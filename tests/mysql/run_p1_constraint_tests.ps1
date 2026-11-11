$ErrorActionPreference = 'Stop'

$mysql = Get-Command mysql -ErrorAction SilentlyContinue
if (-not $mysql) {
  throw 'mysql client not found. Install MySQL 8 client and set MYSQL_HOST/MYSQL_PORT/MYSQL_USER before running.'
}

$db = if ($env:MYSQL_TEST_DATABASE) { $env:MYSQL_TEST_DATABASE } else { 'tea_house_v12_test' }
if ($db -notmatch '^[A-Za-z0-9_]+_test$') {
  throw "Refusing to use non-test database '$db'. Name must end with _test."
}

$hostName = if ($env:MYSQL_HOST) { $env:MYSQL_HOST } else { '127.0.0.1' }
$port = if ($env:MYSQL_PORT) { $env:MYSQL_PORT } else { '3306' }
$user = if ($env:MYSQL_USER) { $env:MYSQL_USER } else { 'root' }
$common = @("--host=$hostName", "--port=$port", "--user=$user", '--protocol=tcp', '--default-character-set=utf8mb4')

function Invoke-MysqlText([string]$sql) {
  $output = $sql | & $mysql.Source @common 2>&1
  if ($LASTEXITCODE -ne 0) { throw "MySQL command failed:`n$($output -join "`n")" }
}

function Invoke-MysqlDatabase([string]$sql) {
  $output = $sql | & $mysql.Source @common "--database=$db" 2>&1
  if ($LASTEXITCODE -ne 0) { throw "MySQL command failed:`n$($output -join "`n")" }
}

function Invoke-MysqlFile([string]$path) {
  $content = Get-Content -Raw -Encoding UTF8 -LiteralPath $path
  $output = $content | & $mysql.Source @common "--database=$db" 2>&1
  if ($LASTEXITCODE -ne 0) { throw "MySQL file failed: $path`n$($output -join "`n")" }
}

function Expect-MysqlFailure([string]$label, [string]$sql, [string]$expectedMessage = '') {
  $output = $sql | & $mysql.Source @common "--database=$db" 2>&1
  if ($LASTEXITCODE -eq 0) { throw "EXPECTED FAILURE but succeeded: $label" }
  $text = $output -join "`n"
  if ($expectedMessage -and $text -notmatch [regex]::Escape($expectedMessage)) {
    throw "EXPECTED failure '$expectedMessage' but got:`n$text"
  }
  Write-Host "PASS (expected failure): $label"
}

Invoke-MysqlText "DROP DATABASE IF EXISTS ``$db``; CREATE DATABASE ``$db`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
Invoke-MysqlFile (Join-Path $PSScriptRoot '..\..\docs\architecture\v1.2\generated-mysql-ddl.sql')
Invoke-MysqlFile (Join-Path $PSScriptRoot '..\..\docs\architecture\v1.2\constraints.sql')
$fixture = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $PSScriptRoot 'p1_fixture.sql')
Invoke-MysqlDatabase $fixture

Expect-MysqlFailure 'new RecipeVersion cannot start ACTIVE' "INSERT INTO recipe_versions (id,variantId,versionNo,status,effectiveAt,createdAt) VALUES (3,1,2,'ACTIVE',NOW(3),NOW(3));" 'New RecipeVersion must start in DRAFT'
Expect-MysqlFailure 'ACTIVE recipe ingredient INSERT' "INSERT INTO variant_recipes (recipeVersionId,materialId,role,quantity) VALUES (1,2,'BASE',1);" 'Recipe ingredients can only be inserted into DRAFT versions'
Expect-MysqlFailure 'ACTIVE recipe modifier INSERT' "INSERT INTO recipe_modifiers (recipeVersionId,optionValueId,materialId,targetRole,quantityDelta) VALUES (1,1,2,'BASE',1);" 'Recipe modifiers can only be inserted into DRAFT versions'
Expect-MysqlFailure 'ACTIVE recipe cannot return to DRAFT' "UPDATE recipe_versions SET status='DRAFT' WHERE id=1;" 'ACTIVE RecipeVersion cannot return to DRAFT'
Invoke-MysqlDatabase "UPDATE recipe_versions SET status='ARCHIVED' WHERE id=1;"
Expect-MysqlFailure 'ARCHIVED recipe ingredient INSERT' "INSERT INTO variant_recipes (recipeVersionId,materialId,role,quantity) VALUES (1,2,'BASE',1);" 'Recipe ingredients can only be inserted into DRAFT versions'
Expect-MysqlFailure 'ARCHIVED recipe modifier INSERT' "INSERT INTO recipe_modifiers (recipeVersionId,optionValueId,materialId,targetRole,quantityDelta) VALUES (1,1,2,'BASE',1);" 'Recipe modifiers can only be inserted into DRAFT versions'
Expect-MysqlFailure 'ARCHIVED recipe cannot reactivate' "UPDATE recipe_versions SET status='ACTIVE' WHERE id=1;" 'ARCHIVED RecipeVersion cannot be reactivated'
Expect-MysqlFailure 'Product wrong-store category' "INSERT INTO products (id,storeId,categoryId,name,status,sortOrder,createdAt,updatedAt) VALUES (3,1,2,'跨店茶','ACTIVE',0,NOW(3),NOW(3));" 'Product.categoryId must belong to Product.storeId'
Expect-MysqlFailure 'OrderItem wrong-variant recipe' "INSERT INTO order_items (orderId,productId,variantId,recipeVersionId,productNameSnapshot,variantNameSnapshot,unitPriceFen,quantity,lineSubtotalFen,createdAt) VALUES (1,1,1,2,'测试茶','单杯',1000,1,1000,NOW(3));" 'OrderItem product/variant/recipe/store ownership mismatch'
Expect-MysqlFailure 'Category.storeId is immutable' "UPDATE categories SET storeId=2 WHERE id=1;" 'Category.storeId is immutable'
Expect-MysqlFailure 'Product.storeId is immutable' "UPDATE products SET storeId=2, categoryId=2 WHERE id=1;" 'Product.storeId is immutable'
Expect-MysqlFailure 'ProductVariant.productId is immutable' "UPDATE product_variants SET productId=2 WHERE id=1;" 'ProductVariant.productId is immutable'
Expect-MysqlFailure 'RecipeVersion variant/version identity is immutable' "UPDATE recipe_versions SET variantId=1, versionNo=9 WHERE id=2;" 'RecipeVersion variant/version identity is immutable'

Write-Host 'All MySQL P1 constraint tests passed.'
