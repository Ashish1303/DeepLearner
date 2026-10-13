#Requires -Version 7.0
# Offline only: parser/compiler checks and harmless Node children. No application/DB calls.
[CmdletBinding()] param([switch]$OwnerCrashFixture,[string]$FixtureRoot,[switch]$MockOnly)
$ErrorActionPreference='Stop'
. "$PSScriptRoot/../Start-DeepLearner.ps1"
if ($MockOnly -and $OwnerCrashFixture) { throw 'Mock-only mode cannot launch a fixture.' }
if ($OwnerCrashFixture) {
    $prefix=[IO.Path]::GetFullPath((Join-Path $script:LocalRepo '.cache/local-startup-tests'))+[IO.Path]::DirectorySeparatorChar
    if (-not $FixtureRoot -or -not [IO.Path]::GetFullPath($FixtureRoot).StartsWith($prefix,[StringComparison]::OrdinalIgnoreCase)) { throw 'Harmless fixture path rejected.' }
    Add-Type -Path (Join-Path $script:LocalScripts 'LocalProcessOwner.cs')
    $fixtureOwner=[DeepLearnerLocal.Owner]::new()
    $fixtureOwner.Start('orphan',(Get-Command node.exe).Source,@('-e','setInterval(()=>{},1000)'),$FixtureRoot,(Get-LocalEnvironment),(Join-Path $FixtureRoot 'orphan.out'),(Join-Path $FixtureRoot 'orphan.err')) | Out-Null
    [Environment]::Exit(7) # Deliberately skip Dispose: OS closes sole job handle.
}
$passed=0
function Check([string]$Name,[scriptblock]$Body) { & $Body; $script:passed++; Write-Host "PASS $Name" }
function Assert($Value,[string]$Message) { if(-not $Value){throw $Message} }
Check 'PowerShell syntax (all six scripts)' {
    foreach($file in @('Start-DeepLearner.ps1','Stop-DeepLearner.ps1','Initialize-DeepLearnerLocal.ps1','Setup-DemoAccounts.ps1','Setup-DemoContent.ps1','tests/LocalStartup.Tests.ps1')) {
        $tokens=$null;$errors=$null
        [Management.Automation.Language.Parser]::ParseFile((Join-Path $script:LocalScripts $file),[ref]$tokens,[ref]$errors) | Out-Null
        Assert ($errors.Count -eq 0) "Syntax failure in $file"
    }
}
Check 'C# ownership helper compiles' { if(-not ('DeepLearnerLocal.Owner' -as [type])) { Add-Type -Path (Join-Path $script:LocalScripts 'LocalProcessOwner.cs') } }
Check 'frontend environment omits signing credentials and unsafe inherited options' {
    $old=$env:NODE_OPTIONS
    try { $env:NODE_OPTIONS='unsafe-synthetic';$environment=Get-LocalEnvironment;Assert (-not $environment.ContainsKey('NODE_OPTIONS')) 'Inherited preload';Assert (-not $environment.ContainsKey('ACCESS_TOKEN_SECRET')) 'Secret leak' }
    finally { $env:NODE_OPTIONS=$old }
}
Check 'writes require explicit approval before any environment operation' {
    foreach($mode in @('Initialize','Accounts','Content')) {
        $rejected=$false;try { Invoke-LocalRun -Mode $mode } catch { $rejected=$_.Exception.Message -like 'Explicit*' }
        Assert $rejected 'Missing approval gate'
    }
}
Check 'occupied ports reject without terminating or adopting the listener' {
    function Get-NetTCPConnection { [pscustomobject]@{LocalPort=27018;OwningProcess=999;LocalAddress='127.0.0.1'} }
    $rejected=$false;try { Assert-FreePorts @(27018) } catch { $rejected=$_.Exception.Message -like 'Required local port*' }
    Assert $rejected 'Port conflict accepted'
}
$evidence=Join-Path $script:LocalRepo ('.cache/local-startup-tests/'+[guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($evidence) | Out-Null
$node=(Get-Command node.exe).Source
$environment=Get-LocalEnvironment
Check 'ownership receipt rejects wrong target, hash, user and initialization state' {
    $exe=@{Node=$node;Mongo='synthetic-mongod.exe';NodeHash='synthetic-node-hash';MongoHash='synthetic-mongo-hash'}
    $receipt=@{revision=1;ownerSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;root=$evidence;repo=$script:LocalRepo;database='deeplearner-local-demo';replicaSet='deeplearner-local';port=27018;node=$exe.Node;mongo=$exe.Mongo;nodeHash=$exe.NodeHash;mongoHash=$exe.MongoHash;state='INITIALIZED'}
    Write-LocalJson (Join-Path $evidence 'ownership.json') $receipt
    Read-LocalOwnership $evidence $exe | Out-Null
    foreach($field in @('ownerSid','database','replicaSet','nodeHash','mongoHash','state')) {
        $changed=$receipt.Clone();$changed[$field]='wrong'
        Write-LocalJson (Join-Path $evidence 'ownership.json') $changed
        $rejected=$false;try{Read-LocalOwnership $evidence $exe|Out-Null}catch{$rejected=$true}
        Assert $rejected "Invalid $field accepted"
    }
}
Check 'current-user DPAPI secret protection round-trips without plaintext output' {
    $secret=ConvertTo-SecureString 'Harmless offline secret only' -AsPlainText -Force
    $encrypted=ConvertFrom-SecureString $secret
    Assert (-not $encrypted.Contains('Harmless')) 'Plaintext persisted'
    $restored=ConvertTo-SecureString $encrypted;$pointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($restored)
    try{Assert ([Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) -ceq 'Harmless offline secret only') 'DPAPI failure'}
    finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer);$secret.Dispose();$restored.Dispose()}
}
# Run the actual stop preflight AST only: never evaluate its stop.request write or wait loop.
$stopTokens=$null;$stopErrors=$null
$stopAst=[Management.Automation.Language.Parser]::ParseFile((Join-Path $script:LocalScripts 'Stop-DeepLearner.ps1'),[ref]$stopTokens,[ref]$stopErrors)
Assert ($stopErrors.Count -eq 0) 'Stop parser failure'
$statements=@($stopAst.EndBlock.Statements)
$boundary=@($statements | Where-Object { $_.Extent.Text -eq 'Assert-NoLink $active.run' })
Assert ($boundary.Count -eq 1) 'Stop preflight boundary changed'
$preflight=[scriptblock]::Create((($statements | Where-Object {
    $_.Extent.StartOffset -gt $statements[0].Extent.StartOffset -and $_.Extent.EndOffset -le $boundary[0].Extent.EndOffset
}).Extent.Text -join "`n"))
$instant=[datetime]::ParseExact('2026-10-13T07:08:51.3777996Z','o',[Globalization.CultureInfo]::InvariantCulture,[Globalization.DateTimeStyles]::RoundtripKind)
function Test-StopIdentity([hashtable]$Change=@{},[string]$Representation='Json',[string]$OwnerState='Running',[bool]$Reject=$false,[string]$ReceiptChange='') {
    $fixtureRoot=Join-Path $evidence 'mock-only';$id='11111111111111111111111111111111'
    $record=@{active=$true;root=$fixtureRoot;repo=$script:LocalRepo;runId=$id;run=(Join-Path $fixtureRoot "runs/$id");ownerPid=12345;ownerPath='C:\mock\pwsh.exe';ownerStart=$instant.ToString('o')}
    foreach($key in $Change.Keys){$record[$key]=$Change[$key]}
    $receipt=@{ownerSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;root=$fixtureRoot;repo=$script:LocalRepo}
    if($ReceiptChange){$receipt[$ReceiptChange]='invalid'}
    $identityRecord=[pscustomobject]$record
    function Get-LocalRoot { $fixtureRoot }
    function Assert-NoLink { param($Path) }
    function Get-Content { param([switch]$Raw,[string]$LiteralPath)
        if($LiteralPath -eq (Join-Path $fixtureRoot 'active.json')){return ($record | ConvertTo-Json)}
        if($LiteralPath -eq (Join-Path $fixtureRoot 'ownership.json')){return ($receipt | ConvertTo-Json)}
        throw 'Unexpected fixture read'
    }
    function ConvertFrom-Json { param([Parameter(ValueFromPipeline)]$InputObject)
        process {
            $value=Microsoft.PowerShell.Utility\ConvertFrom-Json -InputObject $InputObject
            if($value.PSObject.Properties.Name -contains 'ownerPid') {
                if($Representation -eq 'String'){$value.ownerStart=$identityRecord.ownerStart}
                if($Representation -eq 'DateTime'){$value.ownerStart=$instant}
                if($Representation -eq 'Local'){$value.ownerStart=$instant.ToLocalTime()}
                if($Representation -eq 'Unspecified'){$value.ownerStart=[datetime]::SpecifyKind($instant,[DateTimeKind]::Unspecified)}
            }
            $value
        }
    }
    function Get-Process { param($Id,$ErrorAction)
        Assert ($Id -eq 12345) 'Unexpected process lookup'
        if($OwnerState -eq 'Missing'){throw 'Mock owner exited'}
        if($OwnerState -eq 'Null'){return $null}
        [pscustomobject]@{HasExited=($OwnerState -eq 'Exited');Path=if($OwnerState -eq 'WrongPath'){'C:\other\pwsh.exe'}else{'C:\mock\pwsh.exe'};StartTime=if($OwnerState -eq 'Reused'){$instant.AddTicks(1)}else{$instant}}
    }
    $failure=$null
    try { & $preflight } catch { $failure=$_ }
    if($Reject){
        Assert ($null -ne $failure) 'Invalid stop identity accepted'
        Assert ($failure.Exception.Message -match '^(Owner exited or PID reused;|Malformed owner|Ambiguous owner|Run identity mismatch\.|Ownership mismatch\.|Mock owner exited$)') "Unexpected failure instead of identity rejection: $($failure.Exception.Message)"
    }
    elseif($failure){throw $failure}
}
Check 'stop owner identity: actual JSON round-trip preserves exact UTC ticks' { Test-StopIdentity }
Check 'stop owner identity: ISO string, UTC and local DateTime representations' {
    foreach($representation in @('String','DateTime','Local')){Test-StopIdentity -Representation $representation}
    Test-StopIdentity -Representation String -Change @{ownerStart='2026-10-13T12:38:51.3777996+05:30'}
}
Check 'stop owner identity: invariant parsing despite current culture' {
    $culture=[Globalization.CultureInfo]::CurrentCulture
    try{[Globalization.CultureInfo]::CurrentCulture=[Globalization.CultureInfo]::GetCultureInfo('fr-FR');Test-StopIdentity -Representation String}
    finally{[Globalization.CultureInfo]::CurrentCulture=$culture}
}
Check 'stop owner identity: seventh fractional digit and PID reuse mismatch reject' {
    Test-StopIdentity -Representation String -Change @{ownerStart='2026-10-13T07:08:51.3777997Z'} -Reject $true
    Test-StopIdentity -OwnerState Reused -Reject $true
}
Check 'stop owner identity: mismatched and absent executable paths reject' {
    Test-StopIdentity -OwnerState WrongPath -Reject $true
    foreach($path in @($null,'',' ')){Test-StopIdentity -Change @{ownerPath=$path} -Reject $true}
}
Check 'stop owner identity: malformed or ambiguous timestamps reject' {
    foreach($stamp in @($null,'','invalid','2026-10-13T07:08:51.3777996','2026-10-13T07:08:51.377799Z','2026-02-30T07:08:51.3777996Z','10/13/2026 07:08:51',42)) {
        Test-StopIdentity -Representation String -Change @{ownerStart=$stamp} -Reject $true
    }
    Test-StopIdentity -Representation Unspecified -Reject $true
}
Check 'stop owner identity: malformed PID, run and ownership records reject' {
    foreach($id in @($null,0,-1,'12345',1.5,2147483648)){Test-StopIdentity -Change @{ownerPid=$id} -Reject $true}
    foreach($field in @('root','repo','runId','run')){Test-StopIdentity -Change @{$field='invalid'} -Reject $true}
    foreach($field in @('ownerSid','root','repo')){Test-StopIdentity -ReceiptChange $field -Reject $true}
}
Check 'stop owner identity: missing, null and exited owners reject' {
    foreach($state in @('Missing','Null','Exited')){Test-StopIdentity -OwnerState $state -Reject $true}
}

if ($MockOnly) {
    Write-Host "$passed/$passed PASS; native child/process-termination tests NOT_RUN; fixture evidence: $evidence"
    return
}

Check 'native handle observation and private stdin completion' {
    $owner=[DeepLearnerLocal.Owner]::new()
    try {
        $child=$owner.Start('stdin',$node,@('-e','process.stdin.once("data", d => { if(d.toString().trim()!=="STOP") process.exitCode=2; process.stdin.destroy(); });'),$evidence,$environment,(Join-Path $evidence 'stdin.out'),(Join-Path $evidence 'stdin.err'))
        Assert ($owner.Owns($child.Id)) 'Not owned';Assert (-not $owner.Owns([uint32]$PID)) 'Owner mistakenly contained'
        $child.Send('STOP');Assert ($child.Wait(5000)) 'Child hung';Assert ($child.ExitCode -eq 0) 'Bad exit';Assert ($owner.WaitEmpty(2000)) 'Job not empty'
    } finally { $owner.Dispose() }
}
Check 'hung descendants are contained without PID-based termination' {
    $owner=[DeepLearnerLocal.Owner]::new()
    try {
        $child=$owner.Start('descendants',$node,@('-e','const c=require("node:child_process").spawn(process.execPath,["-e","setInterval(()=>{},1000)"],{stdio:"ignore"}); console.log(c.pid);setInterval(()=>{},1000);'),$evidence,$environment,(Join-Path $evidence 'descendants.out'),(Join-Path $evidence 'descendants.err'))
        $clock=[Diagnostics.Stopwatch]::StartNew()
        while($owner.ActiveCount -lt 2 -and $clock.ElapsedMilliseconds -lt 5000){Start-Sleep -Milliseconds 50}
        Assert ($owner.ActiveCount -eq 2) 'Descendant not observed';$owner.ForceStop()
        Assert ($child.Wait(5000)) 'Root remained';Assert ($child.ExitCode -ne 0) 'Forced exit falsely successful';Assert ($owner.WaitEmpty(5000)) 'Descendant remained'
    } finally { $owner.Dispose() }
}
Check 'owner disposal kills contained children and invalid launch fails closed' {
    $owner=[DeepLearnerLocal.Owner]::new()
    try {
        $rejected=$false;try {$owner.Start('invalid','missing.exe',@(),$evidence,$environment,'unused','unused')|Out-Null} catch {$rejected=$true}
        Assert $rejected 'Invalid executable accepted';Assert ($owner.ActiveCount -eq 0) 'Unexpected child'
        $child=$owner.Start('dispose',$node,@('-e','setInterval(()=>{},1000)'),$evidence,$environment,(Join-Path $evidence 'dispose.out'),(Join-Path $evidence 'dispose.err'))
        $pidObserved=$child.Id;$process=Get-Process -Id $pidObserved
        $owner.Dispose();Assert ($process.WaitForExit(5000)) 'Kill-on-close failed'
    } finally {$owner.Dispose();if($process){$process.Dispose()}}
}
Check 'nonzero child exit is preserved, not reported as graceful success' {
    $owner=[DeepLearnerLocal.Owner]::new()
    try {
        $child=$owner.Start('failure',$node,@('-e','process.exitCode=7'),$evidence,$environment,(Join-Path $evidence 'failure.out'),(Join-Path $evidence 'failure.err'))
        Assert ($child.Wait(5000)) 'Failure child hung';Assert ($child.ExitCode -eq 7) 'Exit code lost'
    } finally {$owner.Dispose()}
}
Check 'abrupt owner exit closes its job and contains descendants' {
    $owner=[DeepLearnerLocal.Owner]::new()
    try {
        $child=$owner.Start('crash-owner',(Join-Path $PSHOME 'pwsh.exe'),@('-NoProfile','-File',(Join-Path $script:LocalScripts 'tests/LocalStartup.Tests.ps1'),'-OwnerCrashFixture','-FixtureRoot',$evidence),$evidence,$environment,(Join-Path $evidence 'crash.out'),(Join-Path $evidence 'crash.err'))
        Assert ($child.Wait(15000)) 'Harmless owner fixture hung';Assert ($child.ExitCode -eq 7) 'Expected deliberate exit absent';Assert ($owner.WaitEmpty(5000)) 'Orphan child survived owner exit'
    } finally { if($owner.ActiveCount -gt 0){$owner.ForceStop()};$owner.Dispose() }
}
foreach($mode in @('success','rejection','hung','residual','repeated')) {
    Check "actual shutdown handler: $mode" {
        $owner=[DeepLearnerLocal.Owner]::new()
        try {
            $moduleUri=([uri](Join-Path $script:LocalRepo 'apps/api/scripts/local-tools.ts')).AbsoluteUri
            $prefix="import {installShutdown} from '$moduleUri';"
            $body=switch($mode) {
                'success' { 'installShutdown(async()=>{},process.stdin,300);' }
                'rejection' { 'installShutdown(async()=>{throw Error("synthetic-private-value")},process.stdin,300);' }
                'hung' { 'installShutdown(async()=>new Promise(()=>{}),process.stdin,300);' }
                'residual' { 'setInterval(()=>{},1000);installShutdown(async()=>{},process.stdin,300);' }
                'repeated' { 'installShutdown(async()=>{console.log("HANDLER");await new Promise(r=>setTimeout(r,100));},process.stdin,300);' }
            }
            $stdout=Join-Path $evidence "$mode.out"; $stderr=Join-Path $evidence "$mode.err"
            $child=$owner.Start($mode,$node,@('--import','tsx','--input-type=module','-e',($prefix+$body)),$script:LocalRepo,$environment,$stdout,$stderr)
            $child.Send('STOP');if($mode -eq 'repeated'){$child.Send('STOP')}
            Assert ($child.Wait(15000)) 'Shutdown fixture hung'
            $expected=if($mode -in @('success','repeated')){0}else{1}
            Assert ($child.ExitCode -eq $expected) 'False success or wrong shutdown outcome'
            $output=[IO.File]::ReadAllText($stdout)+[IO.File]::ReadAllText($stderr)
            Assert (-not $output.Contains('synthetic-private-value')) 'Sensitive error text leaked'
            if($mode -in @('hung','residual')){Assert ($output.Contains('STOP_TIMEOUT')) 'Missing timeout evidence'}
            if($mode -eq 'repeated'){Assert (([regex]::Matches($output,'HANDLER\r?\n')).Count -eq 1) 'Repeated cleanup'}
            Assert ($owner.WaitEmpty(2000)) 'Fixture descendants remained'
        } finally {if($owner.ActiveCount -gt 0){$owner.ForceStop()};$owner.Dispose()}
    }
}
Write-Host "$passed/$passed PASS; harmless evidence retained at $evidence"
