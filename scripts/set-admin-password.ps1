# Run locally: powershell -ExecutionPolicy Bypass -File .\scripts\set-admin-password.ps1
# Reads credentials from .env.local. Passwords are prompted, never command-line arguments.
$ErrorActionPreference = 'Stop'
$settings = @{}
$envFile = Join-Path (Split-Path -Parent $PSScriptRoot) '.env.local'
if (Test-Path -LiteralPath $envFile) {
    foreach ($line in Get-Content -LiteralPath $envFile -Encoding UTF8) {
        if ($line -match '^\s*([A-Z_][A-Z0-9_]*)\s*=(.*)$') {
            $value = $Matches[2].Trim()
            if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) {
                $value = $value.Substring(1, $value.Length - 2)
            }
            $settings[$Matches[1]] = $value
        }
    }
}
foreach ($name in @('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'ADMIN_EMAIL')) {
    $configured = [Environment]::GetEnvironmentVariable($name)
    if ($configured) { $settings[$name] = $configured }
    if (-not $settings[$name]) { throw "Missing $name in .env.local or environment." }
}
$baseUrl = $settings['NEXT_PUBLIC_SUPABASE_URL'].TrimEnd('/')
$parsedUrl = [uri]$baseUrl
if ($parsedUrl.Scheme -ne 'https' -or $parsedUrl.AbsolutePath -ne '/' -or $parsedUrl.Query -or $parsedUrl.UserInfo) {
    throw 'Supabase URL must be an HTTPS origin.'
}
$adminEmail = $settings['ADMIN_EMAIL'].Trim()
$headers = @{
    apikey = $settings['SUPABASE_SERVICE_ROLE_KEY']
    Authorization = "Bearer $($settings['SUPABASE_SERVICE_ROLE_KEY'])"
}
$plainPassword = $null
$confirmation = $null
$payload = $null
try {
    # Find the existing account only. Never create users or change authorization metadata.
    $account = $null
    for ($page = 1; ; $page++) {
        $result = Invoke-RestMethod -Uri "$baseUrl/auth/v1/admin/users?page=$page&per_page=100" -Headers $headers -Method Get -TimeoutSec 15
        $users = @($result.users)
        $account = $users | Where-Object { $_.email -ieq $adminEmail } | Select-Object -First 1
        if ($account -or $users.Count -lt 100) { break }
    }
    if (-not $account) { throw 'Configured admin email was not found in Supabase Auth.' }
    Write-Host "Updating password for: $adminEmail"
    $secret = Read-Host 'New password (at least 8 characters)' -AsSecureString
    $repeat = Read-Host 'Confirm new password' -AsSecureString
    try {
        $plainPassword = [System.Net.NetworkCredential]::new('', $secret).Password
        $confirmation = [System.Net.NetworkCredential]::new('', $repeat).Password
        if ($plainPassword.Length -lt 8) { throw 'Password must contain at least 8 characters.' }
        if ($plainPassword -cne $confirmation) { throw 'Passwords do not match.' }
        $payload = @{ password = $plainPassword } | ConvertTo-Json -Compress
        $updated = Invoke-RestMethod -Uri "$baseUrl/auth/v1/admin/users/$($account.id)" -Headers $headers -Method Put -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($payload)) -TimeoutSec 15
        if ($updated.id -ne $account.id) { throw 'The server did not confirm the expected account update.' }
        Write-Host 'Password updated. Sign in at /admin using this email and the new password.'
    } finally {
        $secret.Dispose()
        $repeat.Dispose()
    }
} catch {
    # Do not print HTTP request details, headers or payloads that could include secrets.
    if ($_.Exception.Response) {
        throw "Supabase rejected the request (HTTP $([int]$_.Exception.Response.StatusCode)). Check the service key, network and password policy."
    }
    throw
} finally {
    $plainPassword = $null
    $confirmation = $null
    $payload = $null
    $headers.Clear()
    $settings.Clear()
}
