$ErrorActionPreference = "Continue"

$repoRoot = Split-Path -Parent $PSScriptRoot
$skillRoot = Join-Path $repoRoot "skill-service"
$apiRoot = Join-Path $repoRoot "api"

$python = Join-Path `
    $skillRoot `
    ".venv\Scripts\python.exe"

$results = @()

function Invoke-BetaTest {
    param(
        [string]$Name,
        [string]$WorkingDirectory,
        [string]$Executable,
        [string[]]$Arguments
    )

    Write-Host ""
    Write-Host "========================================"
    Write-Host "Running: $Name"
    Write-Host "========================================"

    Push-Location $WorkingDirectory

    try {
        & $Executable @Arguments
        $exitCode = $LASTEXITCODE
    }
    catch {
        Write-Host $_.Exception.Message `
            -ForegroundColor Red

        $exitCode = 1
    }
    finally {
        Pop-Location
    }

    $results += [PSCustomObject]@{
        Test = $Name
        ExitCode = $exitCode
        Status = if ($exitCode -eq 0) {
            "PASS"
        }
        else {
            "FAIL"
        }
    }
}

if (-not (Test-Path $python)) {
    Write-Host `
        "Python virtual environment tidak ditemukan: $python" `
        -ForegroundColor Red

    exit 1
}

Write-Host "Leafy AI Beta Gate"
Write-Host "Pastikan MySQL, Skill Service, dan Node API aktif."
Write-Host ""

Invoke-BetaTest `
    -Name "Client import unit tests" `
    -WorkingDirectory $skillRoot `
    -Executable $python `
    -Arguments @(
        "-m",
        "pytest",
        "tests/test_client_imports.py",
        "-q"
    )

Invoke-BetaTest `
    -Name "Client import workflow" `
    -WorkingDirectory $skillRoot `
    -Executable $python `
    -Arguments @(
        "tests/manual_client_import_test.py"
    )

Invoke-BetaTest `
    -Name "Outreach pipeline" `
    -WorkingDirectory $skillRoot `
    -Executable $python `
    -Arguments @(
        "tests/manual_outreach_pipeline_test.py"
    )

Invoke-BetaTest `
    -Name "Finance workflow" `
    -WorkingDirectory $skillRoot `
    -Executable $python `
    -Arguments @(
        "tests/manual_finance_test.py"
    )

Invoke-BetaTest `
    -Name "Finance void workflow" `
    -WorkingDirectory $skillRoot `
    -Executable $python `
    -Arguments @(
        "tests/manual_finance_void_test.py"
    )

Invoke-BetaTest `
    -Name "Daily business summary" `
    -WorkingDirectory $skillRoot `
    -Executable $python `
    -Arguments @(
        "tests/manual_daily_business_summary_test.py"
    )

Invoke-BetaTest `
    -Name "Document ingestion" `
    -WorkingDirectory $skillRoot `
    -Executable $python `
    -Arguments @(
        "tests/manual_document_ingestion_test.py"
    )

Invoke-BetaTest `
    -Name "Document skills" `
    -WorkingDirectory $skillRoot `
    -Executable $python `
    -Arguments @(
        "tests/manual_document_skills_test.py"
    )

Invoke-BetaTest `
    -Name "Document permissions" `
    -WorkingDirectory $apiRoot `
    -Executable "node" `
    -Arguments @(
        "tests/manualDocumentPermissionTest.js"
    )

Invoke-BetaTest `
    -Name "Document planner" `
    -WorkingDirectory $apiRoot `
    -Executable "node" `
    -Arguments @(
        "tests/manualDocumentPlannerTest.js"
    )

Invoke-BetaTest `
    -Name "Document multipart API" `
    -WorkingDirectory $apiRoot `
    -Executable "node" `
    -Arguments @(
        "tests/manualDocumentMultipartTest.js"
    )

Invoke-BetaTest `
    -Name "WhatsApp attachment workflow" `
    -WorkingDirectory $apiRoot `
    -Executable "node" `
    -Arguments @(
        "tests/manualAttachmentWorkflowTest.js"
    )

Write-Host ""
Write-Host "============== BETA GATE =============="
$results | Format-Table -AutoSize

$failedTests = @(
    $results |
        Where-Object {
            $_.Status -eq "FAIL"
        }
)

if ($failedTests.Count -gt 0) {
    Write-Host "Result: BETA BLOCKED" `
        -ForegroundColor Red

    Write-Host `
        "$($failedTests.Count) test suite gagal."

    exit 1
}

Write-Host "Result: BETA READY" `
    -ForegroundColor Green

exit 0