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
Write-Host "$passed inert/unit checks passed. Real applications, MongoDB, listener integration and Ctrl+C qualification NOT_RUN."
