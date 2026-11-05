# Добавляет в PATH инструменты проекта для текущей сессии PowerShell.
# Использование:  . .\scripts\dev-env.ps1
#
# Node.js и gh установлены локально (без администратора), Git берётся из
# GitHub Desktop — отдельная установка Git не требуется.

$nodeDir = Join-Path $env:LOCALAPPDATA 'Programs\nodejs'
$ghDir = Join-Path $env:LOCALAPPDATA 'Programs\gh\bin'

$gitExe = Get-ChildItem (Join-Path $env:LOCALAPPDATA 'GitHubDesktop\app-*\resources\app\git\cmd\git.exe') -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

$paths = @($nodeDir, $ghDir)
if ($gitExe) { $paths += $gitExe.DirectoryName }

foreach ($p in $paths) {
  if ($p -and (Test-Path $p) -and ($env:Path -split ';' -notcontains $p)) {
    $env:Path = "$p;$env:Path"
  }
}

Write-Host "Node: $(if (Get-Command node -ErrorAction SilentlyContinue) { node --version } else { 'не найден' })"
Write-Host "npm:  $(if (Get-Command npm -ErrorAction SilentlyContinue) { npm --version } else { 'не найден' })"
Write-Host "git:  $(if (Get-Command git -ErrorAction SilentlyContinue) { git --version } else { 'не найден' })"
Write-Host "gh:   $(if (Get-Command gh -ErrorAction SilentlyContinue) { gh --version | Select-Object -First 1 } else { 'не найден' })"
