param(
    [string]$AssetsRoot = (Join-Path $PSScriptRoot '..\public\Assets'),
    [string]$OutputPath = (Join-Path $PSScriptRoot '..\plans\asset-slug-report.json')
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $AssetsRoot)) {
    throw "Assets root path not found: $AssetsRoot"
}

$publicRoot = (Get-Item (Join-Path $PSScriptRoot '..\public')).FullName
$files = Get-ChildItem -Path $AssetsRoot -Recurse -File

$needsNormalization = $files | Where-Object {
    $_.Name -cmatch '[A-Z]' -or $_.Name -match "[^a-z0-9_.]"
}

$raw = foreach ($file in $needsNormalization) {
    $relative = $file.FullName.Substring($publicRoot.Length + 1).Replace('\\','/')
    $base = $file.BaseName.ToLowerInvariant()
    $slugBase = [System.Text.RegularExpressions.Regex]::Replace($base, '[^a-z0-9]+', '_').Trim('_')
    if (-not $slugBase) { $slugBase = 'unnamed' }
    $extension = $file.Extension.ToLowerInvariant()
    $suggested = "$slugBase$extension"

    [PSCustomObject]@{
        relativePath = $relative
        suggestedSlug = $suggested
    }
}

$collisionLookup = @{}
foreach ($group in ($raw | Group-Object -Property suggestedSlug)) {
    if ($group.Count -gt 1) {
        $collisionLookup[$group.Name] = $group.Group.relativePath
    }
}

$report = foreach ($entry in $raw) {
    $collisions = @()
    if ($collisionLookup.ContainsKey($entry.suggestedSlug)) {
        $collisions = $collisionLookup[$entry.suggestedSlug] | Where-Object { $_ -ne $entry.relativePath }
    }

    [PSCustomObject]@{
        relativePath   = $entry.relativePath
        suggestedSlug  = $entry.suggestedSlug
        collisionWith  = $collisions
    }
}

$json = $report | ConvertTo-Json -Depth 5

Set-Content -LiteralPath $OutputPath -Value $json -Encoding UTF8

Write-Host "Asset slug report written to $OutputPath"
