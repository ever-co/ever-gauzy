# Bootstrap a new Spec Kit feature directory under docs/specs/features/.
#
# Usage:
#   .\.specify\scripts\powershell\create-new-feature.ps1 -Slug my-feature -Title "My Feature"
#
# Creates docs/specs/features/<slug>/ with spec.md, plan.md, tasks.md from
# the .specify/templates/ folder, pre-filled with slug, title, and today's date.

param(
    [Parameter(Mandatory = $true)][string] $Slug,
    [Parameter(Mandatory = $false)][string] $Title = $null
)

if (-not $Title) { $Title = $Slug }

$repoRoot = Resolve-Path "$PSScriptRoot\..\..\.."
$templates = Join-Path $repoRoot ".specify\templates"
$outDir = Join-Path $repoRoot "docs\specs\features\$Slug"

if (-not (Test-Path $templates)) {
    Write-Error "Cannot find $templates -- run from inside the platform monorepo."
    exit 1
}

if (Test-Path $outDir) {
    Write-Error "Feature directory already exists: $outDir"
    exit 1
}

New-Item -ItemType Directory -Path $outDir -Force | Out-Null
$today = Get-Date -Format "yyyy-MM-dd"

foreach ($kind in @("spec", "plan", "tasks")) {
    $src = Join-Path $templates "$kind-template.md"
    $dst = Join-Path $outDir "$kind.md"
    (Get-Content -Raw -Encoding UTF8 $src) `
        -replace [regex]::Escape("[FEATURE NAME]"), $Title `
        -replace [regex]::Escape("[short-slug]"), $Slug `
        -replace "YYYY-MM-DD", $today |
        Set-Content -Path $dst -Encoding UTF8
    Write-Host "  + $dst"
}

Write-Host ""
Write-Host "Created Spec Kit feature directory: $outDir"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Open spec.md and replace placeholders."
Write-Host "  2. Once approved, fill in plan.md."
Write-Host "  3. Once plan is approved, expand tasks.md."
