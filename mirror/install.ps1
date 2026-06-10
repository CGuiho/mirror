param(
  [string]$Version = $env:MIRROR_VERSION,
  [string]$Repo = $(if ($env:MIRROR_REPO) { $env:MIRROR_REPO } else { 'CGuiho/mirror' }),
  [string]$InstallDir = $(if ($env:MIRROR_INSTALL_DIR) { $env:MIRROR_INSTALL_DIR } else { Join-Path $HOME '.local\bin' })
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($Version)) {
  $Version = 'latest'
}

$arch = switch ([System.Runtime.InteropServices.RuntimeInformation]::ProcessArchitecture) {
  'X64' { 'x64' }
  'Arm64' { 'arm64' }
  default { throw "Unsupported architecture: $([System.Runtime.InteropServices.RuntimeInformation]::ProcessArchitecture)" }
}

$asset = "guiho-mirror-windows-$arch.exe"
$url = if ($Version -eq 'latest') {
  "https://github.com/$Repo/releases/latest/download/$asset"
} else {
  "https://github.com/$Repo/releases/download/$Version/$asset"
}

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
$destination = Join-Path $InstallDir 'mirror.exe'

"Downloading $url"
Invoke-WebRequest -Uri $url -OutFile $destination
"Installed mirror to $destination"
