#Requires -Version 7.0
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
. "$PSScriptRoot/../Start-DeepLearnerDev.ps1"
$passed=0
function Assert($Condition, [string]$Message) { if (-not $Condition) { throw $Message } }
function Check([string]$Name, [scriptblock]$Body) { & $Body; $script:passed++; Write-Host "PASS: $Name" }
$fixture=Join-Path $script:DevRepo ('.cache/dev-local-tests/' + [guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($fixture) | Out-Null
$node=(Get-Command node.exe -CommandType Application | Select-Object -First 1).Source
Check 'launcher parses without application or database execution' {
    $tokens=$null; $errors=$null
    [Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot '../Start-DeepLearnerDev.ps1'),[ref]$tokens,[ref]$errors) | Out-Null
    Assert ($errors.Count -eq 0) 'PowerShell parser errors'
}
Check 'missing profile refuses without creating it' {
    $path=Join-Path $fixture 'missing/profile.json'; $refused=$false
    try { Read-DevJson $path | Out-Null } catch { $refused=$_.Exception.Message -eq 'DEV_PROFILE_MISSING' }
    Assert $refused 'Missing profile accepted'; Assert (-not (Test-Path -LiteralPath $path)) 'Profile created'
}
Check 'public environment drops inherited credentials and preload options' {
    $old=$env:NODE_OPTIONS; $oldSecret=$env:ACCESS_TOKEN_SECRET; $oldDb=$env:MONGODB_URI
    try {
        $env:NODE_OPTIONS='synthetic-preload'; $env:ACCESS_TOKEN_SECRET='synthetic-only'; $env:MONGODB_URI='synthetic-only'
        $public=New-DevEnvironment $script:DevRepo $node $fixture
        foreach ($name in @('NODE_OPTIONS','ACCESS_TOKEN_SECRET','MONGODB_URI','MONGODB_DB_NAME','APP_ENV')) { Assert (-not $public.ContainsKey($name)) "Leaked $name" }
        Assert ($public['NPM_CONFIG_USERCONFIG'] -eq 'NUL') 'Ambient npm user config enabled'
        Assert ($public['NPM_CONFIG_IGNORE_SCRIPTS'] -eq 'true') 'Lifecycle hooks enabled'
        $api=New-DevApiEnvironment $public 'synthetic-uri' 'synthetic-secret'
        Assert ($api['MONGODB_URI'] -eq 'synthetic-uri') 'API config missing'
        Assert (-not $public.ContainsKey('ACCESS_TOKEN_SECRET')) 'API mutated frontend environment'
        Assert ($api['APP_ENV'] -eq 'LOCAL' -and $api['PORT'] -eq '4000') 'API bind config changed'
        $api.Clear(); $public.Clear()
    } finally { $env:NODE_OPTIONS=$old; $env:ACCESS_TOKEN_SECRET=$oldSecret; $env:MONGODB_URI=$oldDb }
}
Check 'frontend dotenv conflicts and per-workspace npm config refuse' {
    $repo=Join-Path $fixture 'fake-repo'
    foreach ($dir in @('apps/web','apps/admin','apps/api','packages/shared-types','packages/validation')) { [IO.Directory]::CreateDirectory((Join-Path $repo $dir)) | Out-Null }
    [IO.File]::WriteAllText((Join-Path $repo '.env.example'),'example only')
    Assert-DevFrontendFiles $repo
    foreach ($relative in @('apps/web/.env.local','apps/web/.ENV.LOCAL','apps/admin/.Env.Development','apps/admin/.env','packages/shared-types/.npmrc')) {
        $path=Join-Path $repo $relative; [IO.File]::WriteAllText($path,'synthetic only'); $refused=$false
        try { Assert-DevFrontendFiles $repo } catch { $refused=$true }
        Assert $refused 'Unsafe config accepted'; [IO.File]::Delete($path)
    }
}
Check 'occupied port refuses without adoption or termination' {
    function Get-DevListeners { param($Port) @([pscustomobject]@{LocalAddress='127.0.0.1'; OwningProcess=777; LocalPort=$Port}) }
    $refused=$false; try { Assert-DevFreePorts } catch { $refused=$_.Exception.Message -eq 'DEV_PORT_OCCUPIED' }
    Assert $refused 'Occupied port accepted'
}
Check 'listener query failures refuse instead of being treated as free ports' {
    function Get-NetTCPConnection { [CmdletBinding()] param($State,$LocalPort) throw [UnauthorizedAccessException]::new('synthetic query denial') }
    $refused=$false; try { Get-DevListeners 4000 | Out-Null } catch { $refused=$_.Exception.Message -eq 'DEV_PORT_INSPECTION_UNAVAILABLE' }
    Assert $refused 'Failed ownership query accepted'
    function Get-NetTCPConnection {
        [CmdletBinding()] param($State,$LocalPort)
        $record=[Management.Automation.ErrorRecord]::new([Exception]::new('synthetic no match'),'CmdletizationQuery_NotFound_LocalPort',[Management.Automation.ErrorCategory]::ObjectNotFound,$LocalPort)
        $PSCmdlet.ThrowTerminatingError($record)
    }
    Assert (@(Get-DevListeners 4000).Count -eq 0) 'Explicit no-match was not treated as free'
}
Check 'listener race rejects foreign owners and wildcard bindings' {
    $owner=[pscustomobject]@{}; $owner | Add-Member ScriptMethod Owns { param($Number) $Number -eq 123 }
    foreach ($row in @(@{LocalAddress='127.0.0.1'; OwningProcess=456},@{LocalAddress='0.0.0.0'; OwningProcess=123},@{LocalAddress='::1'; OwningProcess=123})) {
        function Get-DevListeners { param($Port) @([pscustomobject]$row) }
        $refused=$false; try { Test-DevOwnedListener 4000 $owner | Out-Null } catch { $refused=$_.Exception.Message -eq 'DEV_LISTENER_OWNERSHIP_REJECTED' }
        Assert $refused 'Foreign/wildcard listener accepted'
    }
    function Get-DevListeners { param($Port) @([pscustomobject]@{LocalAddress='127.0.0.1'; OwningProcess=123}) }
    Assert (Test-DevOwnedListener 4000 $owner) 'Owned loopback listener refused'
}
Check 'watcher listener gaps recover but persistent absence times out' {
    $state=@{missingSince=$null}
    Update-DevListenerRecovery $state $false 100
    Update-DevListenerRecovery $state $false 500
    Update-DevListenerRecovery $state $true 1000
    Assert ($null -eq $state.missingSince) 'Recovery not reset'
    Update-DevListenerRecovery $state $false 2000
    $refused=$false; try { Update-DevListenerRecovery $state $false 62000 } catch { $refused=$_.Exception.Message -eq 'DEV_LISTENER_TIMEOUT' }
    Assert $refused 'Unbounded missing listener'
}
Check 'exclusive startup lock refuses overlap and releases after disposal' {
    $path=Join-Path $fixture 'startup.lock'; $first=Open-DevLock $path; $refused=$false
    try { try { $second=Open-DevLock $path; $second.Dispose() } catch { $refused=$true } }
    finally { $first.Dispose() }
    Assert $refused 'Concurrent launcher accepted'; $next=Open-DevLock $path; $next.Dispose()
}
Check 'private validation writes have a deadline and a bounded frame' {
    $child=[pscustomobject]@{pending=[Threading.Tasks.TaskCompletionSource[string]]::new()}
    $child | Add-Member ScriptMethod ReadFrameAsync { [Threading.Tasks.Task]::FromResult('{}') }
    $child | Add-Member ScriptMethod SendFrameAsync { param($Text) $this.pending.Task }
    $refused=$false
    try { Send-DevValidationRequest $child '{}' 20 | Out-Null } catch { $refused=$_.Exception.Message -eq 'DEV_VALIDATION_TIMEOUT' }
    Assert $refused 'Unbounded pipe write'
    $refused=$false
    try { Send-DevValidationRequest $child ('x' * 8193) 20 | Out-Null } catch { $refused=$_.Exception.Message -eq 'DEV_CONFIGURATION_REJECTED' }
    Assert $refused 'Oversized private frame accepted'
}
Check 'check-mode cleanup failures still fail after all retained handles are disposed' {
    $tokens=$null; $errors=$null
    $ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot '../Start-DeepLearnerDev.ps1'),[ref]$tokens,[ref]$errors)
    $function=$ast.Find({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Invoke-DevStartup'},$true)
    $try=$function.Body.EndBlock.Statements | Where-Object { $_ -is [Management.Automation.Language.TryStatementAst] } | Select-Object -First 1
    $text=$try.Finally.Extent.Text
    $cleanup=[scriptblock]::Create($text.Substring(1,$text.Length-2))
    $owner=[pscustomobject]@{ActiveCount=0; disposed=$false}
    $owner | Add-Member ScriptMethod WaitEmpty { param($Timeout) throw 'synthetic query failure' }
    $owner | Add-Member ScriptMethod Dispose { $this.disposed=$true }
    $readers=@(); $lock=[IO.MemoryStream]::new(); $public=$null; $apiEnvironment=$null; $oldControl=$null
    $failed=$false; $uri=''; $secret=''; $request=$null; $refused=$false
    try { . $cleanup } catch { $refused=$_.Exception.Message -eq 'DEV_STARTUP_INCOMPLETE' }
    Assert $refused 'Cleanup failure incorrectly became success'
    Assert $owner.disposed 'Owner handle not disposed'; Assert (-not $lock.CanRead) 'Lock not disposed'
}
Check 'native containment stops owned descendants and preserves an unrelated retained child' {
    if (-not ('DeepLearnerLocal.Owner' -as [type])) { Add-Type -Path (Join-Path $PSScriptRoot '../LocalProcessOwner.cs') }
    $owner=[DeepLearnerLocal.Owner]::new(); $external=$null
    try {
        $info=[Diagnostics.ProcessStartInfo]::new($node); $info.UseShellExecute=$false; $info.CreateNoWindow=$true
        $info.ArgumentList.Add('-e'); $info.ArgumentList.Add('setInterval(()=>{},1000)')
        $info.Environment.Clear()
        foreach ($entry in (New-DevEnvironment $script:DevRepo $node $fixture).GetEnumerator()) { $info.Environment[$entry.Key]=$entry.Value }
        $external=[Diagnostics.Process]::Start($info)
        $child=$owner.Start('inert', $node, @('-e', 'const {spawn}=require("node:child_process");spawn(process.execPath,["-e","setInterval(()=>{},1000)"],{stdio:"ignore"});setInterval(()=>{},1000)'), $script:DevRepo, (New-DevEnvironment $script:DevRepo $node $fixture), (Join-Path $fixture 'inert.out.log'), (Join-Path $fixture 'inert.err.log'))
        $timer=[Diagnostics.Stopwatch]::StartNew()
        while ($owner.ActiveCount -lt 2 -and $timer.Elapsed.TotalSeconds -lt 10) { Start-Sleep -Milliseconds 50 }
        Assert ($owner.ActiveCount -ge 2) 'Owned descendant not observed'
        $owner.ForceStop(); Assert ($owner.WaitEmpty(5000)) 'Owned Job not empty'; Assert ($child.Wait(1000)) 'Owned root did not exit'
        Assert (-not $external.HasExited) 'Unrelated retained child terminated'
    } finally {
        $owner.Dispose()
        if ($external) { try { if (-not $external.HasExited) { $external.Kill(); $external.WaitForExit(5000) | Out-Null } } finally { $external.Dispose() } }
    }
}
Check 'real private validator returns a public plan without launching applications' {
    $owner=[DeepLearnerLocal.Owner]::new()
    try {
        $profile=Read-DevJson (Join-Path $PSScriptRoot '../dev-local.example.json')
        $profile.repository=$script:DevRepo; $profile.ownerSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
        $profile.prerequisites=@{instance='APPROVED_READY'; schema='APPROVED_READY'}
        $manifests=@{}
        foreach ($entry in @(@('root','package.json'),@('web','apps/web/package.json'),@('admin','apps/admin/package.json'),@('api','apps/api/package.json'),@('types','packages/shared-types/package.json'),@('validation','packages/validation/package.json'))) {
            $manifest=Read-DevJson (Join-Path $script:DevRepo $entry[1]); $manifests[$entry[0]]=@{scripts=$manifest.scripts}
        }
        $uri='mongodb://' + 'fixture-user:synthetic-only@127.0.0.1:27019/deeplearner-dev?replicaSet=deeplearner-dev-rs&directConnection=true&authSource=deeplearner-dev'
        $secret=[Convert]::ToBase64String([byte[]](0..31))
        $request=@{profile=$profile; repository=$script:DevRepo; ownerSid=$profile.ownerSid; manifests=$manifests; secrets=@{mongodbUri=$uri; signingSecret=$secret}}
        $child=$owner.StartControlled('inert-validator',$node,@('--import','tsx',(Join-Path $script:DevRepo 'apps/api/scripts/dev-local.ts')),$script:DevRepo,(New-DevEnvironment $script:DevRepo $node $fixture),(Join-Path $fixture 'validator.err.log'))
        $frame=Send-DevValidationRequest $child ($request | ConvertTo-Json -Depth 12 -Compress)
        $plan=$frame | ConvertFrom-Json -AsHashtable
        Assert ($plan.services.Count -eq 3) 'Missing public process plan'
        Assert (-not $frame.Contains($uri) -and -not $frame.Contains($secret)) 'Private values in output'
        Assert ($owner.WaitEmpty(1000)) 'Validator stayed alive'
    } finally { $owner.Dispose() }
}
. "$PSScriptRoot/../Setup-DeepLearnerDev.ps1"
Check 'MongoDB setup parses and defaults to a non-mutating exact plan' {
    $tokens=$null; $errors=$null
    [Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot '../Setup-DeepLearnerDev.ps1'),[ref]$tokens,[ref]$errors) | Out-Null
    Assert ($errors.Count -eq 0) 'Setup syntax invalid'
    $result=Invoke-DevMongoSetup
    Assert ($result.operation -eq 'PLAN_ONLY') 'Default would execute'
    Assert ($result.target.port -eq 27019 -and $result.target.member -eq 'localhost:27019') 'Wrong target/member'
    Assert ($result.target.policy -eq 'PROPOSED / NOT ACTIVE') 'Policy activated'
}
Check 'changed protected ports, paths, services and network exposure refuse' {
    $plan=Get-DevMongoPlan
    foreach ($change in @(@('port',27017),@('port',27018),@('host','0.0.0.0'),@('storage','C:\Program Files\MongoDB\Server\8.2\data'),@('storage','C:\Users\Shreeji\AppData\Local\DeepLearner\local-dev\mongodb'),@('serviceName','MongoDB'),@('database','admin'),@('replicaSet','other'))) {
        $copy=[ordered]@{}; foreach($key in $plan.Keys){$copy[$key]=$plan[$key]}; $copy[$change[0]]=$change[1]
        $refused=$false; try { Assert-DevMongoPlan $copy } catch { $refused=$_.Exception.Message -eq 'DEV_MONGO_TARGET_REJECTED' }
        Assert $refused 'Altered target accepted'
    }
}
Check 'configuration is authenticated loopback with keys outside writable data' {
    $plan=Get-DevMongoPlan; $config=Get-DevMongoConfiguration $plan
    Assert ($config.Contains('bindIp: 127.0.0.1') -and $config.Contains('port: 27019')) 'Wrong network exposure'
    Assert ($config.Contains('authorization: enabled') -and $config.Contains('keyFile:')) 'Authentication omitted'
    Assert (-not $plan.keyFile.StartsWith($plan.storage+'\') -and -not $plan.configuration.StartsWith($plan.storage+'\')) 'Control files in writable data'
    Assert ($plan.serviceAccount -eq 'NT SERVICE\DeepLearnerDevMongo27019') 'Shared/privileged service identity'
    Assert (-not $config.Contains('disableSplitHorizonIPCheck')) 'Unapproved IP bypass'
}
Check 'all effectful setup actions refuse before probes, credentials or writes' {
    function Get-DevMongoPortRows { throw 'UNEXPECTED_PORT_PROBE' }
    foreach ($operation in @('PrepareStorage','InstallService','StartService','StopService','InitializeReplica','BootstrapFirstUser')) {
        $refused=$false; try { Invoke-DevMongoSetup $operation } catch { $refused=$_.Exception.Message -eq 'DEV_PERSISTENT_POLICY_NOT_ACTIVE' }
        Assert $refused "Execution unexpectedly reached $operation"
    }
    $refused=$false; try { Invoke-DevMongoSetup 'Activate' } catch { $refused=$_.Exception.Message -eq 'DEV_MONGO_ACTION_REJECTED' }
    Assert $refused 'Activation operation accepted'
}
Check 'filesystem primitives reject foreign paths and cannot bypass policy' {
    $plan=Get-DevMongoPlan
    foreach ($body in @({New-DevMongoDirectory 'C:\foreign' 'Modify'},{Write-DevMongoPrivateFile 'C:\foreign.key' ([byte[]]::new(0)) 'Read'})) {
        $refused=$false; try { & $body } catch { $refused=$_.Exception.Message -eq 'DEV_MONGO_TARGET_REJECTED' }; Assert $refused 'Foreign write accepted'
    }
    foreach ($body in @({New-DevMongoDirectory $plan.storage 'Modify'},{Write-DevMongoPrivateFile $plan.configuration ([byte[]]::new(0)) 'Read'},{Open-DevMongoLifecycleLock $plan})) {
        $refused=$false; try { & $body } catch { $refused=$_.Exception.Message -eq 'DEV_PERSISTENT_POLICY_NOT_ACTIVE' }; Assert $refused 'Primitive bypassed inactive policy'
    }
}
Check 'ACL descriptors isolate service rights without changing any Windows ACL' {
    $plan=Get-DevMongoPlan
    foreach ($kind in @('Traverse','Read','Modify','OwnerOnly')) {
        $acl=Get-DevMongoAcl $kind
        Assert $acl.AreAccessRulesProtected 'Inherited permissions retained'
        $rules=@($acl.GetAccessRules($true,$false,[Security.Principal.SecurityIdentifier]) | Where-Object { $_.IdentityReference.Value -eq $plan.serviceSid })
        if ($kind -eq 'OwnerOnly') { Assert ($rules.Count -eq 0) 'Service can read owner-only receipt' }
        else {
            Assert ($rules.Count -eq 1) 'Missing service-specific rule'
            if ($kind -eq 'Read' -or $kind -eq 'Traverse') { Assert (-not ($rules[0].FileSystemRights -band [Security.AccessControl.FileSystemRights]::WriteData)) 'Service writable control configuration' }
            if ($kind -eq 'Traverse') { Assert ($rules[0].InheritanceFlags -eq 'None') 'Service inherits API secret access' }
        }
    }
    Import-DevMongoAtomicDirectory
    Assert ($null -ne ('DeepLearnerMongoIO' -as [type]).GetMethod('CreateExclusive')) 'Atomic exclusive-create primitive did not compile'
}
Check 'TCP parser refuses unknown output and conservatively treats target bindings as occupied' {
    $header='Proto Local Address Foreign Address State PID'
    Assert (@(ConvertFrom-DevMongoListeners @($header,'TCP 127.0.0.1:4000 0.0.0.0:0 LISTENING 5')).Count -eq 0) 'Unrelated binding treated as target'
    foreach ($row in @('TCP 127.0.0.1:27019 0.0.0.0:0 LISTENING 12','TCP [::]:27019 [::]:0 LISTENING 12','TCP 127.0.0.1:27019 0.0.0.0:0 TIME_WAIT 0')) { Assert (@(ConvertFrom-DevMongoListeners @($header,$row)).Count -eq 1) 'Occupied target treated as free' }
    foreach ($rows in @(@($header,'TCP 127.0.0.1:27019 0.0.0.0:0 UNKNOWN 12'),@($header,'TCP 127.0.0.1:27019 malformed'),@('unrecognized output'))) {
        $refused=$false; try { ConvertFrom-DevMongoListeners $rows | Out-Null } catch { $refused=$_.Exception.Message -eq 'DEV_MONGO_PORT_UNKNOWN' }; Assert $refused 'Unknown TCP result treated as free'
    }
    $live=@(ConvertFrom-DevMongoListeners @($header,'TCP 127.0.0.1:27019 0.0.0.0:0 LISTENING 12','TCP 127.0.0.1:27019 127.0.0.1:50000 ESTABLISHED 12','TCP 127.0.0.1:27019 127.0.0.1:50001 TIME_WAIT 0'))
    Assert-DevMongoListenerRows $live 12
    $refused=$false; try { Assert-DevMongoListenerRows $live 99 } catch { $refused=$_.Exception.Message -eq 'DEV_MONGO_LISTENER_IDENTITY_UNKNOWN' }; Assert $refused 'Foreign listener accepted'
}
Check 'owner-matching parent ACL rejects unrelated write and delete-child authority' {
    $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    $acl=Get-DevMongoAcl 'OwnerOnly'
    Assert-DevMongoParentAcl $acl $sid
    $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new('S-1-1-0'),'Read','Allow'))
    Assert-DevMongoParentAcl $acl $sid
    $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new('S-1-1-0'),'DeleteSubdirectoriesAndFiles','Allow'))
    $refused=$false; try { Assert-DevMongoParentAcl $acl $sid } catch { $refused=$_.Exception.Message -eq 'DEV_MONGO_PARENT_SHARED_WRITE_REFUSED' }; Assert $refused 'Shared writable parent accepted'
    foreach ($generic in @('GA','GW')) {
        $genericAcl=[Security.AccessControl.DirectorySecurity]::new()
        $genericAcl.SetSecurityDescriptorSddlForm("O:${sid}D:(A;;FA;;;${sid})(A;;${generic};;;WD)")
        $refused=$false; try { Assert-DevMongoParentAcl $genericAcl $sid } catch { $refused=$_.Exception.Message -eq 'DEV_MONGO_PARENT_SHARED_WRITE_REFUSED' }; Assert $refused 'Generic shared write capability accepted'
    }
}
Check 'replica helper emits only exact public plan and blocks initialization before driver imports' {
    $tool=Join-Path $script:DevRepo 'apps/api/scripts/dev-local.ts'
    $json=@(& $node --import tsx $tool mongo-plan); Assert ($LASTEXITCODE -eq 0) 'Replica plan failed'
    $replica=($json -join '') | ConvertFrom-Json
    Assert ($replica._id -eq 'deeplearner-dev-rs' -and $replica.members.Count -eq 1 -and $replica.members[0].host -eq 'localhost:27019') 'Replica target changed'
    $message=@(& $node --import tsx $tool mongo-initialize 2>&1); $code=$LASTEXITCODE
    Assert ($code -eq 1 -and ($message -join '') -match 'DEV_PERSISTENT_POLICY_NOT_ACTIVE') 'Replica execution bypassed policy'
}
Check 'two exact transport configurations preserve access control and disable normal localhost bypass' {
    $plan=Get-DevMongoPlan
    $bootstrap=Get-DevMongoConfiguration $plan 'Bootstrap'; $normal=Get-DevMongoConfiguration $plan 'Normal'
    Assert ($bootstrap.Contains('mode: requireTLS') -and $bootstrap.Contains('allowConnectionsWithoutCertificates: false')) 'Bootstrap accepts unintended clients'
    Assert ($bootstrap.Contains('enableLocalhostAuthBypass: true') -and $normal.Contains('enableLocalhostAuthBypass: false')) 'Incorrect localhost-exception lifecycle'
    foreach($text in @($bootstrap,$normal)){Assert ($text.Contains('authorization: enabled') -and $text.Contains('clusterAuthMode: keyFile') -and $text.Contains('bindIp: 127.0.0.1')) 'Authentication or target changed'}
    Assert ((Get-DevMongoConfigurationPhaseFromText $plan $bootstrap) -eq 'Bootstrap') 'Bootstrap phase lost'
    Assert ((Get-DevMongoConfigurationPhaseFromText $plan $normal) -eq 'Normal') 'Normal phase lost'
    $refused=$false;try{Get-DevMongoConfigurationPhaseFromText $plan ($bootstrap.Replace('allowConnectionsWithoutCertificates: false','allowConnectionsWithoutCertificates: true'))}catch{$refused=$_.Exception.Message -eq 'DEV_MONGO_PRIVATE_CONFIGURATION_CHANGED'};Assert $refused 'Unknown transport config accepted'
}
Check 'bootstrap crypto, DPAPI, helper, service permissions and transition refuse before effects' {
    $plan=Get-DevMongoPlan
    foreach($body in @({New-DevMongoPassword},{Protect-DevMongoValue 'synthetic-only'},{Initialize-DevMongoPrivateMaterial $plan},{Set-DevMongoOwnerServiceRights $plan},{Write-DevMongoStage $plan 'complete' 'NORMAL_AUTHENTICATION_VERIFIED'},{Invoke-DevMongoNodeStep $plan 'administrator'},{Set-DevMongoNormalConfiguration $plan},{Assert-DevMongoAuthenticatedBootstrap})){
        $refused=$false;try{& $body | Out-Null}catch{$refused=$_.Exception.Message -eq 'DEV_PERSISTENT_POLICY_NOT_ACTIVE'};Assert $refused 'Bootstrap primitive bypassed inactive policy'
    }
}
Check 'private artifact ACL allowlist separates server material from owner credentials' {
    $plan=Get-DevMongoPlan
    foreach($path in @($plan.ca,$plan.serverCertificate,$plan.keyFile,$plan.nextConfiguration)){Assert ((Get-DevMongoPrivateFileKind $plan $path) -eq 'Read') 'Service cannot read required material'}
    foreach($path in @($plan.clientCertificate,$plan.caKey,$plan.operatorSecret,$plan.applicationSecret,$plan.bootstrapManifest,(Get-DevMongoStagePath $plan 'complete'))){Assert ((Get-DevMongoPrivateFileKind $plan $path) -eq 'OwnerOnly') 'Service can read owner credentials'}
    $refused=$false;try{Get-DevMongoPrivateFileKind $plan (Join-Path $plan.storage 'secret.pem')}catch{$refused=$_.Exception.Message -eq 'DEV_MONGO_TARGET_REJECTED'};Assert $refused 'Writable data used for private key'
    $mask=Get-DevMongoServiceOwnerMask
    Assert (($mask -band 0x30) -eq 0x30) 'Owner lacks start/stop'
    Assert (($mask -band (0x2 -bor 0x10000 -bor 0x40000 -bor 0x80000)) -eq 0) 'Owner service grant includes change-config/delete/write-DACL/write-owner'
}
Check 'uncertain first-user, role and application writes select inspection without replay or credential regeneration' {
    foreach($row in @(@('administrator','inspect-administrator'),@('application-role','inspect-application-role'),@('application-user','verify-application'))){
        Assert ((Get-DevMongoRecoveryStep $row[0] $false $false) -eq $row[0]) 'Fresh operation lost'
        Assert ((Get-DevMongoRecoveryStep $row[0] $false $true) -eq $row[1]) 'Uncertain write would replay'
        Assert ((Get-DevMongoRecoveryStep $row[0] $true $true) -eq $row[1]) 'Completed write would replay'
        $refused=$false;try{Get-DevMongoRecoveryStep $row[0] $true $false}catch{$refused=$_.Exception.Message -eq 'DEV_MONGO_BOOTSTRAP_STAGE_REJECTED'};Assert $refused 'Impossible phase accepted'
    }
}
Check 'new private helper CLI refuses before reading secrets or creating a client' {
    $tool=Join-Path $script:DevRepo 'apps/api/scripts/dev-mongo-bootstrap.ts'
    $message=@(& $node --import tsx $tool 2>&1);$code=$LASTEXITCODE
    Assert ($code -eq 1 -and ($message -join '') -match '^DEV_PERSISTENT_POLICY_NOT_ACTIVE$') 'Bootstrap helper entry did not refuse safely'
}
Check 'bootstrap orchestration reconciles interrupted transport and credential phases with all host effects mocked' {
    # These local mocks exist only for this Check scope. They cannot alter the
    # source policy guard; no real filesystem, SCM, crypto, helper or DB is called.
    $plan=Get-DevMongoPlan; $calls=[Collections.Generic.List[string]]::new(); $files=@{}; $simulation=@{Phase='Normal';Interrupt=$false;MissingOperator=$false}
    function Assert-DevMongoExecutionPolicy {}
    function Open-DevMongoLifecycleLock {param($Plan) return [IO.MemoryStream]::new()}
    function Assert-DevMongoPrepared {param($Plan)}
    function Get-DevMongoConfigurationPhase {param($Plan) return $simulation.Phase}
    function Test-Path {param([string]$LiteralPath) return $files.ContainsKey($LiteralPath)}
    function Assert-DevMongoStage {param($Plan,$Stage) $calls.Add('inspect-stage:'+$Stage);return @{stage=$Stage}}
    function Write-DevMongoStage {param($Plan,$Stage,$Status) $calls.Add('write-stage:'+$Stage);$files[(Get-DevMongoStagePath $Plan $Stage)]=$true}
    function Assert-DevMongoPortFree {$calls.Add('port-check')}
    function Assert-DevMongoRunningIdentity {param($Plan,$Service) if($Service.Status -ne 'Running'){throw 'MOCK_NOT_RUNNING'};$calls.Add('identity')}
    $fakeService=[pscustomobject]@{Status='Stopped';Calls=$calls}
    $fakeService | Add-Member ScriptMethod Refresh {}
    $fakeService | Add-Member ScriptMethod Start {$this.Calls.Add('service-start');$this.Status='Running'}
    $fakeService | Add-Member ScriptMethod Stop {$this.Calls.Add('service-stop');$this.Status='Stopped'}
    $fakeService | Add-Member ScriptMethod WaitForStatus {param($Status,$Timeout) if($this.Status -ne $Status){throw 'MOCK_BAD_SERVICE_STATE'}}
    $fakeService | Add-Member ScriptMethod Dispose {}
    function Get-DevMongoService {param($Plan)return $fakeService}
    function Invoke-DevMongoNodeStep {param($Plan,$Step)
        $calls.Add('node:'+$Step)
        if($simulation.MissingOperator -and $Step -eq 'inspect-administrator'){throw 'DEV_PRIVATE_CONFIG_MISSING'}
        switch($Step){'verify-normal'{'NORMAL_AUTHENTICATION_VERIFIED'} 'inspect-administrator'{'ADMINISTRATOR_VERIFIED'} 'inspect-application-role'{'APPLICATION_ROLE_VERIFIED'} 'verify-application'{'APPLICATION_VERIFIED'} default{throw ('UNEXPECTED_MUTATION:'+ $Step)}}
    }
    function Set-DevMongoNormalConfiguration {param($Plan) $calls.Add('normal-config');if($fakeService.Status -ne 'Stopped'){throw 'MOCK_CONFIG_CHANGED_WHILE_RUNNING'};$simulation.Phase='Normal';if($simulation.Interrupt){throw 'SYNTHETIC_INTERRUPTED_TRANSITION'}}
    foreach($stage in @('administrator','application')){$files[(Get-DevMongoStagePath $plan $stage)]=$true}
    $result=Invoke-DevMongoBootstrap $plan
    Assert ($result.status -eq 'NORMAL_AUTHENTICATION_VERIFIED') 'Interrupted normal transition not reconciled'
    Assert (($calls | Where-Object {$_ -like 'node:*'}) -join ',' -eq 'node:verify-normal') 'Normal transition repeated bootstrap'
    Assert ($calls.Contains('write-stage:complete') -and -not $calls.Contains('normal-config')) 'Normal phase overwritten or not completed'
    $calls.Clear();$result=Invoke-DevMongoBootstrap $plan
    Assert (-not ($calls | Where-Object {$_ -like 'write-stage:*'})) 'Completed restart rewrote stage state'
    Assert (($calls | Where-Object {$_ -like 'node:*'}) -join ',' -eq 'node:verify-normal') 'Completed restart repeated bootstrap'
    $calls.Clear();$files.Clear();$simulation.Phase='Bootstrap';$fakeService.Status='Running'
    $files[(Get-DevMongoStagePath $plan 'initialize-intent')]=$true
    $refused=$false;try{Invoke-DevMongoBootstrap $plan | Out-Null}catch{$refused=$_.Exception.Message -eq 'DEV_MONGO_INITIALIZATION_OUTCOME_UNKNOWN_RECONCILE'}
    Assert ($refused -and -not ($calls | Where-Object {$_ -like 'node:*'})) 'Uncertain replica init replayed'
    $calls.Clear();$files.Clear()
    foreach($stage in @('replica','administrator-intent','application-role-intent','application-role','application-user-intent','application')){$files[(Get-DevMongoStagePath $plan $stage)]=$true}
    $simulation.MissingOperator=$true
    $refused=$false;try{Invoke-DevMongoBootstrap $plan | Out-Null}catch{$refused=$_.Exception.Message -eq 'DEV_PRIVATE_CONFIG_MISSING'}
    Assert ($refused -and -not $calls.Contains('normal-config') -and -not $calls.Contains('node:administrator')) 'Missing operator credentials changed state'
    $simulation.MissingOperator=$false;$calls.Clear();$simulation.Interrupt=$true
    $refused=$false;try{Invoke-DevMongoBootstrap $plan | Out-Null}catch{$refused=$_.Exception.Message -eq 'SYNTHETIC_INTERRUPTED_TRANSITION'}
    Assert ($refused -and $simulation.Phase -eq 'Normal') 'Transition interruption not exercised'
    Assert ($calls.Contains('node:inspect-administrator') -and -not $calls.Contains('node:administrator')) 'Lost administrator ACK repeated createUser'
    Assert ($calls.Contains('node:verify-application') -and -not $calls.Contains('node:application-user')) 'Lost application ACK repeated createUser'
    Assert ($calls.IndexOf('node:verify-application') -lt $calls.IndexOf('service-stop')) 'Configuration transition preceded application verification'
    Assert ($calls.IndexOf('service-stop') -lt $calls.IndexOf('normal-config')) 'Configuration changed before service stopped'
    $simulation.Interrupt=$false;$calls.Clear();$result=Invoke-DevMongoBootstrap $plan
    Assert (($calls | Where-Object {$_ -like 'node:*'}) -join ',' -eq 'node:verify-normal') 'Interrupted transition repeated credential operations'
    Assert (-not $calls.Contains('normal-config') -and $calls.Contains('write-stage:complete')) 'Interrupted normal config reopened bootstrap'
    $calls.Clear();$files.Clear();$simulation.Phase='Bootstrap';$files[(Get-DevMongoStagePath $plan 'complete')]=$true
    $refused=$false;try{Invoke-DevMongoBootstrap $plan | Out-Null}catch{$refused=$_.Exception.Message -eq 'DEV_MONGO_BOOTSTRAP_REENTRY_REJECTED'}
    Assert $refused 'Completion marker allowed re-entry into bootstrap transport'
}
Check 'service security rejects foreign owners and controlling ACEs without touching Windows service ACLs' {
    $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    $safe=[Security.AccessControl.RawSecurityDescriptor]::new("O:${sid}D:(A;;GA;;;SY)(A;;GA;;;BA)(A;;0x1200B5;;;${sid})(A;;0x20005;;;WD)")
    Assert-DevMongoServiceSecurity $safe $sid
    foreach($rights in @('0x2','0x10','0x20','0x40','0x100','0x10000','0x40000','0x80000','GA','GX','GW')){
        $bad=[Security.AccessControl.RawSecurityDescriptor]::new("O:${sid}D:(A;;GA;;;SY)(A;;${rights};;;WD)")
        $refused=$false;try{Assert-DevMongoServiceSecurity $bad $sid}catch{$refused=$_.Exception.Message -eq 'DEV_MONGO_FOREIGN_SERVICE_CONTROL_REFUSED'};Assert $refused 'Foreign service control accepted'
    }
    foreach($sddl in @('O:WDD:(A;;GA;;;SY)',"O:${sid}")){
        $refused=$false;try{Assert-DevMongoServiceSecurity ([Security.AccessControl.RawSecurityDescriptor]::new($sddl)) $sid}catch{$refused=$_.Exception.Message -eq 'DEV_MONGO_SERVICE_PERMISSIONS_UNKNOWN'};Assert $refused 'Unknown service owner/DACL accepted'
    }
    Import-DevMongoServiceSecurityReader
    Assert ($null -ne ('DeepLearnerMongoServiceSecurity' -as [type]).GetMethod('Read')) 'Read-only service-security native helper did not compile'
}
Write-Host "$passed inert/unit checks passed. No MongoDB/service/database/ACL operation or application startup was performed. Runtime qualification remains NOT_RUN."
