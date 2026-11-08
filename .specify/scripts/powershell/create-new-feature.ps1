# Bootstrap a new Spec Kit feature directory under docs/specs/features/.
#
# Usage:
#   pwsh -File .specify/scripts/powershell/create-new-feature.ps1 -Slug my-feature -Title "My Feature"
#
# -Slug is one directory name: lower-case letters, digits and hyphens, starting with a letter
# or a digit, at most 64 characters. -Title is any one-line text; it is inserted literally
# (`Import/Export`, `R&D` and `$&` stay as typed).
#
# Creates docs/specs/features/<slug>/ with spec.md, plan.md, tasks.md from the
# .specify/templates/ folder, pre-filled with slug, title, and today's date (UTC).
# Nothing is left behind when a step fails.

param(
    [Parameter(Mandatory = $true)][string] $Slug,
    [Parameter(Mandatory = $false)][string] $Title = $null
)

$ErrorActionPreference = 'Stop'

# One safe path component: no separators, no '..', no leading hyphen, no upper case.
if ($Slug -cnotmatch '^[a-z0-9][a-z0-9-]{0,63}$') {
    [Console]::Error.WriteLine("Invalid slug '$Slug': use lower-case letters, digits and hyphens (1-64 characters, starting with a letter or digit).")
    exit 1
}

if (-not $Title) { $Title = $Slug }
if ($Title.Contains("`n") -or $Title.Contains("`r")) {
    [Console]::Error.WriteLine('The title must be a single line.')
    exit 1
}

$repoRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($PSScriptRoot, '..', '..', '..'))
$templates = [System.IO.Path]::Combine($repoRoot, '.specify', 'templates')
$featuresDir = [System.IO.Path]::Combine($repoRoot, 'docs', 'specs', 'features')
$outDir = [System.IO.Path]::Combine($featuresDir, $Slug)

if (-not (Test-Path -LiteralPath $templates -PathType Container)) {
    [Console]::Error.WriteLine("Cannot find $templates -- run from inside the platform monorepo.")
    exit 1
}

if (Test-Path -LiteralPath $outDir) {
    [Console]::Error.WriteLine("Feature directory already exists: $outDir")
    exit 1
}

$today = (Get-Date).ToUniversalTime().ToString('yyyy-MM-dd')
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

# The placeholders and their values, filled in ONE pass (as the bash script does): a value is
# never re-scanned, so a title that contains `[short-slug]` or `YYYY-MM-DD` stays as typed. The
# evaluator's return value is inserted literally (no `$&` / `$1` substitutions).
$placeholders = [System.Collections.Generic.Dictionary[string, string]]::new([System.StringComparer]::Ordinal)
$placeholders['[FEATURE NAME]'] = $Title
$placeholders['[short-slug]'] = $Slug
$placeholders['YYYY-MM-DD'] = $today
$placeholderPattern = ($placeholders.Keys | ForEach-Object { [regex]::Escape($_) }) -join '|'
$fill = [System.Text.RegularExpressions.MatchEvaluator] { param($match) $placeholders[$match.Value] }

[System.IO.Directory]::CreateDirectory($featuresDir) | Out-Null
New-Item -ItemType Directory -Path $outDir | Out-Null
try {
    foreach ($kind in @('spec', 'plan', 'tasks')) {
        $src = [System.IO.Path]::Combine($templates, "$kind-template.md")
        $dst = [System.IO.Path]::Combine($outDir, "$kind.md")
        $content = [regex]::Replace([System.IO.File]::ReadAllText($src, $utf8NoBom), $placeholderPattern, $fill)
        [System.IO.File]::WriteAllText($dst, $content, $utf8NoBom)
        Write-Output "  + $dst"
    }
}
catch {
    # Remove the half-made directory so a rerun starts clean.
    Remove-Item -LiteralPath $outDir -Recurse -Force -ErrorAction SilentlyContinue
    [Console]::Error.WriteLine("Scaffolding failed: $($_.Exception.Message)")
    exit 1
}

Write-Output ""
Write-Output "Created Spec Kit feature directory: $outDir"
Write-Output ""
Write-Output "Next steps:"
Write-Output "  1. Open spec.md and replace placeholders."
Write-Output "  2. Once approved, fill in plan.md."
Write-Output "  3. Once plan is approved, expand tasks.md."
