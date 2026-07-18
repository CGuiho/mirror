param(
  [string]$Version,
  [string]$Repo,
  [string]$Arch,
  [string]$Variant,
  [string]$InstallDir,
  [string]$ApiBaseUrl,
  [switch]$NoPathUpdate,
  [switch]$Help
)

$installer = Join-Path $PSScriptRoot '..\mirror\install.ps1'
& $installer @PSBoundParameters
