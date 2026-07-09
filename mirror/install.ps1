param(
  [string]$Version,
  [string]$Arch,
  [string]$Variant,
  [string]$InstallDir
)

$ErrorActionPreference = 'Stop'

# === Defaults from env vars or sensible defaults ===
if ([string]::IsNullOrWhiteSpace($Version)) {
  $Version = if ($env:MIRROR_VERSION) { $env:MIRROR_VERSION } else { 'latest' }
}
$Repo = if ($env:MIRROR_REPO) { $env:MIRROR_REPO } else { 'CGuiho/mirror' }
if ([string]::IsNullOrWhiteSpace($InstallDir)) {
  $InstallDir = if ($env:MIRROR_INSTALL_DIR) { $env:MIRROR_INSTALL_DIR } else { Join-Path $HOME '.local\bin' }
}

# === Show help ===
if ($Version -eq '--help' -or $Version -eq '-h') {
  @"
Install GUIHO Mirror — native CLI binary from GitHub Releases.

Usage: install.ps1 [-Version VERSION] [-Arch ARCH] [-Variant VARIANT] [-InstallDir DIR]

Parameters:
  -Version      Version to install (default: latest).
                Examples: latest, alpha, 3.3.1, @guiho/mirror@3.3.1
  -Arch         Force architecture: x64 | arm64 (default: auto-detect)
  -Variant      Force variant for x64: baseline | modern (default: baseline)
  -InstallDir   Install directory (default: `$HOME\.local\bin)

Environment variables:
  MIRROR_VERSION, MIRROR_REPO, MIRROR_INSTALL_DIR
"@
  exit 0
}

# === Detect architecture ===
$detectedArch = if ($Arch) {
  $Arch
} else {
  switch ([System.Runtime.InteropServices.RuntimeInformation]::ProcessArchitecture) {
    'X64'   { 'x64' }
    'Arm64' { 'arm64' }
    default { throw "Unsupported architecture: $([System.Runtime.InteropServices.RuntimeInformation]::ProcessArchitecture)" }
  }
}

if ($detectedArch -notin @('x64', 'arm64')) {
  throw "Invalid architecture: $detectedArch. Must be x64 or arm64."
}

if (-not [Environment]::Is64BitOperatingSystem) {
  throw 'Unsupported platform: Windows 32-bit is not supported.'
}

# === Build asset candidates (baseline-first for x64) ===
$variant = if ($Variant) { $Variant } else { 'baseline' }

$assetCandidates = if ($detectedArch -eq 'x64') {
  switch ($variant) {
    'baseline' { @(
      "guiho-mirror-windows-x64-baseline.exe",
      "guiho-mirror-windows-x64.exe",
      "guiho-mirror-windows-x64-modern.exe"
    )}
    'modern' { @(
      "guiho-mirror-windows-x64-modern.exe",
      "guiho-mirror-windows-x64.exe",
      "guiho-mirror-windows-x64-baseline.exe"
    )}
    default { @(
      "guiho-mirror-windows-x64-$variant.exe",
      "guiho-mirror-windows-x64-baseline.exe",
      "guiho-mirror-windows-x64.exe",
      "guiho-mirror-windows-x64-modern.exe"
    )}
  }
} else {
  @("guiho-mirror-windows-arm64.exe")
}

# === Build download URL ===
function Get-DownloadUrl {
  param([string]$Asset)

  if ($Version -eq 'latest') {
    return "https://github.com/$Repo/releases/latest/download/$Asset"
  }

  $tag = if ($Version.StartsWith('@guiho/mirror@')) { $Version }
         elseif ($Version.StartsWith('@')) { $Version }
         else { "@guiho/mirror@$Version" }

  $encodedTag = [Uri]::EscapeDataString($tag)
  return "https://github.com/$Repo/releases/download/$encodedTag/$Asset"
}

# === Main ===
$variantLabel = if ($Variant) { " variant=$Variant" } else { "" }
Write-Host "mirror: $Version  os=windows  arch=$detectedArch$variantLabel"

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
$destination = Join-Path $InstallDir 'mirror.exe'

foreach ($asset in $assetCandidates) {
  $url = Get-DownloadUrl -Asset $asset
  Write-Host "  Trying $url"
  try {
    Invoke-WebRequest -Uri $url -OutFile $destination -ErrorAction Stop
    Write-Host "Installed mirror to $destination"

    # Add to user PATH if not already there
    $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    if (($userPath -split ';') -notcontains $InstallDir) {
      [Environment]::SetEnvironmentVariable('Path', "$userPath;$InstallDir", 'User')
      Write-Host "Added $InstallDir to user PATH. Restart your terminal to use mirror globally."
    }

    Write-Host 'Run: mirror --version'
    exit 0
  } catch {
    Write-Host "  not available, trying next..."
  }
}

throw "No compatible mirror binary found. Check available assets at: https://github.com/$Repo/releases"
