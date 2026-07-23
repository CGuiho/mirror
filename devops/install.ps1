param(
  [string]$Version,
  [string]$Arch,
  [string]$Variant,
  [string]$InstallDir,
  [switch]$Help
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$UserHome = if ($env:HOME) { $env:HOME } elseif ($env:USERPROFILE) { $env:USERPROFILE } else { $HOME }

if ([string]::IsNullOrWhiteSpace($Version)) { $Version = if ($env:MIRROR_VERSION) { $env:MIRROR_VERSION } else { 'latest' } }
$Repo = if ($env:MIRROR_REPO) { $env:MIRROR_REPO } else { 'CGuiho/mirror' }
$DownloadBaseUrl = if ($env:MIRROR_DOWNLOAD_BASE_URL) { $env:MIRROR_DOWNLOAD_BASE_URL.TrimEnd('/') } else { $null }
if ([string]::IsNullOrWhiteSpace($InstallDir)) { $InstallDir = if ($env:MIRROR_INSTALL_DIR) { $env:MIRROR_INSTALL_DIR } else { Join-Path $UserHome '.local\bin' } }

if ($Help -or $Version -eq '--help' -or $Version -eq '-h') {
  @"
Install GUIHO Mirror as a verified native CLI binary from GitHub Releases.

Usage: install.ps1 [-Version VERSION] [-Arch ARCH] [-Variant VARIANT] [-InstallDir DIR]

Parameters:
  -Version      Exact stable or prerelease version (default: latest stable).
  -Arch         Force architecture: x64 | arm64 (default: auto-detect).
  -Variant      Force x64 variant: baseline | default | modern (default: baseline).
  -InstallDir   Install directory (default: `$HOME\.local\bin).
  -Help         Show this help.
"@
  return
}

function Resolve-TargetVersion {
  param([string]$RequestedVersion)
  $tag = $RequestedVersion
  if ($RequestedVersion -eq 'latest') {
    Write-Host 'Resolving latest stable Mirror release...'
    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest" -Headers @{ Accept = 'application/vnd.github+json' }
    $tag = [string]$release.tag_name
  }
  $normalized = $tag -replace '^@guiho/mirror@', '' -replace '^v', ''
  if ($normalized -notmatch '^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$') {
    throw "Invalid Mirror version: $RequestedVersion"
  }
  $prerelease = (($normalized -split '\+', 2)[0] -split '-', 2)
  if ($prerelease.Count -eq 2) {
    foreach ($identifier in $prerelease[1] -split '\.') {
      if ($identifier -match '^0\d+$') { throw "Invalid Mirror version: $RequestedVersion" }
    }
  }
  return $normalized
}

function Get-PathEntries { param([string]$PathValue); if ([string]::IsNullOrWhiteSpace($PathValue)) { return @() }; return @($PathValue -split ';' | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }) }
function Test-PathContains {
  param([string]$PathValue, [string]$Directory)
  $normalizedDirectory = $Directory.TrimEnd('\')
  foreach ($entry in Get-PathEntries -PathValue $PathValue) {
    if ($entry.TrimEnd('\').Equals($normalizedDirectory, [StringComparison]::OrdinalIgnoreCase)) { return $true }
  }
  return $false
}
function Add-InstallDirToPath {
  param([string]$Directory)
  $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
  if (-not (Test-PathContains -PathValue $userPath -Directory $Directory)) {
    $newUserPath = (@($Directory) + @(Get-PathEntries -PathValue $userPath)) -join ';'
    [Environment]::SetEnvironmentVariable('Path', $newUserPath.TrimEnd(';'), 'User')
    Write-Host "Added $Directory to user PATH. Restart your terminal to use mirror globally."
  }
  if (-not (Test-PathContains -PathValue $env:Path -Directory $Directory)) { $env:Path = "$Directory;$env:Path" }
}

function Test-NativeBinary {
  param([string]$Path)
  $stream = [System.IO.File]::OpenRead($Path)
  try { return $stream.Length -ge 2 -and $stream.ReadByte() -eq 0x4D -and $stream.ReadByte() -eq 0x5A }
  finally { $stream.Dispose() }
}

function Test-MarkdownAsset {
  param([string]$Path, [string]$ExpectedName)
  $bytes = [System.IO.File]::ReadAllBytes($Path)
  if ($bytes.Length -eq 0) { throw "Downloaded Markdown asset is empty: $Path" }
  if ($bytes.Length -ge 2 -and $bytes[0] -eq 0x4D -and $bytes[1] -eq 0x5A) {
    throw "Downloaded Markdown asset has a Windows executable header: $Path"
  }
  if ($bytes -contains 0) { throw "Downloaded Markdown asset contains binary NUL bytes: $Path" }
  try {
    $text = ([System.Text.UTF8Encoding]::new($false, $true)).GetString($bytes).Replace("`r`n", "`n")
  } catch {
    throw "Downloaded Markdown asset is not valid UTF-8 text: $Path"
  }
  if (-not $text.StartsWith("---`n")) { throw "Downloaded Markdown asset does not begin with YAML frontmatter: $Path" }
  if ($text -notmatch "(?m)^name:\s*$([Regex]::Escape($ExpectedName))\s*$") {
    throw "Downloaded Markdown asset identity does not match $ExpectedName`: $Path"
  }
}

function Read-Utf8TextFile {
  param([string]$Path)
  $bytes = [System.IO.File]::ReadAllBytes($Path)
  try { $text = ([System.Text.UTF8Encoding]::new($false, $true)).GetString($bytes) }
  catch { throw "Instruction file is not valid UTF-8 text: $Path" }
  if ($text.Length -gt 0 -and $text[0] -eq [char]0xFEFF) { return $text.Substring(1) }
  return $text
}

function Set-MirrorManagedBlock {
  param([string]$Path, [string]$Prompt)
  $startMarker = '<!-- BEGIN MIRROR ' + [char]0x2014 + ' DO NOT EDIT THIS SECTION -->'
  $legacyStartMarker = '<!-- BEGIN MIRROR ' + [char]0x00E2 + [char]0x20AC + [char]0x201D + ' DO NOT EDIT THIS SECTION -->'
  $endMarker = '<!-- END MIRROR -->'
  $existing = if (Test-Path -LiteralPath $Path) { Read-Utf8TextFile -Path $Path } else { '' }
  $starts = '(?:' + [Regex]::Escape($startMarker) + '|' + [Regex]::Escape($legacyStartMarker) + ')'
  $pattern = $starts + '[\s\S]*?' + [Regex]::Escape($endMarker) + '\s*'
  $clean = ([Regex]::Replace($existing, $pattern, '')).TrimEnd()
  $prefix = if ($clean) { "$clean`r`n`r`n" } else { '' }
  $content = "$prefix$startMarker`r`n$($Prompt.Trim())`r`n$endMarker`r`n"
  [System.IO.File]::WriteAllText($Path, $content, [System.Text.UTF8Encoding]::new($false))
}

function Test-InstalledVersion {
  param([string]$Path, [string]$ExpectedVersion)
  $startInfo = New-Object System.Diagnostics.ProcessStartInfo
  $startInfo.FileName = $Path
  $startInfo.Arguments = '--version'
  $startInfo.UseShellExecute = $false
  $startInfo.CreateNoWindow = $true
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true
  $process = New-Object System.Diagnostics.Process
  $process.StartInfo = $startInfo
  try {
    if (-not $process.Start()) { throw 'Could not start installed Mirror for version verification' }
    if (-not $process.WaitForExit(10000)) {
      $process.Kill()
      $process.WaitForExit()
      throw 'Installed Mirror version check timed out after 10 seconds'
    }
    $stdout = $process.StandardOutput.ReadToEnd().Trim()
    $stderr = $process.StandardError.ReadToEnd().Trim()
    if ($process.ExitCode -ne 0) { throw "Installed Mirror exited with code $($process.ExitCode) during verification: $stderr" }
    if ($stdout -ne $ExpectedVersion) { throw "Installed Mirror reported $stdout; expected $ExpectedVersion" }
  } finally {
    $process.Dispose()
  }
}

function Start-BackupCleanup {
  param([string]$BackupPath)
  $script = 'for ($attempt = 0; $attempt -lt 300; $attempt += 1) { try { Remove-Item -LiteralPath $env:MIRROR_BACKUP_PATH -Force -ErrorAction Stop; exit 0 } catch { Start-Sleep -Milliseconds 100 } }; exit 1'
  $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($script))
  $previousBackupPath = $env:MIRROR_BACKUP_PATH
  try {
    $env:MIRROR_BACKUP_PATH = $BackupPath
    Start-Process powershell.exe -ArgumentList @('-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', $encoded) -WindowStyle Hidden
  } finally {
    $env:MIRROR_BACKUP_PATH = $previousBackupPath
  }
}

function Install-Transactional {
  param([string]$DownloadedPath, [string]$Destination, [string]$ExpectedVersion)
  $backupPath = "$Destination.old-$PID-$([Guid]::NewGuid().ToString('N'))"
  $originalMoved = $false
  try {
    if (Test-Path -LiteralPath $Destination) { Move-Item -LiteralPath $Destination -Destination $backupPath; $originalMoved = $true }
    Move-Item -LiteralPath $DownloadedPath -Destination $Destination
    Write-Host 'Verifying...'
    Test-InstalledVersion -Path $Destination -ExpectedVersion $ExpectedVersion
    if ($originalMoved) {
      try { Remove-Item -LiteralPath $backupPath -Force }
      catch { Start-BackupCleanup -BackupPath $backupPath; Write-Host 'Old executable cleanup will finish after the running process exits.' }
    }
  } catch {
    $failure = $_.Exception.Message
    try {
      if (Test-Path -LiteralPath $Destination) { Remove-Item -LiteralPath $Destination -Force -ErrorAction Stop }
      if ($originalMoved) {
        if (-not (Test-Path -LiteralPath $backupPath)) { throw "Backup is missing: $backupPath" }
        Move-Item -LiteralPath $backupPath -Destination $Destination -ErrorAction Stop
      }
    } catch {
      throw "Mirror installation failed: $failure. Automatic rollback also failed: $($_.Exception.Message). Backup remains at $backupPath"
    }
    if ($originalMoved) { throw "Mirror installation failed and the previous executable was restored: $failure" }
    throw "Mirror installation failed before a previous executable could be restored: $failure"
  }
}

function Test-Shadowing {
  param([string]$ExpectedPath)
  $command = Get-Command mirror -ErrorAction SilentlyContinue
  if ($command -and -not $command.Source.Equals($ExpectedPath, [StringComparison]::OrdinalIgnoreCase)) {
    Write-Warning "Another mirror appears earlier in PATH: $($command.Source)"
    Write-Warning "The newly installed binary is at: $ExpectedPath"
  }
}

if ($env:MIRROR_INSTALLER_SOURCE_ONLY -eq '1') { return }

$detectedArch = if ($Arch) { $Arch } else { switch ($env:PROCESSOR_ARCHITECTURE) { 'AMD64' { 'x64' } 'ARM64' { 'arm64' } default { throw "Unsupported architecture: $env:PROCESSOR_ARCHITECTURE" } } }
if ($detectedArch -notin @('x64', 'arm64')) { throw "Invalid architecture: $detectedArch" }
if (-not [Environment]::Is64BitOperatingSystem) { throw 'Unsupported platform: Windows 32-bit is not supported.' }
$variant = if ($Variant) { $Variant } else { 'baseline' }
$assetCandidates = if ($detectedArch -eq 'arm64') {
  if ($Variant) { throw '-Variant is only valid for x64 installs.' }
  @('mirror-windows-arm64.exe')
} else {
  switch ($variant) {
    'baseline' { @('mirror-windows-x64-baseline.exe', 'mirror-windows-x64.exe', 'mirror-windows-x64-modern.exe') }
    'default' { @('mirror-windows-x64.exe', 'mirror-windows-x64-baseline.exe', 'mirror-windows-x64-modern.exe') }
    'modern' { @('mirror-windows-x64-modern.exe', 'mirror-windows-x64.exe', 'mirror-windows-x64-baseline.exe') }
    default { throw "Invalid variant: $variant" }
  }
}

$targetVersion = Resolve-TargetVersion -RequestedVersion $Version
$encodedTag = [Uri]::EscapeDataString("@guiho/mirror@$targetVersion")
$temporaryDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ("mirror-install-$PID-$([Guid]::NewGuid().ToString('N'))")
New-Item -ItemType Directory -Force -Path $temporaryDirectory | Out-Null

try {
  New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
  $InstallDir = (Resolve-Path -LiteralPath $InstallDir).Path
  $destination = Join-Path $InstallDir 'mirror.exe'
  $firstAsset = $assetCandidates[0]
  $sourceUrl = if ($DownloadBaseUrl) { "$DownloadBaseUrl/$encodedTag/$firstAsset" } else { "https://github.com/$Repo/releases/download/$encodedTag/$firstAsset" }
  Write-Host 'Initiating GUIHO CLI Upgrade / Installation Sequence...'
  Write-Host "Target Version: v$targetVersion"
  Write-Host "Architecture:   $detectedArch"
  Write-Host "Variant:        $variant"
  Write-Host "Source URL:     $sourceUrl"
  $downloadedPath = $null
  foreach ($asset in $assetCandidates) {
    $url = if ($DownloadBaseUrl) { "$DownloadBaseUrl/$encodedTag/$asset" } else { "https://github.com/$Repo/releases/download/$encodedTag/$asset" }
    $candidatePath = Join-Path $temporaryDirectory $asset
    Write-Host "Downloading $url"
    try {
      Invoke-WebRequest -Uri $url -OutFile $candidatePath -UseBasicParsing
    } catch {
      $statusCode = if ($_.Exception.Response -and $_.Exception.Response.StatusCode) { [int]$_.Exception.Response.StatusCode } else { 0 }
      if ($statusCode -eq 404) { Write-Host "  $asset is not available; trying the next compatible candidate."; continue }
      throw "Failed to download $url`: $($_.Exception.Message)"
    }
    if (-not (Test-NativeBinary $candidatePath)) { throw "Downloaded asset $asset is not a native Windows executable." }
    Unblock-File -LiteralPath $candidatePath -ErrorAction SilentlyContinue
    $downloadedPath = $candidatePath
    break
  }
  if (-not $downloadedPath) { throw "No compatible Mirror $targetVersion binary found at https://github.com/$Repo/releases" }
  Write-Host 'Replacing...'
  Install-Transactional -DownloadedPath $downloadedPath -Destination $destination -ExpectedVersion $targetVersion
  Write-Host "Saving Mirror schema: $(Join-Path $UserHome '.guiho\mirror\schema.json')"
  & $destination config schema --save --format json | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Installed Mirror could not save its global configuration schema.' }
  $skillAsset = Join-Path $temporaryDirectory 'guiho-s-mirror.md'
  $promptAsset = Join-Path $temporaryDirectory 'guiho-i-mirror.md'
  $assetBase = if ($DownloadBaseUrl) { "$DownloadBaseUrl/$encodedTag" } else { "https://github.com/$Repo/releases/download/$encodedTag" }
  Write-Host "Downloading skill asset: $assetBase/guiho-s-mirror.md"
  Invoke-WebRequest -Uri "$assetBase/guiho-s-mirror.md" -OutFile $skillAsset -UseBasicParsing
  Test-MarkdownAsset -Path $skillAsset -ExpectedName 'guiho-s-mirror'
  Write-Host "Downloading instruction asset: $assetBase/guiho-i-mirror.md"
  Invoke-WebRequest -Uri "$assetBase/guiho-i-mirror.md" -OutFile $promptAsset -UseBasicParsing
  Test-MarkdownAsset -Path $promptAsset -ExpectedName 'guiho-i-mirror'
  foreach ($skillRoot in @((Join-Path $UserHome '.agents\skills\guiho-s-mirror'), (Join-Path $UserHome '.claude\skills\guiho-s-mirror'))) {
    New-Item -ItemType Directory -Force -Path $skillRoot | Out-Null
    Copy-Item -LiteralPath $skillAsset -Destination (Join-Path $skillRoot 'SKILL.md') -Force
    Write-Host "Installed skill: $(Join-Path $skillRoot 'SKILL.md')"
  }
  $instructionTargets = @()
  if (Test-Path -LiteralPath (Join-Path (Get-Location) 'AGENTS.md')) { $instructionTargets += (Join-Path (Get-Location) 'AGENTS.md') }
  if (Test-Path -LiteralPath (Join-Path (Get-Location) 'CLAUDE.md')) { $instructionTargets += (Join-Path (Get-Location) 'CLAUDE.md') }
  if ($instructionTargets.Count -eq 0) { $instructionTargets += (Join-Path (Get-Location) 'AGENTS.md') }
  $prompt = Read-Utf8TextFile -Path $promptAsset
  foreach ($instructionPath in $instructionTargets) {
    Write-Host "Reconciling instruction file: $instructionPath"
    Set-MirrorManagedBlock -Path $instructionPath -Prompt $prompt
  }
  if ($env:MIRROR_SKIP_PATH_UPDATE -ne '1') {
    Add-InstallDirToPath -Directory $InstallDir
    Test-Shadowing -ExpectedPath $destination
  }
  Write-Host "Final verification: $destination --version"
  Write-Host "Installed and verified Mirror $targetVersion at $destination"
} finally {
  Remove-Item -LiteralPath $temporaryDirectory -Recurse -Force -ErrorAction SilentlyContinue
}
