#Requires -Version 7.0
# Offline only: parser/compiler checks and harmless Node children. No application/DB calls.
[CmdletBinding()] param([switch]$OwnerCrashFixture,[string]$FixtureRoot,[switch]$MockOnly,[switch]$SupervisedFixture,[switch]$GuardedRunner,[switch]$FixtureCors)
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
function Read-ContainedIdentity($Owner,$Member,[string]$Executable,$Parents) {
    $native=$Owner.ObserveMember($Member)
    $cim=Get-CimInstance Win32_Process -Filter ('ProcessId='+$Member.Id) -OperationTimeoutSec 2 -ErrorAction Stop
    $who=Invoke-CimMethod -InputObject $cim -MethodName GetOwnerSid -OperationTimeoutSec 2 -ErrorAction Stop
    $nt=[DateTime]::FromFileTimeUtc([long]$native.Filetime).Ticks;$ct=$cim.CreationDate.ToUniversalTime().Ticks
    Assert ($native.Pid -eq $Member.Id -and $native.IndependentPid -eq $Member.Id -and $cim.ProcessId -eq $Member.Id) 'Retained member PID mismatch'
    Assert ($native.Filetime -eq $native.IndependentFiletime -and ($nt-($nt%10)) -eq ($ct-($ct%10))) 'Retained member creation mismatch'
    Assert ($native.Live -eq $true -and $native.RetainedJob -eq $true -and $native.IndependentJob -eq $true) 'Retained member not live in exact Job'
    Assert ([string]::Equals($native.Executable,$Executable,[StringComparison]::OrdinalIgnoreCase) -and [string]::Equals($cim.ExecutablePath,$Executable,[StringComparison]::OrdinalIgnoreCase)) 'Unexpected member executable'
    Assert ($who.ReturnValue -eq 0 -and $who.Sid -ceq [Security.Principal.WindowsIdentity]::GetCurrent().User.Value) 'Unexpected member owner'
    $parentKey=[string]$cim.ParentProcessId
    Assert ($Parents.ContainsKey($parentKey)) 'Unexpected member parent'
    $parent=Get-CimInstance Win32_Process -Filter ('ProcessId='+$parentKey) -OperationTimeoutSec 2 -ErrorAction Stop
    $pt=$parent.CreationDate.ToUniversalTime().Ticks
    $expected=[DateTime]::FromFileTimeUtc([long]$Parents[$parentKey]).Ticks
    Assert (($pt-($pt%10)) -eq ($expected-($expected%10)) -and $nt -ge $expected) 'Member parent identity changed'
    return @{Id=$Member.Id;Filetime=[long]$native.Filetime;Parent=$cim.ParentProcessId}
}
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

# F038 child-only CORS correction: no MongoDB, fixture or credential input.
if ($FixtureCors) {
. (Join-Path $script:LocalRepo '.cache/f038-slice3-supervised-launcher.ps1')
function Read-FixtureChildEnvironment($Environment) {
    $tokens=$null;$errors=$null
    $path=Join-Path $script:LocalRepo '.cache/f038-slice3-supervised-launcher.ps1'
    $ast=[Management.Automation.Language.Parser]::ParseFile($path,[ref]$tokens,[ref]$errors)
    Assert ($errors.Count -eq 0) 'Launcher syntax failure'
    $core=$ast.Find({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -ceq 'Invoke-SupervisedFixtureHostCore'},$false)
    $statements=@($core.Body.EndBlock.Statements)
    $start=@($statements | Where-Object {$_.Extent.Text.StartsWith('$childEnvironment=')})
    $end=@($statements | Where-Object {$_.Extent.Text.StartsWith('$arguments=')})
    Assert ($start.Count -eq 1 -and $end.Count -eq 1 -and $end[0].Extent.StartOffset -gt $start[0].Extent.StartOffset) 'Child-only construction boundary changed'
    # Execute the actual clone/configuration statements only. Never call the
    # surrounding initializer, StartControlled, private input or fixture code.
    $block=[scriptblock]::Create($ast.Extent.Text.Substring($start[0].Extent.StartOffset,$end[0].Extent.StartOffset-$start[0].Extent.StartOffset))
    . $block
    return ,$childEnvironment
}
Check 'F038 exact child CORS overrides broad inputs without mutating parent configuration' {
    $parent=[Environment]::GetEnvironmentVariable('CORS_ORIGINS','Process')
    $machine=[Environment]::GetEnvironmentVariable('CORS_ORIGINS','Machine')
    foreach($value in @($null,'*','http://localhost:3000,http://127.0.0.1:5173')) {
        $source=Get-LocalEnvironment
        if($null -ne $value){$source['CORS_ORIGINS']=$value}
        $before=ConvertTo-Json -InputObject $source -Compress
        $childEnvironment=Read-FixtureChildEnvironment $source
        Assert (-not [object]::ReferenceEquals($source,$childEnvironment)) 'Fixture adopted parent dictionary'
        Assert ($childEnvironment['CORS_ORIGINS'] -ceq 'http://127.0.0.1:3000') 'Extra or wildcard origin accepted'
        Assert ($childEnvironment['WEB_ORIGIN'] -ceq $childEnvironment['CORS_ORIGINS'] -and $childEnvironment['AUTH_COOKIE_SECURE'] -ceq 'false') 'Existing loopback cookie binding changed'
        Assert ((ConvertTo-Json -InputObject $source -Compress) -ceq $before) 'Caller environment mutated'
        Assert (-not $childEnvironment.ContainsKey('ACCESS_TOKEN_SECRET')) 'Signing-key transport changed'
        $childEnvironment.Clear()
        Assert ((ConvertTo-Json -InputObject $source -Compress) -ceq $before) 'Child disposal mutated caller'
    }
    Assert ([Environment]::GetEnvironmentVariable('CORS_ORIGINS','Process') -ceq $parent -and [Environment]::GetEnvironmentVariable('CORS_ORIGINS','Machine') -ceq $machine) 'Parent or machine CORS changed'
}
Check 'F038 effective child origin preserves strict Auth Origin and refresh-cookie rules' {
    $code=@'
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkAuthOrigin } from './apps/api/src/middleware/auth-origin.ts';
import { setRefreshCookie } from './apps/api/src/modules/auth/refresh-cookie.ts';
const config = {
  APP_ENV: process.env.APP_ENV,
  AUTH_COOKIE_SECURE: process.env.AUTH_COOKIE_SECURE === 'true',
  CORS_ORIGINS: process.env.CORS_ORIGINS.split(',').map((v) => v.trim()),
};
const request = (origin) => ({
  headers: origin === undefined ? {} : { origin },
  hostname: '127.0.0.1',
  socket: { remoteAddress: '127.0.0.1' },
});
const refused = (req) =>
  assert.throws(
    () => checkAuthOrigin(req, config),
    (e) => e.statusCode === 403 && e.code === 'ORIGIN_NOT_ALLOWED',
  );
test('actual fixture child receives exactly its supported loopback origin', () => {
  assert.deepEqual(config.CORS_ORIGINS, ['http://127.0.0.1:3000']);
  assert.equal(config.AUTH_COOKIE_SECURE, false);
  assert.equal(process.env.WEB_ORIGIN, config.CORS_ORIGINS[0]);
  assert(!Object.hasOwn(process.env, 'ACCESS_TOKEN_SECRET'));
  checkAuthOrigin(request(config.CORS_ORIGINS[0]), config);
});
for (const origin of [
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'https://127.0.0.1:3000',
  'https://example.invalid',
  'null',
  '*',
  'http://127.0.0.1:3000.evil.invalid',
])
  test(`unapproved origin refused: ${origin}`, () => refused(request(origin)));
test('missing Origin stays refused', () => refused(request(undefined)));
test('non-loopback socket stays refused', () => {
  const req = request(config.CORS_ORIGINS[0]);
  req.socket.remoteAddress = '192.0.2.1';
  refused(req);
});
test('different API hostname stays refused', () => {
  const req = request(config.CORS_ORIGINS[0]);
  req.hostname = 'localhost';
  refused(req);
});
test('existing LOCAL refresh cookie stays HttpOnly and SameSite Lax', () => {
  let cookie;
  const now = new Date();
  setRefreshCookie(
    {
      append(name, value) {
        assert.equal(name, 'Set-Cookie');
        cookie = value;
      },
    },
    false,
    'nonsecret-offline-only',
    new Date(now.getTime() + 60000),
    now,
  );
  assert.match(cookie, /^dl_refresh=/);
  assert.match(cookie, /; HttpOnly/i);
  assert.match(cookie, /; SameSite=Lax/i);
  assert.match(cookie, /; Path=\//i);
  assert(!/; (Secure|Domain)=?/i.test(cookie));
});
'@
    $source=Get-LocalEnvironment;$before=ConvertTo-Json -InputObject $source -Compress
    $childEnvironment=Read-FixtureChildEnvironment $source
    $owner=[DeepLearnerLocal.Owner]::new();$child=$null
    $log=Join-Path $evidence 'fixture-cors.out';$err=Join-Path $evidence 'fixture-cors.err'
    try {
        $child=$owner.Start('fixture-cors',$node,@('--import','tsx','--input-type=module','--test-reporter=tap','-e',$code),$script:LocalRepo,$childEnvironment,$log,$err)
        Assert ($child.Wait(15000) -and $child.ExitCode -eq 0) 'Child CORS/Auth rules failed'
        Assert ($owner.WaitEmpty(2000)) 'CORS peer Job not empty'
        $text=[IO.File]::ReadAllText($log)
        Assert ($text -match '# tests 12' -and $text -match '# fail 0') 'Missing focused origin/cookie results'
        Assert ([IO.File]::ReadAllText($err).Length -eq 0 -and -not $text.Contains('nonsecret-offline-only')) 'Unexpected or sensitive peer output'
        Write-Host '# child origin/cookie tests 12 # pass 12 # fail 0'
    } finally {
        if($owner.ActiveCount -gt 0){$owner.ForceStop()};$owner.Dispose();$childEnvironment.Clear()
        if($child){Assert $child.HandlesClosed 'CORS peer handle leak'}
    }
    Assert ($childEnvironment.Count -eq 0 -and (ConvertTo-Json -InputObject $source -Compress) -ceq $before) 'Child-only configuration survived disposal or changed source'
}
Check 'F038 subsequent normal child and parent retain no fixture-only configuration' {
    $parent=[Environment]::GetEnvironmentVariable('CORS_ORIGINS','Process')
    $machine=[Environment]::GetEnvironmentVariable('CORS_ORIGINS','Machine')
    $normal=Get-LocalEnvironment
    foreach($field in @('CORS_ORIGINS','AUTH_COOKIE_SECURE','ACCESS_TOKEN_SECRET')){Assert (-not $normal.ContainsKey($field)) 'Fixture configuration leaked into normal startup'}
    $owner=[DeepLearnerLocal.Owner]::new();$child=$null
    try {
        $code="for(const k of ['CORS_ORIGINS','AUTH_COOKIE_SECURE','ACCESS_TOKEN_SECRET'])if(Object.hasOwn(process.env,k))process.exitCode=1;"
        $child=$owner.Start('normal-after-fixture-cors',$node,@('-e',$code),$script:LocalRepo,$normal,(Join-Path $evidence 'normal-cors.out'),(Join-Path $evidence 'normal-cors.err'))
        Assert ($child.Wait(5000) -and $child.ExitCode -eq 0 -and $owner.WaitEmpty(2000)) 'Normal child inherited fixture-only settings'
    } finally {if($owner.ActiveCount -gt 0){$owner.ForceStop()};$owner.Dispose();if($child){Assert $child.HandlesClosed 'Normal child handle leak'}}
    Assert ([Environment]::GetEnvironmentVariable('CORS_ORIGINS','Process') -ceq $parent -and [Environment]::GetEnvironmentVariable('CORS_ORIGINS','Machine') -ceq $machine) 'Parent or machine environment changed'
}
Write-Host "$passed/$passed PASS; child-only CORS offline evidence retained at $evidence"
return
}

# F038 runner correction: explicit offline-only opt-in. Normal startup/test
# invocations do not depend on ignored runner files or change their behavior.
if ($GuardedRunner) {
. (Join-Path $script:LocalRepo '.cache/f038-slice3-guarded-runner.ps1')
Check 'F038 corrected runner import and approval refusal have no startup side effects' {
    $runner=Join-Path $script:LocalRepo '.cache/f038-slice3-guarded-runner.ps1'
    $tokens=$null;$errors=$null
    $ast=[Management.Automation.Language.Parser]::ParseFile($runner,[ref]$tokens,[ref]$errors)
    Assert ($errors.Count -eq 0) 'Corrected runner syntax failure'
    Assert ($ast.EndBlock.Statements.Count -gt 0) 'Missing runner functions'
    foreach($statement in $ast.EndBlock.Statements){Assert ($statement -is [Management.Automation.Language.FunctionDefinitionAst]) 'Import can execute startup'}
    Assert (-not (Get-Variable F038GuardedAttemptStarted -Scope Script -ErrorAction SilentlyContinue)) 'Import started an attempt'
    $rejected=$false;try{Invoke-F038GuardedRun | Out-Null}catch{$rejected=$_.Exception.Message -ceq 'SEPARATE_GUARDED_APPROVAL_REQUIRED'}
    Assert $rejected 'Runner omitted separate execution approval'
    Assert (-not (Get-Variable F038GuardedAttemptStarted -Scope Script -ErrorAction SilentlyContinue)) 'Refused call changed run state'
    $text=[IO.File]::ReadAllText($runner)
    foreach($guard in @('$init.Wait(35000)','$stop.Wait(15000)','$mongo.Wait(10000)','Get-SupervisedIdentity $owner $mongo $mongod $context $mongoPin','CommonMicrosecond')) {
        # The timestamp predicate lives in the unchanged imported adapter.
        $source=if($guard -ceq 'CommonMicrosecond'){[IO.File]::ReadAllText((Join-Path $script:LocalRepo '.cache/f038-slice3-supervised-launcher.ps1'))}else{$text}
        Assert ($source.Contains($guard)) 'Original identity/deadline guarantee missing'
    }
    Assert ($text.Contains("if(`$primaryReady){") -and $text.Contains('NOT_ATTEMPTED_BEFORE_VERIFIED_READINESS')) 'Pre-PRIMARY cleanup assumes readiness'
    $ready=$text.IndexOf("if(`$markers.Contains('WRITABLE_PRIMARY_EMPTY_EXCLUSIVE_TARGET')){`$primaryReady=`$true}")
    $exitGate=$text.IndexOf("Require (`$init.ExitCode -eq 0) 'INITIALIZER_NONZERO_EXIT'")
    $fixture=$text.IndexOf('$outcome=Invoke-SupervisedFixtureHost')
    Assert ($ready -gt 0 -and $exitGate -gt $ready -and $fixture -gt $exitGate) 'Readiness/failure shutdown or fixture exit gate changed'
    Assert (-not ($text -match 'Stop-Process|taskkill|GetProcessById.*Kill|\.Kill\(')) 'PID-based termination introduced'
}
Check 'F038 corrected live helpers parse without execution or a MongoDB connection' {
    foreach($code in @((Get-F038MongoLifecycleCode),(Get-F038InitializationCode),(Get-F038ShutdownCode))) {
        $code | & $node --input-type=module --check
        Assert ($LASTEXITCODE -eq 0) 'Generated lifecycle code syntax failure'
    }
}
Check 'F038 disposable storage rejects contents before any database startup' {
    . (Join-Path $script:LocalRepo '.cache/f038-slice3-supervised-launcher.ps1')
    $storage=Join-Path $evidence 'empty-storage-check'
    $null=New-Item -ItemType Directory -Path $storage
    Assert-F038FreshStorage $storage
    [IO.File]::WriteAllText((Join-Path $storage 'unexpected.txt'),'harmless offline content')
    $refused=$false;try{Assert-F038FreshStorage $storage}catch{$refused=$_.Exception.Message -ceq 'STORAGE_NOT_EMPTY'}
    Assert $refused 'Unexpected storage contents accepted'
    $refused=$false;try{Assert-F038FreshStorage (Join-Path $evidence 'missing-storage')}catch{$refused=$true}
    Assert $refused 'Absent storage accepted'
}
Check 'F038 owned cleanup rejects foreign stale and mismatched native members' {
    foreach($fault in @('Pid','IndependentPid','Filetime','RetainedJob','IndependentJob','Live','capture')) {
        $mock=[pscustomobject]@{Fault=$fault;Terminations=0}
        $mock | Add-Member ScriptMethod WaitEmpty {param($deadline) if($deadline -ne 5000){throw 'DEADLINE_CHANGED'};return $false}
        $mock | Add-Member ScriptMethod MemberIds {return ,@([uint32]71)}
        $mock | Add-Member ScriptMethod CaptureMember {param($id) if($this.Fault -ceq 'capture'){throw 'FOREIGN_MEMBER_REFUSED'};return [pscustomobject]@{Id=$id}}
        $mock | Add-Member ScriptMethod ObserveMember {param($member) $o=@{Pid=[uint32]71;IndependentPid=[uint32]71;Filetime=11L;IndependentFiletime=11L;RetainedJob=$true;IndependentJob=$true;Live=$true};if($this.Fault -cin @('Pid','IndependentPid')){$o[$this.Fault]=[uint32]72}elseif($this.Fault -ceq 'Filetime'){$o.Filetime=12L}else{$o[$this.Fault]=$false};return $o}
        $mock | Add-Member ScriptMethod ForceStop {$this.Terminations++}
        $members=[Collections.Generic.List[object]]::new();$refused=$false
        try{$null=Stop-F038OwnedJob $mock $members}catch{$refused=$true}
        Assert ($refused -and $mock.Terminations -eq 0) 'Unknown/foreign identity authorized termination'
    }
}
Check 'F038 pre-PRIMARY failure cleanup terminates only the verified owned Job' {
    $mock=[pscustomobject]@{Empty=$false;Terminations=0}
    $mock | Add-Member ScriptMethod WaitEmpty {param($deadline) if($deadline -ne 5000){throw 'DEADLINE_CHANGED'};return $this.Empty}
    $mock | Add-Member ScriptMethod MemberIds {return ,@([uint32]71)}
    $mock | Add-Member ScriptMethod CaptureMember {param($id) return [pscustomobject]@{Id=$id}}
    $mock | Add-Member ScriptMethod ObserveMember {param($member) return @{Pid=[uint32]71;IndependentPid=[uint32]71;Filetime=11L;IndependentFiletime=11L;RetainedJob=$true;IndependentJob=$true;Live=$true}}
    $mock | Add-Member ScriptMethod ForceStop {$this.Terminations++}
    $members=[Collections.Generic.List[object]]::new()
    Assert (Stop-F038OwnedJob $mock $members) 'Verified owned pre-PRIMARY cleanup refused'
    Assert ($mock.Terminations -eq 1 -and $members.Count -eq 1) 'Wrong cleanup count or missing retained member'
    $mock.Empty=$true
    Assert (-not (Stop-F038OwnedJob $mock $members)) 'Empty Job was terminated'
    Assert ($mock.Terminations -eq 1) 'Unnecessary forced termination'
}
Check 'F038 native pre-PRIMARY cleanup contains only a retained harmless owned peer' {
    . (Join-Path $script:LocalRepo '.cache/f038-slice3-supervised-launcher.ps1')
    $owner=[DeepLearnerLocal.Owner]::new();$foreign=[DeepLearnerLocal.Owner]::new();$child=$null
    $members=[Collections.Generic.List[object]]::new();$before=Get-SupervisedProtected $owner
    $parentProcess=Get-Process -Id $PID
    try {
        $child=$owner.Start('runner-owned-cleanup',$node,@('-e','setInterval(()=>{},1000);'),$script:LocalRepo,$environment,(Join-Path $evidence 'runner-owned.out'),(Join-Path $evidence 'runner-owned.err'))
        $context=Get-SupervisedContext
        $identity=Get-SupervisedIdentity $owner $child $node $context ''
        Assert ($identity.Status -ceq 'PASS') 'Retained native/CIM/Job peer identity refused'
        Assert ((Get-SupervisedIdentity $foreign $child $node $context '').Status -ceq 'UNKNOWN') 'Foreign Owner adopted peer'
        Assert (-not (Stop-F038OwnedJob $foreign ([Collections.Generic.List[object]]::new()))) 'Empty foreign Job affected owned peer'
        Assert (-not $child.HasExited) 'Unrelated Job terminated peer'
        $ids=$owner.MemberIds();$captured=@()
        foreach($memberId in $ids){$captured+=,$owner.CaptureMember($memberId)}
        $root=@($captured | Where-Object Id -eq $child.Id)
        Assert ($root.Count -eq 1) 'Expected retained root identity missing'
        $rootIdentity=Read-ContainedIdentity $owner $root[0] $node @{([string]$PID)=$parentProcess.StartTime.ToUniversalTime().ToFileTimeUtc()}
        $extras=@($captured | Where-Object Id -ne $child.Id)
        Assert ($extras.Count -le 1) 'Unknown additional Job members'
        foreach($extra in $extras){Read-ContainedIdentity $owner $extra (Join-Path ([Environment]::SystemDirectory) 'conhost.exe') @{([string]$child.Id)=$rootIdentity.Filetime} | Out-Null}
        Assert (($owner.MemberIds() -join ',') -ceq ($ids -join ',')) 'Job membership changed before cleanup'
        Assert (Stop-F038OwnedJob $owner $members) 'Verified native Job cleanup refused'
        Assert ($child.Wait(5000) -and $child.ExitCode -ne 0 -and $owner.WaitEmpty(5000)) 'Forced owned cleanup misreported or incomplete'
        Assert ((($members | ForEach-Object Id) -join ',') -ceq ($ids -join ',')) 'Retained cleanup identities changed'
    }finally{$foreign.Dispose();if($owner.ActiveCount -gt 0){$owner.ForceStop()};$owner.Dispose();$parentProcess.Dispose()}
    Assert ($child.HandlesClosed -and @($members|Where-Object {-not $_.HandleClosed}).Count -eq 0) 'Native cleanup handle leak'
    Assert (@($captured|Where-Object {-not $_.HandleClosed}).Count -eq 0) 'Prevalidated containment handle leak'
    $observer=[DeepLearnerLocal.Owner]::new()
    try{Assert ($before -ceq (Get-SupervisedProtected $observer)) 'Protected process/storage baseline changed'}finally{$observer.Dispose()}
}
Check 'F038 lifecycle ordering timeout target and shutdown refusal contracts' {
    $cases=@'
import {test} from 'node:test';
import fs from 'node:fs';
const expected={storage:'C:\\owned-unit-only',pid:71};
const primary={isWritablePrimary:true,setName:'f021-test',hosts:['127.0.0.1:27018']};
function fixture(options={}) {
 const events=[];let initiated=false,ready=false,now=0;
 const admin={async command(command,opts){assert.equal(opts.timeoutMS,command.shutdown?8000:2000);const op=Object.keys(command)[0];events.push(op);
  if(op==='getCmdLineOpts')return {parsed:{net:{bindIp:'127.0.0.1',port:27018},replication:{replSet:options.wrongStartupReplica?'wrong':'f021-test'},storage:{dbPath:options.wrongStorage?'C:\\foreign':expected.storage}}};
  if(op==='serverStatus')return {pid:options.wrongPid?72:71};
  if(op==='replSetInitiate'){assert(!initiated);assert.deepEqual(command.replSetInitiate,{_id:'f021-test',members:[{_id:0,host:'127.0.0.1:27018'}]});initiated=true;return {ok:1};}
  if(op==='hello'){assert(initiated||options.shutdown);if(options.neverPrimary)return {isWritablePrimary:false};ready=true;return {...primary,...(options.wrongPrimaryReplica?{setName:'wrong'}:{})};}
  if(op==='replSetGetConfig')return {config:{_id:'f021-test',members:options.extraMember?[{host:'127.0.0.1:27018'},{host:'127.0.0.1:27019'}]:[{host:'127.0.0.1:27018'}]}};
  if(op==='shutdown'){assert(ready);if(options.shutdownFailure)throw Object.assign(Error('synthetic-sensitive-canary'),{name:'MongoServerError',code:13});return {ok:1};}
  throw Error('UNEXPECTED_COMMAND');},async listDatabases(opts){events.push('listDatabases');assert(ready,'premature enumeration');assert.equal(opts.timeoutMS,2000);return {databases:(options.foreignDatabase?['protected']:['admin','config','local']).map(name=>({name}))};}};
 const db={databaseName:'deeplearner-f021-test',listCollections(_filter,opts){events.push('listCollections');assert(ready,'premature enumeration');assert.equal(opts.timeoutMS,2000);return {async toArray(){return options.nonempty?[{name:'unexpected'}]:[];}};}};
 return {admin,db,events,clock:{now:()=>now,async sleep(ms){assert.equal(ms,250);now+=ms;}}};
}
test('initialization requires real PRIMARY before any enumeration',async()=>{const f=fixture();await initializeOwnedTarget(f.admin,f.db,expected,f.clock);assert.deepEqual(f.events,['getCmdLineOpts','serverStatus','replSetInitiate','hello','getCmdLineOpts','serverStatus','replSetGetConfig','listDatabases','listCollections']);});
test('premature empty-target verification refuses without contacting enumerators',async()=>{const f=fixture();await assert.rejects(verifyEmptyTarget(f.admin,f.db,{isWritablePrimary:false}));assert.deepEqual(f.events,[]);});
test('PRIMARY timeout is twenty seconds, bounded and never enumerates',async()=>{const f=fixture({neverPrimary:true});await assert.rejects(initializeOwnedTarget(f.admin,f.db,expected,f.clock),e=>e.code==='PRIMARY_READINESS_TIMEOUT');assert.equal(f.clock.now(),20000);assert.equal(f.events.filter(e=>e==='hello').length,80);assert(!f.events.includes('listDatabases'));assert.equal(lifecycleError({code:'PRIMARY_READINESS_TIMEOUT'}).stage,'PRIMARY_WAIT');});
for(const fault of ['wrongStartupReplica','wrongStorage','wrongPid'])test(`initial ${fault} refuses before replica initialization`,async()=>{const f=fixture({[fault]:true});await assert.rejects(initializeOwnedTarget(f.admin,f.db,expected,f.clock));assert(!f.events.includes('replSetInitiate'));assert(!f.events.includes('listDatabases'));});
for(const fault of ['wrongPrimaryReplica','extraMember'])test(`published ${fault} refuses before enumeration`,async()=>{const f=fixture({[fault]:true});await assert.rejects(initializeOwnedTarget(f.admin,f.db,expected,f.clock));assert(!f.events.includes('listDatabases'));});
for(const fault of ['foreignDatabase','nonempty'])test(`unexpected ${fault} refuses before provisioning`,async()=>{const f=fixture({[fault]:true});await assert.rejects(initializeOwnedTarget(f.admin,f.db,expected,f.clock));assert(!f.events.includes('shutdown'));});
test('graceful shutdown verifies identity PRIMARY and exact replica first',async()=>{const f=fixture({shutdown:true});await shutdownOwnedTarget(f.admin,expected);assert.deepEqual(f.events,['getCmdLineOpts','serverStatus','hello','replSetGetConfig','shutdown']);});
for(const fault of ['neverPrimary','wrongStorage','wrongPid','extraMember'])test(`shutdown ${fault} never issues shutdown command`,async()=>{const f=fixture({shutdown:true,[fault]:true});await assert.rejects(shutdownOwnedTarget(f.admin,expected));assert(!f.events.includes('shutdown'));});
test('unexpected shutdown errors are refused and sanitized',async()=>{const f=fixture({shutdown:true,shutdownFailure:true});await assert.rejects(shutdownOwnedTarget(f.admin,expected));const d=lifecycleError({name:'MongoServerError',code:13,message:'synthetic-sensitive-canary',cause:{name:'private',code:'secret'}});assert.equal(d.stage,'SHUTDOWN_COMMAND');assert.equal(d.name,'MongoServerError');assert.equal(d.code,'UNKNOWN');assert(!JSON.stringify(d).includes('synthetic-sensitive-canary'));assert(!JSON.stringify(d).includes('secret'));});
test('safe known initialization errors retain only bounded allowlisted metadata',()=>{lifecycleStage='DATABASE_ENUMERATION';const d=lifecycleError({name:'MongoServerError',code:94,message:'private',stack:'private',cause:{name:'TypeError',code:'ERR_ASSERTION'}});assert.deepEqual(d,{stage:'DATABASE_ENUMERATION',name:'MongoServerError',code:94,nested:{name:'TypeError',code:'ERR_ASSERTION'}});assert(JSON.stringify(d).length<512);});
const approved=JSON.parse(fs.readFileSync('.cache/f038-slice3-rerun-2026-10-21-0355/approved-index-definitions.json','utf8'));
const definitions=approved.map(({options,...d})=>d);
const collections=['auditLogs','technologies','learningPaths','modules','topics','concepts','practiceQuestions','visualizations'];
test('all twenty-one approved definitions and eight collections match exactly',()=>{verifyFixtureManifest(definitions,approved,collections);});
for(const fault of ['count','name','keyOrder','unique','partial','ttl','collections'])test(`manifest refuses ${fault}`,()=>{const defs=structuredClone(definitions),plan=[...collections];if(fault==='count')defs.pop();if(fault==='name')defs[0].name='unexpected';if(fault==='keyOrder')defs[0].key=Object.fromEntries(Object.entries(defs[0].key).reverse());if(fault==='unique')defs[0].unique=false;if(fault==='partial')defs.find(d=>d.partialFilterExpression).partialFilterExpression={unexpected:true};if(fault==='ttl')defs.find(d=>d.expireAfterSeconds!==undefined).expireAfterSeconds=1;if(fault==='collections')plan[0]='unexpected';assert.throws(()=>verifyFixtureManifest(defs,approved,plan));});
'@
    $log=Join-Path $evidence 'runner-lifecycle.out';$err=Join-Path $evidence 'runner-lifecycle.err'
    $owner=[DeepLearnerLocal.Owner]::new()
    try {
        # Pure generated lifecycle code + mocked driver only. No driver import,
        # MongoDB connection/startup, fixture invocation or credential entry.
        $child=$owner.Start('runner-lifecycle',$node,@('--input-type=module','--test-reporter=tap','-e',((Get-F038MongoLifecycleCode)+$cases)),$script:LocalRepo,$environment,$log,$err)
        Assert ($child.Wait(20000)) 'Offline lifecycle cases exceeded deadline'
        Assert ($child.ExitCode -eq 0) 'Offline lifecycle cases failed'
        $text=[IO.File]::ReadAllText($log)
        Assert ($text -match '# fail 0' -and $text -match '# tests 25') 'Missing lifecycle case summary'
        Assert ([IO.File]::ReadAllText($err).Length -eq 0) 'Unexpected lifecycle stderr'
        Assert (-not $text.Contains('synthetic-sensitive-canary')) 'Private exception leaked'
        Write-Host '# lifecycle tests 25 # pass 25 # fail 0'
        Assert ($owner.WaitEmpty(2000)) 'Offline lifecycle Job not empty'
    }finally{if($owner.ActiveCount -gt 0){$owner.ForceStop()};$owner.Dispose();if($child){Assert $child.HandlesClosed 'Offline lifecycle handle leak'}}
}
Write-Host "$passed/$passed PASS; corrected runner offline evidence retained at $evidence"
return
}

# F038 opt-in adapter checks. No MongoDB, application startup or owner input.
if ($SupervisedFixture) {
. (Join-Path $script:LocalRepo '.cache/f038-slice3-supervised-launcher.ps1')
Check 'F038 temporary launcher syntax and import are side-effect free' {
    $tokens=$null;$errors=$null
    [Management.Automation.Language.Parser]::ParseFile((Join-Path $script:LocalRepo '.cache/f038-slice3-supervised-launcher.ps1'),[ref]$tokens,[ref]$errors) | Out-Null
    Assert ($errors.Count -eq 0) 'Adapter parser failure'
    Assert ($null -ne (Get-Command Invoke-SupervisedFixtureHost)) 'Adapter missing'
    Assert (-not (Get-Variable owner -ErrorAction SilentlyContinue)) 'Import created resources'
    Assert (-not (Test-SupervisedInteger '1')) 'String protocol version accepted'
    Assert (-not (Test-SupervisedInteger 1.5)) 'Fractional protocol ordinal accepted'
    Assert (Test-SupervisedInteger 1) 'Integer protocol version refused'
}
Check 'F038 exact existing collection plan and inert disposable preparation code' {
    $plan=@(Get-SupervisedCollectionPlan)
    Assert (($plan -join ',') -ceq 'auditLogs,technologies,learningPaths,modules,topics,concepts,practiceQuestions,visualizations') 'Collection plan drift'
    $models=@{
        auditLogs='audit/audit.model.ts';technologies='technologies/technology.model.ts';learningPaths='learning-paths/learning-path.model.ts';modules='modules/module.model.ts';topics='topics/topic.model.ts';concepts='concepts/concept.model.ts';practiceQuestions='practice/practice-question.model.ts';visualizations='visualizations/visualization.model.ts'
    }
    foreach($name in $plan){$source=[IO.File]::ReadAllText((Join-Path $script:LocalRepo ('apps/api/src/modules/'+$models[$name])));Assert ($source.Contains("collection: '$name'")) 'Collection lacks canonical existing model'}
    $code=Get-SupervisedCollectionCode
    Assert ($code.Contains('await prepareFixtureCollections(db,fixtureIndexes,verifyFixtureIndex,verify)')) 'Owned preparation missing'
    Assert (-not $code.Contains('createIndex(') -and -not $code.Contains('drop')) 'Preparation changed index scope'
    Assert ($code.Contains('process.env.OWNED_MONGO_PID') -and $code.Contains('process.env.OWNED_DBPATH') -and $code.Contains('replication.replSet')) 'Preparation target verification missing'
}
Check 'F038 verified terminal counts survive nonzero exit and never imply success alone' {
    $nonce='a'*64;$generation='b'*64
    $frame=@{v=1;type='RESULT';nonce=$nonce;generation=$generation;pass=7;fail=1;total=8;expected=8;notRun=0;stage='FIXTURE_READY';record='T04';errorName='AssertionError';errorCode='ERR_ASSERTION'}
    $parsed=ConvertFrom-SupervisedResult $frame $nonce $generation 8
    $report=Get-SupervisedReport $parsed $null 1
    Assert ($report.CountsStatus -ceq 'VERIFIED' -and $report.Pass -eq 7 -and $report.Fail -eq 1 -and $report.NotRun -eq 0 -and $report.ExitCode -eq 1 -and $report.Overall -ceq 'FAIL') 'Nonzero exit lost counters or passed'
    $frame.pass=8;$frame.fail=0;$frame.errorName='NONE';$frame.errorCode='NONE'
    $parsed=ConvertFrom-SupervisedResult $frame $nonce $generation 8
    Assert ((Get-SupervisedReport $parsed $null 1).Overall -ceq 'FAIL') 'Counters overrode exit'
    Assert ((Get-SupervisedReport $parsed $null 0).Overall -ceq 'PASS') 'Complete verified result refused'
    Assert ((Get-SupervisedReport $parsed $null ([uint32]0)).Overall -ceq 'PASS') 'Native unsigned zero exit lost'
    Assert ((Get-SupervisedReport $parsed $null ([uint32]1)).Overall -ceq 'FAIL') 'Native unsigned nonzero exit passed'
    $frame.pass=7;$frame.total=7;$frame.notRun=1
    Assert ((Get-SupervisedReport (ConvertFrom-SupervisedResult $frame $nonce $generation 8) $null 0).Overall -ceq 'FAIL') 'Incomplete suite passed'
    Assert ((Get-SupervisedReport $parsed $null $null).Overall -ceq 'FAIL') 'Unknown exit passed'
}
Check 'F038 unauthenticated malformed and contradictory result counters remain unknown' {
    $nonce='a'*64;$generation='b'*64
    $base=@{v=1;type='RESULT';nonce=$nonce;generation=$generation;pass=0;fail=1;total=1;expected=8;notRun=7;stage='INITIALIZATION_ENTERED';record='PARENT';errorName='Error';errorCode='COMPLETION_FIXTURE_UNAVAILABLE'}
    foreach($fault in @('nonce','generation','missing','extra','negative','fraction','string','contradiction','expected','notRun','stage','error','successError')){
        $frame=$base.Clone()
        switch($fault){'nonce'{$frame.nonce='c'*64};'generation'{$frame.generation='c'*64};'missing'{$frame.Remove('pass')};'extra'{$frame.password='synthetic-sensitive-canary'};'negative'{$frame.pass=-1};'fraction'{$frame.pass=0.5};'string'{$frame.pass='0'};'contradiction'{$frame.pass=8};'expected'{$frame.expected=1};'notRun'{$frame.notRun=0};'stage'{$frame.stage='synthetic-sensitive-canary'};'error'{$frame.errorCode='synthetic-sensitive-canary'};'successError'{$frame.pass=8;$frame.fail=0;$frame.total=8;$frame.notRun=0}}
        $rejected=$false;try{$null=ConvertFrom-SupervisedResult $frame $nonce $generation 8}catch{$rejected=$true;Assert (-not $_.Exception.Message.Contains('synthetic-sensitive-canary')) 'Private diagnostic echoed'}
        Assert $rejected ('Bad frame accepted: '+$fault)
    }
    foreach($exit in @($null,0,1)){$r=Get-SupervisedReport $null $null $exit;Assert ($r.CountsStatus -ceq 'UNKNOWN' -and $null -eq $r.Pass -and $null -eq $r.Fail -and $null -eq $r.NotRun -and $r.Overall -ceq 'FAIL') 'Missing evidence guessed'}
    $parsed=ConvertFrom-SupervisedResult $base $nonce $generation 8
    foreach($field in @('type','nonce','generation','stage','record','errorName','errorCode')){
        $arrayFrame=$base.Clone();$arrayFrame[$field]=@($base[$field]);$rejected=$false
        try{$null=ConvertFrom-SupervisedResult $arrayFrame $nonce $generation 8}catch{$rejected=$true}
        Assert $rejected ('Array protocol field coerced: '+$field)
    }
    Assert ((Get-SupervisedReport $parsed $null 1 $true).CountsStatus -ceq 'UNKNOWN') 'Invalid trailing evidence retained counts'
    $diag=ConvertFrom-SupervisedDiagnostic $base
    $r=Get-SupervisedReport $null $diag 1
    Assert ($r.Diagnostic.Stage -ceq 'INITIALIZATION_ENTERED' -and $r.Diagnostic.Record -ceq 'PARENT' -and $r.CountsStatus -ceq 'UNKNOWN') 'Safe stage lost or counted as results'
}
Check 'F038 send diagnostics distinguish invocation wait extraction and deadline without payloads' {
    Add-Type -TypeDefinition @'
public sealed class DiagnosticWritePeer {
    public int Mode;
    public DiagnosticWriteTask SendFrameAsync(string ignored) {
        if(Mode==1)throw new System.IO.IOException("synthetic-sensitive-canary");
        return new DiagnosticWriteTask{Mode=Mode};
    }
}
public sealed class DiagnosticWriteTask {
    public int Mode;
    public bool Wait(int deadline) {
        if(deadline!=1000)throw new System.InvalidOperationException("DEADLINE_CHANGED");
        if(Mode==2)throw new System.AggregateException(new System.IO.IOException("synthetic-sensitive-canary"));
        return Mode!=4;
    }
    public DiagnosticWriteTask GetAwaiter(){if(Mode==5)throw new System.IO.IOException("synthetic-sensitive-canary");return this;}
    public void GetResult(){if(Mode==3)throw new System.IO.IOException("synthetic-sensitive-canary");}
}
'@
    foreach($mode in 0..5) {
        $peer=[DiagnosticWritePeer]::new();$peer.Mode=$mode;$observation=@{};$refused=$false
        try {Send-SupervisedFrame $peer @{value='synthetic-sensitive-canary'} $observation}catch{$refused=$true}
        Assert ($refused -eq ($mode -ne 0)) 'Observation changed send decision'
        $expected=@('COMPLETE','SEND_INVOCATION','TASK_WAIT','RESULT_EXTRACTION','TASK_WAIT','AWAIT_ACCESS')[$mode]
        Assert ($observation.Substage -ceq $expected) 'Earliest send substage lost'
        Assert ($observation.AuthenticatedDelivery -ceq 'UNKNOWN') 'Send completion claimed authenticated receipt'
        Assert ($observation.ElapsedMs -ge 0) 'Missing send clock'
        $json=ConvertTo-Json $observation -Depth 8 -Compress
        Assert (-not $json.Contains('synthetic-sensitive-canary')) 'Send diagnostic leaked payload/message'
        if($mode -ne 0){Assert ($observation.Error.Chain.Count -ge 1 -and $observation.Error.Chain.Count -le 3) 'Missing bounded safe error chain'}
    }
}
Check 'F038 identity diagnostics retain native and CIM failure substages as UNKNOWN' {
    $peer=[pscustomobject]@{Id=1};$owner=[pscustomobject]@{}
    $owner | Add-Member ScriptMethod Observe {param($child) throw [InvalidOperationException]::new('RETAINED_IDENTITY_UNAVAILABLE')}
    $r=Get-SupervisedIdentity $owner $peer 'unused' @{Pid=1} ''
    Assert ($r.Status -ceq 'UNKNOWN' -and $r.Diagnostic.Substage -ceq 'NATIVE_OBSERVE') 'Stale native failure disguised'
    Assert ($r.Diagnostic.Error.Chain.Category -contains 'RETAINED_IDENTITY_UNAVAILABLE') 'Native safe category lost'
    $owner | Add-Member ScriptMethod Observe {param($child) return @{}} -Force
    try {
        function global:Get-CimInstance {throw [InvalidOperationException]::new('synthetic-sensitive-canary')}
        $r=Get-SupervisedIdentity $owner $peer 'unused' @{Pid=1} ''
        Assert ($r.Status -ceq 'UNKNOWN' -and $r.Diagnostic.Substage -ceq 'CIM_PROCESS') 'CIM exception accepted or obscured'
        Assert (-not (ConvertTo-Json $r.Diagnostic -Depth 8).Contains('synthetic-sensitive-canary')) 'CIM raw message leaked'
    } finally {Remove-Item Function:\Get-CimInstance}
}
Check 'F038 pure private protocol refusal, lifecycle and credential checks' {
    $protocol=@'
import assert from 'node:assert/strict';
import { test, run } from 'node:test';
import { PassThrough, Writable } from 'node:stream';
import { setTimeout as delay, setImmediate as tick } from 'node:timers/promises';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
const { createSupervisor, runWithEphemeralAuth, prepareFixtureCollections,
 fixtureCollectionPlan, safeFixtureError, createFixtureReport, safeSupervisorError } = await import('./.cache/f038-slice3-supervised-host.mjs');
const {fixtureIndexes,verifyFixtureIndex}=await import('./apps/api/scripts/completion-student-fixture.ts');
const generation='b'.repeat(64);
const sample={author:'synthetic-author-only',reviewer:'synthetic-reviewer-only',student:'synthetic-student-only'};
function pair(options={},configure=true) {
 const input=new PassThrough(), frames=[], observations=[];
 let notify=()=>{};
 const output=new Writable({write(chunk,_encoding,done){frames.push(JSON.parse(String(chunk)));done();notify(frames.at(-1));}});
 const s=createSupervisor(input,output,{requestMs:200,heartbeatMs:2000,observe:value=>observations.push(value),...options});
 const hello=frames[0];
 const config={v:1,type:'CONFIG',nonce:hello.nonce,generation,hostPid:process.pid,parentPid:process.ppid,mongoPid:123,dbPath:'C:\\synthetic-owned-only',expiresAt:Date.now()+10000};
 const send=(x)=>input.write(JSON.stringify(x)+'\n');
 const reply=(r,tail={status:'PASS'})=>send({...r,...tail});
 if(configure)send(config);
 return {s,input,output,frames,observations,config,send,reply,setNotify(fn){notify=fn;},close(){s.dispose();output.destroy();}};
}
test('diagnostics distinguish authenticated OWNED receipt from send and redact private bindings',async()=>{
 const p=pair();try{const task=p.s.assertOwned();await tick();const r=p.frames.at(-1);p.reply(r);await task;const d=p.s.supervisionSnapshot();assert.equal(d.lastOwnershipReply.binding,'VALIDATED');assert.equal(d.lastOwnershipReply.status,'PASS');assert.equal(d.lastOwnershipReply.id,r.id);assert(d.lastOwnershipReply.elapsedMs>=0);const json=JSON.stringify(d);for(const secret of [r.nonce,r.generation,r.challenge])assert(!json.includes(secret));p.s.dispose();assert.equal(p.observations.length,1);assert.equal(p.observations[0].reason,'DISPOSED');}finally{p.close();}
});
test('diagnostics retain RPC deadline elapsed and permanent onLoss without guessing receipt',async()=>{
 const p=pair({requestMs:25});let losses=0;p.s.onLoss(()=>losses++);try{await assert.rejects(p.s.assertOwned());const d=p.observations[0];assert.equal(d.reason,'RPC_DEADLINE');assert.equal(d.authorityInvalidated,true);assert.equal(d.callbacksInvoked,1);assert.equal(losses,1);assert.equal(d.lastOwnershipReply,null);assert.equal(d.pending.length,1);assert(d.pending[0].elapsedMs>=0);await assert.rejects(p.s.assertOwned());assert.equal(p.observations.length,1);}finally{p.close();}
});
test('diagnostics retain authenticated UNKNOWN refusal without upgrading ownership',async()=>{
 const p=pair();try{const task=p.s.assertOwned();await tick();p.reply(p.frames.at(-1),{status:'UNKNOWN'});await assert.rejects(task);const d=p.observations[0];assert.equal(d.reason,'REPLY_REFUSED');assert.equal(d.lastOwnershipReply.status,'UNKNOWN');assert.equal(d.validation,'AUTHENTICATED_REPLY');await assert.rejects(p.s.assertOwned());}finally{p.close();}
});
test('diagnostics refuse stale correlation and never mark it authenticated',async()=>{
 const p=pair();try{const task=p.s.assertOwned();await tick();p.reply(p.frames.at(-1),{generation:'c'.repeat(64)});await assert.rejects(task);const d=p.observations[0];assert.equal(d.reason,'FRAME_REFUSED');assert.equal(d.validation,'CORRELATION_GENERATION');assert.equal(d.lastReply,null);}finally{p.close();}
});
test('diagnostics report broken-pipe write rejection without raw error content',async()=>{
 const input=new PassThrough(), frames=[], observations=[];let fail=false;
 const output=new Writable({write(chunk,_e,done){frames.push(JSON.parse(String(chunk)));if(fail){const e=Object.assign(Error('synthetic-sensitive-canary'),{code:'EPIPE'});done(e);}else done();}});
 const s=createSupervisor(input,output,{requestMs:200,heartbeatMs:2000,observe:d=>observations.push(d)});
 input.write(JSON.stringify({v:1,type:'CONFIG',nonce:frames[0].nonce,generation,hostPid:process.pid,parentPid:process.ppid,mongoPid:123,dbPath:'C:\\synthetic-owned-only',expiresAt:Date.now()+10000})+'\n');
 try{await s.ready;fail=true;await assert.rejects(s.assertOwned());assert.equal(observations.length,1);assert.equal(observations[0].reason,'WRITE_CALLBACK_ERROR');assert.equal(observations[0].error.code,'EPIPE');assert(!JSON.stringify(observations).includes('synthetic-sensitive-canary'));}finally{s.dispose();output.destroy();}
});
test('diagnostics isolate throwing loss listeners and observers from authority invalidation',async()=>{
 const p=pair({observe(){throw Error('synthetic-sensitive-canary');}});let delivered=0;p.s.onLoss(()=>{throw Error('synthetic-sensitive-canary');});p.s.onLoss(()=>delivered++);p.s.dispose();assert.equal(delivered,1);const d=p.s.supervisionSnapshot();assert.equal(d.authorityInvalidated,true);assert.equal(d.callbackErrors,1);assert.equal(d.observerError.name,'Error');assert(!JSON.stringify(d).includes('synthetic-sensitive-canary'));await assert.rejects(p.s.assertOwned());p.close();
});
test('diagnostic nested errors expose only fixed categories',()=>{
 const error=Object.assign(Error('synthetic-sensitive-canary'),{code:'private-code',cause:Object.assign(Error('private-value'),{name:'private-name',code:'ECONNRESET'})});assert.deepEqual(safeSupervisorError(error),{name:'Error',code:'UNKNOWN',nested:{name:'UNKNOWN',code:'ECONNRESET'}});
});
test('ownership requires fresh independently correlated replies',async()=>{
 const p=pair();try {await p.s.ready;for(let i=0;i<2;i++){const task=p.s.assertOwned();await tick();const r=p.frames.at(-1);assert.equal(r.type,'OWNED');assert.equal(r.id,i+1);p.reply(r);await task;}assert.notEqual(p.frames[1].challenge,p.frames[2].challenge);}finally{p.close();}
});
for(const status of ['FAIL','UNKNOWN'])test(`ownership ${status} refuses permanently`,async()=>{
 const p=pair();let losses=0;p.s.onLoss(()=>losses++);try{const task=p.s.assertOwned();await tick();p.reply(p.frames.at(-1),{status});await assert.rejects(task);await assert.rejects(p.s.assertOwned());assert.equal(losses,1);}finally{p.close();}
});
test('ownership deadline rejects and loss cannot be restored',async()=>{
 const p=pair({requestMs:25});let loss=0;p.s.onLoss(()=>loss++);try{await assert.rejects(p.s.assertOwned());assert.equal(loss,1);await assert.rejects(p.s.assertOwned());}finally{p.close();}
});
for(const [name,change] of [
 ['nonce',r=>({...r,nonce:'c'.repeat(64),status:'PASS'})],
 ['generation',r=>({...r,generation:'c'.repeat(64),status:'PASS'})],
 ['unknown ordinal',r=>({...r,id:r.id+1,status:'PASS'})],
 ['challenge',r=>({...r,challenge:'c'.repeat(64),status:'PASS'})],
 ['unknown type',r=>({...r,type:'AUTHORIZE',status:'PASS'})],
 ['extra field',r=>({...r,status:'PASS',approved:true})],
 ['unsupported status',r=>({...r,status:true})],
])test(`protocol refuses ${name}`,async()=>{
 const p=pair();try{const task=p.s.assertOwned();await tick();p.send(change(p.frames.at(-1)));await assert.rejects(task);await assert.rejects(p.s.assertOwned());}finally{p.close();}
});
test('replayed ownership PASS cannot authorize a later request',async()=>{
 const p=pair();try{let task=p.s.assertOwned();await tick();const old=p.frames.at(-1);p.reply(old);await task;task=p.s.assertOwned();await tick();p.reply(old);await assert.rejects(task);}finally{p.close();}
});
for(const [name,line] of [
 ['malformed','not-json\n'], ['duplicate keys','{"v":1,"v":1}\n'],
 ['oversized','x'.repeat(8193)], ['invalid UTF8',Buffer.from([0xff,10])],
])test(`bounded framing refuses ${name}`,async()=>{
 const p=pair();try{const task=p.s.assertOwned();await tick();p.input.write(line);await assert.rejects(task);}finally{p.close();}
});
for(const kind of ['end','destroy','error'])test(`channel ${kind} delivers terminal loss`,async()=>{
 const p=pair();let loss=0;p.s.onLoss(()=>loss++);try{const task=p.s.assertOwned();await tick();if(kind==='end')p.input.end();else if(kind==='destroy')p.output.destroy();else p.output.emit('error',Error('nonsecret-synthetic'));await assert.rejects(task);assert.equal(loss,1);let late=0;p.s.onLoss(()=>late++);assert.equal(late,1);await assert.rejects(p.s.assertOwned());}finally{p.close();}
});
test('unsubscribe and repeated dispose never revive callbacks',async()=>{
 const p=pair();let n=0;const off=p.s.onLoss(()=>n++);off();p.close();p.close();assert.equal(n,0);
});
test('credentials delivered once after fresh owned verification only',async()=>{
 const p=pair();try{p.setNotify(r=>{if(r.type==='OWNED')p.reply(r);if(r.type==='CREDENTIALS')p.reply(r,{value:{...sample}});});
 let value=await p.s.readCredentials();assert.deepEqual(value,sample);value=undefined;
 assert.deepEqual(p.frames.map(f=>f.type),['HELLO','OWNED','CREDENTIALS']);
 assert(!JSON.stringify(p.frames).includes(sample.student));await assert.rejects(p.s.readCredentials());
 }finally{p.close();}
});
test('malformed credentials never resolve private input',async()=>{
 const p=pair();try{p.setNotify(r=>{if(r.type==='OWNED')p.reply(r);if(r.type==='CREDENTIALS')p.reply(r,{value:{...sample,unapproved:true}});});await assert.rejects(p.s.readCredentials());}finally{p.close();}
});
test('private Auth key requires owned proof and is delivered only once',async()=>{
 const p=pair();let secret=randomBytes(64).toString('base64');
 try{p.setNotify(r=>{if(r.type==='OWNED')p.reply(r);if(r.type==='AUTH_KEY')p.reply(r,{value:secret});});
 const bytes=await p.s.readAuthKey();assert.equal(bytes.length,64);bytes.fill(0);
 assert.deepEqual(p.frames.map(f=>f.type),['HELLO','OWNED','AUTH_KEY']);assert(!JSON.stringify(p.frames).includes(secret));
 await assert.rejects(p.s.readAuthKey());}finally{secret='';p.close();}
});
test('invalid private Auth key fails closed',async()=>{
 const p=pair();try{p.setNotify(r=>{if(r.type==='OWNED')p.reply(r);if(r.type==='AUTH_KEY')p.reply(r,{value:'unapproved'});});await assert.rejects(p.s.readAuthKey());}finally{p.close();}
});
test('pending private Auth key is invalidated on channel loss',async()=>{
 const p=pair();try{p.setNotify(r=>{if(r.type==='OWNED')p.reply(r);if(r.type==='AUTH_KEY')p.input.destroy();});await assert.rejects(p.s.readAuthKey());await assert.rejects(p.s.assertOwned());}finally{p.close();}
});
test('genuine Auth works with child-only ephemeral config and terminal key cleanup',async()=>{
 const p=pair({requestMs:5000});let secret=randomBytes(64).toString('base64'),token='';
 const settings={APP_ENV:'LOCAL',MONGODB_URI:'mongodb://127.0.0.1:27018/?replicaSet=f021-test',MONGODB_DB_NAME:'deeplearner-f021-test',MONGODB_TLS:'false',ACCESS_TOKEN_ISSUER:'deeplearner-api',ACCESS_TOKEN_AUDIENCE:'deeplearner',AUTH_COOKIE_SECURE:'false',WEB_ORIGIN:'http://127.0.0.1:3000',PORT:'4000'};
 const previous=Object.fromEntries(Object.keys(settings).map(k=>[k,process.env[k]]));
 let usedConfig,active;
 try{
 Object.assign(process.env,settings);
 p.setNotify(r=>{if(r.type==='OWNED')p.reply(r);if(r.type==='AUTH_KEY')p.reply(r,{value:secret});});
 await runWithEphemeralAuth(p.s,async(config,assertActive)=>{
  usedConfig=config;active=assertActive;assertActive();assert(!Object.hasOwn(process.env,'ACCESS_TOKEN_SECRET'));
  const {createAccessTokens}=await import('./apps/api/src/modules/auth/access-token.service.ts');
  const tokens=createAccessTokens(config),context={sub:'1'.repeat(24),sid:'2'.repeat(24),role:'STUDENT',plan:'FREE'};
  token=await tokens.sign(context);assert.deepEqual(await tokens.verify(token),context);
  await assert.rejects(tokens.verify(token+'changed'));
  let otherBytes=randomBytes(64);const other=createAccessTokens({...config,ACCESS_TOKEN_SECRET:otherBytes.toString('base64')});otherBytes.fill(0);otherBytes=undefined;
  await assert.rejects(other.verify(token));token='';
  p.input.destroy();await tick();assert.throws(assertActive);assert.equal(config.ACCESS_TOKEN_SECRET,'');assert(!Object.hasOwn(process.env,'ACCESS_TOKEN_SECRET'));
 });
 assert.equal(usedConfig.ACCESS_TOKEN_SECRET,'');assert.throws(active);
 await assert.rejects(runWithEphemeralAuth(p.s,()=>{}));
 }finally{token='';secret='';p.close();for(const [k,v]of Object.entries(previous)){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
});
for(const field of ['hostPid','parentPid','expiresAt'])test(`configuration refuses wrong ${field}`,async()=>{
 const p=pair({},false);try{p.send({...p.config,[field]:field==='expiresAt'?Date.now()-1:0});await assert.rejects(p.s.ready);}finally{p.close();}
});
test('absolute generation lease expires even without requests',async()=>{
 const p=pair({},false);try{let lost=0;p.s.onLoss(()=>lost++);p.send({...p.config,expiresAt:Date.now()+30});await p.s.ready;await delay(60);assert.equal(lost,1);await assert.rejects(p.s.assertOwned());}finally{p.close();}
});
test('heartbeat detects silent supervisor loss without caller activity',async()=>{
 const p=pair({heartbeatMs:20,requestMs:20});try{let lost=0;p.s.onLoss(()=>lost++);await delay(80);assert.equal(lost,1);}finally{p.close();}
});
test('pending request cap is bounded and terminal',async()=>{
 const p=pair();try{const tasks=Array.from({length:17},()=>p.s.assertOwned());const values=await Promise.allSettled(tasks);assert(values.every(v=>v.status==='rejected'));}finally{p.close();}
});
test('safe terminal counters do not restore authority after fixture shutdown',async()=>{
 const p=pair();try{await p.s.ready;p.s.dispose();p.s.result(1,0,1);assert.equal(p.frames.at(-1).type,'RESULT');await assert.rejects(p.s.assertOwned());}finally{p.close();}
});
test('eight approved existing collections prepare through an exact empty mock database only',async()=>{
 const f=collectionFixture();assert.deepEqual(fixtureCollectionPlan,['auditLogs','technologies','learningPaths','modules','topics','concepts','practiceQuestions','visualizations']);
 assert.equal(fixtureIndexes.length,21);const before=JSON.stringify(fixtureIndexes);
 assert.equal(await prepareFixtureCollections(f.db,fixtureIndexes,verifyFixtureIndex,async()=>{f.checks++;}),8);
 assert.deepEqual(f.created,fixtureCollectionPlan);assert.equal(f.collections.size,19);assert.equal(JSON.stringify(fixtureIndexes),before);assert.equal(f.checks,10);
 assert.equal(await prepareFixtureCollections(f.db,fixtureIndexes,verifyFixtureIndex,async()=>{}),8);assert.equal(f.created.length,8);
});
function collectionFixture(){
 const collections=new Map(),created=[];
 const id=()=>({v:2,name:'_id_',key:{_id:1}});
 for(const i of fixtureIndexes){if(!collections.has(i.collection))collections.set(i.collection,{name:i.collection,type:'collection',options:{},count:0,indexes:[id()]});const value={v:2,name:i.name,key:{...i.key}};if(i.unique)value.unique=true;if(i.partialFilterExpression)value.partialFilterExpression=i.partialFilterExpression;if(i.expireAfterSeconds!==undefined)value.expireAfterSeconds=i.expireAfterSeconds;collections.get(i.collection).indexes.push(value);}
 const db={databaseName:'deeplearner-f021-test',listCollections(){return{async toArray(){return [...collections.values()].map(({name,type,options})=>({name,type,options}));}};},collection(name){const c=collections.get(name);return{async countDocuments(){return c.count;},listIndexes(){return{async toArray(){return c.indexes;}};}};},async createCollection(name){assert(fixtureCollectionPlan.includes(name));assert(!collections.has(name));created.push(name);collections.set(name,{name,type:'collection',options:{},count:0,indexes:[id()]});}};
 return {db,collections,created,checks:0};
}
for(const fault of ['unexpected','nonempty','options','view','index','target'])test(`collection preparation refuses ${fault} before any creation`,async()=>{
 const f=collectionFixture();if(fault==='unexpected')f.collections.set('unapproved',{name:'unapproved',type:'collection',options:{},count:0,indexes:[]});
 if(fault==='nonempty')f.collections.get('users').count=1;if(fault==='options')f.collections.get('users').options={collation:{locale:'en'}};
 if(fault==='view')f.collections.get('users').type='view';if(fault==='index')f.collections.get('users').indexes[1].unique=false;if(fault==='target')f.db.databaseName='protected';
 await assert.rejects(prepareFixtureCollections(f.db,fixtureIndexes,verifyFixtureIndex,async()=>{}));assert.deepEqual(f.created,[]);
});
test('collection preparation loss before creation refuses without fallback',async()=>{
 const f=collectionFixture();let calls=0;await assert.rejects(prepareFixtureCollections(f.db,fixtureIndexes,verifyFixtureIndex,async()=>{if(++calls===2)throw Error('synthetic loss');}));assert.deepEqual(f.created,[]);
});
test('fixed failure record and initialization stage survive parent failure without private errors',()=>{
 const r=createFixtureReport();r.stage('INITIALIZATION_ENTERED');const secret='synthetic-sensitive-canary';
 r.record('PARENT',false,{name:'Error',code:'unapproved-'+secret,message:secret,stack:secret});
 const summary=r.summary();assert.equal(summary.pass,0);assert.equal(summary.fail,1);assert.equal(summary.notRun,7);assert.equal(summary.stage,'INITIALIZATION_ENTERED');assert.equal(summary.errorCode,'UNKNOWN');assert(!JSON.stringify(summary).includes(secret));
 assert.throws(()=>r.record('PARENT',false));assert.throws(()=>r.stage(secret));assert.throws(()=>createFixtureReport(2));
});
test('first child failure diagnostics cannot be overwritten by parent aggregation',()=>{
 const r=createFixtureReport();r.stage('FIXTURE_READY');r.record('T03',false,{name:'AssertionError',code:'ERR_ASSERTION'});r.record('PARENT',false,{name:'Error',code:'ERR_TEST_FAILURE'});const s=r.summary();assert.equal(s.record,'T03');assert.equal(s.fail,2);assert.equal(s.notRun,6);assert.equal(s.errorCode,'ERR_ASSERTION');
 assert.deepEqual(safeFixtureError({cause:{name:'Error',message:'COMPLETION_FIXTURE_UNAVAILABLE'}}),{errorName:'Error',errorCode:'COMPLETION_FIXTURE_UNAVAILABLE'});
});
test('valid bounded terminal summary is one-shot and contains only approved metadata',async()=>{
 const p=pair();try{await p.s.ready;const r=createFixtureReport();r.stage('INITIALIZATION_ENTERED');r.record('PARENT',false,{name:'Error',message:'COMPLETION_FIXTURE_UNAVAILABLE'});const s=r.summary();p.s.result(s.pass,s.fail,s.total,s);const frame=p.frames.at(-1);assert.equal(frame.notRun,7);assert.equal(frame.record,'PARENT');assert.equal(frame.errorCode,'COMPLETION_FIXTURE_UNAVAILABLE');assert.throws(()=>p.s.result(0,1,1,s));await assert.rejects(p.s.assertOwned());}finally{p.close();}
});
test('malformed and contradictory terminal summaries are refused without private fallback',async()=>{
 for(const fault of ['total','notRun','extra','stage','counters']){const p=pair();try{await p.s.ready;const d={expected:8,notRun:7,stage:'INITIALIZATION_ENTERED',record:'PARENT',errorName:'Error',errorCode:'UNKNOWN'};if(fault==='notRun')d.notRun=0;if(fault==='extra')d.password='synthetic-canary';if(fault==='stage')d.stage='synthetic-canary';if(fault==='counters')Object.assign(d,{pass:8,fail:0,total:8});assert.throws(()=>p.s.result(0,1,fault==='total'?8:1,d));assert(!p.frames.some(f=>f.type==='RESULT'));}finally{p.close();}}
});
test('fatal diagnostic is bounded, one-shot, scoreless and cannot authorize after loss',async()=>{
 const p=pair();try{await p.s.ready;p.s.dispose();p.s.diagnostic({stage:'SUITE_IMPORTED',record:'NONE',errorName:'Error',errorCode:'UNKNOWN'});const f=p.frames.at(-1);assert.equal(f.type,'DIAGNOSTIC');assert(!('pass' in f));assert.throws(()=>p.s.diagnostic({stage:'SUITE_IMPORTED',record:'NONE',errorName:'Error',errorCode:'UNKNOWN'}));await assert.rejects(p.s.assertOwned());}finally{p.close();}
});
test('installed in-process reporter runs exported registrations without private output',async()=>{
 // A fresh top-level host is essential: calling run() from inside an already
 // running test binds registrations to that active test instead of the new root.
 const code=`import {run,test} from 'node:test'; const events=run({files:[],isolation:'none',setup(){test('safe registration',()=>{});}}); let count=0;for await(const event of events)if(event.type==='test:pass')count++;if(count!==1)process.exitCode=1;`;
 const child=spawnSync(process.execPath,['--input-type=module','-e',code],{timeout:5000,encoding:'utf8'});
 assert.equal(child.status,0);assert.equal(child.stderr,'');
});
'@
    $out=Join-Path $evidence 'supervisor-protocol.out';$err=Join-Path $evidence 'supervisor-protocol.err'
    $owner=[DeepLearnerLocal.Owner]::new()
    try {
        $child=$owner.Start('protocol',$node,@('--import','tsx','--test-reporter=tap','--input-type=module','-e',$protocol),$script:LocalRepo,$environment,$out,$err)
        Assert ($child.Wait(20000)) 'Protocol tests hung'
        Assert ($child.ExitCode -eq 0) 'Protocol tests failed; inspect bounded test evidence'
        $text=[IO.File]::ReadAllText($out)+[IO.File]::ReadAllText($err)
        Assert (-not $text.Contains('synthetic-student-only')) 'Private sample leaked'
        Assert ($text -match '# fail 0') 'Missing passing protocol summary'
        Write-Host ($text -split "`n" | Where-Object {$_ -match '^# (tests|pass|fail) '})
        Assert ($owner.WaitEmpty(2000)) 'Protocol Job not empty'
    } finally {if($owner.ActiveCount -gt 0){$owner.ForceStop()};$owner.Dispose()}
}
Check 'F038 native and CIM identity accepts only exact fresh owned child' {
    $owner=[DeepLearnerLocal.Owner]::new();$other=[DeepLearnerLocal.Owner]::new()
    try {
        $context=Get-SupervisedContext
        $child=$owner.Start('identity',$node,@('-e','process.stdin.resume();process.stdin.on("data",()=>process.stdin.destroy());'),$evidence,$environment,(Join-Path $evidence 'identity.out'),(Join-Path $evidence 'identity.err'))
        $valid=Get-SupervisedIdentity $owner $child $node $context ''
        Assert ($valid.Status -ceq 'PASS') 'Genuine native/CIM identity refused'
        Assert ((Get-SupervisedIdentity $owner $child ($node+'.wrong') $context $valid.Filetime).Status -ceq 'FAIL') 'Wrong executable accepted'
        Assert ((Get-SupervisedIdentity $owner $child $node $context ([string]([long]$valid.Filetime+1))).Status -ceq 'FAIL') 'Stale native creation identity accepted'
        $wrong=$context.Clone();$wrong.Pid=1
        Assert ((Get-SupervisedIdentity $owner $child $node $wrong $valid.Filetime).Status -cne 'PASS') 'Wrong parent accepted'
        Assert ((Get-SupervisedIdentity $other $child $node $context '').Status -cne 'PASS') 'Another Job adopted child'
        Assert (-not $owner.Owns([uint32]$PID)) 'Wrong process adopted'
        $child.Send('STOP');Assert ($child.Wait(5000)) 'Identity fixture hung'
        Assert ((Get-SupervisedIdentity $owner $child $node $context $valid.Filetime).Status -cne 'PASS') 'Exited process accepted'
        $owner.Dispose();Assert $child.HandlesClosed 'Retained handles not closed'
        Assert ((Get-SupervisedIdentity $owner $child $node $context $valid.Filetime).Status -cne 'PASS') 'Closed stale handle accepted'
    } finally {$owner.Dispose();$other.Dispose()}
}
Check 'F038 actual inherited duplex channel and synthetic one-time private input' {
    $owner=[DeepLearnerLocal.Owner]::new();$resource=$null
    try {
        $resource=$owner.Start('harmless-resource',$node,@('-e','process.stdin.resume();process.stdin.on("data",()=>process.stdin.destroy());'),$evidence,$environment,(Join-Path $evidence 'resource.out'),(Join-Path $evidence 'resource.err'))
        $input=@{Values=@{};IssuedUtc=[DateTime]::UtcNow}
        foreach($role in @('author','reviewer','student')){$input.Values[$role]=ConvertTo-SecureString ('nonsecret-offline-'+$role) -AsPlainText -Force}
        try {$result=Invoke-SupervisedFixtureHost -Owner $owner -Mongo $resource -MongoExecutable $node -Storage $evidence -Repo $script:LocalRepo -Environment $environment -PrivateInput $input -ErrorFile (Join-Path $evidence 'duplex.err') -OfflineProbe}
        catch {Write-Host ('Safe stage: '+$_.Exception.Data['Stage']+' / '+$_.Exception.Data['Category']+' / '+$_.Exception.Data['ErrorName']+' / ms='+$_.Exception.Data['CheckMs']+' / resource='+$_.Exception.Data['Resource']+' / host='+$_.Exception.Data['Host']+' / checks='+$_.Exception.Data['FailedChecks']);throw}
        Assert ($result.Result.Pass -eq 1 -and $result.ExitCode -eq 0) 'Duplex probe failed'
        Assert ($input.Values.Count -eq 0) 'Private input retained'
        $safeLines=@([IO.File]::ReadAllLines((Join-Path $evidence 'duplex.err')))
        Assert ($safeLines.Count -eq 1) 'Missing bounded host loss observation'
        $safeLoss=ConvertFrom-Json $safeLines[0] -AsHashtable
        Assert ($safeLoss.event -ceq 'SUPERVISOR_LOSS' -and $safeLoss.hostPid -eq $result.Host.Id -and $safeLoss.parentPid -eq $PID -and $safeLoss.reason -ceq 'DISPOSED' -and $safeLoss.authorityInvalidated -eq $true) 'Host observation unbound or incorrect'
        Assert ($safeLoss.lastOwnershipReply.status -ceq 'PASS' -and $safeLoss.lastOwnershipReply.binding -ceq 'VALIDATED') 'Authenticated OWNED receipt not observed'
        Assert ($result.Report.Supervision.LastRpc.Send.AuthenticatedDelivery -ceq 'UNKNOWN') 'Parent write guessed receipt'
        foreach($role in @('author','reviewer','student')){Assert (-not $safeLines[0].Contains('nonsecret-offline-'+$role)) 'Synthetic credential leaked'}
        $resource.Send('STOP');Assert ($resource.Wait(5000)) 'Resource exit deadline';Assert ($resource.ExitCode -eq 0) 'Resource exit nonzero'
        Assert ($owner.WaitEmpty(2000)) 'Duplex Job not empty'
    } finally {if($owner.ActiveCount -gt 0){$owner.ForceStop()};$owner.Dispose();if($resource){Assert $resource.HandlesClosed 'Resource handle leak'}}
}
Check 'F038 owned nonzero reporting peer preserves authenticated bounded counters' {
    $owner=[DeepLearnerLocal.Owner]::new();$child=$null
    try {
        $code=@'
const {createSupervisor}=await import('./.cache/f038-slice3-supervised-host.mjs');
const s=createSupervisor(process.stdin,process.stdout);
await s.ready;s.result(7,1,8,{expected:8,notRun:0,stage:'FIXTURE_READY',record:'T04',errorName:'AssertionError',errorCode:'ERR_ASSERTION'});s.dispose();process.exitCode=1;
'@
        $child=$owner.StartControlled('reporting-nonzero',$node,@('--input-type=module','-e',$code),$script:LocalRepo,$environment,(Join-Path $evidence 'reporting-nonzero.err'))
        $context=Get-SupervisedContext
        $identity=Get-SupervisedIdentity $owner $child $node $context ''
        Assert ($identity.Status -ceq 'PASS') 'Nonzero reporting peer not owned'
        $hello=Receive-SupervisedFrame ($child.ReadFrameAsync())
        Assert-SupervisedFields $hello @('v','type','nonce','pid','parentPid')
        Assert ($hello.v -eq 1 -and $hello.type -ceq 'HELLO' -and $hello.pid -eq $child.Id -and $hello.parentPid -eq $PID -and $hello.nonce -cmatch '^[a-f0-9]{64}$') 'Reporting peer not bound'
        $generation=[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLowerInvariant()
        Send-SupervisedFrame $child ([ordered]@{v=1;type='CONFIG';nonce=$hello.nonce;generation=$generation;hostPid=$child.Id;parentPid=$PID;mongoPid=$child.Id;dbPath=$evidence;expiresAt=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()+10000})
        $frame=Receive-SupervisedFrame ($child.ReadFrameAsync())
        $parsed=ConvertFrom-SupervisedResult $frame $hello.nonce $generation 8
        Assert ($child.Wait(5000)) 'Reporting peer exit deadline'
        $r=Get-SupervisedReport $parsed $null $child.ExitCode
        Assert ($r.CountsStatus -ceq 'VERIFIED' -and $r.Pass -eq 7 -and $r.Fail -eq 1 -and $r.NotRun -eq 0 -and $r.ExitCode -eq 1 -and $r.Overall -ceq 'FAIL') 'Nonzero real child lost counts or passed'
        Assert ($owner.WaitEmpty(2000)) 'Reporting peer Job not empty'
        Assert ([IO.File]::ReadAllText((Join-Path $evidence 'reporting-nonzero.err')).Length -eq 0) 'Reporting peer leaked diagnostics'
    }finally{if($owner.ActiveCount -gt 0){$owner.ForceStop()};$owner.Dispose();if($child){Assert $child.HandlesClosed 'Reporting peer handle leak'}}
}
Check 'F038 inherited channel rejects oversized writes and forced cleanup is owned' {
    $owner=[DeepLearnerLocal.Owner]::new()
    try {
        $child=$owner.StartControlled('bounded',$node,@('-e','setInterval(()=>{},1000);'),$evidence,$environment,(Join-Path $evidence 'bounded.err'))
        foreach($line in @(('x'*8193),"bad`nframe")) {
            $refused=$false;try {$child.SendFrameAsync($line).GetAwaiter().GetResult()}catch{$refused=$true}
            Assert $refused 'Malformed control write accepted'
        }
        $child.CloseInput();$observation=@{};$refused=$false
        try {Send-SupervisedFrame $child @{v=1;type='OWNED'} $observation}catch{$refused=$true}
        Assert ($refused -and $observation.Status -ceq 'UNKNOWN') 'Closed native pipe was accepted'
        Assert ($observation.Substage -cin @('SEND_INVOCATION','TASK_WAIT','AWAIT_ACCESS','RESULT_EXTRACTION')) 'Closed-pipe substage lost'
        Assert ($observation.Error.Chain.Count -ge 1 -and $observation.AuthenticatedDelivery -ceq 'UNKNOWN') 'Closed-pipe failure lost or implied receipt'
        $owner.ForceStop();Assert ($child.Wait(5000)) 'Forced child remained';Assert ($child.ExitCode -ne 0) 'Forced exit misreported'
        Assert ($owner.WaitEmpty(2000)) 'Forced Job not empty'
    } finally {$owner.Dispose();if($child){Assert $child.HandlesClosed 'Control handles not closed'}}
}
Check 'F038 parent refuses duplicate frames, oversized child output and read deadlines' {
    foreach($kind in @('duplicate','oversized','silent')) {
        $owner=[DeepLearnerLocal.Owner]::new();$child=$null
        try {
            $code=switch($kind){
                'duplicate' {'process.stdout.write("{\"v\":1,\"v\":1}\n");setInterval(()=>{},1000);'}
                'oversized' {'process.stdout.write("x".repeat(8193));setInterval(()=>{},1000);'}
                'silent' {'setInterval(()=>{},1000);'}
            }
            $child=$owner.StartControlled($kind,$node,@('-e',$code),$evidence,$environment,(Join-Path $evidence ($kind+'.err')))
            $rejected=$false;try{Receive-SupervisedFrame ($child.ReadFrameAsync()) 500 | Out-Null}catch{$rejected=$true}
            Assert $rejected 'Unverifiable child output accepted'
            $owner.ForceStop();Assert ($child.Wait(5000)) 'Owned negative fixture survived';Assert ($owner.WaitEmpty(2000)) 'Negative Job not empty'
        } finally {$owner.Dispose();if($child){Assert $child.HandlesClosed 'Negative handle leak'}}
    }
}
Check 'F038 real inherited EOF invalidates private host and refuses restart adoption' {
    $owner=[DeepLearnerLocal.Owner]::new();$child=$null
    try {
        $child=$owner.StartControlled('eof',$node,@((Join-Path $script:LocalRepo '.cache/f038-slice3-supervised-host.mjs'),'--probe'),$script:LocalRepo,$environment,(Join-Path $evidence 'eof.err'))
        $hello=Receive-SupervisedFrame ($child.ReadFrameAsync())
        Assert ($hello.pid -eq $child.Id) 'Wrong private peer'
        $child.CloseInput();Assert ($child.Wait(5000)) 'Private host ignored EOF';Assert ($child.ExitCode -ne 0) 'EOF falsely accepted'
        Assert ($owner.WaitEmpty(2000)) 'EOF Job not empty'
    } finally {$owner.Dispose();if($child){Assert $child.HandlesClosed 'EOF handle leak'}}
}
} else {
    Write-Host 'F038 temporary supervised-adapter checks NOT_RUN (explicit -SupervisedFixture required).'
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
    $captured=@();$parentProcess=Get-Process -Id $PID
    try {
        $output=Join-Path $evidence 'descendants.out'
        $child=$owner.Start('descendants',$node,@('-e','const c=require("node:child_process").spawn(process.execPath,["-e","setInterval(()=>{},1000)"],{stdio:"ignore"}); console.log(c.pid);setInterval(()=>{},1000);'),$evidence,$environment,$output,(Join-Path $evidence 'descendants.err'))
        $clock=[Diagnostics.Stopwatch]::StartNew()
        do {
            $reader=[IO.StreamReader]::new([IO.File]::Open($output,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::ReadWrite))
            try {$line=$reader.ReadToEnd().Trim()}finally{$reader.Dispose()}
            if($line -match '^[1-9][0-9]{0,9}$'){break};Start-Sleep -Milliseconds 25
        }while($clock.ElapsedMilliseconds -lt 5000)
        Assert ($line -match '^[1-9][0-9]{0,9}$') 'Expected descendant identity not reported'
        $descendantId=[uint32]$line
        # The reported PID locates a candidate only. Authority comes from complete
        # exact-Job enumeration and retained/independent native identity checks.
        $ids=$owner.MemberIds();Start-Sleep -Milliseconds 100
        Assert (($owner.MemberIds() -join ',') -ceq ($ids -join ',')) 'Job membership changed during observation'
        Assert ($ids -contains $child.Id -and $ids -contains $descendantId -and $child.Id -ne $descendantId) 'Expected root/descendant absent'
        foreach($memberId in $ids){$captured+=,$owner.CaptureMember($memberId)}
        $root=$captured | Where-Object Id -eq $child.Id
        $descendant=$captured | Where-Object Id -eq $descendantId
        $rootIdentity=Read-ContainedIdentity $owner $root $node @{([string]$PID)=$parentProcess.StartTime.ToUniversalTime().ToFileTimeUtc()}
        Assert ($rootIdentity.Filetime -eq ($owner.Observe($child)).Filetime) 'Root retained handle changed'
        $descendantIdentity=Read-ContainedIdentity $owner $descendant $node @{([string]$child.Id)=$rootIdentity.Filetime}
        $parents=@{([string]$child.Id)=$rootIdentity.Filetime;([string]$descendantId)=$descendantIdentity.Filetime}
        $extras=@($captured | Where-Object {$_.Id -notin @($child.Id,$descendantId)})
        Assert ($extras.Count -le 1) 'Unknown extra Job members'
        foreach($extra in $extras){Read-ContainedIdentity $owner $extra (Join-Path ([Environment]::SystemDirectory) 'conhost.exe') $parents | Out-Null}
        # Every member has an allowed role, executable, owner and pinned parent.
        Assert (($owner.MemberIds() -join ',') -ceq ($ids -join ',')) 'Unknown/replaced Job member'
        foreach($member in $captured){Assert (($owner.ObserveMember($member)).Live -eq $true) 'Verified member exited before cleanup'}
        Write-Host ('Verified exact Job: two Node identities; conhost identities='+$extras.Count)
        $owner.ForceStop()
        Assert ($child.Wait(5000)) 'Root remained';Assert ($child.ExitCode -ne 0) 'Forced exit falsely successful';Assert ($owner.WaitEmpty(5000)) 'Descendant remained'
        foreach($member in $captured){Assert $member.HasExited 'Retained member survived';Assert ($member.ExitCode -ne 0) 'Forced member exit misreported'}
    } finally {$owner.Dispose();$parentProcess.Dispose();foreach($member in $captured){Assert $member.HandleClosed 'Retained member handle leak'}}
}
Check 'retained Job members refuse wrong process, foreign Job, parent and closed handle' {
    $owner=[DeepLearnerLocal.Owner]::new();$other=[DeepLearnerLocal.Owner]::new()
    try {
        $root=$owner.Start('member-root',$node,@('-e','setInterval(()=>{},1000)'),$evidence,$environment,(Join-Path $evidence 'member-root.out'),(Join-Path $evidence 'member-root.err'))
        $peer=$owner.Start('member-peer',$node,@('-e','setInterval(()=>{},1000)'),$evidence,$environment,(Join-Path $evidence 'member-peer.out'),(Join-Path $evidence 'member-peer.err'))
        $member=$owner.CaptureMember($peer.Id)
        $refused=$false;try{$owner.CaptureMember([uint32]$PID)|Out-Null}catch{$refused=$true};Assert $refused 'Unrelated PID accepted'
        $refused=$false;try{$other.ObserveMember($member)|Out-Null}catch{$refused=$true};Assert $refused 'Foreign Job member accepted'
        $parents=@{([string]$root.Id)=($owner.Observe($root)).Filetime}
        $refused=$false;try{Read-ContainedIdentity $owner $member $node $parents|Out-Null}catch{$refused=$true};Assert $refused 'Unrelated same-Job peer accepted as descendant'
        $refused=$false;try{Read-ContainedIdentity $owner $member (Join-Path ([Environment]::SystemDirectory) 'conhost.exe') $parents|Out-Null}catch{$refused=$true};Assert $refused 'Node accepted as conhost'
        $member.Dispose();$refused=$false;try{$owner.ObserveMember($member)|Out-Null}catch{$refused=$true};Assert $refused 'Closed stale member handle accepted'
        $owner.ForceStop();Assert ($owner.WaitEmpty(5000)) 'Negative member Job not empty'
    } finally {$owner.Dispose();$other.Dispose()}
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
