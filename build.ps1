$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$data = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $root 'data.js')
$store = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $root 'store.js')
$app = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $root 'app.js')

$data = [regex]::Replace($data, '(?ms)\r?\nexport \{[^\n]*\};\s*$', "`r`n")
$store = [regex]::Replace($store, '(?m)^import \{[\s\S]*?\} from ''\.\/data\.js'';\r?\n', '')
$store = [regex]::Replace($store, '(?ms)\r?\nexport \{[^\n]*\};\s*$', "`r`n")
$store = $store.Replace('export class TeaStore', 'class TeaStore')
$app = [regex]::Replace($app, '(?m)^import \{[\s\S]*?\} from ''\.\/store\.js'';\r?\n', '')
$app = [regex]::Replace($app, '(?m)^import \{[\s\S]*?\} from ''\.\/data\.js'';\r?\n', '')

$bundle = "/* Generated from data.js + store.js + app.js for direct file:// use. */`r`n'use strict';`r`n" + $data + "`r`n" + $store + "`r`n" + $app
Set-Content -LiteralPath (Join-Path $root 'bundle.js') -Value $bundle -Encoding utf8
Write-Host 'bundle.js generated.'

