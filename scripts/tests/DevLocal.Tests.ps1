#Requires -Version 7.0
param([switch]$InertOnly)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
. "$PSScriptRoot/../Start-DeepLearnerDev.ps1"
$passed=0
function Assert($Condition, [string]$Message) { if (-not $Condition) { throw $Message } }
function Check([string]$Name, [scriptblock]$Body) {
    if($InertOnly -and $Name -cin @('native containment stops owned descendants and preserves an unrelated retained child','real private validator returns a public plan without launching applications','replica helper emits only exact public plan and blocks initialization before driver imports','private helper policy-check CLI reads no private input or database','manual default Plan and Node metadata issue no runtime lease or private migration')){Write-Host "NOT_RUN (child-process restriction): $Name";return}
    & $Body; $script:passed++; Write-Host "PASS: $Name"
}
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
Check 'dot-sourcing exposes no context issuer and installs only the context-free refusal' {
    $guard=${function:Assert-DevMongoExecutionPolicy}.ToString()
    Assert ($guard.Contains("throw 'DEV_MONGO_EXECUTION_CONTEXT_REQUIRED'") -and -not $guard.Contains('Set-Item') -and -not $guard.Contains('New-Service') -and -not $guard.Contains('CreateExclusive')) 'Imported guard can issue context or perform effects'
    $source=[IO.File]::ReadAllText((Join-Path $PSScriptRoot '../Setup-DeepLearnerDev.ps1'))
    $cli=$source.IndexOf("if (`$MyInvocation.InvocationName -ne '.')")
    Assert ($cli -gt 0 -and $source.IndexOf('Set-Item Function:Assert-DevMongoExecutionPolicy') -gt $cli) 'Context issuer exists outside CLI'
    Assert ($source.Substring($cli).Contains('$lease.alive=$false; $lease.Clear()') -and $source.Substring($cli).Contains('Set-Item Function:Assert-DevMongoExecutionPolicy -Value $closedGuard')) 'CLI context not revoked/restored in finally'
}
Check 'pure source policy agreement rejects mixed status, version, target and operation changes' {
    $inactive=Get-DevMongoSourcePolicy
    $inactive.status='PROPOSED / NOT ACTIVE'
    $refused=$false;try{Assert-DevMongoPolicyAgreement $inactive $inactive}catch{$refused=$_.Exception.Message -eq 'DEV_PERSISTENT_POLICY_NOT_ACTIVE'};Assert $refused 'Inactive policy accepted'
    $active=$inactive | ConvertTo-Json -Depth 8 | ConvertFrom-Json -AsHashtable; $active.status='ACTIVE'
    Assert-DevMongoPolicyAgreement $active $active
    foreach($change in @('status','sourceVersion','port','operation','extra')) {
        $peer=$active | ConvertTo-Json -Depth 8 | ConvertFrom-Json -AsHashtable
        switch($change){'status'{$peer.status='PROPOSED / NOT ACTIVE'} 'sourceVersion'{$peer.sourceVersion=2} 'port'{$peer.target.port=27018} 'operation'{$peer.operations+=@('InitializeReplica')} 'extra'{$peer['permit']=$true}}
        $refused=$false;try{Assert-DevMongoPolicyAgreement $active $peer}catch{$refused=$_.Exception.Message -eq 'DEV_MONGO_SOURCE_POLICY_MISMATCH'};Assert $refused "Policy mismatch accepted: $change"
    }
}
Check 'synthetic ACTIVE cannot authorize public setup calls or private primitives without a CLI context' {
    $active=Get-DevMongoSourcePolicy; $active.status='ACTIVE'
    function Get-DevMongoSourcePolicy {return $active}
    function Get-DevMongoPortRows {throw 'UNEXPECTED_HOST_IO'}
    function New-Service {throw 'UNEXPECTED_HOST_IO'}
    function Read-DevSecret {throw 'UNEXPECTED_HOST_IO'}
    foreach($operation in $active.operations) {
        $refused=$false;try{Invoke-DevMongoSetup $operation}catch{$refused=$_.Exception.Message -eq 'DEV_MONGO_EXECUTION_CONTEXT_REQUIRED'};Assert $refused "ACTIVE direct call reached $operation"
    }
    foreach($body in @({New-DevMongoPassword},{Protect-DevMongoValue 'synthetic-only'},{New-DevMongoDirectory (Get-DevMongoPlan).storage 'Modify'},{Write-DevMongoPrivateFile (Get-DevMongoPlan).configuration ([byte[]]::new(0)) 'Read'})) {
        $refused=$false;try{& $body}catch{$refused=$_.Exception.Message -eq 'DEV_MONGO_EXECUTION_CONTEXT_REQUIRED'};Assert $refused 'ACTIVE primitive bypassed private context'
    }
    $refused=$false;try{Assert-DevMongoExecutionPolicy @{alive=$true;action='PrepareStorage';policy='ACTIVE'}}catch{$refused=$_.Exception.Message -eq 'DEV_MONGO_EXECUTION_CONTEXT_REQUIRED'};Assert $refused 'Caller object forged a context'
}
Check 'pure invocation facts reject wrong owner, action, target and expired error lifetime' {
    $sid='S-1-5-21-11-22-33-1001'; $target=(Get-DevMongoSourcePolicy).target | ConvertTo-Json -Compress
    $facts=@{alive=$true;action='PrepareStorage';ownerSid=$sid;target=$target}
    Assert-DevMongoInvocation $facts @('PrepareStorage') $sid $target
    foreach($change in @('action','ownerSid','target','alive')) {
        $copy=$facts.Clone();switch($change){'action'{$copy.action='InstallService'} 'ownerSid'{$copy.ownerSid='S-1-5-21-11-22-33-1002'} 'target'{$copy.target='27017'} 'alive'{$copy.alive=$false}}
        $refused=$false;try{Assert-DevMongoInvocation $copy @('PrepareStorage') $sid $target}catch{$refused=$_.Exception.Message -match '^DEV_MONGO_(EXECUTION_CONTEXT_REQUIRED|ACTION_REJECTED|TARGET_REJECTED|OWNER_REJECTED)$'};Assert $refused "Invocation mismatch accepted: $change"
    }
    try {throw 'SYNTHETIC_CANCELLATION'}catch{}finally{$facts.alive=$false}
    $refused=$false;try{Assert-DevMongoInvocation $facts @('PrepareStorage') $sid $target}catch{$refused=$_.Exception.Message -eq 'DEV_MONGO_EXECUTION_CONTEXT_REQUIRED'};Assert $refused 'Expired context survived error'
}
Check 'private file authorization limits each action to its reviewed artifact paths' {
    $plan=Get-DevMongoPlan
    foreach($path in @($plan.keyFile,$plan.configuration,$plan.ca,$plan.caKey,$plan.clientCertificate,$plan.operatorSecret,$plan.applicationSecret,$plan.bootstrapManifest,$plan.receipt)) {
        Assert ((@(Get-DevMongoFileActions $plan $path) -join ',') -ceq 'PrepareStorage') 'Non-preparation action can write private material'
    }
    Assert ((@(Get-DevMongoFileActions $plan $plan.serviceReceipt) -join ',') -ceq 'InstallService') 'Registration receipt action broadened'
    foreach($path in @($plan.nextConfiguration,(Get-DevMongoStagePath $plan 'complete'),(Get-DevMongoStagePath $plan 'administrator-intent'))) {
        Assert ((@(Get-DevMongoFileActions $plan $path) -join ',') -ceq 'BootstrapFirstUser') 'Bootstrap transition writable during ordinary lifecycle'
    }
    Assert ((@(Get-DevMongoFileActions $plan $plan.operationLock) -join ',') -ceq 'InstallService,StartService,StopService,BootstrapFirstUser') 'Lifecycle lock scope changed'
    $refused=$false;try{Get-DevMongoFileActions $plan 'C:\foreign'}catch{$refused=$_.Exception.Message -eq 'DEV_MONGO_TARGET_REJECTED'};Assert $refused 'Unknown write path accepted'
}
Check 'MongoDB setup parses and defaults to a non-mutating exact plan' {
    $tokens=$null; $errors=$null
    [Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot '../Setup-DeepLearnerDev.ps1'),[ref]$tokens,[ref]$errors) | Out-Null
    Assert ($errors.Count -eq 0) 'Setup syntax invalid'
    $result=Invoke-DevMongoSetup
    Assert ($result.operation -eq 'PLAN_ONLY') 'Default would execute'
    Assert ($result.target.port -eq 27019 -and $result.target.member -eq 'localhost:27019') 'Wrong target/member'
    Assert ($result.target.policy -ceq (Get-DevMongoSourcePolicy).status) 'Plan/source policy mismatch'
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
        $refused=$false; try { Invoke-DevMongoSetup $operation } catch { $refused=$_.Exception.Message -match '^DEV_(PERSISTENT_POLICY_NOT_ACTIVE|MONGO_EXECUTION_CONTEXT_REQUIRED|MONGO_LEGACY_INITIALIZATION_DISABLED)$' }
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
        $refused=$false; try { & $body } catch { $refused=$_.Exception.Message -match '^DEV_(PERSISTENT_POLICY_NOT_ACTIVE|MONGO_EXECUTION_CONTEXT_REQUIRED)$' }; Assert $refused 'Primitive bypassed CLI context'
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
    Assert ($code -eq 1 -and ($message -join '') -match 'DEV_MONGO_LEGACY_INITIALIZATION_DISABLED') 'Legacy initialization became available'
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
    foreach($body in @({New-DevMongoPassword},{Protect-DevMongoValue 'synthetic-only'},{Initialize-DevMongoPrivateMaterial $plan},{Assert-DevMongoServiceCreationSecurity $plan},{Assert-DevMongoInstallAdministrator},{Write-DevMongoStage $plan 'complete' 'NORMAL_AUTHENTICATION_VERIFIED'},{Invoke-DevMongoNodeStep $plan 'administrator'},{Set-DevMongoNormalConfiguration $plan},{Assert-DevMongoAuthenticatedBootstrap})){
        $refused=$false;try{& $body | Out-Null}catch{$refused=$_.Exception.Message -match '^DEV_(PERSISTENT_POLICY_NOT_ACTIVE|MONGO_EXECUTION_CONTEXT_REQUIRED)$'};Assert $refused 'Bootstrap primitive bypassed CLI context'
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
Check 'private helper policy-check CLI reads no private input or database' {
    $tool=Join-Path $script:DevRepo 'apps/api/scripts/dev-mongo-bootstrap.ts'
    $message=@(& $node --import tsx $tool --check-policy);$code=$LASTEXITCODE
    Assert ($code -eq 0 -and (($message -join '') | ConvertFrom-Json).id -eq 'DEV-PERSISTENT-27019') 'Policy metadata check failed'
    $peer=($message -join '') | ConvertFrom-Json -AsHashtable
    Assert-DevMongoPolicyAgreement (Invoke-DevMongoSetup).policyDefinition $peer $false
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
Check 'documented Windows default service ACL conflicts with strict controls; approved creation descriptor is exact' {
    $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    $default=[Security.AccessControl.RawSecurityDescriptor]::new('O:BAG:BAD:(A;;GA;;;SY)(A;;GA;;;BA)(A;;0x2018D;;;AU)')
    $refused=$false;try{Assert-DevMongoServiceSecurity $default $sid}catch{$refused=$_.Exception.Message -eq 'DEV_MONGO_FOREIGN_SERVICE_CONTROL_REFUSED'}
    Assert $refused 'Documented default local-user 0x100 control right was accepted'
    $sddl=Get-DevMongoServiceSecurityDescriptor $sid
    $approved=[Security.AccessControl.RawSecurityDescriptor]::new(('O:'+$sid+$sddl))
    Assert-DevMongoApprovedServiceSecurity $approved $sid
    Assert (($approved.ControlFlags -band [Security.AccessControl.ControlFlags]::DiscretionaryAclProtected) -ne 0) 'Service DACL is not protected'
    Assert ($approved.DiscretionaryAcl.Count -eq 3) 'Unexpected service trustee'
    $masks=@{};foreach($ace in $approved.DiscretionaryAcl){$masks[$ace.SecurityIdentifier.Value]=$ace.AccessMask}
    Assert ($masks['S-1-5-18'] -eq 0xF01FF -and $masks['S-1-5-32-544'] -eq 0xF01FF -and $masks[$sid] -eq 0x1200B5) 'Service rights differ from approved descriptor'
    Assert (-not $masks.ContainsKey('S-1-5-11') -and -not $masks.ContainsKey('S-1-1-0')) 'Broad local-user service rights present'
    foreach($bad in @('not-a-sid','S-1-5-18','S-1-5-32-544')){
        $refused=$false;try{Get-DevMongoServiceSecurityDescriptor $bad}catch{$refused=$_.Exception.Message -eq 'DEV_MONGO_SERVICE_OWNER_REJECTED'};Assert $refused 'Invalid/overlapping owner SID accepted'
    }
}
Check 'creation readback requires exact effective ACE allowlist while tolerating canonical order' {
    $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    $reordered=[Security.AccessControl.RawSecurityDescriptor]::new("O:BAG:BAD:P(A;;0x1200B5;;;${sid})(A;;0xF01FF;;;BA)(A;;0xF01FF;;;SY)")
    Assert-DevMongoApprovedServiceSecurity $reordered $sid
    $base='O:'+$sid+(Get-DevMongoServiceSecurityDescriptor $sid)
    $invalid=@(
        $base.Replace("(A;;0x1200B5;;;${sid})",''),
        $base.Replace('D:P','D:'),
        $base.Replace('0x1200B5','0x1200B7'),
        ($base+'(A;;0x20005;;;AU)'),
        ($base+'(A;;0x100;;;AU)'),
        ($base+'(D;;0x10;;;WD)'),
        ($base+"(A;;0x1200B5;;;${sid})"),
        $base.Replace(('O:'+$sid),'O:WD')
    )
    foreach($sddl in $invalid){$refused=$false;try{Assert-DevMongoApprovedServiceSecurity ([Security.AccessControl.RawSecurityDescriptor]::new($sddl)) $sid}catch{$refused=$_.Exception.Message -match '^DEV_MONGO_(SERVICE_ACL_MISMATCH|SERVICE_PERMISSIONS_UNKNOWN|FOREIGN_SERVICE_CONTROL_REFUSED)$'};Assert $refused 'Unapproved readback accepted'}
    $refused=$false;try{Assert-DevMongoApprovedServiceSecurity $null $sid}catch{$refused=$_.Exception.Message -eq 'DEV_MONGO_SERVICE_PERMISSIONS_UNKNOWN'};Assert $refused 'Missing service-security readback accepted'
    $callback=[Security.AccessControl.RawSecurityDescriptor]::new($base)
    $callback.DiscretionaryAcl.RemoveAce(2)
    $callback.DiscretionaryAcl.InsertAce(2,[Security.AccessControl.CommonAce]::new([Security.AccessControl.AceFlags]::None,[Security.AccessControl.AceQualifier]::AccessAllowed,0x1200B5,[Security.Principal.SecurityIdentifier]::new($sid),$true,$null))
    $refused=$false;try{Assert-DevMongoApprovedServiceSecurity $callback $sid}catch{$refused=$_.Exception.Message -eq 'DEV_MONGO_SERVICE_ACL_MISMATCH'};Assert $refused 'Conditional/callback grant accepted'
}
Check 'installer supplies creation descriptor, validates readback and receipts only complete registrations with all host effects mocked' {
    # Test-only local overrides. There is no real New-Service, privilege elevation,
    # registry/native service call, private-file write, service start or ACL change.
    $plan=Get-DevMongoPlan;$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    $simulation=@{Mode='success';Created=$false;Receipted=$false;Disposed=$false;Descriptor=$null;Calls=[Collections.Generic.List[string]]::new()}
    function Assert-DevMongoExecutionPolicy {}
    function Assert-DevMongoPrepared {param($Plan) $simulation.Calls.Add('prepared')}
    function Assert-DevMongoPortFree {$simulation.Calls.Add('port')}
    function Assert-DevMongoInstallAdministrator {$simulation.Calls.Add('administrator')}
    $controller=[pscustomobject]@{Simulation=$simulation}
    $controller | Add-Member ScriptMethod Dispose {$this.Simulation.Disposed=$true;$this.Simulation.Calls.Add('dispose')}
    function Get-DevMongoService {param($Plan)
        $simulation.Calls.Add('existing-check')
        if($simulation.Mode -eq 'unknown'){throw 'DEV_MONGO_UNKNOWN_SERVICE'}
        if($simulation.Mode -eq 'existing'){return $controller}
        return $null
    }
    function New-Service {param($Name,$BinaryPathName,$StartupType,$Credential,$SecurityDescriptorSddl,$ErrorAction)
        $simulation.Calls.Add('create')
        Assert ($Name -eq 'DeepLearnerDevMongo27019' -and $Name -eq $plan.serviceName) 'Wrong service name'
        Assert ($BinaryPathName -ceq ('"'+$plan.executable+'" --config "'+$plan.configuration+'" --service')) 'Wrong service command'
        Assert ($StartupType -eq 'Manual' -and $Credential.UserName -eq $plan.serviceAccount -and $Credential.Password.Length -eq 0) 'Wrong service identity/startup'
        Assert ($ErrorAction -eq 'Stop') 'Creation/application failure could continue'
        Assert ($SecurityDescriptorSddl -ceq (Get-DevMongoServiceSecurityDescriptor $sid)) 'Approved descriptor not supplied at creation'
        $simulation.Created=$true
        $simulation.Descriptor=[Security.AccessControl.RawSecurityDescriptor]::new(('O:'+$sid+$SecurityDescriptorSddl))
        if($simulation.Mode -eq 'creation-interrupted'){throw 'SYNTHETIC_DESCRIPTOR_APPLICATION_INTERRUPTED'}
        return $controller
    }
    function Read-DevMongoServiceSecurity {param($Plan)
        $simulation.Calls.Add('readback')
        Assert $simulation.Created 'Readback happened before creation'
        switch($simulation.Mode){
            'missing'{return $null}
            'readback-interrupted'{throw 'SYNTHETIC_READBACK_INTERRUPTED'}
            'mismatch'{return [Security.AccessControl.RawSecurityDescriptor]::new(('O:'+$sid+(Get-DevMongoServiceSecurityDescriptor $sid).Replace('0x1200B5','0x1200B7')))}
            'unexpected'{return [Security.AccessControl.RawSecurityDescriptor]::new(('O:'+$sid+(Get-DevMongoServiceSecurityDescriptor $sid)+'(A;;0x100;;;AU)'))}
            default{return $simulation.Descriptor}
        }
    }
    function Write-DevMongoPrivateFile {param($Path,$Bytes,$Kind)
        $simulation.Calls.Add('receipt')
        Assert ($Path -ceq $plan.serviceReceipt -and $Kind -eq 'OwnerOnly') 'Wrong receipt path/ACL'
        Assert ($simulation.Calls.Contains('readback')) 'Receipt preceded validation'
        $record=([Text.Encoding]::UTF8.GetString($Bytes)) | ConvertFrom-Json -AsHashtable
        Assert ($record.ownerSid -ceq $sid -and $record.target -ceq ($plan | ConvertTo-Json -Compress -Depth 5) -and $record.revision -eq 2) 'Wrong registration receipt'
        if($simulation.Mode -eq 'receipt-interrupted'){throw 'SYNTHETIC_RECEIPT_INTERRUPTED'}
        $simulation.Receipted=$true
    }
    function Start-Service {throw 'UNEXPECTED_SERVICE_START'}
    function Stop-Service {throw 'UNEXPECTED_SERVICE_STOP'}
    function Set-Service {throw 'UNEXPECTED_SERVICE_CHANGE'}
    function Remove-Service {throw 'UNEXPECTED_SERVICE_DELETE'}
    Invoke-DevMongoInstall $plan
    Assert ($simulation.Created -and $simulation.Receipted -and $simulation.Disposed) 'Valid registration did not complete'
    Assert (($simulation.Calls -join ',') -ceq 'prepared,port,existing-check,administrator,create,readback,receipt,dispose') 'Creation/readback/receipt order changed'
    foreach($mode in @('creation-interrupted','missing','readback-interrupted','mismatch','unexpected','receipt-interrupted','unknown','existing')){
        $simulation.Mode=$mode;$simulation.Created=$false;$simulation.Receipted=$false;$simulation.Disposed=$false;$simulation.Calls.Clear()
        $refused=$false;try{Invoke-DevMongoInstall $plan}catch{$refused=$true}
        Assert ($refused -and -not $simulation.Receipted) 'Failed/unknown registration received a receipt'
        if($mode -in @('unknown','existing')){Assert (-not $simulation.Created -and -not $simulation.Calls.Contains('create')) 'Existing service was modified/adopted'}
        elseif($mode -ne 'creation-interrupted'){Assert $simulation.Disposed 'Returned controller not disposed after failure'}
        if($mode -ne 'receipt-interrupted'){Assert (-not $simulation.Calls.Contains('receipt')) 'Validation failure reached receipt creation'}
    }
    foreach($change in @(@('port',27017),@('port',27018),@('serviceName','MongoDB'),@('storage','C:\Program Files\MongoDB\Server\8.2\data'),@('storage','C:\Users\Shreeji\AppData\Local\DeepLearner\local-dev\mongodb'))){
        $copy=Get-DevMongoPlan;$copy[$change[0]]=$change[1];$simulation.Calls.Clear()
        $refused=$false;try{Invoke-DevMongoInstall $copy}catch{$refused=$_.Exception.Message -eq 'DEV_MONGO_TARGET_REJECTED'}
        Assert ($refused -and $simulation.Calls.Count -eq 0) 'Protected target reached installation'
    }
}
Check 'service creation and installer guards remain inactive after local test mocks leave scope' {
    $plan=Get-DevMongoPlan
    foreach($body in @({Invoke-DevMongoInstall $plan},{Assert-DevMongoServiceCreationSecurity $plan},{Assert-DevMongoInstallAdministrator})){
        $refused=$false;try{& $body}catch{$refused=$_.Exception.Message -match '^DEV_(PERSISTENT_POLICY_NOT_ACTIVE|MONGO_EXECUTION_CONTEXT_REQUIRED)$'};Assert $refused 'Real CLI-context guard was replaced or bypassed'
    }
}
Check 'manual source is separate and inactive facts never authorize effects' {
    $policy=Get-DevManualMongoPolicy;$policy.status='INACTIVE'
    $refused=$false;try{Assert-DevManualPolicyAgreement $policy $policy}catch{$refused=$_.Exception.Message -eq 'DEV_MANUAL_POLICY_INACTIVE'};Assert $refused 'Inactive accepted'
    Assert-DevManualPolicyAgreement $policy $policy $false
    $active=$policy.Clone();$active.status='ACTIVE';Assert-DevManualPolicyAgreement $active $active
    foreach($other in @((Get-DevMongoSourcePolicy),$policy)){$refused=$false;try{Assert-DevManualPolicyAgreement $active $other}catch{$refused=$true};Assert $refused 'Service/mixed policy accepted'}
    function Get-DevManualMongoPolicy {return $active}
    function Get-DevMongoPlan {throw 'UNEXPECTED_HOST_IO'}
    foreach($action in $active.operations){$refused=$false;try{Invoke-DevManualMongo $action}catch{$refused=$_.Exception.Message -eq 'DEV_MONGO_EXECUTION_CONTEXT_REQUIRED'};Assert $refused 'Synthetic ACTIVE issued context'}
}
Check 'manual primitives remain context-free after mocks and never create or migrate private state' {
    $plan=Get-DevMongoPlan
    foreach($body in @({New-DevManualOwner},{Start-DevManualOwned $plan},{Write-DevManualPrivate $plan 'manual-runtime.json' ([byte[]]::new(0))},{Set-DevManualNormalConfiguration $plan},{Invoke-DevManualBootstrap $plan})){
        $refused=$false;try{& $body}catch{$refused=$_.Exception.Message -match '^DEV_(MANUAL_POLICY_INACTIVE|MONGO_EXECUTION_CONTEXT_REQUIRED)$'};Assert $refused 'Imported manual actuator bypassed lease'
    }
    $source=[IO.File]::ReadAllText((Join-Path $PSScriptRoot '../Setup-DeepLearnerDev.ps1'))
    $cli=$source.IndexOf("if (`$MyInvocation.InvocationName -ne '.')")
    Assert ($source.IndexOf('Set-Item Function:Assert-DevManualExecutionPolicy') -gt $cli) 'Manual lease issuer outside CLI'
    Assert ($source.Substring($cli).Contains('Set-Item Function:Assert-DevManualExecutionPolicy -Value $closedManualGuard')) 'Manual guard not restored'
}
Check 'manual process facts reject different image, PID, creation, job and liveness; plan rejects different storage' {
    $plan=Get-DevMongoPlan
    $facts=@{Pid=100;IndependentPid=100;Filetime=123;IndependentFiletime=123;Executable=$plan.executable;RetainedJob=$true;IndependentJob=$true;Live=$true}
    Assert-DevManualProcessFacts $facts $plan 100
    foreach($key in @('Pid','IndependentPid','Filetime','Executable','RetainedJob','IndependentJob','Live')){
        $bad=$facts.Clone();$bad[$key]=switch($key){'Executable'{'C:\foreign.exe'} 'Pid'{200} 'IndependentPid'{200} 'Filetime'{456} default{$false}}
        $refused=$false;try{Assert-DevManualProcessFacts $bad $plan 100}catch{$refused=$true};Assert $refused ('Foreign facts accepted: '+$key)
    }
    $badPlan=Get-DevMongoPlan;$badPlan.storage='C:\foreign';$refused=$false;try{Assert-DevManualProcessFacts $facts $badPlan 100}catch{$refused=$true};Assert $refused 'Foreign storage accepted'
}
Check 'manual retained-child startup uses exact config and rejects a foreign listener using local host mocks' {
    $plan=Get-DevMongoPlan;$calls=[Collections.Generic.List[string]]::new();$simulation=@{Foreign=$false}
    function Assert-DevManualExecutionPolicy {}
    function Assert-DevManualPrepared {param($Plan) Assert-DevMongoPlan $Plan}
    function Assert-DevMongoPortFree {$calls.Add('free')}
    $child=[pscustomobject]@{Id=100}
    $fake=[pscustomobject]@{Calls=$calls;Child=$child;Plan=$plan;Disposed=$false}
    $fake | Add-Member ScriptMethod Start {param($Label,$Executable,$Arguments,$Directory,$Environment,$Output,$ErrorOutput) Assert ($Executable -ceq $this.Plan.executable -and ($Arguments -join '|') -ceq ('--config|'+$this.Plan.configuration)) 'Changed image/config';$this.Calls.Add('start');return $this.Child}
    $fake | Add-Member ScriptMethod Observe {param($Child) Assert ([object]::ReferenceEquals($Child,$this.Child)) 'Adopted unrelated child';return @{Pid=100;IndependentPid=100;Filetime=123;IndependentFiletime=123;Executable=$this.Plan.executable;RetainedJob=$true;IndependentJob=$true;Live=$true}}
    $fake | Add-Member ScriptMethod Dispose {$this.Disposed=$true}
    function New-DevManualOwner {return $fake}
    function Get-DevMongoPortRows {return @([pscustomobject]@{local='127.0.0.1:27019';state='LISTENING';processId=$(if($simulation.Foreign){101}else{100})})}
    $runtime=Start-DevManualOwned $plan;Assert ([object]::ReferenceEquals($runtime.child,$child)) 'Lost retained child'
    Assert (($calls -join ',') -ceq 'free,start') 'Unsafe start order'
    $simulation.Foreign=$true;$refused=$false;try{Start-DevManualOwned $plan}catch{$refused=$true};Assert ($refused -and $fake.Disposed) 'Foreign listener adopted or owned container leaked'
}
Check 'manual stop requires request plus actual retained zero-exit, empty Job and released port' {
    $plan=Get-DevMongoPlan;$simulation=@{Exited=$true;Code=0;Empty=$true;Disposed=$false;Released=$false}
    $child=[pscustomobject]@{State=$simulation;ExitCode=0};$child | Add-Member ScriptMethod Wait {param($Timeout)return $this.State.Exited}
    $owner=[pscustomobject]@{State=$simulation};$owner | Add-Member ScriptMethod WaitEmpty {param($Timeout)return $this.State.Empty};$owner | Add-Member ScriptMethod Dispose {$this.State.Disposed=$true}
    function Invoke-DevManualNode {param($Runtime,$Plan,$Step) Assert ($Step -ceq 'shutdown-normal') 'Wrong transport';return 'SHUTDOWN_REQUESTED'}
    function Assert-DevMongoPortFree {$simulation.Released=$true}
    Stop-DevManualOwned @{child=$child;owner=$owner} $plan 'Normal';Assert ($simulation.Disposed -and $simulation.Released) 'Missing exit/port cleanup'
    $simulation.Disposed=$false;$simulation.Exited=$false;$refused=$false;try{Stop-DevManualOwned @{child=$child;owner=$owner} $plan 'Normal'}catch{$refused=$true};Assert ($refused -and -not $simulation.Disposed) 'Request mistaken for graceful exit'
}
Check 'manual ambiguous replica or contradictory receipts refuse before any process launch' {
    $plan=Get-DevMongoPlan;$stages=@{};$simulation=@{Phase='Bootstrap';Starts=0}
    function Assert-DevManualExecutionPolicy {}
    function Assert-DevManualPrepared {}
    function Get-DevMongoConfigurationPhase {return $simulation.Phase}
    function Test-Path {param($LiteralPath)return $LiteralPath.EndsWith('manual-initialize-reconciliation-v1.json')}
    function Read-DevManualBootstrapReconciliation {return @{}}
    function Write-DevManualPrivate {throw 'UNEXPECTED_PRIVATE_WRITE'}
    function Assert-DevManualKnownMetadata {}
    function Get-DevManualStage {param($Plan,$Name)return $stages.ContainsKey($Name)}
    function Start-DevManualOwned {$simulation.Starts++;throw 'UNEXPECTED_PROCESS_START'}
    foreach($case in @(@('initialize-intent'),@('replica'),@('complete'),@('administrator-intent'))){
        $stages.Clear();foreach($name in $case){$stages[$name]=$true};$refused=$false;try{Invoke-DevManualBootstrap $plan}catch{$refused=$_.Exception.Message -match '^DEV_MANUAL_(INITIALIZATION_UNKNOWN_RECONCILE|STAGE_REJECTED|BOOTSTRAP_RECONCILIATION_REJECTED)$'};Assert ($refused -and $simulation.Starts -eq 0) 'Uncertain state launched process'
    }
}
Check 'manual interrupted normal transition reconciles with inspection and never repeats credential writes' {
    $plan=Get-DevMongoPlan;$stages=@{};$calls=[Collections.Generic.List[string]]::new()
    foreach($name in @('initialize-intent','replica','administrator-intent','administrator','shutdown-role-intent','shutdown-role','shutdown-grant-intent','shutdown-grant','application-role-intent','application-role','application-user-intent','application')){$stages[$name]=$true}
    function Assert-DevManualExecutionPolicy {}
    function Assert-DevManualPrepared {}
    function Get-DevMongoConfigurationPhase {return 'Normal'}
    function Test-Path {param($LiteralPath)return $LiteralPath.EndsWith('manual-initialize-reconciliation-v1.json')}
    function Read-DevManualBootstrapReconciliation {return @{}}
    function Write-DevManualPrivate {throw 'UNEXPECTED_PRIVATE_WRITE'}
    function Assert-DevManualKnownMetadata {}
    function Get-DevManualStage {param($Plan,$Name)return $stages.ContainsKey($Name)}
    function Write-DevManualStage {param($Plan,$Name)$calls.Add('stage:'+$Name);$stages[$Name]=$true}
    function Start-DevManualOwned {$calls.Add('start');return @{owner=[IO.MemoryStream]::new()}}
    function Stop-DevManualOwned {$calls.Add('stop')}
    function Invoke-DevManualNode {param($Runtime,$Plan,$Step)$calls.Add($Step);Assert ($Step -ceq 'verify-normal') 'Replayed bootstrap write';return 'NORMAL_AUTHENTICATION_VERIFIED'}
    $result=Invoke-DevManualBootstrap $plan;Assert ($result.status -eq 'MANUAL_BOOTSTRAP_RESTART_VERIFIED') 'No restart verification'
    Assert (($calls -join ',') -ceq 'start,verify-normal,stop,start,verify-normal,stop,stage:complete') 'Recovery replayed writes or lost verification'
    Assert ((Get-DevManualRecoveryStep 'administrator' 'inspect-administrator' $false $true) -ceq 'inspect-administrator') 'Unknown first-user would replay'
    Assert ((Get-DevManualRecoveryStep 'shutdown-grant' 'inspect-shutdown-grant' $true $true) -ceq 'inspect-shutdown-grant') 'Completed grant would replay'
}
Check 'manual default Plan and Node metadata issue no runtime lease or private migration' {
    $plan=Invoke-DevManualMongo
    Assert ($plan.operation -ceq 'PLAN_ONLY' -and $plan.sourcePinMigration -ceq 'SEPARATE_REVIEW_REQUIRED') 'Default is effectful'
    $message=@(& $node --import tsx (Join-Path $script:DevRepo 'apps/api/scripts/dev-mongo-bootstrap.ts') --check-manual-policy)
    Assert ($LASTEXITCODE -eq 0) 'Manual metadata failed'
    Assert-DevManualPolicyAgreement (Get-DevManualMongoPolicy) (($message -join '') | ConvertFrom-Json -AsHashtable) $false
}
Check 'recovery inspector never invokes initialization or user writes and labels retained containment' {
    $plan=Get-DevMongoPlan;$simulation=@{Forced=$false;Disposed=$false;Writes=0;State='REPLICA_NOT_INITIALIZED'}
    function Assert-DevManualExecutionPolicy {}
    function Assert-DevManualRecoveryV2State {}
    $records=@{}
    function Read-DevManualRecoveryV2Record {param($Plan,$Name)return $records[$Name]}
    function Get-DevMongoConfigurationPhase {return 'Bootstrap'}
    function Get-DevManualStage {param($Plan,$Name)return $Name -ceq 'initialize-intent'}
    function Get-DevManualInspection {return $false}
    function Get-FileHash {param($LiteralPath)return @{Hash=('A'*64)}}
    function Get-DevMongoPortRows {return @()}
    $child=[pscustomobject]@{};$child | Add-Member ScriptMethod Wait {param($Timeout)return $true}
    $owner=[pscustomobject]@{State=$simulation};$owner | Add-Member ScriptMethod ForceStop {$this.State.Forced=$true};$owner | Add-Member ScriptMethod WaitEmpty {param($Timeout)return $true};$owner | Add-Member ScriptMethod Dispose {$this.State.Disposed=$true}
    function Start-DevManualOwned {param($Plan,[switch]$RecoveryV2)Assert ($RecoveryV2 -and $records.ContainsKey('manual-replica-inspection-v2-intent.json')) 'Started before attempt was consumed';return @{owner=$owner;child=$child}}
    function Invoke-DevManualNode {param($Runtime,$Plan,$Step)Assert ($Step -ceq 'inspect-replica') 'Recovery issued a mutating helper action';return $simulation.State}
    function Write-DevManualPrivate {param($Plan,$Name,$Bytes)Assert ($Name -cin @('manual-replica-inspection-v2-intent.json','manual-replica-inspection-v2.json') -and -not $records.ContainsKey($Name)) 'Overwrote old record';$simulation.Writes++;$record=([Text.Encoding]::UTF8.GetString($Bytes)) | ConvertFrom-Json -AsHashtable;$records[$Name]=$record;if($Name -ceq 'manual-replica-inspection-v2.json'){Assert ($record.cleanup -ceq 'FORCED_OWNED_JOB') 'Claimed graceful shutdown'}}
    foreach($state in @('REPLICA_NOT_INITIALIZED','REPLICA_INITIALIZED_PRIMARY')){$records.Clear();$simulation.State=$state;$result=Invoke-DevManualInspection $plan;Assert ($result.status -ceq $state -and $result.bootstrap -ceq 'NOT_REPLAYED' -and $result.persistence -ceq 'NOT_VERIFIED') 'Inspection upgraded evidence'}
    Assert ($simulation.Forced -and $simulation.Disposed -and $simulation.Writes -eq 4) 'Lost consumed attempt or inspection receipt'
}
Check 'bootstrap reconciliation consumes once before start and uncertain initialization cannot restart using only mocks' {
    $plan=Get-DevMongoPlan;$stages=@{'initialize-intent'=$true};$calls=[Collections.Generic.List[string]]::new();$simulation=@{Phase='Bootstrap';Consumed=$false;Fail=$true}
    function Assert-DevManualExecutionPolicy {}
    function Assert-DevManualPrepared {}
    function Get-DevMongoConfigurationPhase {return $simulation.Phase}
    function Test-Path {param($LiteralPath)return $simulation.Consumed -and $LiteralPath.EndsWith('manual-initialize-reconciliation-v1.json')}
    function Assert-DevManualKnownMetadata {}
    function Get-DevManualStage {param($Plan,$Name)return $stages.ContainsKey($Name)}
    function Read-DevManualBootstrapReconciliation {Assert $simulation.Consumed 'Missing consumed receipt';return @{}}
    function Get-DevManualBootstrapReconciliation {return @{synthetic='only'}}
    function Assert-DevMongoPortFree {}
    function Start-DevManualOwned {param($Plan,[switch]$BootstrapReconciliation,$LifecycleLock)Assert ($simulation.Consumed -and $BootstrapReconciliation) 'Start before consumption or with wrong authority';$calls.Add('start');return @{owner=[IO.MemoryStream]::new()}}
    function Stop-DevManualOwned {$calls.Add('stop')}
    function Set-DevManualNormalConfiguration {$simulation.Phase='Normal'}
    function Write-DevManualStage {param($Plan,$Name)$stages[$Name]=$true;$calls.Add('stage:'+$Name)}
    function Write-DevManualPrivate {param($Plan,$Name,$Bytes)Assert ($Name -ceq 'manual-initialize-reconciliation-v1.json' -and -not $simulation.Consumed) 'Overwrote preserved or consumed intent';$simulation.Consumed=$true;$calls.Add('reconciliation')}
    function Invoke-DevManualNode {param($Runtime,$Plan,$Step)
        $calls.Add($Step)
        switch($Step){'inspect-replica'{throw 'INSPECTION_REPLAY'} 'initialize'{if($simulation.Fail){throw 'DEV_MONGO_OUTCOME_UNKNOWN_RECONCILE'};return 'REPLICA_INITIALIZED'} 'administrator'{'ADMINISTRATOR_VERIFIED'} 'shutdown-role'{'SHUTDOWN_ROLE_VERIFIED'} 'shutdown-grant'{'SHUTDOWN_GRANT_VERIFIED'} 'application-role'{'APPLICATION_ROLE_VERIFIED'} 'application-user'{'APPLICATION_VERIFIED'} 'verify-normal'{'NORMAL_AUTHENTICATION_VERIFIED'} default{throw 'UNEXPECTED_STEP'}}
    }
    $refused=$false;try{Invoke-DevManualBootstrap $plan}catch{$refused=$_.Exception.Message -ceq 'DEV_MONGO_OUTCOME_UNKNOWN_RECONCILE'}
    Assert ($refused -and ($calls -join ',') -ceq 'reconciliation,start,initialize' -and -not $stages.ContainsKey('replica')) 'Unknown initialization was hidden or performed out of order'
    $calls.Clear();$refused=$false;try{Invoke-DevManualBootstrap $plan}catch{$refused=$_.Exception.Message -ceq 'DEV_MANUAL_INITIALIZATION_UNKNOWN_RECONCILE'};Assert ($refused -and $calls.Count -eq 0) 'Consumed initialization restarted or retried'
    # A separate synthetic fixture demonstrates successful progression, never host state reset.
    $simulation.Consumed=$false;$simulation.Fail=$false
    Invoke-DevManualBootstrap $plan | Out-Null
    Assert (@($calls|Where-Object {$_ -ceq 'initialize'}).Count -eq 1 -and $calls.IndexOf('reconciliation') -lt $calls.IndexOf('start') -and $stages.ContainsKey('complete')) 'Single successful initialization/restart flow changed'
}
Check 'a second uncertain reconciled initialization attempt refuses before startup' {
    $plan=Get-DevMongoPlan;$starts=0
    function Get-DevMongoConfigurationPhase {return 'Bootstrap'}
    function Get-DevManualStage {param($Plan,$Name)return $Name -ceq 'initialize-intent'}
    function Get-DevManualInspection {return @{state='REPLICA_NOT_INITIALIZED'}}
    function Read-DevManualBootstrapReconciliation {return @{}}
    function Test-Path {param($LiteralPath)return $LiteralPath.EndsWith('manual-initialize-reconciliation-v1.json')}
    function Assert-DevManualKnownMetadata {}
    $refused=$false;try{Assert-DevManualBootstrapState $plan}catch{$refused=$_.Exception.Message -ceq 'DEV_MANUAL_INITIALIZATION_UNKNOWN_RECONCILE'};Assert $refused 'Repeated uncertain new attempt allowed'
}
Check 'recovery actions and writers have no accepted imported context after mocks' {
    $plan=Get-DevMongoPlan
    foreach($body in @({Invoke-DevManualMongo 'BindRecoverySources'},{Invoke-DevManualMongo 'InspectOwnedMongo'},{Invoke-DevManualInspection $plan},{Write-DevManualPrivate $plan 'manual-recovery-v1.json' ([byte[]]::new(0))})){
        $refused=$false;try{& $body}catch{$refused=$_.Exception.Message -match '^DEV_(MANUAL_POLICY_INACTIVE|MONGO_EXECUTION_CONTEXT_REQUIRED)$'};Assert $refused 'Recovery bypassed CLI lease'
    }
}
Check 'strict recovery preflight rejects all later, legacy, unknown and transition markers' {
    $plan=Get-DevMongoPlan;$simulation=@{File='';Legacy=$false;Next=$false}
    function Assert-DevManualRecoveryMaterial {}
    function Get-DevMongoConfigurationPhase {return 'Bootstrap'}
    function Get-DevManualStage {param($Plan,$Name)return $Name -ceq 'initialize-intent'}
    function Test-Path {param($LiteralPath) return ($simulation.Next -and $LiteralPath -ceq $plan.nextConfiguration) -or ($simulation.Legacy -and $LiteralPath.EndsWith('administrator.json'))}
    function Get-ChildItem {param($LiteralPath,$Filter,[switch]$File) if($simulation.File){return @([pscustomobject]@{Name=$simulation.File})};return @([pscustomobject]@{Name='manual-runtime.json'},[pscustomobject]@{Name='manual-initialize-intent.json'})}
    Assert-DevManualRecoveryState $plan
    foreach($name in @('manual-administrator.json','manual-application-user-intent.json','manual-complete.json','manual-unknown.json','manual-initialize-reconciliation-v1.json')){$simulation.File=$name;$refused=$false;try{Assert-DevManualRecoveryState $plan}catch{$refused=$true};Assert $refused 'Unexpected manual stage accepted'}
    $simulation.File='';$simulation.Legacy=$true;$refused=$false;try{Assert-DevManualRecoveryState $plan}catch{$refused=$true};Assert $refused 'Legacy first-user result accepted'
    $simulation.Legacy=$false;$simulation.Next=$true;$refused=$false;try{Assert-DevManualRecoveryState $plan}catch{$refused=$true};Assert $refused 'Pending transition accepted'
}
Check 'recovery fingerprint can hash an owned exclusive lock through its retained stream' {
    $path=Join-Path $fixture 'exclusive-recovery.lock';[IO.File]::WriteAllBytes($path,[byte[]]::new(0))
    $before=(Get-FileHash -LiteralPath $path).Hash
    $stream=[IO.File]::Open($path,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
    try {
        $refused=$false;try{Get-FileHash -LiteralPath $path -ErrorAction Stop | Out-Null}catch{$refused=$true};Assert $refused 'Path hash unexpectedly ignored exclusive share'
        Assert ((Get-FileHash -InputStream $stream).Hash -ceq $before) 'Retained stream changed hash'
        Assert ((Get-Item -LiteralPath $path).Length -eq 0 -and $null -ne (Get-Acl -LiteralPath $path)) 'Metadata unavailable under retained lock'
    }finally{$stream.Dispose()}
}
Check 'manual diagnostics preserve nonzero exit, structured phase and connection evidence without verifying replica state' {
    $frame=@{status='HELPER_FAILED';phase='PROTOCOL_READ';gate='DEV_MONGO_OUTCOME_UNKNOWN_RECONCILE';code='MONGO_13';connectionAttempted=$true}|ConvertTo-Json -Compress
    $r=Get-DevManualResponseDiagnostic $frame ([uint32]3221225477)
    Assert ($r.exitCode -eq 3221225477 -and $r.classification -ceq 'HELPER_REPORTED_FAILURE' -and $r.helperPhase -ceq 'PROTOCOL_READ' -and $r.gate -ceq 'DEV_MONGO_OUTCOME_UNKNOWN_RECONCILE' -and $r.code -ceq 'MONGO_13') 'Lost structured error or uint32 exit'
    Assert ($r.connectionAttempted -ceq 'YES' -and $r.inspectedState -ceq 'UNKNOWN' -and $r.cleanupCompleted -ceq 'UNKNOWN') 'Invented state or cleanup proof'
    $r=Get-DevManualResponseDiagnostic ($frame.Replace('true','false')) 1;Assert ($r.connectionAttempted -ceq 'NO') 'Lost explicit no-connection evidence'
    $legacy=@{status='HELPER_FAILED';phase='CONNECT';gate='DEV_MANUAL_HELPER_REJECTED';code='NONE'}|ConvertTo-Json -Compress
    Assert ((Get-DevManualResponseDiagnostic $legacy 1).connectionAttempted -ceq 'UNKNOWN') 'Legacy frame guessed connection evidence'
}
Check 'manual diagnostics distinguish missing malformed unexpected and conflicting responses and preserve successes' {
    foreach($case in @(@($null,'MISSING_RESPONSE'),@('','MISSING_RESPONSE'),@('{','MALFORMED_RESPONSE'),@('[]','UNEXPECTED_RESPONSE'),@('{"status":"private"}','UNEXPECTED_RESPONSE'),@(('x'*8193),'MALFORMED_RESPONSE'))){$r=Get-DevManualResponseDiagnostic $case[0] 7;Assert ($r.classification -ceq $case[1] -and $r.exitCode -eq 7 -and $r.inspectedState -ceq 'UNKNOWN') 'Failure misclassified'}
    foreach($status in @('REPLICA_NOT_INITIALIZED','REPLICA_INITIALIZED_PRIMARY','NORMAL_AUTHENTICATION_VERIFIED','SHUTDOWN_REQUESTED')){$frame=@{status=$status}|ConvertTo-Json -Compress;Assert ((Get-DevManualResponseDiagnostic $frame 0).classification -ceq $status) 'Success classification lost';Assert ((Get-DevManualResponseDiagnostic $frame 1).classification -ceq 'EXIT_RESPONSE_CONFLICT') 'Nonzero verified as success'}
    Assert ($null -eq (Get-DevManualResponseDiagnostic $null -1).exitCode) 'Invalid exit accepted'
}
Check 'manual diagnostic redaction drops raw secrets paths extra keys and disguised public codes' {
    $secret='synthetic-secret-only';$frame=@{status='HELPER_FAILED';phase='CONNECT';gate='DEV_PRIVATE_PASSWORD';code='ERR_PRIVATE_TOKEN';connectionAttempted=$false}|ConvertTo-Json -Compress
    $r=Get-DevManualResponseDiagnostic $frame 1;$text=$r|ConvertTo-Json -Compress
    Assert ($r.gate -ceq 'DEV_MANUAL_HELPER_REJECTED' -and $r.code -ceq 'NONE') 'Disguised secret escaped'
    foreach($raw in @("mongodb://user:${secret}@private.invalid/",'C:\private\synthetic-secret-only.pem',('{"status":"HELPER_FAILED","password":"'+$secret+'"}'))){$text=Get-DevManualResponseDiagnostic $raw 2|ConvertTo-Json -Compress;Assert (-not $text.Contains($secret) -and -not $text.Contains('private.invalid') -and -not $text.Contains('.pem')) 'Raw private frame leaked'}
}
Check 'manual request failure reports once using synthetic child and never retries or invokes a runtime' {
    $simulation=@{Reads=0;Writes=0;Waits=0;Closes=0}
    $child=[pscustomobject]@{ExitCode=[uint32]17}
    $child|Add-Member ScriptMethod ReadFrameAsync {$simulation.Reads++;return [Threading.Tasks.Task]::FromResult('{"status":"HELPER_FAILED","phase":"CONNECT","gate":"DEV_MONGO_OUTCOME_UNKNOWN_RECONCILE","code":"ECONNREFUSED","connectionAttempted":true}')}
    $child|Add-Member ScriptMethod SendFrameAsync {param($Request)$simulation.Writes++;return [Threading.Tasks.Task]::FromResult($true)}
    $child|Add-Member ScriptMethod Wait {param($Timeout)$simulation.Waits++;return $true}
    $child|Add-Member ScriptMethod CloseInput {$simulation.Closes++}
    function Start-DevManualOwned {throw 'Unexpected runtime call'}
    function Invoke-DevManualMongo {throw 'Unexpected runtime call'}
    function Write-DevManualPrivate {throw 'Unexpected private write'}
    $refused=$false
    try{Send-DevManualRequest $child '{}' -Action 'inspect-replica'}catch{$refused=$_.Exception.Message -ceq 'DEV_MANUAL_HELPER_FAILED';Assert ($_.Exception.Data['DevManualDiagnostic'].exitCode -eq 17 -and $_.Exception.Data['DevManualDiagnostic'].helperAction -ceq 'inspect-replica') 'Exception lost sanitized diagnostic'}
    Assert ($refused -and $simulation.Reads -eq 1 -and $simulation.Writes -eq 1 -and $simulation.Waits -eq 1 -and $simulation.Closes -eq 1) 'Failure retried or changed request behavior'
}
Check 'manual transport failure preserves observable exit and never retries a faulted frame' {
    $simulation=@{Reads=0;Writes=0;Reports=@()}
    $child=[pscustomobject]@{ExitCode=[uint32]29;HasExited=$true}
    $child|Add-Member ScriptMethod ReadFrameAsync {$simulation.Reads++;return [Threading.Tasks.Task]::FromException[string]([IO.IOException]::new('synthetic-private-transport-secret'))}
    $child|Add-Member ScriptMethod SendFrameAsync {param($Request)$simulation.Writes++;return [Threading.Tasks.Task]::FromResult($true)}
    $child|Add-Member ScriptMethod CloseInput {}
    function Write-Host {param($Object)$simulation.Reports+=@([string]$Object)}
    $refused=$false;try{Send-DevManualRequest $child '{}' -Action 'inspect-replica'}catch{$refused=$true}
    $text=$simulation.Reports -join ''
    Assert ($refused -and $simulation.Reads -eq 1 -and $simulation.Writes -eq 1 -and $simulation.Reports.Count -eq 1) 'Transport fault retried'
    Assert ($text.Contains('"exitCode":29') -and $text.Contains('HELPER_TRANSPORT_FAILURE') -and $text.Contains('"invocationStage":"RESPONSE_WAIT"') -and -not $text.Contains('private-transport-secret')) 'Transport metadata missing or private exception leaked'
}
Check 'manual invocation rejects missing malformed and conflicting frames without retries or replay using only mocks' {
    $plan=Get-DevMongoPlan;$simulation=@{Frame='';Exit=[uint32]0;Starts=0;Disposed=0;Assertions=0}
    $child=[pscustomobject]@{}
    $child|Add-Member ScriptProperty ExitCode {return $simulation.Exit}
    $child|Add-Member ScriptMethod ReadFrameAsync {return [Threading.Tasks.Task]::FromResult([string]$simulation.Frame)}
    $child|Add-Member ScriptMethod SendFrameAsync {param($Request)return [Threading.Tasks.Task]::FromResult($true)}
    $child|Add-Member ScriptMethod CloseInput {}
    $child|Add-Member ScriptMethod Wait {param($Timeout)return $true}
    $owner=[pscustomobject]@{}
    $owner|Add-Member ScriptMethod StartControlled {param($Label,$Executable,$Arguments,$Directory,$Environment,$ErrorPath)$simulation.Starts++;Assert ($Arguments[-1] -ceq 'inspect-replica') 'Inspection action changed';return $child}
    $owner|Add-Member ScriptMethod WaitEmpty {param($Timeout)return $true}
    $owner|Add-Member ScriptMethod Dispose {$simulation.Disposed++}
    function New-DevManualOwner {return $owner}
    function Assert-DevManualOwned {param($Runtime,$Plan)$simulation.Assertions++}
    function Read-DevSecret {param($Path)if($Path -ceq $plan.operatorSecret){return ('A'*43)};return ('mongodb://deeplearner-local-app:'+('B'*43)+'@127.0.0.1:27019/deeplearner-dev?replicaSet=deeplearner-dev-rs&directConnection=true&authSource=deeplearner-dev')}
    function Read-DevJson {param($Path)return @{certificates=@{}}}
    function Get-DevMongoConfigurationPhase {param($Plan)return 'Bootstrap'}
    function New-DevEnvironment {param($Repo,$Node,$Directory)return @{}}
    function Write-DevManualPrivate {throw 'Unexpected binding write'}
    foreach($frame in @('', '{', '{}', '{"status":"REPLICA_INITIALIZED_PRIMARY","password":"synthetic-private"}')){
        $simulation.Frame=$frame;$before=$simulation.Starts;$refused=$false
        try{Invoke-DevManualNode @{} $plan 'inspect-replica'}catch{$refused=$true}
        Assert ($refused -and $simulation.Starts -eq $before+1 -and $simulation.Disposed -eq $simulation.Starts) 'Bad response accepted, retried or helper not disposed'
    }
    $simulation.Frame='{"status":"REPLICA_NOT_INITIALIZED"}';Assert ((Invoke-DevManualNode @{} $plan 'inspect-replica') -ceq 'REPLICA_NOT_INITIALIZED') 'Accepted classification changed'
    $simulation.Exit=3;$refused=$false;try{Invoke-DevManualNode @{} $plan 'inspect-replica'}catch{$refused=$true};Assert $refused 'Nonzero response accepted as verified'
}
Check 'reporting-only diagnostics have no effectful statements or private binding writes' {
    $tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot '../Setup-DeepLearnerDev.ps1'),[ref]$tokens,[ref]$errors)
    $f=$ast.Find({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -ceq 'Get-DevManualResponseDiagnostic'},$true)
    Assert ($null -ne $f -and $errors.Count -eq 0) 'Missing pure classifier or parse failure'
    Assert (-not ($f.Extent.Text -match 'Start-Dev|Invoke-Dev|Write-Dev|Set-Content|WriteAll|createUser|replSetInitiate|manual-recovery-v')) 'Diagnostic classifier can mutate runtime or binding'
}
Check 'recovery v2 facts preserve immutable lineage sources owner target and exact inspection-only limits' {
    $plan=Get-DevMongoPlan
    function Get-DevManualSourceHashes {return [ordered]@{powershell=('A'*64);validator=('B'*64);helper=('C'*64);owner=('D'*64)}}
    $expected=Get-DevManualRecoveryV2Binding $plan;$snapshot=$expected|ConvertTo-Json -Compress -Depth 10
    Assert-DevManualRecoveryV2Facts $expected $expected
    foreach($key in @('parentBindingHash','previousRecoveryBindingHash','initializationIntentHash','preparedManifestHash','originalMaterialFingerprint','ownerSid','allowedAction','maximumAttempts','revision')){
        $bad=$snapshot|ConvertFrom-Json -AsHashtable;$bad[$key]=if($key -ceq 'maximumAttempts'){2}else{'wrong'}
        $refused=$false;try{Assert-DevManualRecoveryV2Facts $bad $expected}catch{$refused=$true};Assert $refused ('Changed v2 fact accepted: '+$key)
    }
    $bad=$snapshot|ConvertFrom-Json -AsHashtable;$bad.sources.helper='0'*64;$refused=$false;try{Assert-DevManualRecoveryV2Facts $bad $expected}catch{$refused=$true};Assert $refused 'Source mismatch accepted'
    $bad=$snapshot|ConvertFrom-Json -AsHashtable;$bad.policy.target.port=27018;$refused=$false;try{Assert-DevManualRecoveryV2Facts $bad $expected}catch{$refused=$true};Assert $refused 'Protected target accepted'
    foreach($action in @('BootstrapOwnedMongo','RunOwnedMongo','initialize','administrator')){$refused=$false;try{Assert-DevManualRecoveryV2Facts $expected $expected $action}catch{$refused=$true};Assert $refused 'Successor broadened authority'}
    Assert (($expected|ConvertTo-Json -Compress -Depth 10) -ceq $snapshot) 'Validation changed original facts'
}
Check 'recovery v2 consumed attempts block restart and never create results without cleanup proof using only mocks' {
    $plan=Get-DevMongoPlan;$records=@{};$simulation=@{Starts=0;FailStart=$true;Empty=$true;NodeFailure=$false;Disposed=0}
    function Assert-DevManualExecutionPolicy {}
    function Assert-DevManualRecoveryMaterial {}
    function Assert-DevManualRecoveryV2Parent {}
    function Get-DevManualSourceHashes {return [ordered]@{powershell=('A'*64);validator=('B'*64);helper=('C'*64);owner=('D'*64)}}
    $generation=Get-DevManualRecoveryV2Binding $plan
    function Read-DevManualRecoveryV2Record {param($Plan,$Name)if($Name -ceq 'manual-recovery-v2.json'){return $generation};return $records[$Name]}
    function Get-DevMongoConfigurationPhase {return 'Bootstrap'}
    function Get-DevManualStage {param($Plan,$Name)return $Name -ceq 'initialize-intent'}
    function Get-DevManualInspection {return $false}
    function Test-Path {param($LiteralPath)return $false}
    function Get-ChildItem {param($LiteralPath,$Filter,[switch]$File)foreach($name in @('manual-runtime.json','manual-initialize-intent.json','manual-recovery-v1.json','manual-recovery-v2.json')+@($records.Keys)){[pscustomobject]@{Name=$name}}}
    function Get-FileHash {param($LiteralPath)return @{Hash=('A'*64)}}
    function Write-DevManualPrivate {param($Plan,$Name,$Bytes)Assert ($Name -cin @('manual-replica-inspection-v2-intent.json','manual-replica-inspection-v2.json') -and -not $records.ContainsKey($Name)) 'Record overwrite';$records[$Name]=[Text.Encoding]::UTF8.GetString($Bytes)|ConvertFrom-Json -AsHashtable}
    $child=[pscustomobject]@{};$child|Add-Member ScriptMethod Wait {param($Timeout)return $true}
    $owner=[pscustomobject]@{};$owner|Add-Member ScriptMethod ForceStop {};$owner|Add-Member ScriptMethod WaitEmpty {param($Timeout)return $simulation.Empty};$owner|Add-Member ScriptMethod Dispose {$simulation.Disposed++}
    function Start-DevManualOwned {param($Plan,[switch]$RecoveryV2)$simulation.Starts++;Assert ($RecoveryV2 -and $records.ContainsKey('manual-replica-inspection-v2-intent.json')) 'Attempt not consumed before start';if($simulation.FailStart){throw 'DEV_MANUAL_START_TIMEOUT'};return @{owner=$owner;child=$child;recoveryV2=$true}}
    function Invoke-DevManualNode {param($Runtime,$Plan,$Step)Assert ($Step -ceq 'inspect-replica') 'Mutating helper action';if($simulation.NodeFailure){throw 'DEV_MANUAL_HELPER_FAILED'};return 'REPLICA_NOT_INITIALIZED'}
    foreach($case in @('startup','cleanup','protocol')){
        $records.Clear();$simulation.FailStart=$case -ceq 'startup';$simulation.Empty=$case -cne 'cleanup';$simulation.NodeFailure=$case -ceq 'protocol';$refused=$false
        try{Invoke-DevManualInspection $plan}catch{$refused=$true}
        Assert ($refused -and $records.ContainsKey('manual-replica-inspection-v2-intent.json') -and -not $records.ContainsKey('manual-replica-inspection-v2.json')) 'Interrupted attempt produced qualified result'
        $before=$simulation.Starts;$refused=$false;try{Invoke-DevManualInspection $plan}catch{$refused=$true};Assert ($refused -and $simulation.Starts -eq $before) 'Consumed attempt restarted MongoDB'
    }
}
Check 'recovery v2 imported writers remain closed and ordinary metadata rejects successor adoption' {
    foreach($gate in @('DEV_MANUAL_RECOVERY_V_TWO_REJECTED','DEV_MANUAL_INSPECTION_ATTEMPT_REJECTED')){$frame=@{status='HELPER_FAILED';phase='SOURCE_BINDING';gate=$gate;code='NONE';connectionAttempted=$false}|ConvertTo-Json -Compress;Assert ((Get-DevManualResponseDiagnostic $frame 1).gate -ceq $gate) 'V2 rejection diagnostic discarded'}
    $plan=Get-DevMongoPlan
    foreach($name in @('manual-recovery-v2.json','manual-replica-inspection-v2-intent.json','manual-replica-inspection-v2.json')){
        $refused=$false;try{Write-DevManualPrivate $plan $name ([byte[]]::new(0))}catch{$refused=$_.Exception.Message -ceq 'DEV_MONGO_EXECUTION_CONTEXT_REQUIRED'};Assert $refused 'Imported v2 writer accepted a context'
        function Get-ChildItem {param($LiteralPath,$Filter,[switch]$File)return @([pscustomobject]@{Name=$name})}
        $refused=$false;try{Assert-DevManualKnownMetadata $plan}catch{$refused=$true};Assert $refused 'Ordinary bootstrap adopted successor'
    }
}
Check 'bootstrap reconciliation facts pin independent authority and immutable six-record lineage' {
    $plan=Get-DevMongoPlan;function Get-DevManualSourceHashes {return [ordered]@{powershell=('A'*64);validator=('B'*64);helper=('C'*64);owner=('D'*64)}}
    $expected=Get-DevManualBootstrapReconciliation $plan;$snapshot=$expected|ConvertTo-Json -Depth 10 -Compress
    Assert-DevManualBootstrapReconciliationFacts $expected $expected
    foreach($key in @('revision','mode','ownerSid','action','parentBindingHash','initializationIntentHash','recoveryV1Hash','recoveryV2Hash','inspectionIntentHash','inspectionResultHash','preparedManifestHash','originalMaterialFingerprint','maximumInitializationAttempts')){$bad=$snapshot|ConvertFrom-Json -AsHashtable;$bad[$key]='wrong';$refused=$false;try{Assert-DevManualBootstrapReconciliationFacts $bad $expected}catch{$refused=$true};Assert $refused ('Mismatched reconciliation accepted: '+$key)}
    $bad=$snapshot|ConvertFrom-Json -AsHashtable;$bad.sources.helper='0'*64;$refused=$false;try{Assert-DevManualBootstrapReconciliationFacts $bad $expected}catch{$refused=$true};Assert $refused 'Drifted source accepted'
    foreach($value in @(@(('C'*64),('C'*64)),@{pin=('C'*64)})){$bad=$snapshot|ConvertFrom-Json -AsHashtable;$bad.sources.helper=$value;$refused=$false;try{Assert-DevManualBootstrapReconciliationFacts $bad $expected}catch{$refused=$true};Assert $refused 'Non-string source pin accepted'}
    $bad=$snapshot|ConvertFrom-Json -AsHashtable;$bad.policy.target.port=27017;$refused=$false;try{Assert-DevManualBootstrapReconciliationFacts $bad $expected}catch{$refused=$true};Assert $refused 'Protected target accepted'
    foreach($bad in @(@{},@{revision=2;allowedAction='InspectOwnedMongo';maximumAttempts=1})){$refused=$false;try{Assert-DevManualBootstrapReconciliationFacts $bad $expected}catch{$refused=$true};Assert $refused 'Inspection authority or missing evidence adopted'}
    Assert (($expected|ConvertTo-Json -Depth 10 -Compress) -ceq $snapshot) 'Validation mutated facts'
}
Check 'bootstrap reconciliation imported effects stay closed and wrong normal configuration fails before private I/O' {
    $plan=Get-DevMongoPlan;$refused=$false;try{Write-DevManualPrivate $plan 'manual-initialize-reconciliation-v1.json' ([byte[]]::new(0))}catch{$refused=$_.Exception.Message -ceq 'DEV_MONGO_EXECUTION_CONTEXT_REQUIRED'};Assert $refused 'Imported writer activated'
    $refused=$false;try{Assert-DevManualPrepared $plan -BootstrapReconciliation -AllowUnreconciled}catch{$refused=$_.Exception.Message -ceq 'DEV_MONGO_EXECUTION_CONTEXT_REQUIRED'};Assert $refused 'Imported bootstrap scope issued context'
    function Assert-DevManualExecutionPolicy {}
    function Get-DevMongoConfigurationPhase {return 'Normal'}
    function Get-FileHash {param($LiteralPath)return @{Hash=('0'*64)}}
    function Get-Item {throw 'Unexpected private read'}
    $refused=$false;try{Assert-DevManualRecoveryMaterial $plan -NormalConfiguration}catch{$refused=$_.Exception.Message -ceq 'DEV_MONGO_PRIVATE_CONFIGURATION_CHANGED'};Assert $refused 'Changed normal config accepted or read other private material'
}
Check 'normal transition source migration is exact and cannot acquire bootstrap authority' {
    $plan=Get-DevMongoPlan;function Get-DevManualSourceHashes {return [ordered]@{powershell=('A'*64);validator=('B'*64);helper=('C'*64);owner=('D'*64)}}
    $expected=Get-DevManualNormalTransition $plan;$snapshot=$expected|ConvertTo-Json -Depth 10 -Compress
    Assert-DevManualNormalTransitionFacts $expected $expected
    Assert ($expected.lineage.Count -eq 18 -and ($expected.allowedActions -join ',') -ceq 'verify-normal,shutdown-normal') 'Broadened authority or incomplete lineage'
    foreach($key in @('revision','purpose','ownerSid','normalConfigurationHash','allowedActions')){$bad=$snapshot|ConvertFrom-Json -AsHashtable;$bad[$key]='wrong';$refused=$false;try{Assert-DevManualNormalTransitionFacts $bad $expected}catch{$refused=$true};Assert $refused ('Mismatched normal fact accepted: '+$key)}
    foreach($key in @('sources','lineage')){foreach($value in @(('0'*64),@(('A'*64),('A'*64)),@{pin=('A'*64)})){$bad=$snapshot|ConvertFrom-Json -AsHashtable;$name=@($bad[$key].Keys)[0];$bad[$key][$name]=$value;$refused=$false;try{Assert-DevManualNormalTransitionFacts $bad $expected}catch{$refused=$true};Assert $refused 'Mismatched or non-string normal pin accepted'}}
    $bad=$snapshot|ConvertFrom-Json -AsHashtable;$bad.policy.target.port=27017;$refused=$false;try{Assert-DevManualNormalTransitionFacts $bad $expected}catch{$refused=$true};Assert $refused 'Protected target accepted'
    Assert (($expected|ConvertTo-Json -Depth 10 -Compress) -ceq $snapshot) 'Facts mutated'
}
Check 'native normal promotion uses real null and changes only disposable files' {
    $active=Join-Path $fixture 'normal-active.txt';$pending=Join-Path $fixture 'normal-pending.txt'
    [IO.File]::WriteAllText($active,'bootstrap');[IO.File]::WriteAllText($pending,'normal')
    $failed=$false;try{[IO.File]::Replace($pending,$active,$null)}catch{$failed=$true}
    Assert ($failed -and [IO.File]::ReadAllText($active) -ceq 'bootstrap' -and [IO.File]::Exists($pending)) 'Original defect not reproduced'
    function Assert-DevManualExecutionPolicy {};function Assert-DevMongoPlan {}
    Move-DevManualNormalConfiguration @{configuration=$active;nextConfiguration=$pending}
    Assert ([IO.File]::ReadAllText($active) -ceq 'normal' -and -not [IO.File]::Exists($pending)) 'Explicit null correction failed'
}
Check 'native normal diagnostics preserve type and HRESULT while withholding sensitive exception text' {
    try{throw [ArgumentException]::new('synthetic-private-password mongodb://private C:\private-key.pem')}catch{$d=Get-DevManualNativeDiagnostic $_ 'NORMAL_CONFIGURATION_REPLACE'}
    $text=$d|ConvertTo-Json -Compress
    Assert ($d.exceptionType -ceq 'System.ArgumentException' -and $d.hresult -eq -2147024809 -and $d.classification -ceq 'ARGUMENT_ERROR' -and -not $d.mongoConnectionAttempted -and $d.state -ceq 'UNKNOWN' -and -not $d.automaticRetry) 'Native diagnostics discarded or state invented'
    Assert ($text -notmatch 'synthetic-private|mongodb://|private-key') 'Native diagnostic leaked secret text'
}
Check 'normal finalization promotes retained pending bytes once and only verifies and shuts down using mocks' {
    $plan=Get-DevMongoPlan;$calls=[Collections.Generic.List[string]]::new();$simulation=@{Phase='Bootstrap';Record=$false;Complete=$false;Fail=$false}
    function Assert-DevManualExecutionPolicy {};function Assert-DevManualPrepared {};function Assert-DevMongoPortFree {}
    function Assert-DevManualNormalState {return $simulation.Phase}
    function Test-Path {param($LiteralPath)return $simulation.Record}
    function Get-DevManualNormalTransition {return @{}}
    function Write-DevManualPrivate {param($Plan,$Name,$Bytes)Assert ($Name -ceq 'manual-normal-transition.json' -and -not $simulation.Record) 'Overwrote record or pending config';$simulation.Record=$true;$calls.Add('receipt')}
    function Read-DevManualNormalTransition {return @{}}
    function Move-DevManualNormalConfiguration {$calls.Add('promote');if($simulation.Fail){throw 'DEV_MANUAL_NORMAL_PROMOTION_FAILED'};$simulation.Phase='Normal'}
    function Start-DevManualOwned {param($Plan,[switch]$NormalTransition,$LifecycleLock)Assert ($NormalTransition -and $simulation.Phase -ceq 'Normal' -and $simulation.Record) 'Wrong source route or start before promotion';$calls.Add('start');return @{owner=[IO.MemoryStream]::new()}}
    function Invoke-DevManualNode {param($Runtime,$Plan,$Step)Assert ($Step -ceq 'verify-normal') 'Bootstrap mutation replayed';$calls.Add($Step);return 'NORMAL_AUTHENTICATION_VERIFIED'}
    function Stop-DevManualOwned {$calls.Add('stop')}
    function Get-DevManualStage {param($Plan,$Name)Assert ($Name -ceq 'complete') 'Unexpected stage';return $simulation.Complete}
    function Write-DevManualStage {param($Plan,$Name)Assert ($Name -ceq 'complete') 'Unexpected stage write';$simulation.Complete=$true;$calls.Add('complete')}
    $simulation.Fail=$true;$refused=$false;try{Invoke-DevManualNormalFinalization $plan}catch{$refused=$true};Assert ($refused -and ($calls -join ',') -ceq 'receipt,promote') 'Promotion failure retried or started MongoDB'
    $calls.Clear();$simulation.Fail=$false;$result=Invoke-DevManualNormalFinalization $plan
    Assert ($result.status -ceq 'NORMAL_AUTHENTICATION_RESTART_VERIFIED' -and ($calls -join ',') -ceq 'promote,start,verify-normal,stop,start,verify-normal,stop,complete') 'Repeated credential/initialization writes or missing restart proof'
}
Check 'normal route rejects imported operations and mutating helper actions before private I/O' {
    $plan=Get-DevMongoPlan
    foreach($body in @({Assert-DevManualPrepared $plan -NormalTransition},{Invoke-DevManualNormalFinalization $plan},{Move-DevManualNormalConfiguration $plan},{Write-DevManualPrivate $plan 'manual-normal-transition.json' ([byte[]]::new(0))})){$refused=$false;try{& $body}catch{$refused=$_.Exception.Message -ceq 'DEV_MONGO_EXECUTION_CONTEXT_REQUIRED'};Assert $refused 'Imported normal route activated'}
    function Assert-DevManualExecutionPolicy {};function Assert-DevManualOwned {throw 'Unexpected ownership/private access'}
    function Read-DevSecret {throw 'Unexpected secret access'}
    foreach($action in @('initialize','administrator','application-user','inspect-replica','shutdown-bootstrap')){$refused=$false;try{Invoke-DevManualNode @{normalTransition=$true} $plan $action}catch{$refused=$_.Exception.Message -ceq 'DEV_MANUAL_NORMAL_TRANSITION_REJECTED'};Assert $refused 'Normal helper acquired mutation or inspection authority'}
}
Check 'optional provisioning refuses missing malformed drifted and non-string source bindings before startup' {
    $plan=Get-DevMongoPlan;$ownerAcl=Get-DevMongoAcl 'OwnerOnly' $true
    $record=@{revision=1;purpose='ADDITIVE_SCHEMA_SYNTHETIC_FIXTURES';ownerSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;normalTransitionHash=('F'*64);allowedAction='ProvisionLocal';sources=@{powershell=('A'*64);helper=('B'*64)}}
    $simulation=@{Record=$record;Missing=$false;Starts=0}
    function Assert-DevManualExecutionPolicy {};function Assert-DevMongoPlan {};function Assert-DevPath {};function Read-DevManualNormalTransition {return @{}}
    function Get-Acl {param($LiteralPath)if($simulation.Missing){throw 'MISSING_SOURCE_BINDING'};return $ownerAcl}
    function Read-DevJson {return $simulation.Record}
    function Get-FileHash {param($LiteralPath)return @{Hash=$(if($LiteralPath.EndsWith('manual-normal-transition.json')){'F'*64}elseif($LiteralPath.EndsWith('Provision-DeepLearnerDev.ps1')){'A'*64}else{'B'*64})}}
    Assert-DevManualProvisioner $plan
    $snapshot=$record|ConvertTo-Json -Depth 10 -Compress
    foreach($key in @('revision','purpose','ownerSid','normalTransitionHash','allowedAction')){$bad=$snapshot|ConvertFrom-Json -AsHashtable;$bad[$key]='wrong';$simulation.Record=$bad;$refused=$false;try{Assert-DevManualProvisioner $plan}catch{$refused=$true};Assert $refused ('Provision source mismatch accepted: '+$key)}
    foreach($key in @('purpose','ownerSid','allowedAction')){foreach($value in @(@($record[$key],$record[$key]),@{value=$record[$key]})){$bad=$snapshot|ConvertFrom-Json -AsHashtable;$bad[$key]=$value;$simulation.Record=$bad;$refused=$false;try{Assert-DevManualProvisioner $plan}catch{$refused=$true};Assert $refused ('Non-string provision fact accepted: '+$key)}}
    foreach($value in @(('0'*64),@(('A'*64),('A'*64)),@{pin=('A'*64)})){$bad=$snapshot|ConvertFrom-Json -AsHashtable;$bad.sources.powershell=$value;$simulation.Record=$bad;$refused=$false;try{Assert-DevManualProvisioner $plan}catch{$refused=$true};Assert $refused 'Unbound provisioning source accepted'}
    $simulation.Record=$record;$simulation.Missing=$true
    function Start-DevManualOwned {$simulation.Starts++;throw 'Unexpected startup'}
    $ProvisionLocal=$true;$FinalizeNormal=$false;$refused=$false;try{Invoke-DevManualMongo 'RunOwnedMongo'}catch{$refused=$_.Exception.Message -ceq 'MISSING_SOURCE_BINDING'}
    Assert ($refused -and $simulation.Starts -eq 0) 'Missing provisioning binding did not fail before startup'
}
Check 'normal transition rejects conflicting pending files or altered pending hashes' {
    $plan=Get-DevMongoPlan;$simulation=@{Phase='Bootstrap';Pending=$true}
    function Get-DevMongoConfigurationPhase {return $simulation.Phase}
    function Get-DevManualStage {return $false}
    function Test-Path {param($LiteralPath,$PathType)return $simulation.Pending}
    function Assert-DevPath {}
    function Get-FileHash {return @{Hash=('0'*64)}}
    foreach($phase in @('Bootstrap','Normal')){$simulation.Phase=$phase;$refused=$false;try{Assert-DevManualNormalState $plan}catch{$refused=$_.Exception.Message -ceq 'DEV_MANUAL_TRANSITION_UNKNOWN_RECONCILE'};Assert $refused 'Mismatched or conflicting pending configuration accepted'}
}
Check 'normal source rejection retains its fixed sanitized helper diagnostic' {
    $frame=@{status='HELPER_FAILED';phase='SOURCE_BINDING';gate='DEV_MANUAL_NORMAL_TRANSITION_REJECTED';code='NONE';connectionAttempted=$false}|ConvertTo-Json -Compress
    Assert ((Get-DevManualResponseDiagnostic $frame 1).gate -ceq 'DEV_MANUAL_NORMAL_TRANSITION_REJECTED') 'Lost normal binding rejection'
}
Check 'persistent setup imports cannot issue runtime authority or write private material' {
    $plan=Get-DevMongoPlan
    . (Join-Path $PSScriptRoot '../Provision-DeepLearnerDev.ps1') -Runtime @{} -Plan $plan
    foreach($body in @({Assert-DevSetupOwner @{} $plan},{Invoke-DevPersistentSetup @{} $plan},{Write-DevSetupFile @{} $plan 'profile.json' ([byte[]]::new(0))})){$refused=$false;try{& $body}catch{$refused=$_.Exception.Message -ceq 'DEV_MONGO_EXECUTION_CONTEXT_REQUIRED'};Assert $refused 'Setup import issued authority or touched private I/O'}
    Assert ((Get-DevPersistentSetupPolicy).target.port -eq 27019 -and (Get-DevPersistentSetupPolicy).actions.Count -eq 7) 'Setup policy drift'
}
Check 'persistent setup stage facts reject forged receipt owner source action and ambiguous field types' {
    $plan=Get-DevMongoPlan;. (Join-Path $PSScriptRoot '../Provision-DeepLearnerDev.ps1') -Runtime @{} -Plan $plan
    $owner=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;$hash='A'*64
    $record=@{revision=1;phase='role';ownerSid=$owner;sourceBindingHash=$hash};Assert-DevSetupStageFacts $record 'role' $owner $hash
    $snapshot=$record|ConvertTo-Json -Compress
    foreach($key in @('revision','phase','ownerSid','sourceBindingHash')){foreach($value in @('wrong',@($record[$key],$record[$key]),@{value=$record[$key]})){$bad=$snapshot|ConvertFrom-Json -AsHashtable;$bad[$key]=$value;$refused=$false;try{Assert-DevSetupStageFacts $bad 'role' $owner $hash}catch{$refused=$true};Assert $refused 'Forged or collection-valued setup fact accepted'}}
    $record.result=@{status='SETUP_ROLE_VERIFIED'};Assert-DevSetupStageFacts $record 'role' $owner $hash -Result
    $record.result.status='UNKNOWN';$refused=$false;try{Assert-DevSetupStageFacts $record 'role' $owner $hash -Result}catch{$refused=$true};Assert $refused 'Unknown write result accepted as verified'
}
Check 'interrupted persistent setup is not retried and consumes no new credentials or runtime using mocks' {
    $plan=Get-DevMongoPlan;. (Join-Path $PSScriptRoot '../Provision-DeepLearnerDev.ps1') -Runtime @{} -Plan $plan
    $owner=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;$hash='A'*64;$calls=@{Node=0;Material=0;Write=0}
    function Assert-DevSetupOwner {}
    function Get-ChildItem {return @()}
    function Get-DevSetupBindingHash {return $hash}
    function Read-DevSetupRecord {param($Plan,$Name)if($Name -ceq 'local-setup-role-intent.json'){return @{revision=1;phase='role';ownerSid=$owner;sourceBindingHash=$hash}};return $null}
    function Invoke-DevSetupNode {$calls.Node++;throw 'Unexpected helper invocation'}
    function Initialize-DevSetupMaterial {$calls.Material++;throw 'Unexpected credential operation'}
    function Write-DevSetupFile {$calls.Write++;throw 'Unexpected private write'}
    $refused=$false;try{Invoke-DevPersistentSetup @{} $plan}catch{$refused=$_.Exception.Message -ceq 'DEV_SETUP_OPERATION_UNCONFIRMED'}
    Assert ($refused -and $calls.Node -eq 0 -and $calls.Material -eq 0 -and $calls.Write -eq 0) 'Interrupted write replayed or environment rebuilt'
}
Check 'existing null scalar and array setup records fail closed instead of appearing missing' {
    $plan=Get-DevMongoPlan;. (Join-Path $PSScriptRoot '../Provision-DeepLearnerDev.ps1') -Runtime @{} -Plan $plan
    $acl=Get-DevMongoAcl 'OwnerOnly' $true;$simulation=@{Value=$null;Exists=$true}
    function Get-DevSetupPath {return 'synthetic-only.json'}
    function Assert-DevPath {}
    function Test-Path {return $simulation.Exists}
    function Get-Acl {return $acl}
    function Read-DevJson {return ,$simulation.Value}
    foreach($value in @($null,$false,@(),'scalar',1)){$simulation.Value=$value;$refused=$false;try{Read-DevSetupRecord $plan 'profile.json'|Out-Null}catch{$refused=$_.Exception.Message -ceq 'DEV_SETUP_PRIVATE_RECORD_REJECTED'};Assert $refused 'Existing invalid JSON was treated as absent'}
    $simulation.Exists=$false;Assert ($null -eq (Read-DevSetupRecord $plan 'profile.json')) 'Missing record classification lost'
}
Check 'unknown setup metadata refuses before a helper credential or write operation using mocks' {
    $plan=Get-DevMongoPlan;. (Join-Path $PSScriptRoot '../Provision-DeepLearnerDev.ps1') -Runtime @{} -Plan $plan
    function Assert-DevSetupOwner {};function Assert-DevPath {}
    function Get-ChildItem {return [pscustomobject]@{Name='local-setup-unexpected.json';FullName='synthetic-only.json';PSIsContainer=$false}}
    function Get-DevSetupStage {throw 'Unexpected stage adoption'}
    function Invoke-DevSetupNode {throw 'Unexpected helper operation'}
    function Initialize-DevSetupMaterial {throw 'Unexpected credential operation'}
    $refused=$false;try{Invoke-DevPersistentSetup @{} $plan}catch{$refused=$_.Exception.Message -ceq 'DEV_SETUP_UNKNOWN_METADATA'};Assert $refused 'Unknown setup state adopted'
}
Check 'listener telemetry compiles without creating a Job or process and exposes immutable primitive fields' {
    if(-not ('DeepLearnerLocal.OwnershipObservation' -as [type])){Add-Type -Path (Join-Path $PSScriptRoot '../LocalProcessOwner.cs')}
    $kind='DeepLearnerLocal.OwnershipObservation' -as [type]
    foreach($property in $kind.GetProperties()){Assert (-not $property.CanWrite) ('Mutable telemetry: '+$property.Name)}
    $source=[IO.File]::ReadAllText((Join-Path $PSScriptRoot '../LocalProcessOwner.cs'))
    $body=$source.Substring($source.IndexOf('public bool Owns(uint pid)'),$source.IndexOf('// Membership is not enough:')-$source.IndexOf('public bool Owns(uint pid)'))
    Assert ($body.Contains('Native.OpenProcess(0x1000,false,pid)') -and ([regex]::Matches($body,'Native.IsProcessInJob\(')).Count -eq 1) 'Ownership access/query semantics changed'
    Assert ($body.Contains('LastOwnershipObservation=null;') -and $body.Contains('bool owned=queried && member;') -and $body.Contains('return owned;')) 'Original decision or per-call reset changed'
    Assert ($body.IndexOf('Marshal.GetLastWin32Error();', $body.IndexOf('bool queried=')) -lt $body.IndexOf('Native.GetProcessTimes')) 'Native error captured after supplemental metadata'
}
Check 'known owned listener retains success without logging or extra ownership queries' {
    $owner=[pscustomobject]@{calls=0};$owner|Add-Member ScriptMethod Owns {param($Number)$this.calls++;return $true}
    function Get-DevListeners {param($Port)@([pscustomobject]@{LocalAddress='127.0.0.1';LocalPort=$Port;OwningProcess=[uint32]123})}
    $log=@();function Write-Host {param($Object)$script:unused=$Object;throw 'Unexpected success telemetry'}
    Assert (Test-DevOwnedListener 3000 $owner) 'Owned listener refused';Assert ($owner.calls -eq 1) 'Repeated ownership query'
}
Check 'unknown listener preserves exact native failure and creation identity without adoption' {
    $fact=[pscustomobject]@{Pid=[uint32]456;Owned=$false;Classification='UNKNOWN';Stage='IS_PROCESS_IN_JOB';NativeError=[int]5;CreationFiletime=[long]134379976371171359;MetadataStage='CREATION_OBSERVED';MetadataError=$null}
    $owner=[pscustomobject]@{LastOwnershipObservation=$fact;calls=0};$owner|Add-Member ScriptMethod Owns {param($Number)$this.calls++;return $false}
    $listener=[pscustomobject]@{LocalAddress='127.0.0.1';LocalPort=4000;OwningProcess=[uint32]456}
    $d=Get-DevListenerDiagnostic 4000 $listener $owner $false 'JOB_MEMBERSHIP_NOT_PROVEN'
    Assert ($d.application -ceq 'API' -and $d.nativeError -eq 5 -and $d.nativeStage -ceq 'IS_PROCESS_IN_JOB' -and $d.ownership -ceq 'UNKNOWN') 'Native failure lost'
    Assert ($d.creationFiletime -eq $fact.CreationFiletime -and $d.pid -eq 456 -and $d.actualPort -eq 4000 -and $d.creationUtc) 'Identity lost'
    function Get-DevListeners {param($Port)@($listener)}
    $refused=$false;try{Test-DevOwnedListener 4000 $owner|Out-Null}catch{$refused=$_.Exception.Message -ceq 'DEV_LISTENER_OWNERSHIP_REJECTED'}
    Assert ($refused -and $owner.calls -eq 1) 'Unknown listener retried or adopted'
}
Check 'successful nonmembership classifies unrelated and still refuses the expected port' {
    $fact=[pscustomobject]@{Pid=[uint32]987;Owned=$false;Classification='UNRELATED';Stage='MEMBERSHIP_QUERIED';NativeError=$null;CreationFiletime=[long]134379976371171359;MetadataStage='CREATION_OBSERVED';MetadataError=$null}
    $owner=[pscustomobject]@{LastOwnershipObservation=$fact};$owner|Add-Member ScriptMethod Owns {param($Number)return $false}
    $listener=[pscustomobject]@{LocalAddress='127.0.0.1';LocalPort=5173;OwningProcess=[uint32]987}
    $d=Get-DevListenerDiagnostic 5173 $listener $owner $false 'JOB_MEMBERSHIP_NOT_PROVEN';Assert ($d.ownership -ceq 'UNRELATED' -and $d.application -ceq 'Admin') 'Unrelated process conflated with query failure'
    function Get-DevListeners {param($Port)@($listener)}
    $refused=$false;try{Test-DevOwnedListener 5173 $owner|Out-Null}catch{$refused=$_.Exception.Message -ceq 'DEV_LISTENER_OWNERSHIP_REJECTED'};Assert $refused 'Unrelated process adopted'
}
Check 'reused unowned PID reports only its current creation identity and never an old owned snapshot' {
    $oldCreation=[long]134379976371171359;$currentCreation=$oldCreation+100000
    $fact=[pscustomobject]@{Pid=[uint32]123;Owned=$false;Classification='UNRELATED';Stage='MEMBERSHIP_QUERIED';NativeError=$null;CreationFiletime=$currentCreation;MetadataStage='CREATION_OBSERVED';MetadataError=$null}
    $owner=[pscustomobject]@{LastOwnershipObservation=$fact};$owner|Add-Member ScriptMethod Owns {param($Number)return $false}
    $listener=[pscustomobject]@{LocalAddress='127.0.0.1';LocalPort=3000;OwningProcess=[uint32]123}
    $d=Get-DevListenerDiagnostic 3000 $listener $owner $false 'JOB_MEMBERSHIP_NOT_PROVEN';Assert ($d.creationFiletime -eq $currentCreation -and $d.creationFiletime -ne $oldCreation) 'Historical identity reused'
    function Get-DevListeners {param($Port)@($listener)}
    $refused=$false;try{Test-DevOwnedListener 3000 $owner|Out-Null}catch{$refused=$_.Exception.Message -ceq 'DEV_LISTENER_OWNERSHIP_REJECTED'};Assert $refused 'Reused unowned PID accepted'
}
Check 'inaccessible process metadata remains explicit unknown with original open error' {
    $owner=[pscustomobject]@{LastOwnershipObservation=[pscustomobject]@{Pid=[uint32]123;Owned=$false;Classification='UNKNOWN';Stage='OPEN_PROCESS';NativeError=[int]5;CreationFiletime=$null;MetadataStage='NOT_AVAILABLE';MetadataError=$null}}
    $listener=[pscustomobject]@{LocalAddress='127.0.0.1';LocalPort=4000;OwningProcess=[uint32]123}
    $d=Get-DevListenerDiagnostic 4000 $listener $owner $false 'JOB_MEMBERSHIP_NOT_PROVEN'
    Assert ($d.ownership -ceq 'UNKNOWN' -and $d.nativeStage -ceq 'OPEN_PROCESS' -and $d.nativeError -eq 5 -and $null -eq $d.creationUtc) 'Access denial fabricated identity'
}
Check 'supplemental creation metadata failure does not hide successful nonmembership' {
    $owner=[pscustomobject]@{LastOwnershipObservation=[pscustomobject]@{Pid=[uint32]123;Owned=$false;Classification='UNRELATED';Stage='MEMBERSHIP_QUERIED';NativeError=$null;CreationFiletime=$null;MetadataStage='CREATION_UNAVAILABLE';MetadataError=[int]5}}
    $d=Get-DevListenerDiagnostic 4000 ([pscustomobject]@{LocalAddress='127.0.0.1';LocalPort=4000;OwningProcess=[uint32]123}) $owner $false 'JOB_MEMBERSHIP_NOT_PROVEN'
    Assert ($d.ownership -ceq 'UNRELATED' -and $d.metadataError -eq 5 -and $null -eq $d.creationFiletime) 'Supplemental failure replaced original result'
}
Check 'malformed or stale ownership telemetry is projected as unknown without sensitive values' {
    $valid=@{Pid=[uint32]123;Owned=$false;Classification='UNRELATED';Stage='MEMBERSHIP_QUERIED';NativeError=$null;CreationFiletime=[long]134379976371171359;MetadataStage='CREATION_OBSERVED';MetadataError=$null}
    $listener=[pscustomobject]@{LocalAddress='127.0.0.1';LocalPort=4000;OwningProcess=[uint32]123}
    $changes=@(@{Pid=[uint32]124},@{Owned=$true},@{Classification='password=synthetic-secret'},@{NativeError='token=synthetic-secret'},@{CreationFiletime='private/key/path'},@{CreationFiletime=[long]::MaxValue},@{MetadataStage=@('CREATION_OBSERVED')},@{Stage='OPEN_PROCESS'},@{Pid='123'})
    foreach($change in $changes){$bad=$valid.Clone();foreach($key in $change.Keys){$bad[$key]=$change[$key]};$owner=[pscustomobject]@{LastOwnershipObservation=[pscustomobject]$bad};$d=Get-DevListenerDiagnostic 4000 $listener $owner $false 'JOB_MEMBERSHIP_NOT_PROVEN';Assert ($d.ownership -ceq 'UNKNOWN') 'Malformed telemetry classified as known';Assert (($d|ConvertTo-Json -Compress) -notmatch 'synthetic-secret|private/key/path') 'Sensitive telemetry leaked'}
    $owner=[pscustomobject]@{LastOwnershipObservation=$null};$d=Get-DevListenerDiagnostic 4000 $listener $owner $false 'JOB_MEMBERSHIP_NOT_PROVEN';Assert ($d.ownership -ceq 'UNKNOWN') 'Missing telemetry accepted'
}
Check 'nonloopback refusal preserves short circuit and never consults ownership' {
    $owner=[pscustomobject]@{};$owner|Add-Member ScriptMethod Owns {param($Number)throw 'UNEXPECTED_OWNERSHIP_QUERY'}
    foreach($address in @('0.0.0.0','::1','192.0.2.1')){
        $listener=[pscustomobject]@{LocalAddress=$address;LocalPort=3000;OwningProcess=[uint32]123}
        function Get-DevListeners {param($Port)@($listener)}
        $d=Get-DevListenerDiagnostic 3000 $listener $null $null 'ADDRESS_REJECTED';Assert ($d.actualAddress -ceq $address -and $d.ownership -ceq 'NOT_CHECKED') 'Address or short-circuit status lost'
        $refused=$false;try{Test-DevOwnedListener 3000 $owner|Out-Null}catch{$refused=$_.Exception.Message -ceq 'DEV_LISTENER_OWNERSHIP_REJECTED'};Assert $refused 'Wildcard/nonloopback accepted'
    }
}
Check 'query and invocation exceptions retain safe stages without raw errors or retry' {
    $log=[Collections.Generic.List[string]]::new();function Write-Host {param($Object)$log.Add([string]$Object)}
    function Get-DevListeners {param($Port)throw 'synthetic-password-token-private-path'}
    try{Test-DevOwnedListener 4000 $null|Out-Null}catch{}
    Assert ($log.Count -eq 1 -and $log[0].Contains('LISTENER_QUERY_FAILED') -and -not $log[0].Contains('synthetic-password')) 'Query exception leaked or lost stage'
    $log.Clear();$owner=[pscustomobject]@{calls=0};$owner|Add-Member ScriptMethod Owns {param($Number)$this.calls++;throw 'synthetic-password-token-private-path'}
    function Get-DevListeners {param($Port)@([pscustomobject]@{LocalAddress='127.0.0.1';LocalPort=4000;OwningProcess=[uint32]123})}
    try{Test-DevOwnedListener 4000 $owner|Out-Null}catch{}
    Assert ($owner.calls -eq 1 -and $log.Count -eq 1 -and $log[0].Contains('OWNERSHIP_CALL_FAILED') -and -not $log[0].Contains('synthetic-password')) 'Invocation exception leaked or retried'
}
Check 'diagnostic data cannot grant ownership even when it claims an owned process' {
    $owner=[pscustomobject]@{LastOwnershipObservation=[pscustomobject]@{Pid=[uint32]123;Owned=$true;Classification='OWNED';Stage='MEMBERSHIP_QUERIED';NativeError=$null;CreationFiletime=[long]134379976371171359;MetadataStage='CREATION_OBSERVED';MetadataError=$null}};$owner|Add-Member ScriptMethod Owns {param($Number)return $false}
    function Get-DevListeners {param($Port)@([pscustomobject]@{LocalAddress='127.0.0.1';LocalPort=4000;OwningProcess=[uint32]123})}
    $refused=$false;try{Test-DevOwnedListener 4000 $owner|Out-Null}catch{$refused=$_.Exception.Message -ceq 'DEV_LISTENER_OWNERSHIP_REJECTED'};Assert $refused 'Telemetry granted ownership'
}
Check 'cancellation cleanup retains only owned Job containment and closes all handles using mocks' {
    $tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot '../Start-DeepLearnerDev.ps1'),[ref]$tokens,[ref]$errors)
    $fn=$ast.Find({param($node)$node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Invoke-DevStartup'},$true)
    $attempt=$fn.Body.EndBlock.Statements|Where-Object {$_ -is [Management.Automation.Language.TryStatementAst]}|Select-Object -First 1
    $text=$attempt.Finally.Extent.Text;$cleanup=[scriptblock]::Create($text.Substring(1,$text.Length-2))
    $owner=[pscustomobject]@{ActiveCount=1;stops=0;disposed=$false};$owner|Add-Member ScriptMethod ForceStop {$this.stops++};$owner|Add-Member ScriptMethod WaitEmpty {param($Timeout)return $true};$owner|Add-Member ScriptMethod Dispose {$this.disposed=$true}
    $readers=@();$lock=[IO.MemoryStream]::new();$public=$null;$apiEnvironment=$null;$oldControl=$null;$failed=$false;$uri='';$secret='';$request=$null
    . $cleanup
    Assert ($owner.stops -eq 1 -and $owner.disposed -and -not $lock.CanRead) 'Cancellation cleanup expanded or lost retained containment'
    Assert ($attempt.CatchClauses[0].Extent.Text.Contains('DEV_USER_STOP')) 'Cancellation classification lost'
}

Check 'normal source amendment selection rejects mixed bootstrap provision and implicit routes before I/O' {
    Assert-DevNormalAmendmentSelection 'BindManualSources' $true $false $false $false
    Assert-DevNormalAmendmentSelection 'RunOwnedMongo' $false $true $false $false
    foreach($args in @(@('RunOwnedMongo',$true,$false,$false,$false),@('BootstrapOwnedMongo',$false,$true,$false,$false),@('RunOwnedMongo',$false,$true,$true,$false),@('RunOwnedMongo',$false,$true,$false,$true),@('BindManualSources',$true,$true,$false,$false))){$refused=$false;try{Assert-DevNormalAmendmentSelection @args}catch{$refused=$true};Assert $refused 'Mixed successor selector accepted'}
}
Check 'normal source amendment strictly pins old20 current5 owner policy action and immutable fingerprints' {
    function Assert-DevMongoPlan {};function Assert-DevPath {};function Get-FileHash {return @{Hash=('A'*64)}}
    function Get-DevManualSourceHashes {return [ordered]@{powershell=('B'*64);validator=('C'*64);helper=('D'*64);owner=('E'*64)}}
    $record=Get-DevNormalSourceAmendment @{};Assert-DevNormalSourceAmendmentFacts $record $record
    Assert ($record.lineage.Count -eq 20 -and $record.sources.Count -eq 5 -and $record.previousSources.owner -ceq 'BA8F2D916D5B04794270769E06C8B5CDB64A98729D28F0169AE9966F89AF9FB9') 'Wrong source lineage'
    $snapshot=$record|ConvertTo-Json -Depth 12
    foreach($key in @('ownerSid','purpose','action','normalConfigurationHash','originalMaterialFingerprint','provisioningBindingHash','revision','maximumAttempts')){$bad=$snapshot|ConvertFrom-Json -AsHashtable;$bad[$key]='wrong';$refused=$false;try{Assert-DevNormalSourceAmendmentFacts $bad $record}catch{$refused=$true};Assert $refused ('Forged amendment '+$key)}
    foreach($key in @('sources','previousSources','lineage')){foreach($value in @($null,@(),@{})){$bad=$snapshot|ConvertFrom-Json -AsHashtable;$bad[$key]=$value;$refused=$false;try{Assert-DevNormalSourceAmendmentFacts $bad $record}catch{$refused=$true};Assert $refused ('Malformed map '+$key)}}
    foreach($key in $record.sources.Keys){$bad=$snapshot|ConvertFrom-Json -AsHashtable;$bad.sources[$key]='F'*64;$refused=$false;try{Assert-DevNormalSourceAmendmentFacts $bad $record}catch{$refused=$true};Assert $refused ('Source drift '+$key)}
    $bad=$snapshot|ConvertFrom-Json -AsHashtable;$bad.allowedActions=@('initialize','shutdown-normal');$refused=$false;try{Assert-DevNormalSourceAmendmentFacts $bad $record}catch{$refused=$true};Assert $refused 'Initialization authority accepted'
    $bad=$snapshot|ConvertFrom-Json -AsHashtable;$bad['Count']=13;$refused=$false;try{Assert-DevNormalSourceAmendmentFacts $bad $record}catch{$refused=$true};Assert $refused 'Count-key shadow accepted extra top-level field'
    foreach($key in @('sources','previousSources','lineage')){$bad=$snapshot|ConvertFrom-Json -AsHashtable;$bad[$key]['Count']=$record[$key].psbase.Count;$refused=$false;try{Assert-DevNormalSourceAmendmentFacts $bad $record}catch{$refused=$true};Assert $refused 'Count-key shadow accepted extra nested field'}
    $bad=$snapshot|ConvertFrom-Json -AsHashtable;$bad.policy['Count']=$record.policy.psbase.Count;$refused=$false;try{Assert-DevNormalSourceAmendmentFacts $bad $record}catch{$refused=$true};Assert $refused 'Policy Count shadow accepted'
    $bad=$snapshot|ConvertFrom-Json -AsHashtable;$bad.policy.target['Count']=$record.policy.target.psbase.Count;$refused=$false;try{Assert-DevNormalSourceAmendmentFacts $bad $record}catch{$refused=$true};Assert $refused 'Target Count shadow accepted'
    $bad=$snapshot|ConvertFrom-Json -AsHashtable;$bad.policy.status=@('ACTIVE');$refused=$false;try{Assert-DevNormalSourceAmendmentFacts $bad $record}catch{$refused=$true};Assert $refused 'Array policy status accepted'
    Assert (($record|ConvertTo-Json -Depth 12) -ceq $snapshot) 'Input mutated'
}
Check 'normal amendment missing or existing partial attempt never becomes unused and cannot replay' {
    $state=@{exists=$false};function Assert-DevPath {};function Get-ChildItem {param($LiteralPath,[switch]$Force)if($state.exists){return [pscustomobject]@{Name='manual-normal-source-amendment-intent.json';Attributes=[IO.FileAttributes]::ReparsePoint;PSIsContainer=$false}};return @()}
    Assert-DevNormalAmendmentUnused @{control='C:\synthetic'}
    $state.exists=$true;$refused=$false;try{Assert-DevNormalAmendmentUnused @{control='C:\synthetic'}}catch{$refused=$_.Exception.Message -ceq 'DEV_MANUAL_NORMAL_AMENDMENT_CONSUMED'};Assert $refused 'Existing partial intent adopted'
    $owner='S-1-5-21-3436178198-164699745-524212520-1001';$hash='A'*64;$intent=@{revision=1;ownerSid=$owner;bindingHash=$hash;action='RunOwnedMongo';state='CONSUMED_BEFORE_STARTUP';attempt=1}
    Assert-DevNormalAmendmentAttemptFacts $intent $owner $hash
    $bad=$intent.Clone();$bad['Count']=6;$refused=$false;try{Assert-DevNormalAmendmentAttemptFacts $bad $owner $hash}catch{$refused=$true};Assert $refused 'Count-key shadow accepted extra attempt field'
    foreach($value in @($null,@(),@{},@{revision=1;ownerSid=$owner;bindingHash=$hash;action='RunOwnedMongo';state='READY';attempt=1})){$refused=$false;try{Assert-DevNormalAmendmentAttemptFacts $value $owner $hash}catch{$refused=$true};Assert $refused 'Missing or forged attempt accepted'}
}
Check 'normal amendment imported writers and creator refuse before private I/O or process startup' {
    function Get-DevMongoPlan {throw 'UNEXPECTED_PRIVATE_OR_RUNTIME_IO'}
    foreach($work in @({Invoke-DevNormalSourceBinding},{Write-DevNormalAmendmentPrivate @{} 'manual-normal-source-amendment.json' @{}},{Write-DevNormalAmendmentPrivate @{} 'manual-normal-source-amendment-intent.json' @{}})){$refused=$false;try{& $work}catch{$refused=$_.Exception.Message -ceq 'DEV_MONGO_EXECUTION_CONTEXT_REQUIRED'};Assert $refused 'Imported source amendment actuator reached private I/O'}
}
Check 'normal amendment intent consumption precedes startup and interrupted attempt is never recreated using mocks' {
    $source=[IO.File]::ReadAllText((Join-Path $PSScriptRoot '../Setup-DeepLearnerDev.ps1'));$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseInput($source,[ref]$tokens,[ref]$errors)
    $block=$ast.Find({param($node)$node -is [Management.Automation.Language.IfStatementAst] -and $node.Extent.Text.StartsWith('if($UseNormalSourceAmendment){')},$true)
    Assert ($null -ne $block -and $block.Extent.EndOffset -lt $source.IndexOf('$runtime=Start-DevManualOwned $plan -NormalTransition -LifecycleLock $lock -NormalSourceAmendment:')) 'Attempt not consumed before startup'
    $UseNormalSourceAmendment=$true;$plan=@{control='C:\synthetic'};$lock=$null;$state=@{consumed=$false;writes=0}
    function Assert-DevNormalAmendmentState {};function Read-DevNormalSourceAmendment {};function Get-FileHash {return @{Hash=('A'*64)}}
    function Assert-DevNormalAmendmentUnused {if($state.consumed){throw 'DEV_MANUAL_NORMAL_AMENDMENT_CONSUMED'}}
    function Write-DevNormalAmendmentPrivate {param($Plan,$Name,$Record)Assert ($Name -ceq 'manual-normal-source-amendment-intent.json') 'Wrong write';$state.writes++;$state.consumed=$true}
    function Read-DevNormalAmendmentAttempt {Assert $state.consumed 'Attempt read before creation'}
    & ([scriptblock]::Create($block.Extent.Text));Assert ($state.consumed -and $state.writes -eq 1) 'Attempt not consumed'
    $refused=$false;try{& ([scriptblock]::Create($block.Extent.Text))}catch{$refused=$_.Exception.Message -ceq 'DEV_MANUAL_NORMAL_AMENDMENT_CONSUMED'};Assert ($refused -and $state.writes -eq 1) 'Interrupted attempt replayed'
}
Check 'normal amendment missing successor evidence refuses before owned process allocation using mocks' {
    function Assert-DevManualExecutionPolicy {};function Assert-DevManualPrepared {};function Assert-DevMongoPortFree {};function Assert-DevNormalAmendmentState {}
    function Read-DevNormalSourceAmendment {throw 'MISSING_SUCCESSOR'};function New-DevManualOwner {throw 'UNEXPECTED_PROCESS_ALLOCATION'}
    $refused=$false;try{Start-DevManualOwned @{} -NormalTransition -NormalSourceAmendment|Out-Null}catch{$refused=$_.Exception.Message -ceq 'MISSING_SUCCESSOR'};Assert $refused 'Missing binding reached owner allocation'
}

Check 'normal amendment binding command is creation only and releases its lock using mocks' {
    $writerSource=${function:Write-DevNormalAmendmentPrivate}.ToString()
    $path=Join-Path $fixture 'normal-binding.lock';[IO.File]::WriteAllText($path,'');$plan=@{operationLock=$path};$state=@{checks=0;writes=0;readbacks=0}
    function Assert-DevManualExecutionPolicy {};function Get-DevMongoPlan {return $plan};function Assert-DevNormalAmendmentState {$state.checks++};function Assert-DevNormalAmendmentUnused {param($Plan,[switch]$Binding)Assert $Binding 'Creator did not require both successor paths absent'};function Assert-DevMongoPortFree {}
    function Get-DevNormalSourceAmendment {return @{synthetic=$true}};function Read-DevNormalSourceAmendment {$state.readbacks++}
    function Write-DevNormalAmendmentPrivate {param($Plan,$Name,$Record)Assert ($Name -ceq 'manual-normal-source-amendment.json') 'Creator wrote intent or other private file';$state.writes++}
    function New-DevManualOwner {throw 'UNEXPECTED_PROCESS_START'};function Read-DevSecret {throw 'UNEXPECTED_SECRET_DECRYPTION'}
    $result=Invoke-DevNormalSourceBinding;Assert ($result.status -ceq 'NORMAL_SOURCE_AMENDMENT_CREATED' -and $state.checks -eq 3 -and $state.writes -eq 1 -and $state.readbacks -eq 1) 'Creation pipeline or readback incomplete'
    $reopened=[IO.File]::Open($path,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None);$reopened.Dispose()
     $text=$writerSource;Assert ($text.Contains('[IO.FileMode]::CreateNew') -and $text.Contains("Get-DevMongoAcl 'OwnerOnly'") -and $text.Contains('Flush($true)')) 'Exclusive owner-only durable creation lost'
}

Check 'normal amendment rejects dangling reparse directory unknown and pending entries using inert metadata' {
    $valid=[pscustomobject]@{Name='manual-complete.json';PSIsContainer=$false;Attributes=[IO.FileAttributes]::Normal}
    Assert-DevNormalAmendmentDirectoryFacts @($valid)
    foreach($entry in @(
        [pscustomobject]@{Name='manual-normal-source-amendment.json';PSIsContainer=$false;Attributes=[IO.FileAttributes]::ReparsePoint},
        [pscustomobject]@{Name='manual-normal-source-amendment-intent.json';PSIsContainer=$false;Attributes=[IO.FileAttributes]::ReparsePoint},
        [pscustomobject]@{Name='manual-complete.json';PSIsContainer=$true;Attributes=[IO.FileAttributes]::Directory},
        [pscustomobject]@{Name='manual-unknown.json';PSIsContainer=$false;Attributes=[IO.FileAttributes]::Normal},
        [pscustomobject]@{Name='mongod.next.cfg';PSIsContainer=$false;Attributes=[IO.FileAttributes]::ReparsePoint},
        [pscustomobject]@{Name='mongod.next.cfg';PSIsContainer=$false;Attributes=[IO.FileAttributes]::Normal}
    )){$refused=$false;try{Assert-DevNormalAmendmentDirectoryFacts @($entry)}catch{$refused=$_.Exception.Message -ceq 'DEV_MANUAL_NORMAL_AMENDMENT_REJECTED'};Assert $refused 'Unsafe entry accepted'}
}

Check 'reusable Normal binding strictly separates current authority from immutable exhausted history' {
    function Assert-DevMongoPlan {};function Get-FileHash {return @{Hash=('A'*64)}}
    function Get-DevManualSourceHashes {return [ordered]@{powershell=('B'*64);validator=('C'*64);helper=('D'*64);owner=('E'*64)}}
    $record=Get-DevNormalRuntimeBinding @{};$json=$record|ConvertTo-Json -Depth 12
    Assert ($record.sources.Count -eq 5 -and $record.lineage.Count -eq 22 -and $record.lifecycle -ceq 'REUSABLE_NORMAL') 'Reusable scope wrong'
    Assert-DevNormalRuntimeFacts $record $record
    foreach($key in @('ownerSid','repository','purpose','action','lifecycle','normalConfigurationHash','binaryHash','preparedManifestHash','originalMaterialFingerprint','provisioningBindingHash','revision')){
        $bad=$json|ConvertFrom-Json -AsHashtable;$bad[$key]='wrong';$refused=$false;try{Assert-DevNormalRuntimeFacts $bad $record}catch{$refused=$true};Assert $refused ('Accepted wrong '+$key)
    }
    foreach($map in @('sources','lineage')){foreach($key in $record[$map].Keys){$bad=$json|ConvertFrom-Json -AsHashtable;$bad[$map][$key]='F'*64;$refused=$false;try{Assert-DevNormalRuntimeFacts $bad $record}catch{$refused=$true};Assert $refused ('Accepted wrong '+$map+'/'+$key)}}
    $bad=$json|ConvertFrom-Json -AsHashtable;$bad.policy.target.port=27017;$refused=$false;try{Assert-DevNormalRuntimeFacts $bad $record}catch{$refused=$true};Assert $refused 'Wrong target accepted'
    $bad=$json|ConvertFrom-Json -AsHashtable;$bad.Remove('purpose');$bad['Purpose']=$record.purpose;$refused=$false;try{Assert-DevNormalRuntimeFacts $bad $record}catch{$refused=$true};Assert $refused 'Ambiguous schema case accepted'
    Assert (($record|ConvertTo-Json -Depth 12) -ceq $json) 'Validation mutated history'
}
Check 'reusable selectors and ordinary owner refuse every mixed or elevated authority' {
    Assert-DevNormalAmendmentSelection 'BindManualSources' $false $false $false $false $true $false
    Assert-DevNormalAmendmentSelection 'RunOwnedMongo' $false $false $false $false $false $true
    foreach($operation in @('Plan','ManualPlan','BootstrapOwnedMongo','InspectOwnedMongo','StartService')){foreach($bind in @($true,$false)){$refused=$false;try{Assert-DevNormalAmendmentSelection $operation $false $false $false $false $bind (-not $bind)}catch{$refused=$true};Assert $refused 'Wrong operation accepted'}}
    foreach($position in 0..3){$old=@($false,$false,$false,$false);$old[$position]=$true;foreach($bind in @($true,$false)){$refused=$false;try{Assert-DevNormalAmendmentSelection $(if($bind){'BindManualSources'}else{'RunOwnedMongo'}) $old[0] $old[1] $old[2] $old[3] $bind (-not $bind)}catch{$refused=$true};Assert $refused 'Mixed old/new route accepted'}}
    $sid='S-1-5-21-3436178198-164699745-524212520-1001';Assert-DevNormalRuntimeOwner $sid 'E:\AI\DeepLearner' $false
    foreach($row in @(@($sid,'E:\AI\DeepLearner',$true),@('other','E:\AI\DeepLearner',$false),@($sid,'C:\other',$false))){$refused=$false;try{Assert-DevNormalRuntimeOwner @row}catch{$refused=$true};Assert $refused 'Wrong/elevated owner accepted'}
}
Check 'reusable creation and run preserve actual nested action guard allowlists with inert expressions' {
    foreach($name in @('Assert-DevManualPrepared','Assert-DevManualRecoveryMaterial')){
        $tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseInput((Get-Item ('Function:'+ $name)).Definition,[ref]$tokens,[ref]$errors)
        $call=$ast.Find({param($n)$n -is [Management.Automation.Language.CommandAst] -and $n.Extent.Text.StartsWith('Assert-DevManualExecutionPolicy -AllowedActions $(if($NormalSourceAmendment -or $NormalRuntime)')},$true)
        Assert ($null -ne $call) 'New route missing actual nested action guard'
        function Assert-DevManualExecutionPolicy {param($AllowedActions)Assert ($acceptedAction -cin $AllowedActions) 'Accepted action lost at nested gate'}
        $NormalSourceAmendment=$false;$NormalRuntime=$true
        foreach($acceptedAction in @('BindManualSources','RunOwnedMongo')){& ([scriptblock]::Create($call.Extent.Text))}
        $NormalRuntime=$false;$acceptedAction='BindManualSources';$refused=$false;try{& ([scriptblock]::Create($call.Extent.Text))}catch{$refused=$true};Assert $refused 'Legacy authorization widened'
    }
}
Check 'reusable imported actuators remain closed before private I/O' {
    function Get-DevMongoPlan {throw 'UNEXPECTED_IO'}
    foreach($body in @({Invoke-DevNormalRuntimeBinding},{Write-DevNormalRuntimeBinding @{} @{}},{Assert-DevNormalRuntimeState @{}})){$refused=$false;try{& $body}catch{$refused=$_.Exception.Message -match 'EXECUTION_CONTEXT_REQUIRED'};Assert $refused 'Imported actuator reached I/O'}
}
Check 'reusable storage walk accepts changing owned inventory but refuses foreign nested or reparse metadata' {
    function Assert-DevMongoPlan {};function Assert-DevPath {}; $plan=@{storage='C:\synthetic\mongo'};$state=@{foreign=$false;reparse=$false;extra=$false;visits=0}
    function Get-ChildItem {param($LiteralPath,[switch]$Force,$ErrorAction)$state.visits++;if($LiteralPath -ceq $plan.storage){[pscustomobject]@{FullName='C:\synthetic\mongo\nested';PSIsContainer=$true;Attributes=[IO.FileAttributes]::Directory}}else{[pscustomobject]@{FullName='C:\synthetic\mongo\nested\data';PSIsContainer=$false;Attributes=$(if($state.reparse){[IO.FileAttributes]::ReparsePoint}else{[IO.FileAttributes]::Normal})};if($state.extra){[pscustomobject]@{FullName='C:\synthetic\mongo\nested\journal';PSIsContainer=$false;Attributes=[IO.FileAttributes]::Normal}}}}
    function Get-Acl {param($LiteralPath,$ErrorAction)$obj=[pscustomobject]@{foreign=$state.foreign};$obj|Add-Member ScriptMethod GetOwner {param($Type)[pscustomobject]@{Value=$(if($this.foreign){'other'}else{'S-1-5-21-3436178198-164699745-524212520-1001'})}};return $obj}
    Assert-DevNormalRuntimeStorage $plan;$state.extra=$true;Assert-DevNormalRuntimeStorage $plan
    foreach($kind in @('foreign','reparse')){$state[$kind]=$true;$refused=$false;try{Assert-DevNormalRuntimeStorage $plan}catch{$refused=$true};Assert $refused ('Accepted '+$kind);$state[$kind]=$false}
    function Get-Acl {param($LiteralPath,$ErrorAction)throw 'SYNTHETIC_METADATA_DENIED'};$refused=$false;try{Assert-DevNormalRuntimeStorage $plan}catch{$refused=$true};Assert $refused 'Unknown metadata accepted'
}
Check 'repeated reusable owned sessions use fresh Jobs locks and unchanged authenticated graceful stop with no intent writes' {
    $state=@{owners=[Collections.Generic.List[object]]::new();reads=0;storage=0;writes=0;step=''};$plan=@{logs=$fixture;executable='synthetic';configuration='synthetic';bootstrap=$fixture}
    function Assert-DevManualExecutionPolicy {param($AllowedActions)Assert ('RunOwnedMongo' -cin $AllowedActions) 'Run gate lost'}
    function Assert-DevManualPrepared {param($Plan,[switch]$RecoveryV2,[switch]$BootstrapReconciliation,[switch]$NormalTransition,$LifecycleLock,[switch]$NormalSourceAmendment,[switch]$NormalRuntime)Assert ($NormalTransition -and $NormalRuntime -and -not $NormalSourceAmendment -and $LifecycleLock.CanRead) 'Wrong runtime/lock'}
    function Assert-DevMongoPortFree {};function Assert-DevNormalRuntimeState {param($Plan,$LifecycleLock)$state.reads++;Assert $LifecycleLock.CanRead 'Lock not retained'};function Assert-DevNormalRuntimeStorage {$state.storage++}
    function Write-DevNormalRuntimeBinding {$state.writes++;throw 'UNEXPECTED_WRITE'};function Write-DevManualStage {$state.writes++;throw 'UNEXPECTED_WRITE'};function Write-DevNormalAmendmentPrivate {$state.writes++;throw 'UNEXPECTED_WRITE'}
    function New-DevEnvironment {return @{}};function Assert-DevManualProcessFacts {};function Get-DevMongoPortRows {return @(@{synthetic=$true})};function Assert-DevMongoListenerRows {};function Assert-DevManualOwned {param($Runtime,$Plan)Assert $Runtime.normalRuntime 'Marker lost'}
    function New-DevManualOwner {$owner=[pscustomobject]@{number=($state.owners.Count+1);disposed=$false};$owner|Add-Member ScriptMethod Start {param($Label,$Exe,$Args,$Repo,$Env,$Out,$Err)$child=[pscustomobject]@{Id=(1000+$this.number);ExitCode=0};$child|Add-Member ScriptMethod Wait {param($Milliseconds)return $true};return $child};$owner|Add-Member ScriptMethod Observe {param($Child)return @{synthetic=$true}};$owner|Add-Member ScriptMethod WaitEmpty {param($Milliseconds)return $true};$owner|Add-Member ScriptMethod Dispose {$this.disposed=$true};$state.owners.Add($owner);return $owner}
    function Invoke-DevManualNode {param($Runtime,$Plan,$Step)Assert ($Step -ceq 'shutdown-normal') 'Unexpected helper command';return 'SHUTDOWN_REQUESTED'}
    foreach($n in 1..2){$path=Join-Path $fixture ('session'+$n+'.lock');[IO.File]::WriteAllText($path,'');$lock=[IO.File]::Open($path,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None);try{$runtime=Start-DevManualOwned $plan -NormalTransition -NormalRuntime -LifecycleLock $lock;Stop-DevManualOwned $runtime $plan 'Normal'}finally{$lock.Dispose()}}
    Assert ($state.owners.Count -eq 2 -and -not [object]::ReferenceEquals($state.owners[0],$state.owners[1]) -and $state.owners[0].disposed -and $state.owners[1].disposed -and $state.reads -eq 2 -and $state.storage -eq 2 -and $state.writes -eq 0) 'Repeated lifecycle widened authority or lost fresh ownership'
    $runtime.owner|Add-Member ScriptMethod WaitEmpty {param($Milliseconds)return $false} -Force;$refused=$false;try{Stop-DevManualOwned $runtime $plan 'Normal'}catch{$refused=$_.Exception.Message -ceq 'DEV_MANUAL_GRACEFUL_EXIT_NOT_VERIFIED'};Assert $refused 'Missing empty Job reported graceful'
}

Check 'reusable creator is exclusive metadata-only and releases its existing lock after readback or failure using mocks' {
    $writer=${function:Write-DevNormalRuntimeBinding}.ToString();$path=Join-Path $fixture 'reusable-creator.lock';[IO.File]::WriteAllText($path,'');$plan=@{operationLock=$path};$state=@{checks=0;writes=0;fail=$false}
    function Assert-DevManualExecutionPolicy {param($AllowedActions)Assert ('BindManualSources' -cin $AllowedActions) 'Creation gate lost'}
    function Get-DevMongoPlan {return $plan};function Assert-DevNormalRuntimeAbsent {};function Assert-DevMongoPortFree {};function Assert-DevNormalRuntimeStorage {}
    function Assert-DevNormalRuntimeState {param($Plan,$LifecycleLock,[switch]$AllowMissingBinding)$state.checks++;if(-not $AllowMissingBinding){Assert ($state.writes -eq 1 -and $LifecycleLock.CanRead) 'Readback before creation/without lock';if($state.fail){throw 'SYNTHETIC_READBACK_REFUSAL'}}}
    function Get-DevNormalRuntimeBinding {return @{synthetic=$true}}
    function Write-DevNormalRuntimeBinding {param($Plan,$Record)Assert ($Record.synthetic -eq $true) 'Wrong binding';$state.writes++}
    function New-DevManualOwner {throw 'UNEXPECTED_PROCESS'};function Read-DevSecret {throw 'UNEXPECTED_CREDENTIAL'};function Write-DevManualStage {throw 'UNEXPECTED_INTENT'}
    $result=Invoke-DevNormalRuntimeBinding;Assert ($result.status -ceq 'NORMAL_RUNTIME_BOUND' -and $state.checks -eq 3 -and $state.writes -eq 1) 'Creation/readback pipeline wrong'
    $lock=[IO.File]::Open($path,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None);$lock.Dispose()
    $state.fail=$true;$state.writes=0;$refused=$false;try{Invoke-DevNormalRuntimeBinding|Out-Null}catch{$refused=$_.Exception.Message -ceq 'SYNTHETIC_READBACK_REFUSAL'};Assert $refused 'Readback failure swallowed'
    $lock=[IO.File]::Open($path,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None);$lock.Dispose()
    Assert ($writer.Contains('[IO.FileMode]::CreateNew') -and $writer.Contains("Get-DevMongoAcl 'OwnerOnly'") -and $writer.Contains('Read-DevNormalRuntimeBinding') -and $writer.Contains('Assert-DevNormalRuntimeAbsent') -and $writer.Contains('Flush($true)')) 'Exclusive owner-only creator semantics lost'
}
Check 'reusable cancellation preserves original retained Job containment lock release and no intent rewrite' {
    $tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot '../Setup-DeepLearnerDev.ps1'),[ref]$tokens,[ref]$errors)
    $fn=$ast.Find({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -ceq 'Invoke-DevManualMongo'},$true)
    $attempt=$fn.Body.EndBlock.Statements|Where-Object {$_ -is [Management.Automation.Language.TryStatementAst]}|Select-Object -First 1
    $text=$attempt.Finally.Extent.Text;$cleanup=[scriptblock]::Create($text.Substring(1,$text.Length-2))
    $owner=[pscustomobject]@{disposed=0};$owner|Add-Member ScriptMethod Dispose {$this.disposed++};$runtime=@{normalRuntime=$true;owner=$owner};$lock=[IO.MemoryStream]::new();$oldControl=$null
    function Write-DevNormalAmendmentPrivate {throw 'UNEXPECTED_INTENT_WRITE'};function Write-DevNormalRuntimeBinding {throw 'UNEXPECTED_BINDING_WRITE'}
    . $cleanup
    Assert ($owner.disposed -eq 1 -and -not $lock.CanRead) 'Cancellation lost owned containment or lock release'
    Assert (-not $text.Contains('Write-Dev') -and $text.Contains('forced retained-Job containment')) 'Cleanup rewrites authority or claims grace'
}

Check 'reusable binding refusal keeps sanitized helper classification without claiming connection or verified state' {
    $frame=@{status='HELPER_FAILED';phase='SOURCE_BINDING';gate='DEV_MANUAL_NORMAL_RUNTIME_REJECTED';code='NONE';connectionAttempted=$false}|ConvertTo-Json -Compress
    $r=Get-DevManualResponseDiagnostic $frame 7 'RESULT_VALIDATION' 'verify-normal'
    Assert ($r.gate -ceq 'DEV_MANUAL_NORMAL_RUNTIME_REJECTED' -and $r.classification -ceq 'HELPER_REPORTED_FAILURE' -and $r.exitCode -eq 7 -and $r.connectionAttempted -ceq 'NO' -and $r.inspectedState -ceq 'UNKNOWN') 'Runtime gate lost or false verification'
}
Write-Host "$passed inert/unit checks passed. No MongoDB/service/database/ACL operation or application startup was performed. Runtime qualification remains NOT_RUN."
