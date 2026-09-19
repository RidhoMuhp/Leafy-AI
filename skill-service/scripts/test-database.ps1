param(
    [string]$BaseUrl = "http://127.0.0.1:8000"
)

$projectRoot = Split-Path $PSScriptRoot -Parent
$envFile = Join-Path $projectRoot ".env"

if (-not (Test-Path $envFile)) {
    throw "File .env tidak ditemukan."
}

$envLine = Get-Content $envFile |
    Where-Object {
        $_ -match '^\s*LEAFY_INTERNAL_KEY\s*='
    } |
    Select-Object -First 1

if (-not $envLine) {
    throw "LEAFY_INTERNAL_KEY tidak ditemukan."
}

$internalKey = ($envLine -split '=', 2)[1].
    Trim().
    Trim('"').
    Trim("'")

if ([string]::IsNullOrWhiteSpace($internalKey)) {
    throw "LEAFY_INTERNAL_KEY kosong."
}

$validHeaders = @{
    "x-leafy-internal-key" = $internalKey
}


function Invoke-LeafyTest {
    param(
        [Parameter(Mandatory)]
        [string]$Name,

        [Parameter(Mandatory)]
        [hashtable]$Body
    )

    Write-Host ""
    Write-Host "===== $Name =====" -ForegroundColor Cyan

    $request = @{
        Method      = "POST"
        Uri         = "$BaseUrl/execute"
        Headers     = $validHeaders
        ContentType = "application/json"
        Body        = (
            $Body |
            ConvertTo-Json -Depth 10 -Compress
        )
    }

    try {
        $response = Invoke-WebRequest `
            @request `
            -UseBasicParsing

        Write-Host "HTTP Status: $($response.StatusCode)"
        Write-Host "Response:"
        Write-Host $response.Content
    }
    catch {
        $statusCode = "Tidak tersedia"

        if ($_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode
        }

        Write-Host "HTTP Status: $statusCode"
        Write-Host "Response:"

        if ($_.ErrorDetails.Message) {
            Write-Host $_.ErrorDetails.Message
        }
        else {
            Write-Host $_.Exception.Message
        }
    }
}


Invoke-LeafyTest `
    -Name "DB 1 - Alias valid" `
    -Body @{
        skill = "list_tables"
        role  = "admin"
        parameters = @{
            database_id = "leafy_core"
        }
    }


Invoke-LeafyTest `
    -Name "DB 2 - Alias unknown" `
    -Body @{
        skill = "list_tables"
        role  = "admin"
        parameters = @{
            database_id = "unknown_database"
        }
    }


Invoke-LeafyTest `
    -Name "DB 3 - User denied" `
    -Body @{
        skill = "list_tables"
        role  = "user"
        parameters = @{
            database_id = "leafy_core"
        }
    }


Invoke-LeafyTest `
    -Name "DB 4 - Raw query rejected" `
    -Body @{
        skill = "list_tables"
        role  = "admin"
        parameters = @{
            database_id = "leafy_core"
            query       = "DROP TABLE users"
        }
    }

    Invoke-LeafyTest `
    -Name "READ 1 - Describe clients" `
    -Body @{
        skill = "describe_table"
        role  = "admin"
        parameters = @{
            database_id = "leafy_core"
            table_id    = "clients"
        }
    }

Invoke-LeafyTest `
    -Name "READ 2 - Read clients" `
    -Body @{
        skill = "read_table"
        role  = "admin"
        parameters = @{
            database_id = "leafy_core"
            table_id    = "clients"
            limit       = 20
            offset      = 0
        }
    }

Invoke-LeafyTest `
    -Name "READ 3 - Count clients" `
    -Body @{
        skill = "count_rows"
        role  = "admin"
        parameters = @{
            database_id = "leafy_core"
            table_id    = "clients"
        }
    }

Invoke-LeafyTest `
    -Name "READ 4 - SQL injection table ID" `
    -Body @{
        skill = "read_table"
        role  = "admin"
        parameters = @{
            database_id = "leafy_core"
            table_id    = "clients; DROP TABLE clients"
        }
    }

Invoke-LeafyTest `
    -Name "READ 5 - Unknown table" `
    -Body @{
        skill = "read_table"
        role  = "admin"
        parameters = @{
            database_id = "leafy_core"
            table_id    = "secret_table"
        }
    }

Invoke-LeafyTest `
    -Name "READ 6 - Excessive limit" `
    -Body @{
        skill = "read_table"
        role  = "admin"
        parameters = @{
            database_id = "leafy_core"
            table_id    = "clients"
            limit       = 1000000
        }
    }