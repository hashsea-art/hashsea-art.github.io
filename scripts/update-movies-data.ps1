$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$csvPath = Join-Path $root 'data\movies.csv'
$jsPath = Join-Path $root 'data\movies-data.js'

if (-not (Test-Path $csvPath)) {
  throw "movies.csv not found at $csvPath"
}

$rows = Import-Csv $csvPath
$json = $rows | ConvertTo-Json -Compress -Depth 3
$output = "window.__MOVIES_DATA__ = $json;"

Set-Content -Path $jsPath -Value $output -Encoding UTF8

Write-Output "Updated $jsPath from $csvPath"
