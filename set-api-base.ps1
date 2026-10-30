param(
  [Parameter(Mandatory = $true)]
  [string]$ApiBase,
  [switch]$Publish
)

$ErrorActionPreference = "Stop"
$ApiBase = $ApiBase.Trim().TrimEnd("/")

if ($ApiBase -notmatch '^https://') {
  throw "ApiBase must start with https://"
}

$indexPath = Join-Path $PSScriptRoot "index.html"
$text = [System.IO.File]::ReadAllText($indexPath, [System.Text.Encoding]::UTF8)

$pattern = 'window\.LXX_API_BASE\s*=\s*"[^"]*";'
if ($text -notmatch $pattern) {
  throw "window.LXX_API_BASE not found in index.html"
}

$text = [regex]::Replace($text, $pattern, {
  param($match)
  'window.LXX_API_BASE = "' + $ApiBase + '";'
})

[System.IO.File]::WriteAllText(
  $indexPath,
  $text,
  (New-Object System.Text.UTF8Encoding($false))
)

Write-Host "Updated index.html:"
Write-Host "  window.LXX_API_BASE = $ApiBase"

if ($Publish) {
  & (Join-Path $PSScriptRoot "publish.cmd") "切换后端地址到 $ApiBase"
}
