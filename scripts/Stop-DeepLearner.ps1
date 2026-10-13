#Requires -Version 7.0
[CmdletBinding()] param()
. "$PSScriptRoot/Start-DeepLearner.ps1"
$root=Get-LocalRoot
Assert-NoLink $root
$active=Get-Content -Raw -LiteralPath (Join-Path $root 'active.json') | ConvertFrom-Json
if (-not $active.active) { Write-Host 'No active local run recorded.'; return }
if ($active.root -ne $root -or $active.repo -ne $script:LocalRepo -or $active.runId -notmatch '^[a-f0-9]{32}$' -or $active.run -ne (Join-Path $root "runs/$($active.runId)")) { throw 'Run identity mismatch.' }
$receipt=Get-Content -Raw -LiteralPath (Join-Path $root 'ownership.json') | ConvertFrom-Json
if ($receipt.ownerSid -ne [Security.Principal.WindowsIdentity]::GetCurrent().User.Value -or $receipt.root -ne $root -or $receipt.repo -ne $script:LocalRepo) { throw 'Ownership mismatch.' }
$owner=Get-Process -Id $active.ownerPid -ErrorAction Stop
if ($owner.Path -ne $active.ownerPath -or $owner.StartTime.ToUniversalTime().ToString('o') -ne $active.ownerStart) { throw 'Owner exited or PID reused; no process was stopped.' }
Assert-NoLink $active.run
# Request only. The live owner retains all native process handles; this script kills no PID.
[IO.File]::WriteAllText((Join-Path $active.run 'stop.request'),$active.runId)
$clock=[Diagnostics.Stopwatch]::StartNew()
while ($clock.Elapsed.TotalSeconds -lt 100) {
    $resultPath=Join-Path $active.run 'result.json'
    if (Test-Path -LiteralPath $resultPath) { Get-Content -Raw -LiteralPath $resultPath; return }
    Start-Sleep -Milliseconds 250
}
throw 'Stop requested; final cleanup evidence unavailable. Do not terminate unrelated processes.'
