param(
  [string]$Version,
  [string]$Repo,
  [string]$Arch,
  [string]$Variant,
  [string]$InstallDir,
  [switch]$Help
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

if ($Help) {
  @"
Install GUIHO Mirror as a native CLI binary from GitHub Releases.

Usage: install.ps1 [-Version VERSION] [-Arch ARCH] [-Variant VARIANT] [-InstallDir DIR]

Parameters:
  -Version      Version to install (default: latest)
  -Arch         Force architecture: x64 | arm64
  -Variant      Force x64 variant: baseline | default | modern
  -InstallDir   Install directory (default: `$HOME\.local\bin)
"@
  exit 0
}

if ([string]::IsNullOrWhiteSpace($Version)) { $Version = if ($env:MIRROR_VERSION) { $env:MIRROR_VERSION } else { 'latest' } }
if ([string]::IsNullOrWhiteSpace($Repo)) { $Repo = if ($env:MIRROR_REPO) { $env:MIRROR_REPO } else { 'CGuiho/mirror' } }
if ([string]::IsNullOrWhiteSpace($InstallDir)) { $InstallDir = if ($env:MIRROR_INSTALL_DIR) { $env:MIRROR_INSTALL_DIR } else { Join-Path $HOME '.local\bin' } }

$detectedArch = if ($Arch) { $Arch } else {
  switch ($env:PROCESSOR_ARCHITECTURE) {
    'AMD64' { 'x64' }
    'ARM64' { 'arm64' }
    default { throw "Unsupported architecture: $env:PROCESSOR_ARCHITECTURE" }
  }
}
if ($detectedArch -notin @('x64', 'arm64')) { throw "Invalid architecture: $detectedArch" }
if (-not [Environment]::Is64BitOperatingSystem) { throw 'Unsupported platform: Windows 32-bit is not supported.' }

$variantValue = if ($Variant) { $Variant } else { 'baseline' }
$assetCandidates = if ($detectedArch -eq 'x64') {
  switch ($variantValue) {
    'baseline' { @('guiho-mirror-windows-x64-baseline.exe', 'guiho-mirror-windows-x64.exe', 'guiho-mirror-windows-x64-modern.exe') }
    'default' { @('guiho-mirror-windows-x64.exe', 'guiho-mirror-windows-x64-baseline.exe', 'guiho-mirror-windows-x64-modern.exe') }
    'modern' { @('guiho-mirror-windows-x64-modern.exe', 'guiho-mirror-windows-x64.exe', 'guiho-mirror-windows-x64-baseline.exe') }
    default { throw "Invalid variant: $variantValue. Must be baseline, default, or modern." }
  }
} else {
  if ($Variant) { throw '-Variant is only valid for x64 installs.' }
  @('guiho-mirror-windows-arm64.exe')
}

function Get-DownloadUrl { param([string]$Asset)
  if ($Version -eq 'latest') { return "https://github.com/$Repo/releases/latest/download/$Asset" }
  $tag = if ($Version.StartsWith('@guiho/mirror@')) { $Version } elseif ($Version.StartsWith('@')) { $Version } else { "@guiho/mirror@$Version" }
  return "https://github.com/$Repo/releases/download/$([Uri]::EscapeDataString($tag))/$Asset"
}

function Test-NativeBinary { param([string]$Path)
  $bytes = [System.IO.File]::ReadAllBytes($Path)
  return $bytes.Length -ge 2 -and $bytes[0] -eq 0x4D -and $bytes[1] -eq 0x5A
}

function Get-PathEntries { param([string]$PathValue)
  if ([string]::IsNullOrWhiteSpace($PathValue)) { return @() }
  return @($PathValue -split ';' | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
}

function Test-PathContains { param([string]$PathValue, [string]$Directory)
  $target = $Directory.TrimEnd('\')
  foreach ($entry in Get-PathEntries -PathValue $PathValue) {
    if ($entry.TrimEnd('\').Equals($target, [StringComparison]::OrdinalIgnoreCase)) { return $true }
  }
  return $false
}

function Add-InstallDirToPath { param([string]$Directory)
  $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
  if (-not (Test-PathContains -PathValue $userPath -Directory $Directory)) {
    $newUserPath = (@($Directory) + @(Get-PathEntries -PathValue $userPath)) -join ';'
    [Environment]::SetEnvironmentVariable('Path', $newUserPath.TrimEnd(';'), 'User')
    Write-Host "Added $Directory to user PATH. Restart your terminal to use mirror globally."
  }
  if (-not (Test-PathContains -PathValue $env:Path -Directory $Directory)) { $env:Path = "$Directory;$env:Path" }
}

Write-Host "mirror: $Version  os=windows  arch=$detectedArch$(if ($Variant) { " variant=$Variant" } else { '' })"
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
$InstallDir = (Resolve-Path -LiteralPath $InstallDir).Path
$destination = Join-Path $InstallDir 'mirror.exe'
$temporaryFile = Join-Path ([System.IO.Path]::GetTempPath()) ([System.IO.Path]::GetRandomFileName())

foreach ($asset in $assetCandidates) {
  $url = Get-DownloadUrl -Asset $asset
  Write-Host "  Trying $url"
  try {
    Invoke-WebRequest -Uri $url -OutFile $temporaryFile -UseBasicParsing -ErrorAction Stop
    if (-not (Test-NativeBinary -Path $temporaryFile)) { Write-Host "  $asset was not a native Windows binary, trying next..."; continue }
    Move-Item -Force -Path $temporaryFile -Destination $destination
    Write-Host "Installed mirror to $destination"
    Add-InstallDirToPath -Directory $InstallDir
    Write-Host 'Run: mirror --version'
    exit 0
  } catch {
    Write-Host '  not available, trying next...'
  }
}

if (Test-Path -LiteralPath $temporaryFile) { Remove-Item -LiteralPath $temporaryFile -Force }
throw "No compatible Mirror binary found. Check available assets at: https://github.com/$Repo/releases"
