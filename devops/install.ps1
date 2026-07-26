param(
  [string]$Version = $(if ($env:MIRROR_VERSION) { $env:MIRROR_VERSION } else { 'latest' }),
  [string]$InstallDir = $(if ($env:MIRROR_INSTALL_DIR) { $env:MIRROR_INSTALL_DIR } else { Join-Path $HOME '.local\bin' })
)

$ErrorActionPreference = 'Stop'
$Repo = if ($env:MIRROR_REPO) { $env:MIRROR_REPO } else { 'CGuiho/mirror' }
$MirrorHome = if ($env:MIRROR_HOME_DIR) { $env:MIRROR_HOME_DIR } else { $HOME }
$EmDash = [char]0x2014
$BeginMarker = "<!-- BEGIN MIRROR $EmDash DO NOT EDIT THIS SECTION -->"
$EndMarker = '<!-- END MIRROR -->'

function Get-MirrorAssetName {
  $architecture = if ($env:MIRROR_TEST_ARCH) {
    $env:MIRROR_TEST_ARCH.ToLowerInvariant()
  } else {
    [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString().ToLowerInvariant()
  }
  switch ($architecture) {
    { $_ -in @('x64', 'amd64', 'x86_64') } { return 'mirror-windows-amd64.exe' }
    { $_ -in @('arm64', 'aarch64') } { return 'mirror-windows-arm64.exe' }
    default { throw "Unsupported Mirror installer architecture: $architecture" }
  }
}

function Resolve-MirrorVersion([string]$Requested) {
  $normalized = $Requested -replace '^mirror/v', '' -replace '^v', ''
  if ($normalized -ne 'latest') { return $normalized }
  if ($env:MIRROR_ASSET_DIR) { throw 'An exact -Version is required with MIRROR_ASSET_DIR.' }
  $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest" -Headers @{ 'User-Agent' = 'guiho-mirror-installer' }
  if ($release.tag_name -notmatch '^mirror/v(.+)$') {
    throw "Latest release tag is not canonical: $($release.tag_name)"
  }
  return $Matches[1]
}

function Get-MirrorAssetBase([string]$ResolvedVersion) {
  if ($env:MIRROR_DOWNLOAD_BASE_URL) { return $env:MIRROR_DOWNLOAD_BASE_URL.TrimEnd('/') }
  return "https://github.com/$Repo/releases/download/mirror%2Fv$ResolvedVersion"
}

function Get-MirrorAsset([string]$Name, [string]$Destination, [string]$Base) {
  if ($env:MIRROR_ASSET_DIR) {
    Copy-Item -LiteralPath (Join-Path $env:MIRROR_ASSET_DIR $Name) -Destination $Destination -Force
    return
  }
  Write-Host "Downloading $Base/$Name"
  Invoke-WebRequest -Uri "$Base/$Name" -OutFile $Destination -UseBasicParsing
}

function Test-MirrorChecksum([string]$Manifest, [string]$Name, [string]$Path) {
  $line = Get-Content -LiteralPath $Manifest | Where-Object { $_ -match "^[0-9a-fA-F]{64}\s+\*?$([regex]::Escape($Name))$" }
  if (@($line).Count -ne 1) { throw "Missing or duplicate checksum for $Name" }
  $expected = (($line -split '\s+')[0]).ToLowerInvariant()
  $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToLowerInvariant()
  if ($actual -ne $expected) { throw "Checksum mismatch for $Name" }
  Write-Host "Verified SHA-256: $Name"
}

function Read-ValidatedMarkdown([string]$Path, [string]$ExpectedName) {
  $bytes = [System.IO.File]::ReadAllBytes($Path)
  if ($bytes.Length -eq 0) { throw "Markdown asset is empty: $Path" }
  if ($bytes.Length -ge 2 -and $bytes[0] -eq 0x4d -and $bytes[1] -eq 0x5a) { throw "Markdown asset is executable: $Path" }
  if ($bytes -contains 0) { throw "Markdown asset contains NUL bytes: $Path" }
  $encoding = [System.Text.UTF8Encoding]::new($false, $true)
  $content = $encoding.GetString($bytes) -replace "`r`n", "`n"
  if (-not $content.StartsWith("---`n") -or $content -notmatch "(?m)^name:\s*$([regex]::Escape($ExpectedName))\s*$") {
    throw "Markdown asset has invalid frontmatter identity: $Path"
  }
  return $content
}

function Install-MirrorSkill([string]$SkillFile, [string]$Destination) {
  $parent = Split-Path -Parent $Destination
  New-Item -ItemType Directory -Path $parent -Force | Out-Null
  $stage = Join-Path $parent ('.mirror-skill-new-' + [guid]::NewGuid().ToString('N'))
  $backup = Join-Path $parent ('.mirror-skill-backup-' + [guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $stage | Out-Null
  Copy-Item -LiteralPath $SkillFile -Destination (Join-Path $stage 'SKILL.md')
  if (Test-Path -LiteralPath $Destination) { Move-Item -LiteralPath $Destination -Destination $backup }
  try {
    Move-Item -LiteralPath $stage -Destination $Destination
    if (Test-Path -LiteralPath $backup) { Remove-Item -LiteralPath $backup -Recurse -Force }
  } catch {
    if (Test-Path -LiteralPath $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
    if (Test-Path -LiteralPath $backup) { Move-Item -LiteralPath $backup -Destination $Destination }
    throw
  }
  Write-Host "Installed skill: $Destination"
}

function Set-MirrorInstruction([string]$Path, [string]$PromptContent) {
  $existing = if (Test-Path -LiteralPath $Path) { [System.IO.File]::ReadAllText($Path) } else { '' }
  $begin = [regex]::Escape($BeginMarker)
  $end = [regex]::Escape($EndMarker)
  $clean = [regex]::Replace($existing, "(?ms)^$begin\r?\n.*?^$end\r?\n?", '').TrimEnd()
  $newline = if ($existing.Contains("`r`n")) { "`r`n" } else { "`n" }
  $block = $BeginMarker + $newline + $PromptContent.Trim() + $newline + $EndMarker + $newline
  $next = if ($clean) { $clean + $newline + $newline + $block } else { $block }
  $parent = Split-Path -Parent $Path
  if ($parent) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
  $temporary = "$Path.mirror-$([guid]::NewGuid().ToString('N'))"
  [System.IO.File]::WriteAllText($temporary, $next, [System.Text.UTF8Encoding]::new($false))
  Move-Item -LiteralPath $temporary -Destination $Path -Force
  Write-Host "Updated instruction block: $Path"
}

function Install-MirrorInstructions([string]$PromptContent) {
  $targets = @()
  if (Test-Path -LiteralPath (Join-Path (Get-Location) 'AGENTS.md')) { $targets += (Join-Path (Get-Location) 'AGENTS.md') }
  if (Test-Path -LiteralPath (Join-Path (Get-Location) 'CLAUDE.md')) { $targets += (Join-Path (Get-Location) 'CLAUDE.md') }
  if ($targets.Count -eq 0) { $targets += (Join-Path (Get-Location) 'AGENTS.md') }
  foreach ($target in $targets) { Set-MirrorInstruction -Path $target -PromptContent $PromptContent }
}

function Add-MirrorPath([string]$Directory) {
  if ($env:MIRROR_SKIP_PATH_UPDATE -eq '1') { return }
  $current = [Environment]::GetEnvironmentVariable('Path', 'User')
  $parts = @($current -split ';' | Where-Object { $_ })
  if ($parts -notcontains $Directory) {
    [Environment]::SetEnvironmentVariable('Path', (($parts + $Directory) -join ';'), 'User')
    Write-Host "Added $Directory to the user PATH."
  }
}

if ($env:MIRROR_INSTALLER_SOURCE_ONLY -eq '1') { return }

$asset = Get-MirrorAssetName
$resolvedVersion = Resolve-MirrorVersion $Version
$base = Get-MirrorAssetBase $resolvedVersion
$temporaryDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ('mirror-install-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $temporaryDirectory | Out-Null
try {
  Write-Host 'Installing GUIHO Mirror'
  Write-Host "Version: $resolvedVersion"
  Write-Host "Target: $asset"
  Write-Host "Source: $base"

  $manifest = Join-Path $temporaryDirectory 'checksums.txt'
  $binary = Join-Path $temporaryDirectory $asset
  $skillArchive = Join-Path $temporaryDirectory 'guiho-s-mirror.zip'
  $instruction = Join-Path $temporaryDirectory 'guiho-i-mirror.md'
  Get-MirrorAsset 'checksums.txt' $manifest $base
  Get-MirrorAsset $asset $binary $base
  Get-MirrorAsset 'guiho-s-mirror.zip' $skillArchive $base
  Get-MirrorAsset 'guiho-i-mirror.md' $instruction $base
  Test-MirrorChecksum $manifest $asset $binary
  Test-MirrorChecksum $manifest 'guiho-s-mirror.zip' $skillArchive
  Test-MirrorChecksum $manifest 'guiho-i-mirror.md' $instruction

  $expanded = Join-Path $temporaryDirectory 'skill'
  Expand-Archive -LiteralPath $skillArchive -DestinationPath $expanded
  $skill = Join-Path $expanded 'guiho-s-mirror\SKILL.md'
  [void](Read-ValidatedMarkdown $skill 'guiho-s-mirror')
  $promptContent = Read-ValidatedMarkdown $instruction 'guiho-i-mirror'

  New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
  $destination = Join-Path $InstallDir 'mirror.exe'
  $backup = "$destination.mirror-backup"
  if (Test-Path -LiteralPath $backup) { Remove-Item -LiteralPath $backup -Force }
  if (Test-Path -LiteralPath $destination) { Move-Item -LiteralPath $destination -Destination $backup }
  try {
    Copy-Item -LiteralPath $binary -Destination $destination
    $previousDisable = $env:MIRROR_DISABLE_UPDATE_CHECK
    $env:MIRROR_DISABLE_UPDATE_CHECK = '1'
    try { $observed = (& $destination --version | Out-String).Trim() } finally { $env:MIRROR_DISABLE_UPDATE_CHECK = $previousDisable }
    if ($observed -ne "mirror v$resolvedVersion") { throw "Installed binary version verification failed: $observed" }
    if (Test-Path -LiteralPath $backup) { Remove-Item -LiteralPath $backup -Force }
  } catch {
    if (Test-Path -LiteralPath $destination) { Remove-Item -LiteralPath $destination -Force }
    if (Test-Path -LiteralPath $backup) { Move-Item -LiteralPath $backup -Destination $destination }
    throw
  }
  Write-Host "Installed binary: $destination"

  Install-MirrorSkill $skill (Join-Path $MirrorHome '.agents\skills\guiho-s-mirror')
  Install-MirrorSkill $skill (Join-Path $MirrorHome '.claude\skills\guiho-s-mirror')
  Install-MirrorInstructions $promptContent
  Add-MirrorPath $InstallDir
  Write-Host "Mirror installation complete: mirror v$resolvedVersion"
} finally {
  if (Test-Path -LiteralPath $temporaryDirectory) { Remove-Item -LiteralPath $temporaryDirectory -Recurse -Force }
}
