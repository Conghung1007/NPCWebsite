# Set Resend email env vars on Render and trigger redeploy.
# Usage:
#   $env:RENDER_API_KEY = "rnd_..."
#   .\scripts\set-render-resend-env.ps1
#
# Resend key is read from $env:RESEND_API_KEY, or backend/.env if unset.

$ErrorActionPreference = "Stop"

$serviceId = "srv-d9olcirm8hqs739b4h50"
$repoRoot = Split-Path $PSScriptRoot -Parent
$envFile = Join-Path $repoRoot "backend\.env"

function Read-DotEnvValue {
  param([string]$Key)
  if (-not (Test-Path $envFile)) { return $null }
  foreach ($line in Get-Content $envFile) {
    if ($line -match "^\s*#" -or $line -notmatch "=") { continue }
    $i = $line.IndexOf("=")
    $k = $line.Substring(0, $i).Trim()
    if ($k -ne $Key) { continue }
    $v = $line.Substring($i + 1).Trim()
    if ($v.StartsWith('"') -and $v.EndsWith('"')) { $v = $v.Substring(1, $v.Length - 2) }
    return $v
  }
  return $null
}

$resendApiKey = if ($env:RESEND_API_KEY) { $env:RESEND_API_KEY.Trim() } else { Read-DotEnvValue "RESEND_API_KEY" }
if ($resendApiKey) { $resendApiKey = $resendApiKey.Trim() }

$resendFromEmail = if ($env:RESEND_FROM_EMAIL) { $env:RESEND_FROM_EMAIL.Trim() } else { Read-DotEnvValue "RESEND_FROM_EMAIL" }
if (-not $resendFromEmail) { $resendFromEmail = "TNJS <support@tnjs.vn>" } else { $resendFromEmail = $resendFromEmail.Trim() }

$emailAppName = if ($env:EMAIL_APP_NAME) { $env:EMAIL_APP_NAME.Trim() } else { Read-DotEnvValue "EMAIL_APP_NAME" }
if (-not $emailAppName) { $emailAppName = "TNJS" } else { $emailAppName = $emailAppName.Trim() }

if (-not $env:RENDER_API_KEY) {
  Write-Error "RENDER_API_KEY is required. Create one at https://dashboard.render.com/u/settings#api-keys"
}
if (-not $resendApiKey) {
  Write-Error "RESEND_API_KEY not found. Set env RESEND_API_KEY or add it to backend/.env"
}

$headers = @{
  Authorization  = "Bearer $($env:RENDER_API_KEY)"
  Accept         = "application/json"
  "Content-Type" = "application/json"
}

function Set-RenderEnvVar {
  param([string]$Key, [string]$Value)
  $uri = "https://api.render.com/v1/services/$serviceId/env-vars/$Key"
  $body = @{ value = $Value } | ConvertTo-Json
  Invoke-RestMethod -Uri $uri -Headers $headers -Method Put -Body $body | Out-Null
  Write-Host "Set $Key"
}

Set-RenderEnvVar -Key "RESEND_API_KEY" -Value $resendApiKey
Set-RenderEnvVar -Key "RESEND_FROM_EMAIL" -Value $resendFromEmail
Set-RenderEnvVar -Key "EMAIL_APP_NAME" -Value $emailAppName

Write-Host "Triggering deploy..."
$deploy = Invoke-RestMethod -Uri "https://api.render.com/v1/services/$serviceId/deploys" -Headers $headers -Method Post -Body "{}"
$deployId = if ($deploy.deploy) { $deploy.deploy.id } else { $deploy.id }
Write-Host "Deploy queued: $deployId"
Write-Host "Verify after live: https://npcwebsite.onrender.com/api/health (features.resendEmail should be true)"
