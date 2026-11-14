import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = dirname(projectRoot);
const schemaPath = join(projectRoot, 'prisma', 'schema.prisma');
const contractPath = join(repoRoot, 'docs', 'engineering', 'phase-1', 'p1-02-a-field-contract.md');

const EXPECTED_MODEL_COUNT = 21;
const EXPECTED_PHYSICAL_FIELDS = 202;
const EXPECTED_RELATION_FIELDS = 92;
const EXPECTED_DELETED_FIELDS = 22;
const EXPECTED_FOREIGN_KEYS = 46;
const EXPECTED_ENUMS = 17;
const EXPECTED_SELF_TESTS = 17;
const EXPECTED_COMPOSITE_UNIQUES = 11;
const EXPECTED_FROZEN_COMPOSITE_UNIQUES = 8;

function splitRow(line) {
  if (!line.startsWith('|') || !line.endsWith('|')) return null;
  return line
    .split('|')
    .map((cell) => cell.trim())
    .slice(1, -1);
}

function unquote(value) {
  return value.replaceAll('`', '');
}

function between(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`Markdown section missing: ${startMarker}`);
  return text.slice(start + startMarker.length, end);
}

function parseContract(markdown) {
  const modelSection = between(markdown, '## 3. 模型与数据库表映射', '## 4. 逐模型字段契约');
  const fieldSection = between(markdown, '## 4. 逐模型字段契约', '## 5. 唯一约束');
  const enumSection = between(markdown, '### 枚举契约', '## 3. 模型与数据库表映射');
  const uniqueSection = between(
    markdown,
    '### 5.1 冻结的 8 组唯一约束',
    '### 5.2 其他保留唯一约束',
  );
  const indexSection = between(markdown, '### 5.3 普通索引最终清单', '## 6. 外键与删除策略');
  const fkSection = between(markdown, '## 6. 外键与删除策略', '## 7. 特殊业务规则');

  const models = new Map();
  for (const line of modelSection.split(/\r?\n/)) {
    const row = splitRow(line);
    if (!row || row[0] === '模型' || row[0].startsWith('---')) continue;
    const model = unquote(row[0]);
    models.set(model, {
      table: unquote(row[1]),
      physicalCount: Number(row[2]),
      relationCount: Number(row[3]),
      fields: [],
    });
  }

  let currentModel = null;
  for (const line of fieldSection.split(/\r?\n/)) {
    const heading = line.match(/^###\s+(\w+)$/);
    if (heading) {
      currentModel = heading[1];
      continue;
    }
    if (!currentModel || !line.startsWith('| `')) continue;
    const row = splitRow(line);
    if (!row || row.length !== 11)
      throw new Error(`Contract field row has ${row?.length ?? 0} columns: ${line}`);
    models.get(currentModel).fields.push({
      field: unquote(row[0]),
      status: row[1].replaceAll('*', ''),
      prismaType: unquote(row[2]),
      mysqlType: row[3],
      nullable: row[4],
      defaultRule: row[5],
      column: unquote(row[6]),
      keys: row[7],
      foreignKey: row[8],
    });
  }

  const enums = new Map();
  for (const line of enumSection.split(/\r?\n/)) {
    const row = splitRow(line);
    if (!row || row[0] === '枚举' || row[0].startsWith('---')) continue;
    if (row[2] !== '已冻结') throw new Error(`Contract enum is not frozen: ${row[0]} (${row[2]})`);
    enums.set(
      unquote(row[0]),
      row[1].split(',').map((value) => value.trim()),
    );
  }

  const compositeUniques = new Map();
  let compositeUniqueRows = 0;
  for (const line of uniqueSection.split(/\r?\n/)) {
    const row = splitRow(line);
    if (!row || row[0] === '模型' || row[0].startsWith('---')) continue;
    const model = unquote(row[0]);
    if (!compositeUniques.has(model)) compositeUniques.set(model, []);
    compositeUniques.get(model).push(
      unquote(row[1])
        .split(',')
        .map((value) => value.trim()),
    );
    compositeUniqueRows++;
  }

  for (const match of markdown.matchAll(/^- `(\w+)\[([^\]]+)\]`$/gm)) {
    const model = match[1];
    if (!compositeUniques.has(model)) compositeUniques.set(model, []);
    compositeUniques.get(model).push(match[2].split(',').map((value) => value.trim()));
  }

  const indexes = new Map();
  for (const line of indexSection.split(/\r?\n/)) {
    const row = splitRow(line);
    if (!row || row[0] === '模型' || row[0].startsWith('---')) continue;
    const model = unquote(row[0]);
    const values =
      row[1] === '无'
        ? []
        : [...row[1].matchAll(/`([^`]+)`/g)].map((match) =>
            match[1].split(/\s*\+\s*/).map((value) => value.trim()),
          );
    indexes.set(model, values);
  }

  const foreignKeys = new Map();
  for (const line of fkSection.split(/\r?\n/)) {
    const row = splitRow(line);
    if (!row || row[0] === '关系字段' || row[0].startsWith('---')) continue;
    foreignKeys.set(unquote(row[0]), {
      column: unquote(row[1]),
      target: unquote(row[2]),
      cardinality: row[3],
      onDelete: row[4],
    });
  }

  const fieldUniques = new Set();
  for (const [model, entry] of models) {
    for (const field of entry.fields) {
      for (const match of field.keys.matchAll(/UQ\(([^)]+)\)/g)) {
        if (!match[1].includes(',') && !match[1].includes(';'))
          fieldUniques.add(`${model}.${field.field}`);
      }
    }
  }

  return {
    models,
    enums,
    compositeUniques,
    compositeUniqueRows,
    indexes,
    foreignKeys,
    fieldUniques,
  };
}

function extractDefault(attrs) {
  const marker = attrs.indexOf('@default(');
  if (marker < 0) return null;
  let depth = 0;
  for (let index = marker + '@default('.length - 1; index < attrs.length; index++) {
    if (attrs[index] === '(') depth++;
    if (attrs[index] === ')') {
      depth--;
      if (depth === 0) return attrs.slice(marker + '@default('.length, index);
    }
  }
  throw new Error('Unclosed @default(...)');
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

  const models = new Map();
  for (const match of schema.matchAll(/^model\s+(\w+)\s+\{([\s\S]*?)^\}/gm)) {
    const name = match[1];
    const fields = [];
    const uniques = [];
    const indexes = [];
    let table = null;
    for (const line of match[2].split(/\r?\n/)) {
      const text = line.trim();
      if (!text || text.startsWith('//')) continue;
      if (text.startsWith('@@map(')) {
        table = text.match(/@@map\("([^"]+)"\)/)?.[1] ?? null;
        continue;
      }
      if (text.startsWith('@@unique')) {
        const value = text.match(/@@unique\(\[([^\]]+)\]\)/)?.[1];
        if (value) uniques.push(value.split(',').map((item) => item.trim()));
        continue;
      }
      if (text.startsWith('@@index')) {
        const value = text.match(/@@index\(\[([^\]]+)\]\)/)?.[1];
        if (value) indexes.push(value.split(',').map((item) => item.trim()));
        continue;
      }
      const field = text.match(/^(\w+)\s+(\w+)(\[\])?(\?)?\s*(.*)$/);
      if (!field) throw new Error(`Cannot parse field in ${name}: ${text}`);
      fields.push({
        name: field[1],
        baseType: field[2],
        type: `${field[2]}${field[3] ?? ''}${field[4] ?? ''}`,
        optional: Boolean(field[4]),
        list: Boolean(field[3]),
        attrs: field[5].replace(/\s+/g, ' ').trim(),
      });
    }
    models.set(name, { name, table, fields, uniques, indexes });
  }

  return { models, enums };
}

function mysqlType(field, enums) {
  const type = field.baseType;
  if (enums.has(type))
    return `ENUM(${enums
      .get(type)
      .map((value) => `'${value}'`)
      .join(', ')})`;
  if (type === 'BigInt') return 'BIGINT';
  if (type === 'Int') return 'INT';
  if (type === 'Boolean') return 'TINYINT(1)';
  if (type === 'DateTime') return 'DATETIME(3)';
  if (type === 'Decimal') {
    const value = field.attrs.match(/@db\.Decimal\((\d+),\s*(\d+)\)/);
    return value ? `DECIMAL(${value[1]},${value[2]})` : null;
  }
  if (type === 'String') {
    const varchar = field.attrs.match(/@db\.VarChar\((\d+)\)/);
    if (varchar) return `VARCHAR(${varchar[1]})`;
    if (field.attrs.includes('@db.Text')) return 'TEXT';
  }
  return null;
}

function expectedDefault(field) {
  if (field.defaultRule.startsWith('—')) return null;
  if (field.defaultRule.includes('AUTO_INCREMENT')) return 'autoincrement()';
  if (field.defaultRule.includes('CURRENT_TIMESTAMP')) return 'now()';
  if (field.defaultRule.includes('Prisma Client 维护')) return '@updatedAt';
  if (field.defaultRule === '1（T4）') return '1';
  if (field.defaultRule === '0（最终）') return '0';
  if (field.defaultRule === '"Asia/Shanghai"（最终）') return '"Asia/Shanghai"';
  throw new Error(`Unsupported contract default rule: ${field.defaultRule}`);
}

function compareSets(errors, label, expected, actual) {
  const expectedValues = [...expected].map((value) => JSON.stringify(value)).sort();
  const actualValues = [...actual].map((value) => JSON.stringify(value)).sort();
  if (JSON.stringify(expectedValues) !== JSON.stringify(actualValues)) {
    errors.push(
      `${label} mismatch: expected ${expectedValues.join(', ') || '(none)'}, got ${actualValues.join(', ') || '(none)'}`,
    );
  }
}

export function validateContract(schema, markdown) {
  const errors = [];
  try {
    const expected = parseContract(markdown);
    const actual = parseSchema(schema);
    const expectedModels = [...expected.models.keys()].sort();
    const actualModels = [...actual.models.keys()].sort();
    compareSets(errors, 'models', expectedModels, actualModels);

    const expectedPhysical = [...expected.models.values()]
      .filter((entry) => entry)
      .flatMap((entry) => entry.fields.filter((field) => field.status === '保留')).length;
    const expectedDeleted = [...expected.models.values()].flatMap((entry) =>
      entry.fields.filter((field) => field.status === '删除'),
    ).length;
    const expectedRelations = [...expected.models.values()].reduce(
      (sum, entry) => sum + entry.relationCount,
      0,
    );
    if (expected.models.size !== EXPECTED_MODEL_COUNT)
      errors.push(`contract model count ${expected.models.size}`);
    if (expectedPhysical !== EXPECTED_PHYSICAL_FIELDS)
      errors.push(`contract physical count ${expectedPhysical}`);
    if (expectedDeleted !== EXPECTED_DELETED_FIELDS)
      errors.push(`contract deleted count ${expectedDeleted}`);
    if (expectedRelations !== EXPECTED_RELATION_FIELDS)
      errors.push(`contract relation count ${expectedRelations}`);
    if (expected.enums.size !== EXPECTED_ENUMS)
      errors.push(`contract enum count ${expected.enums.size}`);
    if (expected.compositeUniqueRows !== EXPECTED_FROZEN_COMPOSITE_UNIQUES)
      errors.push(`contract frozen composite unique count ${expected.compositeUniqueRows}`);
    if ([...expected.compositeUniques.values()].flat().length !== EXPECTED_COMPOSITE_UNIQUES)
      errors.push(
        `contract total composite unique count ${[...expected.compositeUniques.values()].flat().length}`,
      );

    const modelSet = new Set(expectedModels);
    let actualPhysical = 0;
    let actualRelations = 0;
    const actualFieldUniques = new Set();

    for (const [modelName, expectedModel] of expected.models) {
      const actualModel = actual.models.get(modelName);
      if (!actualModel) continue;
      if (actualModel.table !== expectedModel.table)
        errors.push(`table map ${modelName}: ${actualModel.table} != ${expectedModel.table}`);
      const physical = actualModel.fields.filter((field) => !modelSet.has(field.baseType));
      const relations = actualModel.fields.filter((field) => modelSet.has(field.baseType));
      actualPhysical += physical.length;
      actualRelations += relations.length;
      const keptCount = expectedModel.fields.filter((field) => field.status === '保留').length;
      if (expectedModel.fields.length !== expectedModel.physicalCount)
        errors.push(
          `contract current physical count ${modelName}: ${expectedModel.fields.length} != ${expectedModel.physicalCount}`,
        );
      if (physical.length !== keptCount)
        errors.push(`target physical count ${modelName}: ${physical.length} != ${keptCount}`);
      if (relations.length !== expectedModel.relationCount)
        errors.push(
          `relation count ${modelName}: ${relations.length} != ${expectedModel.relationCount}`,
        );

      const expectedKept = expectedModel.fields.filter((field) => field.status === '保留');
      const expectedDeleted = expectedModel.fields.filter((field) => field.status === '删除');
      compareSets(
        errors,
        `${modelName} physical fields`,
        physical.map((field) => field.name),
        expectedKept.map((field) => field.field),
      );
      for (const field of expectedDeleted)
        if (actualModel.fields.some((actual) => actual.name === field.field))
          errors.push(`deleted field exists ${modelName}.${field.field}`);

      for (const expectedField of expectedKept) {
        const actualField = physical.find((field) => field.name === expectedField.field);
        if (!actualField) continue;
        if (actualField.type !== expectedField.prismaType)
          errors.push(
            `type ${modelName}.${expectedField.field}: ${actualField.type} != ${expectedField.prismaType}`,
          );
        const actualNullable = actualField.optional;
        const expectedNullable = expectedField.nullable.startsWith('YES');
        if (actualNullable !== expectedNullable)
          errors.push(
            `nullability ${modelName}.${expectedField.field}: ${actualNullable} != ${expectedNullable}`,
          );
        const actualMap = actualField.attrs.match(/@map\("([^"]+)"\)/)?.[1];
        if (actualMap !== expectedField.column)
          errors.push(
            `@map ${modelName}.${expectedField.field}: ${actualMap} != ${expectedField.column}`,
          );
        const actualMysql = mysqlType(actualField, actual.enums);
        if (actualMysql !== expectedField.mysqlType)
          errors.push(
            `mysql type ${modelName}.${expectedField.field}: ${actualMysql} != ${expectedField.mysqlType}`,
          );
        if (actualField.baseType === 'DateTime' && !actualField.attrs.includes('@db.DateTime(3)'))
          errors.push(`datetime(3) ${modelName}.${expectedField.field}`);
        const defaultValue = extractDefault(actualField.attrs);
        const defaultExpected = expectedDefault(expectedField);
        const expectsPrimaryKey = expectedField.keys.includes('PK');
        const actualPrimaryKey = actualField.attrs.includes('@id');
        if (expectsPrimaryKey !== actualPrimaryKey)
          errors.push(
            `primary key ${modelName}.${expectedField.field}: ${actualPrimaryKey} != ${expectsPrimaryKey}`,
          );
        if (defaultExpected === '@updatedAt') {
          if (!actualField.attrs.includes('@updatedAt'))
            errors.push(`@updatedAt missing ${modelName}.${expectedField.field}`);
          if (defaultValue !== null)
            errors.push(`unexpected @default ${modelName}.${expectedField.field}`);
        } else {
          if (actualField.attrs.includes('@updatedAt'))
            errors.push(`unexpected @updatedAt ${modelName}.${expectedField.field}`);
          if (defaultValue !== defaultExpected)
            errors.push(
              `default ${modelName}.${expectedField.field}: ${defaultValue} != ${defaultExpected}`,
            );
        }
        if (actualField.attrs.includes('@unique'))
          actualFieldUniques.add(`${modelName}.${actualField.name}`);
      }

      const expectedUniqueGroups = expected.compositeUniques.get(modelName) ?? [];
      compareSets(
        errors,
        `${modelName} model unique`,
        expectedUniqueGroups.map((cols) => cols.join(',')),
        actualModel.uniques.map((cols) => cols.join(',')),
      );
      compareSets(
        errors,
        `${modelName} indexes`,
        (expected.indexes.get(modelName) ?? []).map((cols) => cols.join(',')),
        actualModel.indexes.map((cols) => cols.join(',')),
      );
    }

    if (actualPhysical !== EXPECTED_PHYSICAL_FIELDS)
      errors.push(`actual physical count ${actualPhysical}`);
    if (actualRelations !== EXPECTED_RELATION_FIELDS)
      errors.push(`actual relation count ${actualRelations}`);
    if (actual.enums.size !== EXPECTED_ENUMS) errors.push(`actual enum count ${actual.enums.size}`);
    compareSets(errors, 'enums', [...expected.enums.keys()], [...actual.enums.keys()]);
    for (const [name, values] of expected.enums)
      compareSets(errors, `enum ${name}`, values, actual.enums.get(name) ?? []);
    compareSets(errors, 'field uniques', expected.fieldUniques, actualFieldUniques);

    const actualFks = new Map();
    for (const [modelName, model] of actual.models) {
      for (const field of model.fields) {
        if (!field.attrs.includes('@relation') || !field.attrs.includes('fields:')) continue;
        const targetModel = field.baseType;
        const columns =
          field.attrs
            .match(/fields:\s*\[([^\]]+)\]/)?.[1]
            .split(',')
            .map((value) => value.trim()) ?? [];
        const references =
          field.attrs
            .match(/references:\s*\[([^\]]+)\]/)?.[1]
            .split(',')
            .map((value) => value.trim()) ?? [];
        const targetTable = actual.models.get(targetModel)?.table;
        const onDelete = field.attrs.match(/onDelete:\s*(\w+)/)?.[1] ?? null;
        const quoteColumn = (name) => name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
        actualFks.set(`${modelName}.${field.name}`, {
          column: columns.map(quoteColumn).join(', '),
          target: `${targetTable}.${references.map(quoteColumn).join(', ')}`,
          cardinality: field.optional ? '0..1' : '1',
          onDelete,
        });
        if (onDelete !== 'Restrict')
          errors.push(`foreign key delete ${modelName}.${field.name}: ${onDelete}`);
      }
    }
    if (actualFks.size !== EXPECTED_FOREIGN_KEYS)
      errors.push(`actual foreign key count ${actualFks.size}`);
    if (expected.foreignKeys.size !== EXPECTED_FOREIGN_KEYS)
      errors.push(`contract foreign key count ${expected.foreignKeys.size}`);
    compareSets(errors, 'foreign keys', [...expected.foreignKeys.keys()], [...actualFks.keys()]);
    for (const [name, expectedFk] of expected.foreignKeys) {
      const actualFk = actualFks.get(name);
      if (!actualFk) continue;
      for (const key of ['column', 'target', 'cardinality', 'onDelete'])
        if (actualFk[key] !== expectedFk[key])
          errors.push(`foreign key ${name}.${key}: ${actualFk[key]} != ${expectedFk[key]}`);
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  return errors;
}

function replaceModelBlock(schema, model, mutate) {
  const pattern = new RegExp(`model ${model} \\{[\\s\\S]*?\\n\\}`);
  return schema.replace(pattern, (block) => mutate(block));
}

function runSelfTests(schema, markdown) {
  const cases = [
    [
      'extra model',
      schema.replace('model Store {', 'model Unexpected {\n  id Int @id\n}\n\nmodel Store {'),
    ],
    [
      'extra field',
      replaceModelBlock(schema, 'Store', (block) =>
        block.replace('  createdAt', '  unexpected String @map("unexpected")\n  createdAt'),
      ),
    ],
    [
      'missing field',
      replaceModelBlock(schema, 'Store', (block) => block.replace(/^ {2}name\s+.*\n/m, '')),
    ],
    [
      'type drift',
      replaceModelBlock(schema, 'ProductVariant', (block) =>
        block.replace(/^ {2}priceFen\s+BigInt/m, '  priceFen Int'),
      ),
    ],
    [
      'nullability drift',
      replaceModelBlock(schema, 'User', (block) =>
        block.replace(/^ {2}openid\s+String/m, '  openid String?'),
      ),
    ],
    [
      'default drift',
      replaceModelBlock(schema, 'Material', (block) =>
        block.replace(/^ {2}status\s+CommonStatus/m, '  status CommonStatus @default(ACTIVE)'),
      ),
    ],
    [
      'map drift',
      replaceModelBlock(schema, 'Staff', (block) => block.replace(' @map("store_id")', '')),
    ],
    [
      'table map drift',
      replaceModelBlock(schema, 'User', (block) => block.replace('  @@map("users")\n', '')),
    ],
    [
      'unique drift',
      replaceModelBlock(schema, 'Category', (block) =>
        block.replace('  @@unique([storeId, name])\n', ''),
      ),
    ],
    [
      'index drift',
      replaceModelBlock(schema, 'Product', (block) =>
        block.replace('  @@index([categoryId, status, sortOrder])\n', ''),
      ),
    ],
    [
      'field unique drift',
      replaceModelBlock(schema, 'User', (block) => block.replace(' @unique', '')),
    ],
    [
      'updatedAt drift',
      replaceModelBlock(schema, 'Store', (block) => block.replace(' @updatedAt', '')),
    ],
    [
      'foreign key target drift',
      replaceModelBlock(schema, 'Staff', (block) =>
        block.replace('references: [id]', 'references: [name]'),
      ),
    ],
    [
      'foreign key delete drift',
      replaceModelBlock(schema, 'Staff', (block) =>
        block.replace('onDelete: Restrict', 'onDelete: Cascade'),
      ),
    ],
    ['enum drift', schema.replace('  SUSPENDED\n', '')],
    [
      'deleted field reintroduced',
      replaceModelBlock(schema, 'Order', (block) =>
        block.replace('  subtotalFen', '  discountFen BigInt @map("discount_fen")\n  subtotalFen'),
      ),
    ],
    [
      'relation count drift',
      replaceModelBlock(schema, 'User', (block) => block.replace('  orders    Order[]\n', '')),
    ],
  ];
  const failures = [];
  for (const [label, mutated] of cases) {
    const errors = validateContract(mutated, markdown);
    if (errors.length === 0) failures.push(`self-test did not reject: ${label}`);
  }
  return { failures, count: cases.length };
}

const schema = readFileSync(schemaPath, 'utf8');
const contract = readFileSync(contractPath, 'utf8');
const errors = validateContract(schema, contract);
const selfTests = runSelfTests(schema, contract);
errors.push(...selfTests.failures);
if (selfTests.count !== EXPECTED_SELF_TESTS)
  errors.push(`self-test count ${selfTests.count} != ${EXPECTED_SELF_TESTS}`);

if (errors.length) {
  console.error('FAIL: schema contract');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `PASS: contract + ${selfTests.count} self-tests (21 models, 202 physical fields, 92 relations, 22 deletions, 8 composite uniques, 46 foreign keys, 17 enums)`,
);
