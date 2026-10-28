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
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

& $git push
if ($LASTEXITCODE -ne 0) {
  Write-Host "推送失败：请先在 GitHub 建仓库并配置 origin。"
  exit $LASTEXITCODE
}

Write-Host "已推送；如果平台已连接 Git，网站会自动更新。"
