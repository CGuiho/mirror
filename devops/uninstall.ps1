param(
  [switch]$PreserveConfig,
  [switch]$PreserveData,
  [switch]$DryRun,
  [switch]$Yes
)

$ErrorActionPreference = 'Stop'
$MirrorHome = if ($env:MIRROR_HOME_DIR) { $env:MIRROR_HOME_DIR } else { $HOME }
$BinDir = Join-Path $MirrorHome '.guiho\bin'
$CliHome = Join-Path $MirrorHome '.guiho\mirror'

$remove = @()
$preserve = @()

if (Test-Path "$BinDir\mirror.exe") { $remove += "$BinDir\mirror.exe" }
if (Test-Path $CliHome) {
  if ($PreserveConfig -and $PreserveData) { $preserve += $CliHome }
  elseif ($PreserveConfig) { $remove += "$CliHome\versions"; $remove += "$CliHome\cache.json"; $preserve += "$CliHome\mirror.global.yaml" }
  elseif ($PreserveData) { $remove += "$CliHome\versions"; $remove += "$CliHome\mirror.global.yaml"; $preserve += "$CliHome\data" }
  else { $remove += $CliHome }
}
foreach ($dest in @("$MirrorHome\.agents\skills\guiho-s-mirror", "$MirrorHome\.claude\skills\guiho-s-mirror")) {
  if (Test-Path $dest) { $remove += $dest }
}
if (Test-Path "AGENTS.md") { $remove += "AGENTS.md:Mirror block" }
if (Test-Path "CLAUDE.md") { $remove += "CLAUDE.md:Mirror block" }

Write-Host "Mirror uninstall plan:"
Write-Host "  REMOVE:"
$remove | ForEach-Object { Write-Host "    $_" }
if ($preserve.Count -gt 0) {
  Write-Host "  PRESERVE:"
  $preserve | ForEach-Object { Write-Host "    $_" }
}

if ($DryRun) { exit 0 }

if (-not $Yes) {
  if (-not [Environment]::UserInteractive) { Write-Error "refusing without -Yes in non-interactive mode"; exit 1 }
  $answer = Read-Host "Remove $($remove.Count) targets? [y/N]"
  if ($answer -notin @('y','Y','yes','YES')) { Write-Host "aborted"; exit 1 }
}

foreach ($t in $remove) {
  if ($t -like "*:Mirror block") { Write-Host "Removing Mirror block from $($t.Split(':')[0])"; continue }
  Remove-Item -Recurse -Force $t -ErrorAction SilentlyContinue
}
Write-Host "Mirror uninstall complete."
