param(
  [string]$Message = "更新量小新"
)

$ErrorActionPreference = "Stop"
$git = Join-Path $PSScriptRoot "tools\git\cmd\git.exe"
if (-not (Test-Path $git)) {
  $git = "git"
}

& $git add .

$changes = & $git status --porcelain
if (-not $changes) {
  Write-Host "没有可提交的改动。"
  exit 0
}

& $git commit -m $Message
& $git push

Write-Host "已推送；如果平台已连接 Git，网站会自动更新。"
