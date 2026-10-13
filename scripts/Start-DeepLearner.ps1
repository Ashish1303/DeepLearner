#Requires -Version 7.0
[CmdletBinding()]
param([switch]$NoAdmin)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$script:LocalScripts = $PSScriptRoot
$script:LocalRepo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))

function Get-LocalRoot {
    if (-not $IsWindows -or -not $env:LOCALAPPDATA) { throw 'Windows PowerShell 7 is required.' }
    return [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'DeepLearner/local-dev'))
}
function Assert-NoLink([string]$Path) {
    $cursor = [IO.Path]::GetFullPath($Path)
    while ($cursor) {
        if (Test-Path -LiteralPath $cursor) {
            if ((Get-Item -Force -LiteralPath $cursor).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Reparse-point path rejected.' }
        }
        $parent = [IO.Path]::GetDirectoryName($cursor)
        if ($parent -eq $cursor) { break }; $cursor = $parent
    }
}
function Write-LocalJson([string]$Path, $Value) {
    Assert-NoLink $Path
    [IO.File]::WriteAllText($Path, ($Value | ConvertTo-Json -Depth 8), [Text.UTF8Encoding]::new($false))
}
function Get-LocalEnvironment([switch]$Api, [string]$Secret) {
    $result = [Collections.Generic.Dictionary[string,string]]::new([StringComparer]::OrdinalIgnoreCase)
    # Explicit allowlist, never inherit NODE_OPTIONS, backend secrets or .env files.
    foreach ($name in @('SystemRoot','WINDIR','TEMP','TMP','USERPROFILE','LOCALAPPDATA','APPDATA','PATH','PATHEXT','COMSPEC')) {
        $value = [Environment]::GetEnvironmentVariable($name)
        if ($value) { $result[$name] = $value }
    }
    $result['APP_ENV']='LOCAL'; $result['MONGODB_URI']='mongodb://127.0.0.1:27018/?directConnection=true'
    $result['MONGODB_DB_NAME']='deeplearner-local-demo'; $result['MONGODB_TLS']='false'
    $result['NEXT_TELEMETRY_DISABLED']='1'; $result['NO_COLOR']='1'; $result['NODE_ENV']='development'
    $result['NEXT_PUBLIC_API_BASE_URL']='http://127.0.0.1:4000/api/v1'
    $result['VITE_API_BASE_URL']='http://127.0.0.1:4000/api/v1'
    if ($Api) {
        if (-not $Secret) { throw 'Private API signing secret required.' }
        $result['ACCESS_TOKEN_SECRET']=$Secret; $result['ACCESS_TOKEN_ISSUER']='deeplearner-api'
        $result['ACCESS_TOKEN_AUDIENCE']='deeplearner'; $result['AUTH_COOKIE_SECURE']='false'
        $result['CORS_ORIGINS']='http://127.0.0.1:3000,http://127.0.0.1:5173'
        $result['WEB_ORIGIN']='http://127.0.0.1:3000'; $result['PORT']='4000'
        $result['EMAIL_PROVIDER']='disabled'; $result['GOOGLE_CLIENT_ID']=''; $result['LOG_LEVEL']='info'
    }
    return ,$result
}
function Assert-FreePorts([int[]]$Ports) {
    $listeners = @(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object { $_.LocalPort -in $Ports })
    if ($listeners.Count) { throw 'Required local port is occupied; no process was adopted or stopped.' }
}
function Get-LocalExecutables {
    $node = (Get-Command node.exe -CommandType Application -ErrorAction Stop).Source
    $npm = (Get-Command npm.cmd -CommandType Application -ErrorAction Stop).Source
    $mongo = 'C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe'
    foreach ($file in @($node,$npm,$mongo)) { Assert-NoLink $file; if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw 'Required executable missing.' } }
    if ((Get-Item -LiteralPath $node).VersionInfo.ProductMajorPart -ne 24) { throw 'Node 24 required.' }
    $npmPackage = Get-Content -Raw -LiteralPath (Join-Path (Split-Path $npm) 'node_modules/npm/package.json') | ConvertFrom-Json
    if ($npmPackage.version -notmatch '^11\.') { throw 'npm 11 required.' }
    if ((Get-Item -LiteralPath $mongo).VersionInfo.ProductVersion -notmatch '^8\.2\.') { throw 'Existing MongoDB 8.2 required.' }
    foreach ($file in @('node_modules/tsx/package.json','node_modules/typescript/bin/tsc','node_modules/mongoose/package.json','node_modules/argon2/package.json','node_modules/next/package.json','node_modules/vite/package.json')) {
        if (-not (Test-Path -LiteralPath (Join-Path $script:LocalRepo $file))) { throw 'Install prerequisites separately; launcher never installs packages.' }
    }
    # Next/Vite load their own .env files: reject them rather than silently mixing targets.
    foreach ($app in @('web','admin')) {
        $files = @(Get-ChildItem -Force -LiteralPath (Join-Path $script:LocalRepo "apps/$app") -File | Where-Object { $_.Name -like '.env*' -and $_.Name -ne '.env.example' })
        if ($files.Count) { throw 'Frontend .env files require owner reconciliation before local startup.' }
    }
    return @{ Node=$node; Mongo=$mongo; NodeHash=(Get-FileHash -LiteralPath $node).Hash; MongoHash=(Get-FileHash -LiteralPath $mongo).Hash }
}
function Read-LocalOwnership([string]$Root, $Executables, [switch]$AllowPreparing) {
    Assert-NoLink $Root
    $receipt = Get-Content -Raw -LiteralPath (Join-Path $Root 'ownership.json') | ConvertFrom-Json
    $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    if ($receipt.revision -ne 1 -or $receipt.ownerSid -ne $sid -or $receipt.root -ne $Root -or $receipt.repo -ne $script:LocalRepo -or
        $receipt.database -ne 'deeplearner-local-demo' -or $receipt.replicaSet -ne 'deeplearner-local' -or $receipt.port -ne 27018 -or
        $receipt.node -ne $Executables.Node -or $receipt.mongo -ne $Executables.Mongo -or $receipt.nodeHash -ne $Executables.NodeHash -or $receipt.mongoHash -ne $Executables.MongoHash) { throw 'Ownership/configuration mismatch; separate review required.' }
    if (-not $AllowPreparing -and $receipt.state -ne 'INITIALIZED') { throw 'Separate first-time initialization required.' }
    foreach ($name in @('mongodb','runs','signing-secret.dpapi','ownership.json')) { Assert-NoLink (Join-Path $Root $name) }
    return $receipt
}
function New-LocalOwnership([string]$Root, $Executables) {
    Assert-NoLink $Root
    if (Test-Path -LiteralPath $Root) { throw 'Initialization refuses an existing directory; preserve it for owner review.' }
    [IO.Directory]::CreateDirectory($Root) | Out-Null
    # CreateNew also rejects two simultaneous first-time setup attempts.
    $reservation=[IO.File]::Open((Join-Path $Root 'initialization.reservation'),[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
    $reservation.Dispose()
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $acl = [Security.AccessControl.DirectorySecurity]::new()
    $acl.SetAccessRuleProtection($true,$false); $acl.SetOwner($identity)
    foreach ($sid in @($identity,[Security.Principal.SecurityIdentifier]::new('S-1-5-18'))) {
        $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid,'FullControl','ContainerInherit,ObjectInherit','None','Allow'))
    }
    Set-Acl -LiteralPath $Root -AclObject $acl
    foreach ($name in @('mongodb','runs')) { [IO.Directory]::CreateDirectory((Join-Path $Root $name)) | Out-Null }
    $secure=$null
    $secret = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
    try {
        $secure = ConvertTo-SecureString $secret -AsPlainText -Force
        [IO.File]::WriteAllText((Join-Path $Root 'signing-secret.dpapi'), (ConvertFrom-SecureString $secure))
    } finally { $secret=$null; if ($secure) { $secure.Dispose() } }
    $receipt = @{ revision=1; ownerSid=$identity.Value; root=$Root; repo=$script:LocalRepo; database='deeplearner-local-demo'; replicaSet='deeplearner-local'; port=27018;
        node=$Executables.Node; mongo=$Executables.Mongo; nodeHash=$Executables.NodeHash; mongoHash=$Executables.MongoHash; state='PREPARING'; id=[guid]::NewGuid().ToString('N') }
    Write-LocalJson (Join-Path $Root 'ownership.json') $receipt
}
function Read-ConfirmedPassword([string]$Label) {
    $first=Read-Host "$Label password (10-128 characters)" -AsSecureString
    $second=Read-Host 'Confirm password' -AsSecureString
    $a=[IntPtr]::Zero; $b=[IntPtr]::Zero
    try {
        $a=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($first); $b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($second)
        $text=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($a)
        if ($text.Length -lt 10 -or $text.Length -gt 128 -or $text -cne [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b)) { throw 'Password length/confirmation failed.' }
        return $text
    } finally {
        if ($a -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($a) }
        if ($b -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
        $first.Dispose();$second.Dispose()
    }
}
function Invoke-LocalRun {
    param([ValidateSet('Start','Initialize','Accounts','Content')][string]$Mode='Start', [switch]$ApprovedLocalWrite, [switch]$NoAdmin, [string]$Manifest, [string]$ManifestSha256)
    if ($Mode -ne 'Start' -and -not $ApprovedLocalWrite) { throw 'Explicit -ApprovedLocalWrite required for this operation.' }
    $root=Get-LocalRoot; $exe=Get-LocalExecutables
    Assert-FreePorts @(27018,3000,4000,5173)
    if ($Mode -eq 'Initialize') { New-LocalOwnership $root $exe }
    $receipt=Read-LocalOwnership $root $exe -AllowPreparing:($Mode -eq 'Initialize')
    if ($Mode -eq 'Initialize' -and @(Get-ChildItem -Force -LiteralPath (Join-Path $root 'mongodb')).Count) { throw 'Initial MongoDB directory must be empty.' }
    $lock=$null; $owner=$null; $mongo=$null; $apps=@(); $failed=$false; $forced=$false; $shutdownCode=$null; $run=$null; $records=[Collections.Generic.List[object]]::new()
    try {
        $lock=[IO.File]::Open((Join-Path $root 'owner.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
        if (-not ('DeepLearnerLocal.Owner' -as [type])) { Add-Type -Path (Join-Path $script:LocalScripts 'LocalProcessOwner.cs') }
        $owner=[DeepLearnerLocal.Owner]::new()
        $runId=[guid]::NewGuid().ToString('N'); $run=Join-Path $root "runs/$runId"
        [IO.Directory]::CreateDirectory($run) | Out-Null
        $self=Get-Process -Id $PID
        $active=@{ runId=$runId; run=$run; ownerPid=$PID; ownerStart=$self.StartTime.ToUniversalTime().ToString('o'); ownerPath=$self.Path; root=$root; repo=$script:LocalRepo; active=$true }
        Write-LocalJson (Join-Path $root 'active.json') $active
        $environment=Get-LocalEnvironment
        $tool=Join-Path $script:LocalRepo 'apps/api/scripts/local-tools.ts'
        function Start-Owned([string]$Label,[string]$Executable,[string[]]$Arguments,$Environment) {
            $logName=[guid]::NewGuid().ToString('N')
            $child=$owner.Start($Label,$Executable,$Arguments,$script:LocalRepo,$Environment,(Join-Path $run "$Label-$logName.out.log"),(Join-Path $run "$Label-$logName.err.log"))
            $records.Add($child);return $child
        }
        function Wait-Owned($Child,[int]$Seconds) {
            $clock=[Diagnostics.Stopwatch]::StartNew()
            while (-not $Child.Wait(100)) {
                Assert-Continue
                if ($clock.Elapsed.TotalSeconds -ge $Seconds) { throw 'Owned helper timeout; inspect sanitized run logs.' }
            }
            if ($Child.ExitCode -ne 0) { throw 'Owned helper failed; inspect sanitized run logs.' }
        }
        function Assert-Continue {
            if (Test-Path -LiteralPath (Join-Path $run 'stop.request')) { throw 'Stop requested during startup; cleanup required.' }
        }
        function Wait-Listener([int]$Port,$Child,[int]$Seconds) {
            $clock=[Diagnostics.Stopwatch]::StartNew()
            while ($clock.Elapsed.TotalSeconds -lt $Seconds) {
                Assert-Continue
                if ($Child.HasExited) { throw 'Service exited before readiness.' }
                $listeners=@(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object LocalPort -eq $Port)
                if ($listeners.Count) {
                    foreach ($listener in $listeners) { if ($listener.LocalAddress -ne '127.0.0.1' -or -not $owner.Owns([uint32]$listener.OwningProcess)) { throw 'Listener ownership/binding mismatch.' } }
                    return
                }
                Start-Sleep -Milliseconds 200
            }
            throw 'Listener readiness timeout.'
        }
        function Wait-Http([string]$Url,$Child,[int]$Seconds) {
            $clock=[Diagnostics.Stopwatch]::StartNew()
            while ($clock.Elapsed.TotalSeconds -lt $Seconds) {
                Assert-Continue
                if ($Child.HasExited) { throw 'Application exited before readiness.' }
                try { $response=Invoke-WebRequest -Uri $Url -NoProxy -TimeoutSec 2 -MaximumRedirection 0; if ($response.StatusCode -eq 200) { return } } catch { }
                Start-Sleep -Milliseconds 200
            }
            throw 'HTTP readiness timeout.'
        }
        $mongo=Start-Owned 'mongodb' $exe.Mongo @('--bind_ip','127.0.0.1','--port','27018','--replSet','deeplearner-local','--dbpath',(Join-Path $root 'mongodb'),'--logpath',(Join-Path $run 'mongodb.log')) $environment
        Wait-Listener 27018 $mongo 15
        $operation=if ($Mode -eq 'Initialize') {'initialize'} else {'check'}
        $check=Start-Owned $operation $exe.Node @('--import','tsx',$tool,$operation,$root,[string]$mongo.Id) $environment
        Wait-Owned $check 60
        if ($Mode -eq 'Initialize') {
            $receipt.state='INITIALIZED'; Write-LocalJson (Join-Path $root 'ownership.json') $receipt
            Write-Host 'Local replica set and declared indexes initialized. No users/content created.'
        } elseif ($Mode -eq 'Accounts') {
            $passwords=@{student=(Read-ConfirmedPassword 'Premium Demo Student');admin=(Read-ConfirmedPassword 'Demo Admin')}
            try {
                $child=Start-Owned 'accounts' $exe.Node @('--import','tsx',$tool,'accounts',$root,[string]$mongo.Id) $environment
                $child.Send(($passwords | ConvertTo-Json -Compress)); Wait-Owned $child 30
            } finally { $passwords.student='';$passwords.admin='' }
            Write-Host 'Demo accounts processed insert-only. See safe CREATED/UNCHANGED results in the run log.'
        } elseif ($Mode -eq 'Content') {
            if (-not $Manifest -or $ManifestSha256 -notmatch '^[A-Fa-f0-9]{64}$' -or (Get-FileHash -LiteralPath $Manifest).Hash -ne $ManifestSha256) { throw 'Explicit approved manifest and matching SHA-256 required.' }
            $child=Start-Owned 'content' $exe.Node @('--import','tsx',$tool,'content',$root,[string]$mongo.Id,([IO.Path]::GetFullPath($Manifest)),$ManifestSha256) $environment
            Wait-Owned $child 60
            Write-Host 'Approved content transaction completed.'
        } else {
            foreach ($package in @('shared-types','validation')) {
                $build=Start-Owned "build-$package" $exe.Node @((Join-Path $script:LocalRepo 'node_modules/typescript/bin/tsc'),'-p',(Join-Path $script:LocalRepo "packages/$package/tsconfig.json")) $environment
                Wait-Owned $build 60
            }
            $secure=ConvertTo-SecureString ([IO.File]::ReadAllText((Join-Path $root 'signing-secret.dpapi')))
            $pointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
            $apiEnvironment=$null
            try {
                $apiEnvironment=Get-LocalEnvironment -Api -Secret ([Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer))
                $api=Start-Owned 'api' $exe.Node @('--import','tsx',$tool,'service',$root,'api') $apiEnvironment
                $apps+= $api
            } finally { if($apiEnvironment){$apiEnvironment.Clear()};[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer);$secure.Dispose() }
            Wait-Listener 4000 $api 30; Wait-Http 'http://127.0.0.1:4000/api/v1/health' $api 30
            $web=Start-Owned 'web' $exe.Node @('--import','tsx',$tool,'service',$root,'web') $environment; $apps+=$web
            Wait-Listener 3000 $web 120; Wait-Http 'http://127.0.0.1:3000/login' $web 120
            if (-not $NoAdmin) {
                $admin=Start-Owned 'admin' $exe.Node @('--import','tsx',$tool,'service',$root,'admin') $environment; $apps+=$admin
                Wait-Listener 5173 $admin 30; Wait-Http 'http://127.0.0.1:5173' $admin 30
            }
            Write-Host 'READY: Student http://127.0.0.1:3000/login | API http://127.0.0.1:4000/api/v1'
            if (-not $NoAdmin) { Write-Host 'Admin http://127.0.0.1:5173 (existing placeholder UI)' }
            Write-Host 'Demo emails: demo.student@deeplearner.test / demo.admin@deeplearner.test (separate provisioning required).'
            Write-Host 'Use Stop-DeepLearner.ps1 from another PowerShell window. Keep this owner window open.'
            while (-not (Test-Path -LiteralPath (Join-Path $run 'stop.request'))) {
                if ($mongo.HasExited -or @($apps | Where-Object HasExited).Count) { throw 'Owned service exited unexpectedly.' }
                Start-Sleep -Milliseconds 250
            }
            if ([IO.File]::ReadAllText((Join-Path $run 'stop.request')) -ne $runId) { throw 'Stop request identity mismatch.' }
        }
    } catch { $failed=$true; Write-Warning 'Local operation failed; evidence preserved. No automatic repair/retry.'; throw }
    finally {
      try {
        if ($owner) {
            try {
                foreach ($app in $apps) { if (-not $app.HasExited) { try {$app.Send('STOP')} catch {$failed=$true} } }
                foreach ($app in $apps) { if (-not $app.Wait(15000) -or $app.ExitCode -ne 0) { $failed=$true } }
                if ($mongo -and -not $mongo.HasExited) {
                    try {
                        $shutdown=Start-Owned 'shutdown' $exe.Node @('--import','tsx',$tool,'shutdown',$root,[string]$mongo.Id) $environment
                        if ($shutdown.Wait(15000)) { $shutdownCode=$shutdown.ExitCode; if ($shutdownCode -ne 0) { $failed=$true } } else { $failed=$true }
                        if (-not $mongo.Wait(15000)) { $failed=$true }
                    } catch { $failed=$true }
                }
                if ($owner.ActiveCount -gt 0) { $forced=$true;$failed=$true;$owner.ForceStop() }
                $empty=$owner.WaitEmpty(5000)
                if (-not $empty) { $failed=$true }
                $exits=@($records | ForEach-Object { @{label=$_.Label;exit=$(if($_.HasExited){$_.ExitCode}else{$null})} })
                if ($mongo -and (-not $mongo.HasExited -or $mongo.ExitCode -ne 0)) { $failed=$true }
                $remaining=@(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object {$_.LocalPort -in 27018,3000,4000,5173})
                $released=$remaining.Count -eq 0
                if (-not $released) { $failed=$true }
                Write-LocalJson (Join-Path $run 'result.json') @{success=(!$failed);shutdownMode=$(if($forced){'FORCED_CONTAINMENT'}elseif($failed){'FAILED'}else{'GRACEFUL'});forcedContainment=$forced;jobEmpty=$empty;portsReleased=$released;shutdownHelperExit=$shutdownCode;processes=$exits}
                $active.active=$false;Write-LocalJson (Join-Path $root 'active.json') $active
                Write-Host "Cleanup: job empty=$empty; ports released=$released; forced containment=$forced; data preserved. Results: $run"
            } finally { $owner.Dispose() }
        }
      } finally { if ($lock) { $lock.Dispose() } }
    }
    if ($failed) { throw 'Cleanup incomplete or non-graceful; review retained result before restarting.' }
}

if ($MyInvocation.InvocationName -ne '.') { Invoke-LocalRun -NoAdmin:$NoAdmin }
