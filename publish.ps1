param(
  [string]$Message = "更新量小新"
)

$ErrorActionPreference = "Stop"
$git = Join-Path $PSScriptRoot "tools\git\cmd\git.exe"
if (-not (Test-Path $git)) {
  $git = "git"
}

$remotes = & $git remote
if (-not $remotes) {
  Write-Host "还没有配置 GitHub 远程仓库。先运行："
  Write-Host ".\tools\git\cmd\git.exe remote add origin https://github.com/<你的用户名>/<仓库名>.git"
  exit 1
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
  Write-Host "推送失败：请检查远程仓库和登录状态。"
  exit $LASTEXITCODE
}

Write-Host "已推送；如果平台已连接 Git，网站会自动更新。"
