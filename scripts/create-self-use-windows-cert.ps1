param(
  [string]$OutputDir = "",
  [string]$Subject = "CN=TermDock Dev Code Signing",
  [string]$FriendlyName = "TermDock Dev Code Signing",
  [int]$ValidityYears = 3
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($OutputDir)) {
  $OutputDir = Join-Path $env:USERPROFILE ".termdock-secrets\windows"
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$password = ([guid]::NewGuid().ToString("N") + "-Td!9")
$securePassword = ConvertTo-SecureString -String $password -AsPlainText -Force

$existing = Get-ChildItem Cert:\CurrentUser\My |
  Where-Object { $_.Subject -eq $Subject -and $_.FriendlyName -eq $FriendlyName } |
  Sort-Object NotAfter -Descending |
  Select-Object -First 1

if ($existing -and $existing.NotAfter -gt (Get-Date).AddMonths(1)) {
  $cert = $existing
}
else {
  $cert = New-SelfSignedCertificate `
    -Subject $Subject `
    -Type CodeSigningCert `
    -CertStoreLocation "Cert:\CurrentUser\My" `
    -KeyExportPolicy Exportable `
    -KeyAlgorithm RSA `
    -KeyLength 3072 `
    -HashAlgorithm SHA256 `
    -FriendlyName $FriendlyName `
    -NotAfter (Get-Date).AddYears($ValidityYears)
}

$pfxPath = Join-Path $OutputDir "TermDock-dev-code-signing.pfx"
$cerPath = Join-Path $OutputDir "TermDock-dev-code-signing.cer"
$passwordPath = Join-Path $OutputDir "TermDock-dev-code-signing.password.txt"

Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $securePassword | Out-Null
Export-Certificate -Cert $cert -FilePath $cerPath | Out-Null
Set-Content -Path $passwordPath -Value $password -Encoding ascii -NoNewline

Get-PfxData -FilePath $pfxPath -Password $securePassword | Out-Null

[pscustomobject]@{
  subject = $cert.Subject
  thumbprint = $cert.Thumbprint
  notAfter = $cert.NotAfter.ToString("yyyy-MM-dd")
  pfxPath = $pfxPath
  cerPath = $cerPath
  passwordPath = $passwordPath
} | ConvertTo-Json -Compress
