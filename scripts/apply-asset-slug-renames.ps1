param(
    [string]$ReportPath = (Join-Path $PSScriptRoot '..\plans\asset-slug-report.json'),
    [string]$PublicRoot = (Join-Path $PSScriptRoot '..\public'),
    [switch]$WhatIf
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $ReportPath)) {
    throw "Report file not found: $ReportPath"
}

if (-not (Test-Path -LiteralPath $PublicRoot)) {
    throw "Public root not found: $PublicRoot"
}

$json = Get-Content -LiteralPath $ReportPath -Raw | ConvertFrom-Json

$renamed = @()
$skipped = @()

foreach ($entry in $json) {
    $relativePath = $entry.relativePath -replace '\\', '/'
    $sourcePath = Join-Path $PublicRoot $relativePath

    if (-not (Test-Path -LiteralPath $sourcePath)) {
        $skipped += [PSCustomObject]@{
            relativePath = $relativePath
            reason       = 'missing-source'
        }
        continue
    }

    $targetPath = Join-Path (Split-Path $sourcePath -Parent) $entry.suggestedSlug

    if ($sourcePath -ieq $targetPath) {
        $skipped += [PSCustomObject]@{
            relativePath = $relativePath
            reason       = 'already-slugged'
        }
        continue
    }

    if (Test-Path -LiteralPath $targetPath) {
        $skipped += [PSCustomObject]@{
            relativePath = $relativePath
            reason       = 'target-exists'
            target       = $targetPath.Substring($PublicRoot.Length + 1)
        }
        continue
    }

    if ($WhatIf) {
        $renamed += [PSCustomObject]@{
            from = $relativePath
            to   = $targetPath.Substring($PublicRoot.Length + 1)
        }
    } else {
        Rename-Item -LiteralPath $sourcePath -NewName $entry.suggestedSlug
        $renamed += [PSCustomObject]@{
            from = $relativePath
            to   = $targetPath.Substring($PublicRoot.Length + 1)
        }
    }
}

$result = [PSCustomObject]@{
    renamed = $renamed
    skipped = $skipped
}

$result | ConvertTo-Json -Depth 5
