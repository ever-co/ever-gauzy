# Check that the host has everything Spec Kit needs, at the versions the monorepo requires.
# Usage: pwsh -File .specify/scripts/powershell/check-prerequisites.ps1
#
# The versions follow the root package.json: `engines.node` (>=26), `engines.yarn` (>=1.22)
# and `packageManager` (yarn@1.22.22, i.e. Yarn classic 1.x -- Yarn 2+ is refused).

$NodeMinMajor = 26
$YarnMajor = 1
$YarnMinMinor = 22

$script:ok = $true

function Write-Ok([string] $Cmd, [string] $Detail) {
    Write-Output ("  [ok]    {0,-12} {1}" -f $Cmd, $Detail)
}

function Write-Miss([string] $Cmd, [string] $Detail) {
    Write-Output ("  [MISS]  {0,-12} {1}" -f $Cmd, $Detail)
    $script:ok = $false
}

# The executable behind a command name (yarn.cmd rather than a blocked yarn.ps1 on Windows), or $null.
function Find-Tool([string] $Cmd) {
    Get-Command $Cmd -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
}

# The first line a tool prints for --version, or '' when it cannot be run.
function Get-ToolVersion($Tool) {
    try {
        $line = & $Tool.Source --version 2>&1 | Select-Object -First 1
        return "$line".Trim()
    }
    catch {
        return ''
    }
}

# Major and minor numbers of a version string such as 'v26.1.0' or '1.22.22', or $null.
function Get-VersionParts([string] $Raw) {
    if ($Raw -match '^v?(\d+)\.(\d+)') {
        return @([int] $Matches[1], [int] $Matches[2])
    }
    return $null
}

function Test-Node {
    $hint = "install Node.js $NodeMinMajor+ (package.json engines.node >=$NodeMinMajor)"
    $tool = Find-Tool 'node'
    if (-not $tool) { Write-Miss 'node' $hint; return }
    $version = Get-ToolVersion $tool
    $parts = Get-VersionParts $version
    if (-not $parts) { Write-Miss 'node' "unreadable version '$version'; $hint" }
    elseif ($parts[0] -lt $NodeMinMajor) { Write-Miss 'node' "found $version; $hint" }
    else { Write-Ok 'node' $version }
}

function Test-Yarn {
    $hint = "install Yarn classic $YarnMajor.$YarnMinMinor+ (packageManager yarn@1.22.22; corepack enable)"
    $tool = Find-Tool 'yarn'
    if (-not $tool) { Write-Miss 'yarn' $hint; return }
    $version = Get-ToolVersion $tool
    $parts = Get-VersionParts $version
    if (-not $parts) { Write-Miss 'yarn' "unreadable version '$version'; $hint" }
    elseif ($parts[0] -ne $YarnMajor -or $parts[1] -lt $YarnMinMinor) { Write-Miss 'yarn' "found $version; $hint" }
    else { Write-Ok 'yarn' $version }
}

function Test-Git {
    $tool = Find-Tool 'git'
    if ($tool) { Write-Ok 'git' (Get-ToolVersion $tool) }
    else { Write-Miss 'git' 'install Git' }
}

Write-Output "Checking Spec Kit prerequisites..."
Test-Node
Test-Yarn
Test-Git

if ($script:ok) {
    Write-Output ""
    Write-Output "All prerequisites present."
}
else {
    Write-Output ""
    [Console]::Error.WriteLine('Some prerequisites are missing or too old -- see hints above.')
    exit 1
}
