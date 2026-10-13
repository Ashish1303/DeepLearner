#Requires -Version 7.0
[CmdletBinding()] param([switch]$ApprovedLocalWrite,[Parameter(Mandatory)][string]$Manifest,[Parameter(Mandatory)][ValidatePattern('^[A-Fa-f0-9]{64}$')][string]$ManifestSha256)
. "$PSScriptRoot/Start-DeepLearner.ps1"
if (-not $ApprovedLocalWrite) { throw 'Explicit -ApprovedLocalWrite and owner-approved manifest required.' }
Assert-NoLink $Manifest
$file=Get-Item -LiteralPath $Manifest
if ($file.PSIsContainer -or $file.Length -gt 1000000 -or (Get-FileHash -LiteralPath $file.FullName).Hash -ne $ManifestSha256) { throw 'Manifest size/hash rejected before startup.' }
Invoke-LocalRun -Mode Content -ApprovedLocalWrite:$ApprovedLocalWrite -Manifest $Manifest -ManifestSha256 $ManifestSha256
