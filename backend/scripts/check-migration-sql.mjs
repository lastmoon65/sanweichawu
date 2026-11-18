import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const migrationsDir = join(projectRoot, 'prisma', 'migrations');
const schemaPath = join(projectRoot, 'prisma', 'schema.prisma');
const initialDir = '20261114120000_initial_schema';
const constraintsDir = '20261114120100_domain_constraints';
const credentialsDir = '20261117120000_staff_credentials';
const bootstrapLockDir = '20261117173000_bootstrap_owner_lock';

const EXPECTED_TABLES = 22;
const EXPECTED_COLUMNS = 210;
const EXPECTED_FOREIGN_KEYS = 47;
const EXPECTED_UNIQUE_INDEXES = 23;
const EXPECTED_INDEXES = 24;
const EXPECTED_CHECK_COUNT = 22;
const EXPECTED_SELF_TESTS = 22;

const EXPECTED_CHECKS = {
  chk_stores_business_day_cutoff_minute: {
    table: 'stores',
    expression: '(`business_day_cutoff_minute`BETWEEN0AND1439)',
  },
  chk_product_variants_price_fen_nonnegative: {
    table: 'product_variants',
    expression: '(`price_fen`>=0)',
  },
  chk_variant_recipes_quantity_positive: {
    table: 'variant_recipes',
    expression: '(`quantity`>0)',
  },
  chk_materials_nonnegative_balances: {
    table: 'materials',
    expression:
      '(`on_hand`>=0AND`reserved`>=0AND`average_cost_per_unit`>=0AND`reserved`<=`on_hand`)',
  },
  chk_materials_version_positive: {
    table: 'materials',
    expression: '(`version`>0)',
  },
  chk_stock_movements_balance: {
    table: 'stock_movements',
    expression: '(`on_hand_after`>=0AND`reserved_after`>=0AND`reserved_after`<=`on_hand_after`)',
  },
  chk_stock_movements_direction: {
    table: 'stock_movements',
    expression:
      "((`movement_type`='OPENING_BALANCE'AND`quantity_delta`>=0AND`reserved_delta`=0)OR(`movement_type`='STOCK_IN'AND`quantity_delta`>0AND`reserved_delta`=0)OR(`movement_type`='RESERVE'AND`quantity_delta`=0AND`reserved_delta`>0)OR(`movement_type`='RELEASE'AND`quantity_delta`=0AND`reserved_delta`<0)OR(`movement_type`='CONSUME'AND`quantity_delta`<0AND`reserved_delta`<0AND`quantity_delta`=`reserved_delta`)OR(`movement_type`='ADJUST'AND`quantity_delta`<>0AND`reserved_delta`=0))",
  },
  chk_stock_movements_cost_nonnegative: {
    table: 'stock_movements',
    expression:
      '((`unit_cost_snapshot`ISNULLOR`unit_cost_snapshot`>=0)AND(`total_cost_snapshot`ISNULLOR`total_cost_snapshot`>=0))',
  },
  chk_loss_records_values_nonnegative: {
    table: 'loss_records',
    expression: '(`quantity`>0AND`unit_cost_snapshot`>=0AND`loss_cost_snapshot`>=0)',
  },
  chk_dining_sessions_version_positive: {
    table: 'dining_sessions',
    expression: '(`version`>0)',
  },
  chk_dining_sessions_closed_fields: {
    table: 'dining_sessions',
    expression:
      "((`status`='OPEN'AND`closed_at`ISNULLAND`closed_by_staff_id`ISNULL)OR(`status`='CLOSED'AND`closed_at`ISNOTNULL))",
  },
  chk_orders_version_positive: {
    table: 'orders',
    expression: '(`version`>0)',
  },
  chk_orders_amounts: {
    table: 'orders',
    expression: '(`subtotal_fen`>=0AND`total_amount_fen`>=0AND`total_amount_fen`=`subtotal_fen`)',
  },
  chk_orders_channel_session: {
    table: 'orders',
    expression:
      "((`channel`='DINE'AND`session_id`ISNOTNULL)OR(`channel`='TAKEAWAY'AND`session_id`ISNULL))",
  },
  chk_order_items_values: {
    table: 'order_items',
    expression:
      '(`quantity`>0AND`unit_price_fen`>=0AND`line_subtotal_fen`=`unit_price_fen`*`quantity`)',
  },
  chk_order_item_materials_quantities: {
    table: 'order_item_materials',
    expression: '(`quantity_per_item`>=0AND`total_quantity`>=0)',
  },
  chk_order_item_materials_cost_pair: {
    table: 'order_item_materials',
    expression:
      '((`actual_unit_cost_snapshot`ISNULLAND`actual_total_cost_snapshot`ISNULL)OR(`actual_unit_cost_snapshot`ISNOTNULLAND`actual_unit_cost_snapshot`>=0AND`actual_total_cost_snapshot`ISNOTNULLAND`actual_total_cost_snapshot`>=0))',
  },
  chk_payment_records_target_xor: {
    table: 'payment_records',
    expression: '((`session_id`ISNULL)<>(`order_id`ISNULL))',
  },
  chk_payment_records_amount_positive: {
    table: 'payment_records',
    expression: '(`amount_fen`>0)',
  },
  chk_payment_records_void_audit: {
    table: 'payment_records',
    expression:
      "((`status`='ACTIVE'AND`voided_at`ISNULLAND`voided_by_staff_id`ISNULLAND`void_reason`ISNULL)OR(`status`='VOIDED'AND`voided_at`ISNOTNULLAND`voided_by_staff_id`ISNOTNULLAND`void_reason`ISNOTNULL))",
  },
  chk_refund_records_amount_positive: {
    table: 'refund_records',
    expression: '(`amount_fen`>0)',
  },
  chk_refund_records_void_audit: {
    table: 'refund_records',
    expression:
      "((`status`='ACTIVE'AND`voided_at`ISNULLAND`voided_by_staff_id`ISNULLAND`void_reason`ISNULL)OR(`status`='VOIDED'AND`voided_at`ISNOTNULLAND`voided_by_staff_id`ISNOTNULLAND`void_reason`ISNOTNULL))",
  },
};

const EXPECTED_FK_UPDATE_OVERRIDES = {
  dining_sessions_closed_by_staff_id_fkey: {
    table: 'dining_sessions',
    column: 'closed_by_staff_id',
    targetTable: 'staff',
    targetColumn: 'id',
  },
  orders_session_id_fkey: {
    table: 'orders',
    column: 'session_id',
    targetTable: 'dining_sessions',
    targetColumn: 'id',
  },
  payment_records_session_id_fkey: {
    table: 'payment_records',
    column: 'session_id',
    targetTable: 'dining_sessions',
    targetColumn: 'id',
  },
  payment_records_order_id_fkey: {
    table: 'payment_records',
    column: 'order_id',
    targetTable: 'orders',
    targetColumn: 'id',
  },
  payment_records_voided_by_staff_id_fkey: {
    table: 'payment_records',
    column: 'voided_by_staff_id',
    targetTable: 'staff',
    targetColumn: 'id',
  },
  refund_records_voided_by_staff_id_fkey: {
    table: 'refund_records',
    column: 'voided_by_staff_id',
    targetTable: 'staff',
    targetColumn: 'id',
  },
};

function normalizeCheckExpression(expression) {
  let normalized = expression.replace(/\s+/g, '');
  while (normalized.startsWith('(') && normalized.endsWith(')')) {
    let depth = 0;
    let enclosesWholeExpression = true;
    for (let index = 0; index < normalized.length; index += 1) {
      if (normalized[index] === '(') depth += 1;
      if (normalized[index] === ')') depth -= 1;
      if (depth === 0 && index < normalized.length - 1) {
        enclosesWholeExpression = false;
        break;
      }
    }
    if (!enclosesWholeExpression) break;
    normalized = normalized.slice(1, -1);
  }
  return normalized;
}
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
    [...schemaInfo.models.values()]
      .filter((model) => model.table !== 'bootstrap_locks')
      .map((model) => [model.table, model]),
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
    /\bDROP\s+(?:TABLE|DATABASE|INDEX|COLUMN|CHECK)\b/i,
    /\bTRUNCATE\b/i,
    /\bINSERT\b/i,
    /\bUPDATE\s+\S+\s+SET\b/i,
    /\bDELETE\s+FROM\b/i,
    /\bGENERATED\s+ALWAYS\b/i,
  ]) {
    if (forbidden.test(clean)) {
      errors.push(`constraint migration contains forbidden operation ${forbidden}`);
    }
  }

  const statements = clean
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);
  const constraints = [];
  const fkDrops = [];
  const fkAdds = [];
  let firstCheckIndex = Number.POSITIVE_INFINITY;
  let lastForeignKeyChangeIndex = -1;

  for (const [statementIndex, statement] of statements.entries()) {
    const drop = statement.match(/^ALTER TABLE `([^`]+)`\s+DROP FOREIGN KEY `([^`]+)`$/);
    if (drop) {
      fkDrops.push({ table: drop[1], name: drop[2], statementIndex });
      lastForeignKeyChangeIndex = statementIndex;
      continue;
    }

    const add = statement.match(
      /^ALTER TABLE `([^`]+)`\s+ADD CONSTRAINT `([^`]+)`\s+FOREIGN KEY \(`([^`]+)`\)\s+REFERENCES `([^`]+)`\(`([^`]+)`\)\s+ON DELETE (\w+)\s+ON UPDATE (\w+)$/,
    );
    if (add) {
      fkAdds.push({
        table: add[1],
        name: add[2],
        column: add[3],
        targetTable: add[4],
        targetColumn: add[5],
        onDelete: add[6],
        onUpdate: add[7],
        statementIndex,
      });
      lastForeignKeyChangeIndex = statementIndex;
      continue;
    }

    const check = statement.match(
      /^ALTER TABLE `([^`]+)`\s+ADD CONSTRAINT `([^`]+)`\s+CHECK\s*\(([\s\S]*)\)$/,
    );
    if (check) {
      constraints.push({
        table: check[1],
        name: check[2],
        expression: normalizeCheckExpression(check[3]),
      });
      firstCheckIndex = Math.min(firstCheckIndex, statementIndex);
      continue;
    }

    errors.push(`unexpected statement: ${statement.slice(0, 100)}`);
  }

  if (constraints.length !== EXPECTED_CHECK_COUNT) {
    errors.push(`check count ${constraints.length}`);
  }
  const expectedForeignKeyNames = Object.keys(EXPECTED_FK_UPDATE_OVERRIDES);
  if (fkDrops.length !== expectedForeignKeyNames.length) {
    errors.push(`foreign key drop count ${fkDrops.length}`);
  }
  if (fkAdds.length !== expectedForeignKeyNames.length) {
    errors.push(`foreign key add count ${fkAdds.length}`);
  }
  if (lastForeignKeyChangeIndex >= firstCheckIndex) {
    errors.push('all foreign key DROP/ADD statements must precede every CHECK');
  }

  const actual = new Map();
  for (const constraint of constraints) {
    if (actual.has(constraint.name)) {
      errors.push(`duplicate check ${constraint.name}`);
      continue;
    }
    actual.set(constraint.name, constraint);

    const expected = EXPECTED_CHECKS[constraint.name];
    if (!expected) {
      errors.push(`unexpected check ${constraint.name} on ${constraint.table}`);
      continue;
    }
    if (expected.table !== constraint.table) {
      errors.push(
        `check table mismatch ${constraint.name}: ${constraint.table} != ${expected.table}`,
      );
    }
    const expectedExpression = normalizeCheckExpression(expected.expression);
    if (expectedExpression !== constraint.expression) {
      errors.push(
        `check expression mismatch ${constraint.name}: ${constraint.expression} != ${expectedExpression}`,
      );
    }
  }

  for (const name of Object.keys(EXPECTED_CHECKS)) {
    if (!actual.has(name)) errors.push(`missing check ${name}`);
  }

  for (const name of expectedForeignKeyNames) {
    const expected = EXPECTED_FK_UPDATE_OVERRIDES[name];
    const drops = fkDrops.filter((entry) => entry.name === name);
    const adds = fkAdds.filter((entry) => entry.name === name);
    if (drops.length !== 1) errors.push(`foreign key ${name} drop count ${drops.length}`);
    if (adds.length !== 1) errors.push(`foreign key ${name} add count ${adds.length}`);
    if (drops.length === 1 && drops[0].table !== expected.table) {
      errors.push(`foreign key ${name} drop table: ${drops[0].table} != ${expected.table}`);
    }
    if (adds.length === 1) {
      const add = adds[0];
      for (const key of ['table', 'column', 'targetTable', 'targetColumn']) {
        if (add[key] !== expected[key]) {
          errors.push(`foreign key ${name} add.${key}: ${add[key]} != ${expected[key]}`);
        }
      }
      if (add.onDelete !== 'RESTRICT') {
        errors.push(`foreign key ${name} add.onDelete: ${add.onDelete}`);
      }
      if (add.onUpdate !== 'RESTRICT') {
        errors.push(`foreign key ${name} add.onUpdate: ${add.onUpdate}`);
      }
    }
    if (
      drops.length === 1 &&
      adds.length === 1 &&
      drops[0].statementIndex >= adds[0].statementIndex
    ) {
      errors.push(`foreign key ${name} DROP must precede ADD`);
    }
  }

  for (const entry of [...fkDrops, ...fkAdds]) {
    if (!expectedForeignKeyNames.includes(entry.name)) {
      errors.push(`unexpected foreign key change ${entry.name}`);
    }
  }

  const open = (clean.match(/\(/g) ?? []).length;
  const close = (clean.match(/\)/g) ?? []).length;
  if (open !== close) errors.push(`unbalanced parentheses ${open} != ${close}`);

  return { errors, constraints, fkDrops, fkAdds };
}
function expectedFinalForeignKeys(schemaInfo) {
  const expected = [];
  for (const model of schemaInfo.models.values()) {
    for (const field of model.fields) {
      if (!field.attrs.includes('@relation') || !field.attrs.includes('fields:')) continue;
      const targetModel = schemaInfo.models.get(field.baseType);
      const sourceField = field.attrs
        .match(/fields:\s*\[([^\]]+)\]/)[1]
        .split(',')[0]
        .trim();
      const targetField = field.attrs
        .match(/references:\s*\[([^\]]+)\]/)[1]
        .split(',')[0]
        .trim();
      const sourceColumn = mappedColumn(model, sourceField);
      const targetColumn = mappedColumn(targetModel, targetField);
      const onDelete = field.attrs.match(/onDelete:\s*(\w+)/)?.[1] ?? null;
      const onUpdate = field.attrs.match(/onUpdate:\s*(\w+)/)?.[1] ?? 'Cascade';
      expected.push(
        `${model.table}.${sourceColumn}->${targetModel.table}.${targetColumn}:${onDelete.toUpperCase()}:${onUpdate.toUpperCase()}`,
      );
    }
  }
  return expected;
}

function validateBootstrapLockSql(sql) {
  const errors = [];
  const clean = stripComments(sql).trim();
  const statements = clean
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);
  if (statements.length !== 2) {
    errors.push(`bootstrap lock migration statement count ${statements.length} != 2`);
  }

  const create = statements[0]?.match(
    /^CREATE TABLE `([^`]+)` \(([\s\S]*)\) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci$/,
  );
  if (!create) {
    errors.push('bootstrap lock migration must create an InnoDB table');
  } else {
    if (create[1] !== 'bootstrap_locks') errors.push(`bootstrap lock table ${create[1]}`);
    const body = create[2];
    const columns = body
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.startsWith('`'));
    if (columns.length !== 1 || columns[0] !== '`lock_key` VARCHAR(64) NOT NULL,') {
      errors.push('bootstrap lock table must contain only lock_key VARCHAR(64) NOT NULL');
    }
    if (!/PRIMARY KEY \(`lock_key`\)/.test(body)) {
      errors.push('bootstrap lock table primary key mismatch');
    }
  }

  const insert = statements[1];
  if (
    insert !==
    "INSERT INTO `bootstrap_locks` (`lock_key`) VALUES ('first_owner_bootstrap_v1')"
  ) {
    errors.push('bootstrap lock migration must seed exactly one fixed lock row');
  }
  if (
    /\b(?:UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE\s+TRIGGER)\b/i.test(clean) ||
    (clean.match(/\bINSERT\s+INTO\b/gi) ?? []).length !== 1
  ) {
    errors.push('bootstrap lock migration contains an unexpected operation');
  }

  return { errors, lockRowCount: (clean.match(/\bINSERT\s+INTO\b/gi) ?? []).length };
}

function validateMigrationSql(
  schemaText,
  initialSql,
  credentialsSql,
  constraintSql,
  bootstrapLockSql,
) {
  const schemaInfo = parseSchema(schemaText);
  const initial = parseInitialSql(`${initialSql}\n${credentialsSql}`, schemaInfo);
  const constraints = parseConstraintSql(constraintSql);
  const bootstrapLock = validateBootstrapLockSql(bootstrapLockSql);
  const errors = [...initial.errors, ...constraints.errors, ...bootstrapLock.errors];

  const effectiveFks = new Map(initial.foreignKeys.map((entry) => [entry.name, { ...entry }]));
  for (const add of constraints.fkAdds) {
    const current = effectiveFks.get(add.name);
    if (!current) {
      errors.push(`foreign key ADD targets unknown FK ${add.name}`);
      continue;
    }
    for (const key of ['table', 'column', 'targetTable', 'targetColumn', 'onDelete']) {
      if (add[key] !== current[key]) {
        errors.push(`foreign key ADD ${add.name}.${key}: ${add[key]} != ${current[key]}`);
      }
    }
    effectiveFks.set(add.name, {
      ...current,
      onDelete: add.onDelete,
      onUpdate: add.onUpdate,
    });
  }

  const finalFks = [...effectiveFks.values()];
  const restrictUpdates = finalFks.filter((entry) => entry.onUpdate === 'RESTRICT').length;
  const cascadeUpdates = finalFks.filter((entry) => entry.onUpdate === 'CASCADE').length;
  if (finalFks.length !== EXPECTED_FOREIGN_KEYS) {
    errors.push(`final foreign key count ${finalFks.length}`);
  }
  if (restrictUpdates !== Object.keys(EXPECTED_FK_UPDATE_OVERRIDES).length) {
    errors.push(`final Restrict-update foreign key count ${restrictUpdates}`);
  }
  if (cascadeUpdates !== EXPECTED_FOREIGN_KEYS - Object.keys(EXPECTED_FK_UPDATE_OVERRIDES).length) {
    errors.push(`final Cascade-update foreign key count ${cascadeUpdates}`);
  }
  if (finalFks.some((entry) => entry.onDelete !== 'RESTRICT')) {
    errors.push('final foreign key delete rule mismatch');
  }

  const actualFinal = finalFks.map(
    (entry) =>
      `${entry.table}.${entry.column}->${entry.targetTable}.${entry.targetColumn}:${entry.onDelete}:${entry.onUpdate}`,
  );
  const expectedFinal = expectedFinalForeignKeys(schemaInfo);
  if (JSON.stringify([...actualFinal].sort()) !== JSON.stringify([...expectedFinal].sort())) {
    errors.push('final foreign key targets or delete/update rules mismatch');
  }

  return {
    errors,
    initial,
    constraints,
    bootstrapLock,
    final: { foreignKeys: finalFks, restrictUpdates, cascadeUpdates },
  };
}
function runSelfTests(schemaText, initialSql, credentialsSql, constraintSql, bootstrapLockSql) {
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
      label: 'missing foreign key drop',
      initial: initialSql,
      constraints: constraintSql.replace(
        /ALTER TABLE `dining_sessions`\s+DROP FOREIGN KEY `dining_sessions_closed_by_staff_id_fkey`;\r?\n\r?\n/,
        '',
      ),
      expected: /foreign key drop count|foreign key .* drop count/,
    },
    {
      label: 'missing foreign key add',
      initial: initialSql,
      constraints: constraintSql.replace(
        /ALTER TABLE `dining_sessions`\s+ADD CONSTRAINT `dining_sessions_closed_by_staff_id_fkey`\s+FOREIGN KEY[\s\S]*?ON UPDATE RESTRICT;\r?\n\r?\n/,
        '',
      ),
      expected: /foreign key add count|foreign key .* add count/,
    },
    {
      label: 'foreign key add before drop',
      initial: initialSql,
      constraints: constraintSql.replace(
        /(ALTER TABLE `dining_sessions`\s+DROP FOREIGN KEY `dining_sessions_closed_by_staff_id_fkey`;\r?\n\r?\n)(ALTER TABLE `dining_sessions`\s+ADD CONSTRAINT `dining_sessions_closed_by_staff_id_fkey`\s+FOREIGN KEY[\s\S]*?ON UPDATE RESTRICT;\r?\n\r?\n)/,
        '$2$1',
      ),
      expected: /DROP must precede ADD/,
    },
    {
      label: 'unexpected seventh foreign key change',
      initial: initialSql,
      constraints: constraintSql.replace(
        '-- Store configuration',
        'ALTER TABLE `staff` DROP FOREIGN KEY `staff_store_id_fkey`;\n\nALTER TABLE `staff` ADD CONSTRAINT `staff_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;\n\n-- Store configuration',
      ),
      expected: /foreign key drop count|foreign key add count|unexpected foreign key change/,
    },
    {
      label: 'foreign key add field drift',
      initial: initialSql,
      constraints: constraintSql.replace(
        'FOREIGN KEY (`closed_by_staff_id`) REFERENCES `staff`(`id`)',
        'FOREIGN KEY (`store_id`) REFERENCES `staff`(`id`)',
      ),
      expected:
        /foreign key .*add\.column|final foreign key targets or delete\/update rules mismatch/,
    },
    {
      label: 'foreign key add target drift',
      initial: initialSql,
      constraints: constraintSql.replace(
        'FOREIGN KEY (`closed_by_staff_id`) REFERENCES `staff`(`id`)',
        'FOREIGN KEY (`closed_by_staff_id`) REFERENCES `stores`(`id`)',
      ),
      expected:
        /foreign key .*add\.targetTable|final foreign key targets or delete\/update rules mismatch/,
    },
    {
      label: 'foreign key add delete drift',
      initial: initialSql,
      constraints: constraintSql.replace(
        'ON DELETE RESTRICT ON UPDATE RESTRICT;',
        'ON DELETE CASCADE ON UPDATE RESTRICT;',
      ),
      expected: /foreign key .*add\.onDelete|final foreign key delete rule mismatch/,
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
      label: 'deleted original check',
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
      label: 'tampered check expression',
      initial: initialSql,
      constraints: constraintSql.replace('CHECK (`price_fen` >= 0);', 'CHECK (1 = 1);'),
      expected: /check expression mismatch chk_product_variants_price_fen_nonnegative/,
    },
    {
      label: 'unbalanced constraint',
      initial: initialSql,
      constraints: constraintSql.replace('CHECK (`amount_fen` > 0);', 'CHECK (`amount_fen` > 0;'),
      expected: /unbalanced parentheses/,
    },
    {
      label: 'credential password type drift',
      initial: initialSql,
      credentials: credentialsSql.replace('`password_hash` VARCHAR(255)', '`password_hash` TEXT'),
      constraints: constraintSql,
      expected: /type staff_credentials\.password_hash/,
    },
    {
      label: 'missing bootstrap lock seed',
      initial: initialSql,
      credentials: credentialsSql,
      constraints: constraintSql,
      bootstrapLock: bootstrapLockSql.replace(
        /INSERT INTO `bootstrap_locks`[\s\S]*?;/,
        '',
      ),
      expected: /statement count|seed exactly one fixed lock row/,
    },
    {
      label: 'bootstrap lock storage engine drift',
      initial: initialSql,
      credentials: credentialsSql,
      constraints: constraintSql,
      bootstrapLock: bootstrapLockSql.replace('ENGINE=InnoDB', 'ENGINE=MyISAM'),
      expected: /must create an InnoDB table/,
    },
    {
      label: 'second bootstrap lock row',
      initial: initialSql,
      credentials: credentialsSql,
      constraints: constraintSql,
      bootstrapLock: `${bootstrapLockSql}\nINSERT INTO \`bootstrap_locks\` (\`lock_key\`) VALUES ('second_row');\n`,
      expected: /statement count|unexpected operation/,
    },
  ].map((testCase) => ({
    ...testCase,
    credentials: testCase.credentials ?? credentialsSql,
    constraints: testCase.constraints ?? constraintSql,
    bootstrapLock: testCase.bootstrapLock ?? bootstrapLockSql,
  }));

  const failures = [];
  for (const testCase of cases) {
    const errors = validateMigrationSql(
      schemaText,
      testCase.initial,
      testCase.credentials,
      testCase.constraints,
      testCase.bootstrapLock,
    ).errors;
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
const credentialsSql = readFileSync(join(migrationsDir, credentialsDir, 'migration.sql'), 'utf8');
const bootstrapLockSql = readFileSync(
  join(migrationsDir, bootstrapLockDir, 'migration.sql'),
  'utf8',
);
const errors = [];

const expectedDirectories = [
  initialDir,
  constraintsDir,
  credentialsDir,
  bootstrapLockDir,
].sort();
const actualDirectories = readdirSync(migrationsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
if (JSON.stringify(actualDirectories) !== JSON.stringify(expectedDirectories)) {
  errors.push(`migration directories mismatch: ${actualDirectories.join(', ')}`);
}
if (lock !== 'provider = "mysql"') errors.push(`migration lock mismatch: ${lock}`);

const result = validateMigrationSql(
  schema,
  initialSql,
  credentialsSql,
  constraintSql,
  bootstrapLockSql,
);
errors.push(...result.errors);
const selfTests = runSelfTests(
  schema,
  initialSql,
  credentialsSql,
  constraintSql,
  bootstrapLockSql,
);
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
  `PASS: migration SQL contract + ${selfTests.count} self-tests (${result.initial.tables.size} tables, ${result.initial.columns} columns, ${result.initial.uniqueIndexes.length} unique indexes, ${result.initial.indexes.length} ordinary indexes, ${result.initial.foreignKeys.length} initial foreign keys, ${result.constraints.fkDrops.length} FK drops, ${result.constraints.fkAdds.length} FK adds, ${result.final.restrictUpdates} Restrict updates, ${result.final.cascadeUpdates} Cascade updates, ${result.constraints.constraints.length} checks, ${result.bootstrapLock.lockRowCount} bootstrap lock row insert)`,
);
