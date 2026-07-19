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

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

if ($Help) {
  @"
Install GUIHO Mirror as a verified native CLI binary from GitHub Releases.

Usage: install.ps1 [-Version VERSION] [-Arch ARCH] [-Variant VARIANT] [-InstallDir DIR]

Parameters:
  -Version      Exact semantic version to install, including prerelease (default: latest stable)
  -Arch         Force architecture: x64 | arm64
  -Variant      Force x64 variant: baseline | default | modern
  -InstallDir   Install directory (default: `$HOME\.local\bin)
"@
  return
}

if ([string]::IsNullOrWhiteSpace($Version)) { $Version = if ($env:MIRROR_VERSION) { $env:MIRROR_VERSION } else { 'latest' } }
if ([string]::IsNullOrWhiteSpace($Repo)) { $Repo = if ($env:MIRROR_REPO) { $env:MIRROR_REPO } else { 'CGuiho/mirror' } }
if ([string]::IsNullOrWhiteSpace($InstallDir)) { $InstallDir = if ($env:MIRROR_INSTALL_DIR) { $env:MIRROR_INSTALL_DIR } else { Join-Path $HOME '.local\bin' } }
if ([string]::IsNullOrWhiteSpace($ApiBaseUrl)) { $ApiBaseUrl = if ($env:MIRROR_GITHUB_API_URL) { $env:MIRROR_GITHUB_API_URL.TrimEnd('/') } else { 'https://api.github.com' } }

function Assert-SecureUri { param([string]$Uri)
  if ($env:MIRROR_ALLOW_INSECURE_TEST_URLS -eq '1') { return }
  if (([Uri]$Uri).Scheme -ne 'https') { throw "Refusing insecure installer URL: $Uri" }
}

function ConvertTo-MirrorVersion { param([string]$Value)
  $normalized = $Value -replace '^@guiho/mirror@', '' -replace '^v', ''
  if ($normalized -notmatch '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-(?:0|[1-9][0-9]*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9][0-9]*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$') {
    throw "Invalid Mirror semantic version: $Value"
  }
  return $normalized
}

function Get-MirrorBinaryVersion { param([string]$Path)
  $timeoutSeconds = if ($env:MIRROR_VERIFY_TIMEOUT_SECONDS) { [int]$env:MIRROR_VERIFY_TIMEOUT_SECONDS } else { 10 }
  $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = $Path
  $startInfo.Arguments = '--version'
  $startInfo.UseShellExecute = $false
  $startInfo.CreateNoWindow = $true
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true
  $process = [System.Diagnostics.Process]::new()
  $process.StartInfo = $startInfo
  try {
    if (-not $process.Start()) { throw "Could not launch $Path --version." }
    if (-not $process.WaitForExit($timeoutSeconds * 1000)) {
      $process.Kill()
      $process.WaitForExit()
      throw "Timed out after $timeoutSeconds seconds while running $Path --version."
    }
    $stdout = $process.StandardOutput.ReadToEnd().Trim()
    $stderr = $process.StandardError.ReadToEnd().Trim()
    if ($process.ExitCode -ne 0) { throw "$Path --version failed with exit code $($process.ExitCode): $stderr" }
    return $stdout
  } finally {
    $process.Dispose()
  }
}

function Get-MirrorRelease { param([string]$RequestedVersion)
  Assert-SecureUri -Uri $ApiBaseUrl
  $headers = @{ 'User-Agent' = 'mirror-installer' }
  if ($RequestedVersion -eq 'latest') {
    return Invoke-RestMethod -Uri "$ApiBaseUrl/repos/$Repo/releases/latest" -Headers $headers
  }
  $exact = ConvertTo-MirrorVersion -Value $RequestedVersion
  $tag = [Uri]::EscapeDataString("@guiho/mirror@$exact")
  return Invoke-RestMethod -Uri "$ApiBaseUrl/repos/$Repo/releases/tags/$tag" -Headers $headers
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

function Install-MirrorAgentAssets {
  param([object]$Release, [string]$TemporaryDirectory)
  $skillAsset = @($Release.assets) | Where-Object { $_.name -eq 'guiho-s-mirror.md' -and $_.browser_download_url } | Select-Object -First 1
  $promptAsset = @($Release.assets) | Where-Object { $_.name -eq 'guiho-i-mirror.md' -and $_.browser_download_url } | Select-Object -First 1
  if (-not $skillAsset -or -not $promptAsset) { throw 'Mirror release is missing guiho-s-mirror.md or guiho-i-mirror.md.' }
  $skillTemp = Join-Path $TemporaryDirectory 'guiho-s-mirror.md'
  $promptTemp = Join-Path $TemporaryDirectory 'guiho-i-mirror.md'
  Write-Host "Downloading skill asset: $($skillAsset.browser_download_url)"
  Invoke-WebRequest -Uri $skillAsset.browser_download_url -OutFile $skillTemp -UseBasicParsing
  Write-Host "Downloading instruction asset: $($promptAsset.browser_download_url)"
  Invoke-WebRequest -Uri $promptAsset.browser_download_url -OutFile $promptTemp -UseBasicParsing
  Assert-MirrorMarkdownAsset -Path $skillTemp -ExpectedName 'guiho-s-mirror'
  Assert-MirrorMarkdownAsset -Path $promptTemp -ExpectedName 'guiho-i-mirror'
  $agentSkill = Join-Path $HOME '.agents\skills\guiho-s-mirror'
  $claudeSkill = Join-Path $HOME '.claude\skills\guiho-s-mirror'
  foreach ($directory in @($agentSkill, $claudeSkill)) {
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
    Copy-Item -LiteralPath $skillTemp -Destination (Join-Path $directory 'SKILL.md') -Force
    Write-Host "Installed skill: $directory"
  }
  $agents = Join-Path (Get-Location) 'AGENTS.md'
  $claude = Join-Path (Get-Location) 'CLAUDE.md'
  if (-not (Test-Path -LiteralPath $agents) -and -not (Test-Path -LiteralPath $claude)) {
    New-Item -ItemType File -Force -Path $agents | Out-Null
  }
  $start = '<!-- BEGIN MIRROR — DO NOT EDIT THIS SECTION -->'
  $end = '<!-- END MIRROR -->'
  $body = Get-Content -Raw -LiteralPath $promptTemp
  foreach ($target in @($agents, $claude)) {
    if (-not (Test-Path -LiteralPath $target)) { continue }
    Write-Host "Discovered instruction file: $target"
    $content = Get-Content -Raw -LiteralPath $target
    if ($null -eq $content) { $content = '' }
    $pattern = "(?s)\s*$([regex]::Escape($start)).*?$([regex]::Escape($end))\s*"
    $clean = [regex]::Replace($content, $pattern, "`r`n").TrimEnd()
    Set-Content -LiteralPath $target -Value "$clean`r`n`r`n$start`r`n$($body.TrimEnd())`r`n$end`r`n" -NoNewline
    Write-Host "Reconciled instruction block: $target"
  }
}

function Assert-MirrorMarkdownAsset {
  param([string]$Path, [string]$ExpectedName)
  $bytes = [IO.File]::ReadAllBytes($Path)
  if ($bytes.Length -eq 0) { throw "$ExpectedName release asset is empty." }
  if ($bytes.Length -ge 2 -and $bytes[0] -eq 0x4D -and $bytes[1] -eq 0x5A) {
    throw "$ExpectedName release asset is a Windows executable, not Markdown."
  }
  if ($bytes -contains 0) { throw "$ExpectedName release asset contains binary NUL bytes." }
  try {
    $utf8 = New-Object Text.UTF8Encoding($false, $true)
    $content = $utf8.GetString($bytes)
  } catch {
    throw "$ExpectedName release asset is not valid UTF-8 Markdown."
  }
  if (-not $content.StartsWith("---`n") -and -not $content.StartsWith("---`r`n")) {
    throw "$ExpectedName release asset is missing YAML frontmatter."
  }
  $escapedName = [regex]::Escape($ExpectedName)
  if ($content -notmatch "(?m)^name:\s*$escapedName\s*`r?$") {
    throw "$ExpectedName release asset has incorrect or missing frontmatter identity."
  }
}

$release = Get-MirrorRelease -RequestedVersion $Version
if (-not $release.tag_name) { throw 'Mirror release metadata did not include tag_name.' }
$targetVersion = ConvertTo-MirrorVersion -Value ([string]$release.tag_name)
if ($Version -ne 'latest') {
  $requestedVersion = ConvertTo-MirrorVersion -Value $Version
  if ($targetVersion -ne $requestedVersion) {
    throw "Requested Mirror $requestedVersion, but release metadata returned $($release.tag_name)."
  }
}

$detectedArch = if ($Arch) { $Arch } else {
  switch ([System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString()) {
    'X64' { 'x64' }
    'Arm64' { 'arm64' }
    default { throw "Unsupported architecture: $([System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture)" }
  }
}
if ($detectedArch -notin @('x64', 'arm64')) { throw "Invalid architecture: $detectedArch" }
if (-not [Environment]::Is64BitOperatingSystem) { throw 'Unsupported platform: Windows 32-bit is not supported.' }

$variantValue = if ($Variant) { $Variant } else { 'baseline' }
$assetCandidates = if ($detectedArch -eq 'x64') {
  switch ($variantValue) {
    'baseline' { @('mirror-windows-x64-baseline.exe', 'mirror-windows-x64.exe', 'mirror-windows-x64-modern.exe') }
    'default' { @('mirror-windows-x64.exe', 'mirror-windows-x64-baseline.exe', 'mirror-windows-x64-modern.exe') }
    'modern' { @('mirror-windows-x64-modern.exe', 'mirror-windows-x64.exe', 'mirror-windows-x64-baseline.exe') }
    default { throw "Invalid variant: $variantValue. Must be baseline, default, or modern." }
  }
} else {
  if ($Variant) { throw '-Variant is only valid for x64 installs.' }
  @('mirror-windows-arm64.exe')
}

$availableAssets = @()
foreach ($candidate in $assetCandidates) {
  $asset = @($release.assets) | Where-Object { $_.name -eq $candidate -and $_.browser_download_url } | Select-Object -First 1
  if ($asset) { $availableAssets += $asset }
}
if ($availableAssets.Count -eq 0) { throw "Mirror $targetVersion has no compatible Windows/$detectedArch binary ($variantValue)." }

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
$InstallDir = (Resolve-Path -LiteralPath $InstallDir).Path
$destination = Join-Path $InstallDir 'mirror.exe'
$token = [Guid]::NewGuid().ToString('N')
$temporaryFile = Join-Path $InstallDir ".mirror-install-$token.exe"
$backupFile = Join-Path $InstallDir ".mirror-backup-$token.exe"
$failedFile = Join-Path $InstallDir ".mirror-failed-$token.exe"

try {
  $selectedAsset = $null
  foreach ($candidateAsset in $availableAssets) {
    $downloadUrl = [string]$candidateAsset.browser_download_url
    Assert-SecureUri -Uri $downloadUrl
    Write-Host 'Initiating GUIHO CLI Upgrade / Installation Sequence...'
    Write-Host "Target Version: v$targetVersion"
    Write-Host "Architecture:   $detectedArch"
    Write-Host "Variant:        $variantValue"
    Write-Host "Source URL:     $downloadUrl"
    Write-Host "Binary Destination: $destination"
    Write-Host 'Downloading...'
    try {
      Invoke-WebRequest -Uri $downloadUrl -OutFile $temporaryFile -UseBasicParsing
      $selectedAsset = $candidateAsset
      break
    } catch {
      $downloadError = $_
      $statusCode = try { [int]$downloadError.Exception.Response.StatusCode } catch { 0 }
      if ($statusCode -eq 404) {
        Write-Host "  $($candidateAsset.name) is not published; trying the next compatible asset."
        continue
      }
      throw $downloadError
    }
  }
  if (-not $selectedAsset) { throw "Mirror $targetVersion has no downloadable Windows/$detectedArch binary ($variantValue)." }
  $bytes = [System.IO.File]::ReadAllBytes($temporaryFile)
  if ($bytes.Length -lt 2 -or $bytes[0] -ne 0x4D -or $bytes[1] -ne 0x5A) { throw 'Downloaded file is not a native Windows executable.' }
  Unblock-File -LiteralPath $temporaryFile

  Write-Host 'Validating...'
  $temporaryVersion = Get-MirrorBinaryVersion -Path $temporaryFile
  if ($temporaryVersion -ne $targetVersion) { throw "Downloaded binary reported $temporaryVersion; expected $targetVersion." }

  Write-Host 'Replacing...'
  $hadPrevious = Test-Path -LiteralPath $destination
  if ($hadPrevious) { Move-Item -LiteralPath $destination -Destination $backupFile }
  try {
    Move-Item -LiteralPath $temporaryFile -Destination $destination
    Write-Host 'Verifying...'
    $installedVersion = Get-MirrorBinaryVersion -Path $destination
    if ($installedVersion -ne $targetVersion) { throw "Installed binary reported $installedVersion; expected $targetVersion." }
  } catch {
    if (Test-Path -LiteralPath $destination) { Move-Item -LiteralPath $destination -Destination $failedFile -Force }
    if ($hadPrevious -and (Test-Path -LiteralPath $backupFile)) { Move-Item -LiteralPath $backupFile -Destination $destination }
    throw
  }

  if (Test-Path -LiteralPath $backupFile) {
    try { Remove-Item -LiteralPath $backupFile -Force } catch { Write-Warning "Installed Mirror is verified, but the old backup remains at $backupFile" }
  }
  if (-not $NoPathUpdate -and $env:MIRROR_NO_PATH_UPDATE -ne '1') { Add-InstallDirToPath -Directory $InstallDir }
  Install-MirrorAgentAssets -Release $release -TemporaryDirectory $InstallDir
  Write-Host "Installed Mirror $targetVersion to $destination"
  Write-Host 'Run: mirror --version'
} finally {
  if (Test-Path -LiteralPath $temporaryFile) { Remove-Item -LiteralPath $temporaryFile -Force -ErrorAction SilentlyContinue }
}
