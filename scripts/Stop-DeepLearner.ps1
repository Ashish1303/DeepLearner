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
function Get-OwnerStartUtcTicks($Value) {
    if ($Value -is [datetime]) {
        if ($Value.Kind -eq [DateTimeKind]::Unspecified -or
            ($Value.Kind -eq [DateTimeKind]::Local -and [TimeZoneInfo]::Local.IsAmbiguousTime($Value))) {
            throw 'Ambiguous owner start timestamp.'
        }
        return $Value.ToUniversalTime().Ticks
    }
    $parsed=[DateTimeOffset]::MinValue
    $formats=[string[]]@("yyyy-MM-dd'T'HH:mm:ss.fffffff'Z'", "yyyy-MM-dd'T'HH:mm:ss.fffffffzzz")
    if ($Value -isnot [string] -or -not [DateTimeOffset]::TryParseExact(
        $Value, $formats, [Globalization.CultureInfo]::InvariantCulture,
        [Globalization.DateTimeStyles]::AssumeUniversal, [ref]$parsed)) {
        throw 'Malformed owner start timestamp.'
    }
    return $parsed.UtcDateTime.Ticks
}
if (($active.ownerPid -isnot [int] -and $active.ownerPid -isnot [long]) -or
    $active.ownerPid -le 0 -or $active.ownerPid -gt [int]::MaxValue -or
    $active.ownerPath -isnot [string] -or [string]::IsNullOrWhiteSpace($active.ownerPath)) {
    throw 'Malformed owner identity; no process was stopped.'
}
$recordedStartTicks=Get-OwnerStartUtcTicks $active.ownerStart
$owner=Get-Process -Id $active.ownerPid -ErrorAction Stop
if ($null -eq $owner -or $owner.HasExited -or [string]::IsNullOrWhiteSpace($owner.Path) -or
    $owner.Path -ne $active.ownerPath -or
    (Get-OwnerStartUtcTicks $owner.StartTime.ToUniversalTime()) -ne $recordedStartTicks) {
    throw 'Owner exited or PID reused; no process was stopped.'
}
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
