#Requires -Version 7.0
[CmdletBinding()]
param([switch]$Check)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$script:DevRepo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))

function Assert-DevPath([string]$Path) {
    $cursor = [IO.Path]::GetFullPath($Path)
    while ($cursor) {
        if (Test-Path -LiteralPath $cursor) {
            if ((Get-Item -Force -LiteralPath $cursor).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'DEV_LINK_REJECTED' }
        }
        $cursor = [IO.Path]::GetDirectoryName($cursor)
    }
}

function Read-DevJson([string]$Path) {
    Assert-DevPath $Path
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw 'DEV_PROFILE_MISSING' }
    if ((Get-Item -LiteralPath $Path).Length -gt 16384) { throw 'DEV_CONFIGURATION_REJECTED' }
    return ([IO.File]::ReadAllText($Path) | ConvertFrom-Json -AsHashtable)
}

function Assert-DevFrontendFiles([string]$Repo) {
    foreach ($relative in @('', 'apps/web', 'apps/admin')) {
        $directory = Join-Path $Repo $relative
        Assert-DevPath $directory
        foreach ($file in Get-ChildItem -LiteralPath $directory -Force) {
            if (($file.Name -eq '.env' -or $file.Name.StartsWith('.env.', [StringComparison]::OrdinalIgnoreCase)) -and $file.Name -ne '.env.example') { throw 'DEV_FRONTEND_ENV_CONFLICT' }
            if ($file.Name -eq '.npmrc') { throw 'DEV_NPM_CONFIG_CONFLICT' }
        }
    }
    # API .env is deliberately not read; dev:local omits the env-file loader.
    foreach ($relative in @('apps/api', 'packages/shared-types', 'packages/validation')) {
        if (Test-Path -LiteralPath (Join-Path $Repo "$relative/.npmrc")) { throw 'DEV_NPM_CONFIG_CONFLICT' }
    }
}

function New-DevEnvironment([string]$Repo, [string]$Node, [string]$Run) {
    $result = [Collections.Generic.Dictionary[string,string]]::new([StringComparer]::OrdinalIgnoreCase)
    foreach ($name in @('TEMP', 'TMP', 'USERPROFILE', 'LOCALAPPDATA', 'APPDATA')) {
        $value = [Environment]::GetEnvironmentVariable($name)
        if ($value) { $result[$name] = $value }
    }
    $windows = [Environment]::GetFolderPath('Windows')
    $result['SystemRoot'] = $windows
    $result['WINDIR'] = $windows
    $result['COMSPEC'] = Join-Path $windows 'System32/cmd.exe'
    $result['PATH'] = @([IO.Path]::GetDirectoryName($Node), (Join-Path $Repo 'node_modules/.bin'), (Join-Path $windows 'System32'), $windows) -join ';'
    $result['PATHEXT'] = '.COM;.EXE;.BAT;.CMD'
    $result['NODE_ENV'] = 'development'
    $result['NO_COLOR'] = '1'
    $result['NEXT_TELEMETRY_DISABLED'] = '1'
    $result['NEXT_PUBLIC_API_BASE_URL'] = 'http://127.0.0.1:4000/api/v1'
    $result['VITE_API_BASE_URL'] = 'http://127.0.0.1:4000/api/v1'
    $result['NPM_CONFIG_IGNORE_SCRIPTS'] = 'true'
    $result['NPM_CONFIG_SCRIPT_SHELL'] = $result['COMSPEC']
    $result['NPM_CONFIG_USERCONFIG'] = 'NUL'
    $result['NPM_CONFIG_GLOBALCONFIG'] = Join-Path $Run 'absent-global.npmrc'
    $result['NPM_CONFIG_CACHE'] = Join-Path $Run 'npm-cache'
    $result['NPM_CONFIG_UPDATE_NOTIFIER'] = 'false'
    $result['NPM_CONFIG_LOGS_MAX'] = '0'
    return ,$result
}

function New-DevApiEnvironment($Public, [string]$Uri, [string]$Secret) {
    $result = [Collections.Generic.Dictionary[string,string]]::new($Public, [StringComparer]::OrdinalIgnoreCase)
    $result.Remove('NEXT_PUBLIC_API_BASE_URL') | Out-Null
    $result.Remove('VITE_API_BASE_URL') | Out-Null
    $result['APP_ENV'] = 'LOCAL'
    $result['PORT'] = '4000'
    $result['MONGODB_URI'] = $Uri
    $result['MONGODB_DB_NAME'] = 'deeplearner-dev'
    $result['MONGODB_TLS'] = 'false'
    $result['ACCESS_TOKEN_SECRET'] = $Secret
    $result['ACCESS_TOKEN_ISSUER'] = 'deeplearner-api'
    $result['ACCESS_TOKEN_AUDIENCE'] = 'deeplearner'
    $result['AUTH_COOKIE_SECURE'] = 'false'
    $result['WEB_ORIGIN'] = 'http://127.0.0.1:3000'
    $result['CORS_ORIGINS'] = 'http://127.0.0.1:3000,http://127.0.0.1:5173'
    $result['EMAIL_PROVIDER'] = 'disabled'
    $result['GOOGLE_CLIENT_ID'] = ''
    $result['LOG_LEVEL'] = 'info'
    return ,$result
}

function Get-DevListeners([int]$Port) {
    try { return @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction Stop) }
    catch {
        # Only this cmdlet's explicit no-match result means free. Permission/query failures refuse.
        if ($_.CategoryInfo.Category -eq 'ObjectNotFound' -and $_.FullyQualifiedErrorId -like 'CmdletizationQuery_NotFound*') { return @() }
        throw 'DEV_PORT_INSPECTION_UNAVAILABLE'
    }
}

function Assert-DevFreePorts {
    foreach ($port in @(3000, 5173, 4000)) {
        if (@(Get-DevListeners $port).Count) { throw 'DEV_PORT_OCCUPIED' }
    }
}

function Get-DevListenerDiagnostic([int]$Port, $Listener, $Owner, $Owned, [ValidateSet('ADDRESS_REJECTED','JOB_MEMBERSHIP_NOT_PROVEN','OWNERSHIP_CALL_FAILED','LISTENER_QUERY_FAILED')][string]$Stage) {
    # Project only allowlisted primitives. Never serialize an exception, process or raw telemetry.
    $service=switch($Port){3000{'Student'}5173{'Admin'}4000{'API'}default{'UNKNOWN'}}
    $row=[ordered]@{event='DEV_LISTENER_OWNERSHIP_DIAGNOSTIC';timeUtc=[DateTime]::UtcNow.ToString('o');application=$service;expectedAddress='127.0.0.1';expectedPort=$Port;actualAddress=$null;actualPort=$null;pid=$null;creationFiletime=$null;creationUtc=$null;ownership='UNKNOWN';verificationStage=$Stage;nativeStage='NOT_AVAILABLE';nativeError=$null;metadataStage='NOT_AVAILABLE';metadataError=$null;automaticRetry=$false;adopted=$false}
    try {
        $ip=$null
        if($Listener.LocalAddress -is [string] -and [Net.IPAddress]::TryParse($Listener.LocalAddress,[ref]$ip)){$row.actualAddress=$ip.ToString()}
        if(($Listener.LocalPort -is [int] -or $Listener.LocalPort -is [uint16] -or $Listener.LocalPort -is [uint32]) -and $Listener.LocalPort -gt 0 -and $Listener.LocalPort -le 65535){$row.actualPort=[int]$Listener.LocalPort}
        if(($Listener.OwningProcess -is [int] -or $Listener.OwningProcess -is [uint32]) -and $Listener.OwningProcess -gt 0){$row.pid=[uint32]$Listener.OwningProcess}
    } catch { } # Missing socket metadata stays UNKNOWN, never raw text.
    if($Stage -ceq 'ADDRESS_REJECTED'){$row.ownership='NOT_CHECKED';return $row}
    if($Stage -cne 'JOB_MEMBERSHIP_NOT_PROVEN'){return $row}
    try {
        $fact=$Owner.LastOwnershipObservation # One snapshot; no second Owns/native query.
        if($null -eq $row.pid -or $fact.Pid -isnot [uint32] -or $fact.Pid -ne $row.pid -or $Owned -isnot [bool] -or $fact.Owned -isnot [bool] -or $fact.Owned -ne $Owned){return $row}
        if($fact.Classification -isnot [string] -or $fact.Stage -isnot [string] -or $fact.MetadataStage -isnot [string]){return $row}
        $valid=($fact.Stage -ceq 'OPEN_PROCESS' -and $fact.Classification -ceq 'UNKNOWN' -and -not $Owned -and $null -ne $fact.NativeError -and $null -eq $fact.CreationFiletime -and $fact.MetadataStage -ceq 'NOT_AVAILABLE') -or
            ($fact.Stage -ceq 'IS_PROCESS_IN_JOB' -and $fact.Classification -ceq 'UNKNOWN' -and -not $Owned -and $null -ne $fact.NativeError) -or
            ($fact.Stage -ceq 'MEMBERSHIP_QUERIED' -and $fact.Classification -ceq $(if($Owned){'OWNED'}else{'UNRELATED'}) -and $null -eq $fact.NativeError)
        if(-not $valid){return $row}
        foreach($code in @($fact.NativeError,$fact.MetadataError)){if($null -ne $code -and ($code -isnot [int] -or $code -lt 0)){return $row}}
        if($fact.MetadataStage -cnotin @('NOT_AVAILABLE','CREATION_OBSERVED','CREATION_UNAVAILABLE')){return $row}
        $creation=$null;$utc=$null
        if($null -ne $fact.CreationFiletime){
            if($fact.CreationFiletime -isnot [long] -or $fact.CreationFiletime -le 0 -or $fact.MetadataStage -cne 'CREATION_OBSERVED' -or $null -ne $fact.MetadataError){return $row}
            $utc=[DateTime]::FromFileTimeUtc($fact.CreationFiletime).ToString('o');$creation=$fact.CreationFiletime
        }elseif($fact.MetadataStage -ceq 'CREATION_OBSERVED'){return $row}
        $row.ownership=$fact.Classification;$row.nativeStage=$fact.Stage;$row.nativeError=$fact.NativeError
        $row.creationFiletime=$creation;$row.creationUtc=$utc;$row.metadataStage=$fact.MetadataStage;$row.metadataError=$fact.MetadataError
    } catch { } # Malformed diagnostics cannot change the ownership decision.
    return $row
}

function Test-DevOwnedListener([int]$Port, $Owner) {
    try {$listeners = @(Get-DevListeners $Port)}
    catch {Write-Host ((Get-DevListenerDiagnostic $Port $null $null $null 'LISTENER_QUERY_FAILED')|ConvertTo-Json -Compress);throw}
    foreach ($listener in $listeners) {
        if ($listener.LocalAddress -ne '127.0.0.1') {
            Write-Host ((Get-DevListenerDiagnostic $Port $listener $null $null 'ADDRESS_REJECTED')|ConvertTo-Json -Compress)
            throw 'DEV_LISTENER_OWNERSHIP_REJECTED'
        }
        try {$owned=$Owner.Owns([uint32]$listener.OwningProcess)}
        catch {Write-Host ((Get-DevListenerDiagnostic $Port $listener $null $null 'OWNERSHIP_CALL_FAILED')|ConvertTo-Json -Compress);throw}
        if (-not $owned) {
            Write-Host ((Get-DevListenerDiagnostic $Port $listener $Owner $owned 'JOB_MEMBERSHIP_NOT_PROVEN')|ConvertTo-Json -Compress)
            throw 'DEV_LISTENER_OWNERSHIP_REJECTED'
        }
    }
    return $listeners.Count -gt 0
}

function Update-DevListenerRecovery([hashtable]$State, [bool]$Listening, [long]$Now, [int]$GraceMs = 60000) {
    if ($Listening) { $State.missingSince=$null; return }
    if ($null -eq $State.missingSince) { $State.missingSince=$Now }
    if ($Now - $State.missingSince -ge $GraceMs) { throw 'DEV_LISTENER_TIMEOUT' }
}

function Open-DevLock([string]$Path) {
    Assert-DevPath $Path
    return [IO.File]::Open($Path, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
}

function Send-DevValidationRequest($Child, [string]$Request, [int]$DeadlineMs = 10000) {
    if ([Text.Encoding]::UTF8.GetByteCount($Request) -gt 8192) { throw 'DEV_CONFIGURATION_REJECTED' }
    $frame = $Child.ReadFrameAsync()
    $write = $Child.SendFrameAsync($Request)
    if (-not $write.Wait($DeadlineMs)) { throw 'DEV_VALIDATION_TIMEOUT' }
    $Child.CloseInput()
    if (-not $frame.Wait($DeadlineMs) -or -not $Child.Wait(5000) -or $Child.ExitCode -ne 0) { throw 'DEV_CONFIGURATION_REJECTED' }
    return $frame.Result
}

function Read-DevSecret([string]$Path) {
    Assert-DevPath $Path
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw 'DEV_PRIVATE_CONFIG_MISSING' }
    if ((Get-Item -LiteralPath $Path).Length -gt 65536) { throw 'DEV_CONFIGURATION_REJECTED' }
    $secure = ConvertTo-SecureString ([IO.File]::ReadAllText($Path))
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer); $secure.Dispose() }
}

function Invoke-DevStartup([switch]$CheckOnly) {
    $owner = $null; $lock = $null; $public = $null; $apiEnvironment = $null
    $uri = ''; $secret = ''; $request = $null; $oldControl = $null
    $readers = [Collections.Generic.List[object]]::new()
    $children = [Collections.Generic.List[object]]::new()
    $failed = $false; $stage = 'profile'
    try {
        if (-not $IsWindows -or [Runtime.InteropServices.RuntimeInformation]::ProcessArchitecture -ne 'X64') { throw 'DEV_WINDOWS_X64_REQUIRED' }
        $private = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'DeepLearner/dev'
        Assert-DevPath $private
        $profile = Read-DevJson (Join-Path $private 'profile.json')
        Assert-DevFrontendFiles $script:DevRepo
        $node = (Get-Command node.exe -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
        $npm = Join-Path ([IO.Path]::GetDirectoryName((Get-Command npm.cmd -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source)) 'node_modules/npm/bin/npm-cli.js'
        Assert-DevPath $node; Assert-DevPath $npm
        if (-not (Test-Path -LiteralPath $npm -PathType Leaf)) { throw 'DEV_NPM_UNAVAILABLE' }
        $npmManifest = Read-DevJson (Join-Path ([IO.Path]::GetDirectoryName($npm)) '../package.json')
        if ($npmManifest.version -notmatch '^11\.') { throw 'DEV_NPM_VERSION_REJECTED' }
        $uri = Read-DevSecret (Join-Path $private 'mongodb-uri.dpapi')
        $secret = Read-DevSecret (Join-Path $private 'signing-secret.dpapi')
        $stage = 'lock'
        $lock = Open-DevLock (Join-Path $private 'startup.lock')
        $run = Join-Path $private ('runs/' + [guid]::NewGuid().ToString('N'))
        Assert-DevPath $run; [IO.Directory]::CreateDirectory($run) | Out-Null
        $public = New-DevEnvironment $script:DevRepo $node $run
        if (-not ('DeepLearnerLocal.Owner' -as [type])) { Add-Type -Path (Join-Path $PSScriptRoot 'LocalProcessOwner.cs') }
        $owner = [DeepLearnerLocal.Owner]::new()
        $manifests = @{}
        foreach ($entry in @(@('root', 'package.json'), @('web', 'apps/web/package.json'), @('admin', 'apps/admin/package.json'), @('api', 'apps/api/package.json'), @('types', 'packages/shared-types/package.json'), @('validation', 'packages/validation/package.json'))) {
            $manifest = Read-DevJson (Join-Path $script:DevRepo $entry[1])
            $manifests[$entry[0]] = @{scripts=$manifest.scripts}
        }
        $request = @{profile=$profile; repository=$script:DevRepo; ownerSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value; secrets=@{mongodbUri=$uri; signingSecret=$secret}; manifests=$manifests}
        $stage = 'configuration validation'
        $validator = $owner.StartControlled('configuration', $node, @('--import', 'tsx', (Join-Path $script:DevRepo 'apps/api/scripts/dev-local.ts')), $script:DevRepo, $public, (Join-Path $run 'configuration.err.log'))
        $frame = Send-DevValidationRequest $validator ($request | ConvertTo-Json -Compress -Depth 12)
        $request.secrets.mongodbUri=''; $request.secrets.signingSecret=''; $request=$null
        $plan = $frame | ConvertFrom-Json -AsHashtable
        if (-not $plan -or -not $plan.ContainsKey('services')) { throw 'DEV_CONFIGURATION_REJECTED' }
        if ($CheckOnly) { Write-Host 'Configuration checks passed. Applications/database connectivity NOT_RUN; profile metadata is not runtime ownership proof.'; return }
        if ([Console]::IsInputRedirected) { throw 'DEV_INTERACTIVE_TERMINAL_REQUIRED' }
        $oldControl = [Console]::TreatControlCAsInput; [Console]::TreatControlCAsInput = $true
        $stage = 'ports'; Assert-DevFreePorts
        $apiEnvironment = New-DevApiEnvironment $public $uri $secret
        $uri=''; $secret=''
        function Start-DevChild($Spec, $Environment) {
            $out = Join-Path $run ($Spec.label + '.out.log'); $err = Join-Path $run ($Spec.label + '.err.log')
            $child = $owner.Start($Spec.label, $node, (@($npm) + [string[]]$Spec.args), $script:DevRepo, $Environment, $out, $err)
            foreach ($path in @($out, $err)) {
                $stream = [IO.FileStream]::new($path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite)
                $readers.Add(@{label=$Spec.label; reader=[IO.StreamReader]::new($stream)})
            }
            $children.Add($child); return $child
        }
        function Show-DevLogs {
            foreach ($record in $readers) {
                $buffer = [char[]]::new(4096)
                $count = $record.reader.Read($buffer, 0, $buffer.Length)
                if ($count) { Write-Host ('[' + $record.label + '] ' + [string]::new($buffer, 0, $count).TrimEnd()) }
            }
        }
        function Assert-DevContinue {
            if ([Console]::KeyAvailable) {
                $key = [Console]::ReadKey($true)
                if ($key.KeyChar -eq [char]3 -or ($key.Key -eq 'C' -and $key.Modifiers -band [ConsoleModifiers]::Control)) { throw 'DEV_USER_STOP' }
            }
        }
        $stage = 'shared package build'
        $build = Start-DevChild $plan.build $public
        $timer = [Diagnostics.Stopwatch]::StartNew()
        while (-not $build.HasExited) {
            Assert-DevContinue; Show-DevLogs
            if ($timer.Elapsed.TotalSeconds -gt 120) { throw 'DEV_BUILD_TIMEOUT' }
            Start-Sleep -Milliseconds 100
        }
        Show-DevLogs
        if ($build.ExitCode -ne 0) { throw 'DEV_BUILD_FAILED' }
        foreach ($spec in $plan.watchers) { Start-DevChild $spec $public | Out-Null }
        foreach ($spec in $plan.services) {
            $stage = $spec.label
            Assert-DevFreePortForService $spec.port
            Start-DevChild $spec $(if ($spec.label -eq 'api') { $apiEnvironment } else { $public }) | Out-Null
        }
        $apiEnvironment.Clear(); $stage = 'listener startup'
        $timer.Restart(); $announced = $false
        $recovery = @{4000=@{missingSince=$null}; 3000=@{missingSince=$null}; 5173=@{missingSince=$null}}
        while ($true) {
            Assert-DevContinue; Show-DevLogs
            foreach ($child in $children) { if ($child -ne $build -and $child.HasExited) { throw 'DEV_CHILD_EXITED' } }
            $allListening = $true
            foreach ($spec in $plan.services) {
                $listening = Test-DevOwnedListener $spec.port $owner
                if (-not $listening) { $allListening = $false }
                if ($announced) { Update-DevListenerRecovery $recovery[[int]$spec.port] $listening $timer.ElapsedMilliseconds }
            }
            if (-not $announced) {
                if ($allListening) {
                    Write-Host 'Owned loopback listeners present: Student http://127.0.0.1:3000 | Admin http://127.0.0.1:5173 | API http://127.0.0.1:4000/api/v1'
                    Write-Host 'This is not login, database qualification or feature acceptance. Ctrl+C stops only this run; MongoDB is unmanaged.'
                    $announced=$true
                } elseif ($timer.Elapsed.TotalSeconds -gt 120) { throw 'DEV_STARTUP_TIMEOUT' }
            }
            Start-Sleep -Milliseconds 200
        }
    } catch {
        if ($_.Exception.Message -eq 'DEV_USER_STOP') { Write-Host 'Stopping this owned application run.' }
        else {
            $failed=$true
            $code=$_.Exception.Message
            if ($code -notmatch '^DEV_[A-Z_]+$') { $code='DEV_STARTUP_BLOCKED' }
            Write-Host "BLOCKED/FAILED [$stage]: $code. No automatic provisioning, fallback database or listener adoption."
            if ($code -eq 'DEV_PROFILE_MISSING') { Write-Host 'Pending separately approved private profile/MongoDB setup. See docs/LOCAL_DEVELOPMENT.md.' }
        }
    } finally {
        $uri=''; $secret=''; $request=$null
        if ($apiEnvironment) { $apiEnvironment.Clear() }
        if ($public) { $public.Clear() }
        try {
            if ($owner) {
                if ($owner.ActiveCount -gt 0) {
                    Write-Host 'Cleanup mode: FORCED_CONTAINMENT of this retained Windows Job only (not graceful shutdown).'
                    $owner.ForceStop()
                }
                if (-not $owner.WaitEmpty(5000)) { $failed=$true; Write-Host 'Cleanup NOT_VERIFIED: owned Job did not become empty.' }
            }
        } catch {
            $failed=$true; Write-Host 'Cleanup NOT_VERIFIED: native containment/query failed; retained Job handle will close.'
        } finally {
            try {
                if ($owner) { try { $owner.Dispose() } catch { $failed=$true } }
                foreach ($record in $readers) { try { $record.reader.Dispose() } catch { $failed=$true } }
                if ($null -ne $oldControl) { try { [Console]::TreatControlCAsInput=$oldControl } catch { $failed=$true } }
            } finally { if ($lock) { $lock.Dispose() } }
        }
        # This must also override a -Check return when containment/cleanup failed.
        if ($failed) { throw 'DEV_STARTUP_INCOMPLETE' }
    }
}

function Assert-DevFreePortForService([int]$Port) {
    if (@(Get-DevListeners $Port).Count) { throw 'DEV_PORT_OCCUPIED' }
}

if ($MyInvocation.InvocationName -ne '.') {
    try { Invoke-DevStartup -CheckOnly:$Check }
    catch { exit 1 }
}
