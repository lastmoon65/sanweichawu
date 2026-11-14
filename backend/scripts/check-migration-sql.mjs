import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const migrationsDir = join(projectRoot, 'prisma', 'migrations');
const schemaPath = join(projectRoot, 'prisma', 'schema.prisma');
const initialDir = '20261114120000_initial_schema';
const constraintsDir = '20261114120100_domain_constraints';

const EXPECTED_TABLES = 21;
const EXPECTED_COLUMNS = 202;
const EXPECTED_FOREIGN_KEYS = 46;
const EXPECTED_UNIQUE_INDEXES = 21;
const EXPECTED_INDEXES = 24;
const EXPECTED_CHECKS = 21;
const EXPECTED_SELF_TESTS = 10;

const EXPECTED_CHECKS_BY_TABLE = {
  stores: ['chk_stores_business_day_cutoff_minute'],
  product_variants: ['chk_product_variants_price_fen_nonnegative'],
  materials: ['chk_materials_nonnegative_balances', 'chk_materials_version_positive'],
  stock_movements: [
    'chk_stock_movements_balance',
    'chk_stock_movements_direction',
    'chk_stock_movements_cost_nonnegative',
  ],
  loss_records: ['chk_loss_records_values_nonnegative'],
  dining_sessions: ['chk_dining_sessions_version_positive', 'chk_dining_sessions_closed_fields'],
  orders: ['chk_orders_version_positive', 'chk_orders_amounts', 'chk_orders_channel_session'],
  order_items: ['chk_order_items_values'],
  order_item_materials: [
    'chk_order_item_materials_quantities',
    'chk_order_item_materials_cost_pair',
  ],
  payment_records: [
    'chk_payment_records_target_xor',
    'chk_payment_records_amount_positive',
    'chk_payment_records_void_audit',
  ],
  refund_records: ['chk_refund_records_amount_positive', 'chk_refund_records_void_audit'],
};

function stripComments(sql) {
  return sql.replace(/^\s*--.*$/gm, '');
}

function normalizeType(type) {
  return type.replace(/\s+/g, '').replace(/^INTEGER/, 'INT');
}

function parseSchema(schema) {
  const enums = new Map();
  for (const match of schema.matchAll(/^enum\s+(\w+)\s+\{([\s\S]*?)^\}/gm)) {
    enums.set(
      match[1],
      match[2]
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean),
    );
  }

  const modelNames = [...schema.matchAll(/^model\s+(\w+)\s+\{/gm)].map((match) => match[1]);
  const modelSet = new Set(modelNames);
  const models = new Map();

  for (const match of schema.matchAll(/^model\s+(\w+)\s+\{([\s\S]*?)^\}/gm)) {
    const fields = [];
    const uniques = [];
    const indexes = [];
    let table = null;

    for (const line of match[2].split(/\r?\n/)) {
      const text = line.trim();
      if (!text || text.startsWith('//')) continue;
      if (text.startsWith('@@map(')) {
        table = text.match(/@@map\("([^"]+)"\)/)?.[1];
        continue;
      }
      if (text.startsWith('@@unique')) {
        uniques.push(
          text
            .match(/\[([^\]]+)\]/)[1]
            .split(',')
            .map((value) => value.trim()),
        );
        continue;
      }
      if (text.startsWith('@@index')) {
        indexes.push(
          text
            .match(/\[([^\]]+)\]/)[1]
            .split(',')
            .map((value) => value.trim()),
        );
        continue;
      }

      const field = text.match(/^(\w+)\s+(\w+)(\[\])?(\?)?\s*(.*)$/);
      if (!field) continue;
      fields.push({
        name: field[1],
        baseType: field[2],
        optional: Boolean(field[4]),
        list: Boolean(field[3]),
        attrs: field[5].replace(/\s+/g, ' ').trim(),
      });
    }

    models.set(match[1], { name: match[1], table, fields, uniques, indexes });
  }

  return { enums, modelSet, models };
}

function sqlType(field, enums) {
  if (enums.has(field.baseType)) {
    return `ENUM(${enums
      .get(field.baseType)
      .map((value) => `'${value}'`)
      .join(',')})`;
  }
  if (field.baseType === 'BigInt') return 'BIGINT';
  if (field.baseType === 'Int') return 'INT';
  if (field.baseType === 'Boolean') return 'BOOLEAN';
  if (field.baseType === 'DateTime') return 'DATETIME(3)';
  if (field.baseType === 'Decimal') {
    const match = field.attrs.match(/@db\.Decimal\((\d+),\s*(\d+)\)/);
    return match ? `DECIMAL(${match[1]},${match[2]})` : null;
  }
  if (field.baseType === 'String') {
    const varchar = field.attrs.match(/@db\.VarChar\((\d+)\)/);
    if (varchar) return `VARCHAR(${varchar[1]})`;
    if (field.attrs.includes('@db.Text')) return 'TEXT';
  }
  return null;
}

function mappedColumn(model, fieldName) {
  const field = model.fields.find((candidate) => candidate.name === fieldName);
  if (!field) return null;
  return field.attrs.match(/@map\("([^"]+)"\)/)?.[1] ?? fieldName;
}

function parseInitialSql(sql, schemaInfo) {
  const errors = [];
  const tables = new Map();
  const uniqueIndexes = [];
  const indexes = [];
  const foreignKeys = [];
  const clean = stripComments(sql);

  for (const forbidden of [
    /\bDROP\b/i,
    /\bTRUNCATE\b/i,
    /\bINSERT\s+INTO\b/i,
    /\bUPDATE\s+\S+\s+SET\b/i,
    /\bDELETE\s+FROM\b/i,
    /\bCREATE\s+TRIGGER\b/i,
    /\bGENERATED\s+ALWAYS\b/i,
  ]) {
    if (forbidden.test(clean)) {
      errors.push(`initial migration contains forbidden operation ${forbidden}`);
    }
  }

  for (const match of sql.matchAll(
    /CREATE TABLE `([^`]+)` \(([\s\S]*?)\n\) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;/g,
  )) {
    const table = match[1];
    const body = match[2];
    const columns = [];

    for (const line of body.split(/\r?\n/)) {
      const field = line.match(/^\s{4}`([^`]+)`\s+([A-Z]+(?:\([^)]*\))?)(.*)$/);
      if (field) {
        columns.push({ name: field[1], type: normalizeType(field[2]), rest: field[3] });
      }

      const unique = line.match(/^\s*UNIQUE INDEX `([^`]+)`\(([^)]+)\)/);
      if (unique) {
        uniqueIndexes.push({
          table,
          name: unique[1],
          columns: unique[2].split(',').map((value) => value.trim().replaceAll('`', '')),
        });
      }

      const index = line.match(/^\s*INDEX `([^`]+)`\(([^)]+)\)/);
      if (index) {
        indexes.push({
          table,
          name: index[1],
          columns: index[2].split(',').map((value) => value.trim().replaceAll('`', '')),
        });
      }
    }

    tables.set(table, columns);
  }

  for (const match of clean.matchAll(
    /ALTER TABLE `([^`]+)` ADD CONSTRAINT `([^`]+)` FOREIGN KEY \(`([^`]+)`\) REFERENCES `([^`]+)`\(`([^`]+)`\) ON DELETE (\w+) ON UPDATE (\w+);/g,
  )) {
    foreignKeys.push({
      table: match[1],
      name: match[2],
      column: match[3],
      targetTable: match[4],
      targetColumn: match[5],
      onDelete: match[6],
      onUpdate: match[7],
    });
  }

  if (tables.size !== EXPECTED_TABLES) errors.push(`initial table count ${tables.size}`);
  if (uniqueIndexes.length !== EXPECTED_UNIQUE_INDEXES) {
    errors.push(`unique index count ${uniqueIndexes.length}`);
  }
  if (indexes.length !== EXPECTED_INDEXES) errors.push(`ordinary index count ${indexes.length}`);
  if (foreignKeys.length !== EXPECTED_FOREIGN_KEYS) {
    errors.push(`foreign key count ${foreignKeys.length}`);
  }

  const expectedTables = new Map(
    [...schemaInfo.models.values()].map((model) => [model.table, model]),
  );
  for (const [table, model] of expectedTables) {
    const columns = tables.get(table);
    if (!columns) {
      errors.push(`missing table ${table}`);
      continue;
    }

    const physical = model.fields.filter((field) => !schemaInfo.modelSet.has(field.baseType));
    if (columns.length !== physical.length) {
      errors.push(`column count ${table}: ${columns.length} != ${physical.length}`);
    }

    const columnMap = new Map(columns.map((column) => [column.name, column]));
    for (const field of physical) {
      const map = field.attrs.match(/@map\("([^"]+)"\)/)?.[1];
      const column = columnMap.get(map);
      if (!column) {
        errors.push(`missing column ${table}.${map}`);
        continue;
      }

      const expectedType = sqlType(field, schemaInfo.enums);
      if (column.type !== expectedType) {
        errors.push(`type ${table}.${map}: ${column.type} != ${expectedType}`);
      }
      const notNull = column.rest.includes('NOT NULL');
      if (notNull === field.optional) errors.push(`nullability ${table}.${map}`);
    }
  }

  const expectedUniques = [];
  for (const model of schemaInfo.models.values()) {
    for (const fields of model.uniques) {
      const columns = fields.map((field) => mappedColumn(model, field));
      expectedUniques.push({ table: model.table, columns });
    }
    for (const field of model.fields) {
      if (schemaInfo.modelSet.has(field.baseType) || !field.attrs.includes('@unique')) continue;
      expectedUniques.push({
        table: model.table,
        columns: [field.attrs.match(/@map\("([^"]+)"\)/)?.[1]],
      });
    }
  }

  const actualUniqueSets = new Set(
    uniqueIndexes.map((entry) => `${entry.table}:${entry.columns.join(',')}`),
  );
  const expectedUniqueSets = new Set(
    expectedUniques.map((entry) => `${entry.table}:${entry.columns.join(',')}`),
  );
  if (
    JSON.stringify([...actualUniqueSets].sort()) !== JSON.stringify([...expectedUniqueSets].sort())
  ) {
    errors.push('unique index columns mismatch');
  }

  const expectedIndexSets = new Set();
  for (const model of schemaInfo.models.values()) {
    for (const fields of model.indexes) {
      const columns = fields.map((field) => mappedColumn(model, field));
      expectedIndexSets.add(`${model.table}:${columns.join(',')}`);
    }
  }
  const actualIndexSets = new Set(
    indexes.map((entry) => `${entry.table}:${entry.columns.join(',')}`),
  );
  if (
    JSON.stringify([...actualIndexSets].sort()) !== JSON.stringify([...expectedIndexSets].sort())
  ) {
    errors.push('ordinary index columns mismatch');
  }

  const expectedFks = [];
  for (const model of schemaInfo.models.values()) {
    for (const field of model.fields) {
      if (!field.attrs.includes('@relation') || !field.attrs.includes('fields:')) continue;
      const targetModel = schemaInfo.models.get(field.baseType);
      const sourceFields = field.attrs
        .match(/fields:\s*\[([^\]]+)\]/)[1]
        .split(',')
        .map((value) => value.trim());
      const targetFields = field.attrs
        .match(/references:\s*\[([^\]]+)\]/)[1]
        .split(',')
        .map((value) => value.trim());
      if (sourceFields.length !== 1 || targetFields.length !== 1) {
        errors.push(`unsupported composite relation ${model.name}.${field.name}`);
        continue;
      }
      const sourceColumn = mappedColumn(model, sourceFields[0]);
      const targetColumn = mappedColumn(targetModel, targetFields[0]);
      expectedFks.push(
        `${model.table}.${sourceColumn}->${targetModel.table}.${targetColumn}:RESTRICT:CASCADE`,
      );
    }
  }

  const actualFks = foreignKeys.map(
    (entry) =>
      `${entry.table}.${entry.column}->${entry.targetTable}.${entry.targetColumn}:${entry.onDelete}:${entry.onUpdate}`,
  );
  if (JSON.stringify([...actualFks].sort()) !== JSON.stringify([...expectedFks].sort())) {
    errors.push('foreign key targets or delete/update rules mismatch');
  }
  if (foreignKeys.some((entry) => entry.onDelete !== 'RESTRICT')) {
    errors.push('non-Restrict delete found');
  }
  if (foreignKeys.some((entry) => entry.onUpdate !== 'CASCADE')) {
    errors.push('non-Cascade update found');
  }

  const columnCount = [...tables.values()].reduce((sum, value) => sum + value.length, 0);
  if (columnCount !== EXPECTED_COLUMNS) errors.push(`initial column count ${columnCount}`);
  return {
    errors,
    tables,
    columns: columnCount,
    uniqueIndexes,
    indexes,
    foreignKeys,
  };
}

function parseConstraintSql(sql) {
  const errors = [];
  const clean = stripComments(sql);
  for (const forbidden of [
    /\bCREATE\s+TRIGGER\b/i,
    /\bDROP\b/i,
    /\bINSERT\b/i,
    /\bUPDATE\s+\S+\s+SET\b/i,
    /\bDELETE\b/i,
    /\bGENERATED\s+ALWAYS\b/i,
  ]) {
    if (forbidden.test(clean)) {
      errors.push(`constraint migration contains forbidden operation ${forbidden}`);
    }
  }

  const constraints = [
    ...clean.matchAll(/ALTER TABLE `([^`]+)`\s+ADD CONSTRAINT `([^`]+)`\s+CHECK\s*\(/g),
  ].map((match) => ({ table: match[1], name: match[2] }));
  if (constraints.length !== EXPECTED_CHECKS) {
    errors.push(`check count ${constraints.length}`);
  }

  const expected = new Map();
  for (const [table, names] of Object.entries(EXPECTED_CHECKS_BY_TABLE)) {
    for (const name of names) expected.set(name, table);
  }

  const actual = new Map();
  for (const constraint of constraints) {
    if (actual.has(constraint.name)) errors.push(`duplicate check ${constraint.name}`);
    actual.set(constraint.name, constraint.table);
    if (expected.get(constraint.name) !== constraint.table) {
      errors.push(`unexpected check ${constraint.name} on ${constraint.table}`);
    }
  }
  for (const name of expected.keys()) {
    if (!actual.has(name)) errors.push(`missing check ${name}`);
  }

  const statements = clean
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);
  for (const statement of statements) {
    if (!/^ALTER TABLE `[^`]+`\s+ADD CONSTRAINT `[^`]+`\s+CHECK\s*\([\s\S]*\)$/.test(statement)) {
      errors.push(`unexpected statement: ${statement.slice(0, 80)}`);
    }
  }

  const open = (clean.match(/\(/g) ?? []).length;
  const close = (clean.match(/\)/g) ?? []).length;
  if (open !== close) errors.push(`unbalanced parentheses ${open} != ${close}`);

  if (constraints.length !== EXPECTED_CHECKS) {
    errors.push(`check count ${constraints.length}`);
  }

  return { errors, constraints };
}

function validateMigrationSql(schemaText, initialSql, constraintSql) {
  const schemaInfo = parseSchema(schemaText);
  const initial = parseInitialSql(initialSql, schemaInfo);
  const constraints = parseConstraintSql(constraintSql);
  return { errors: [...initial.errors, ...constraints.errors], initial, constraints };
}

function runSelfTests(schemaText, initialSql, constraintSql) {
  const cases = [
    {
      label: 'missing table',
      initial: initialSql.replace(
        /-- CreateTable\r?\nCREATE TABLE `stores`[\s\S]*?utf8mb4_unicode_ci;\r?\n\r?\n/,
        '',
      ),
      constraints: constraintSql,
      expected: /missing table stores/,
    },
    {
      label: 'wrong column type',
      initial: initialSql.replace('`price_fen` BIGINT', '`price_fen` INT'),
      constraints: constraintSql,
      expected: /type product_variants\.price_fen: INT != BIGINT/,
    },
    {
      label: 'extra column',
      initial: initialSql.replace(
        /(\r?\n\s+`name` VARCHAR\(120\) NOT NULL,)/,
        '$&\n    `extra` INT NULL,',
      ),
      constraints: constraintSql,
      expected: /column count stores: 8 != 7/,
    },
    {
      label: 'foreign key cascade',
      initial: initialSql.replace('ON DELETE RESTRICT', 'ON DELETE CASCADE'),
      constraints: constraintSql,
      expected: /foreign key targets or delete\/update rules mismatch|non-Restrict delete found/,
    },
    {
      label: 'missing unique index',
      initial: initialSql.replace(/^ {4}UNIQUE INDEX `users_openid_key`\(`openid`\),\r?\n/m, ''),
      constraints: constraintSql,
      expected: /unique index/,
    },
    {
      label: 'missing ordinary index',
      initial: initialSql.replace(
        /^ {4}INDEX `products_category_id_status_sort_order_idx`\(`category_id`, `status`, `sort_order`\),\r?\n/m,
        '',
      ),
      constraints: constraintSql,
      expected: /ordinary index/,
    },
    {
      label: 'trigger introduced',
      initial: `${initialSql}\nCREATE TRIGGER \`bad_trigger\` BEFORE INSERT ON \`users\` FOR EACH ROW SET @x = 1;\n`,
      constraints: constraintSql,
      expected: /forbidden operation .*CREATE\\s\+TRIGGER|forbidden operation/,
    },
    {
      label: 'missing check',
      initial: initialSql,
      constraints: constraintSql.replace(
        /ALTER TABLE `payment_records`\s+ADD CONSTRAINT `chk_payment_records_target_xor`[\s\S]*?;\r?\n\r?\n/,
        '',
      ),
      expected: /check count|missing check chk_payment_records_target_xor/,
    },
    {
      label: 'unexpected DML',
      initial: initialSql,
      constraints: `${constraintSql}\nDELETE FROM \`payment_records\` WHERE \`id\` = 1;\n`,
      expected: /forbidden operation .*DELETE|constraint migration contains forbidden operation/,
    },
    {
      label: 'unbalanced constraint',
      initial: initialSql,
      constraints: constraintSql.replace('CHECK (`amount_fen` > 0);', 'CHECK (`amount_fen` > 0;'),
      expected: /unbalanced parentheses/,
    },
  ].map((testCase) => ({
    ...testCase,
    constraints: testCase.constraints ?? constraintSql,
  }));

  const failures = [];
  for (const testCase of cases) {
    const errors = validateMigrationSql(schemaText, testCase.initial, testCase.constraints).errors;
    if (errors.length === 0) {
      failures.push(`self-test did not reject: ${testCase.label}`);
      continue;
    }
    if (!errors.some((error) => testCase.expected.test(error))) {
      failures.push(
        `self-test rejected for unexpected reason: ${testCase.label} (${errors.join('; ')})`,
      );
    }
  }
  return { failures, count: cases.length };
}

const schema = readFileSync(schemaPath, 'utf8');
const lock = readFileSync(join(migrationsDir, 'migration_lock.toml'), 'utf8').trim();
const initialSql = readFileSync(join(migrationsDir, initialDir, 'migration.sql'), 'utf8');
const constraintSql = readFileSync(join(migrationsDir, constraintsDir, 'migration.sql'), 'utf8');
const errors = [];

const expectedDirectories = [initialDir, constraintsDir].sort();
const actualDirectories = readdirSync(migrationsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
if (JSON.stringify(actualDirectories) !== JSON.stringify(expectedDirectories)) {
  errors.push(`migration directories mismatch: ${actualDirectories.join(', ')}`);
}
if (lock !== 'provider = "mysql"') errors.push(`migration lock mismatch: ${lock}`);

const result = validateMigrationSql(schema, initialSql, constraintSql);
errors.push(...result.errors);
const selfTests = runSelfTests(schema, initialSql, constraintSql);
errors.push(...selfTests.failures);
if (selfTests.count !== EXPECTED_SELF_TESTS) {
  errors.push(`self-test count ${selfTests.count} != ${EXPECTED_SELF_TESTS}`);
}

if (errors.length) {
  console.error('FAIL: migration SQL contract');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `PASS: migration SQL contract + ${selfTests.count} self-tests (${result.initial.tables.size} tables, ${result.initial.columns} columns, ${result.initial.uniqueIndexes.length} unique indexes, ${result.initial.indexes.length} ordinary indexes, ${result.initial.foreignKeys.length} foreign keys, ${result.constraints.constraints.length} checks)`,
);
