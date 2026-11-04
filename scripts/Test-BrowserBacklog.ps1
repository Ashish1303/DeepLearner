#Requires -Version 7.5
[CmdletBinding()]
param([switch]$QualificationOnly,[ValidateSet('all','student','admin')][string]$Project='all',[string]$Spec='')
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Set-Location -LiteralPath $repo
if (-not $IsWindows -or ([Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'QA_UNELEVATED_WINDOWS_REQUIRED' }
$sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
if ($sid -ne 'S-1-5-21-3436178198-164699745-524212520-1001') { throw 'QA_OWNER_REFUSED' }
if ((git branch --show-current) -ne 'qa/f044-browser-backlog') { throw 'QA_BRANCH_REFUSED' }
foreach ($dir in @($repo, (Join-Path $repo 'apps/web'), (Join-Path $repo 'apps/admin'))) {
    if (Get-ChildItem -LiteralPath $dir -Force | Where-Object { ($_.Name -eq '.env' -or $_.Name.StartsWith('.env.')) -and $_.Name -ne '.env.example' }) { throw 'QA_PRIVATE_ENV_REFUSED' }
}
$node = (Get-Command node.exe -ErrorAction Stop).Source
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
if (-not (Test-Path -LiteralPath $chrome -PathType Leaf)) { throw 'QA_CHROME_MISSING' }
if ((Get-AuthenticodeSignature -LiteralPath $chrome).Status -ne 'Valid') { throw 'QA_CHROME_SIGNATURE_REFUSED' }
$ports = @(3101, 4101, 5181, 9281)
Add-Type -Path (Join-Path $PSScriptRoot 'browser-backlog/TcpSnapshot.cs')
function Get-QaListeners { [DeepLearnerQa.TcpSnapshot]::Read() }
if (Get-QaListeners | Where-Object LocalPort -In $ports) { throw 'QA_PORT_CONFLICT' }
$run = Join-Path $repo ('.cache/browser-backlog/' + [guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($run) | Out-Null
$envMap = [Collections.Generic.Dictionary[string,string]]::new([StringComparer]::OrdinalIgnoreCase)
foreach ($name in @('TEMP','TMP','USERPROFILE','LOCALAPPDATA','APPDATA')) { $value=[Environment]::GetEnvironmentVariable($name); if($value){$envMap[$name]=$value} }
$windows=[Environment]::GetFolderPath('Windows')
$envMap['SystemRoot']=$windows; $envMap['WINDIR']=$windows
$envMap['PATH']=([IO.Path]::GetDirectoryName($node),(Join-Path $windows 'System32'),$windows) -join ';'
$envMap['NODE_ENV']='production'; $envMap['NEXT_TELEMETRY_DISABLED']='1'; $envMap['NO_COLOR']='1'
$envMap['NEXT_PUBLIC_API_BASE_URL']='http://127.0.0.1:4000/api/v1'
$envMap['VITE_API_BASE_URL']='http://127.0.0.1:4000/api/v1'
$envMap['DEEPLEARNER_BROWSER_FIXTURE']='1'
$envMap['QA_BROWSER_OUTPUT']=$run
$owner=$null;$powerScope=$null;$powerReleased=$false
$children=[Collections.Generic.List[object]]::new()
$script:browser=$null; $script:nonce=$null; $script:creation=$null
$server=$null; $cleanup=$false; $forcedContainment=$false; $failure=$null; $failureDetails=$null; $codes=@{}; $script:stage='PREFLIGHT'
$pinPaths=@('scripts/LocalProcessOwner.cs','scripts/Test-BrowserBacklog.ps1','playwright.backlog.config.ts','playwright.config.ts','tsconfig.browser.json','package-lock.json')
$pinPaths+=@('node_modules/playwright-core/lib/coreBundle.js','node_modules/playwright/lib/runner/index.js')
$pinPaths+=@(git ls-files apps/web apps/admin packages tsconfig.base.json package.json)
$pinPaths+=@(Get-ChildItem -LiteralPath (Join-Path $repo 'tests/browser'),(Join-Path $repo 'scripts/browser-backlog') -File | ForEach-Object { [IO.Path]::GetRelativePath($repo,$_.FullName).Replace('\','/') })
$pins=[ordered]@{}
foreach($p in ($pinPaths | Sort-Object -Unique)){ $pins[$p]=(Get-FileHash -LiteralPath (Join-Path $repo $p) -Algorithm SHA256).Hash.ToLowerInvariant() }
function Save-Json($Path,$Value){ $text=$Value|ConvertTo-Json -Depth 12; [IO.File]::WriteAllText($Path,$text,[Text.UTF8Encoding]::new($false)) }
function Read-SharedLog([string]$Path){
    $stream=[IO.FileStream]::new($Path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::ReadWrite)
    $reader=[IO.StreamReader]::new($stream)
    try{return $reader.ReadToEnd()}finally{$reader.Dispose()}
}
function Assert-Pins { foreach($p in $pins.Keys){if((Get-FileHash -LiteralPath (Join-Path $repo $p) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $pins[$p]){throw 'QA_SOURCE_DRIFT'}} }
function Assert-Child($child,$exe,$Authority=$owner){
    $facts=$Authority.Observe($child)
    if(-not $facts.Live -or -not $facts.RetainedJob -or -not $facts.IndependentJob -or $facts.Filetime -ne $facts.IndependentFiletime -or $facts.Executable -ine $exe){throw 'QA_RETAINED_IDENTITY_REFUSED'}
    return $facts
}
function Assert-Servers {
    $null=Assert-Child $server $node
    $allListeners=@(Get-QaListeners)
    foreach($p in $(if($QualificationOnly){@(4101)}else{@(3101,4101,5181)})){
        $serverListeners=@($allListeners|Where-Object LocalPort -EQ $p)
        if(-not $serverListeners.Count){throw 'QA_SERVER_LISTENER_MISSING'}
        foreach($l in $serverListeners){if($l.LocalAddress -ne '127.0.0.1' -or $l.OwningProcess -ne $server.Id -or -not $owner.Owns([uint32]$l.OwningProcess)){throw 'QA_SERVER_LISTENER_UNOWNED'}}
    }
    return $allListeners
}
function Assert-ExecutionAvailable { [DeepLearnerQa.ExecutionScope]::RequireAc() }
function Publish-Proof([switch]$AllowClosing) {
    Assert-ExecutionAvailable
    # Server failures are outside the close-race exception and can never be waived.
    $allListeners=@(Assert-Servers)
    if($AllowClosing -and (Test-ExpectedClose)){return}
    try {
        if($null -eq $script:browser -or $script:browser.HasExited){throw 'QA_BROWSER_EXITED'}
        $f=Assert-Child $script:browser $chrome
        $ls=@($allListeners|Where-Object LocalPort -EQ 9281)
        if(-not $ls.Count){throw 'QA_CDP_LISTENER_MISSING'}
        foreach($l in $ls){if($l.LocalAddress -notin @('127.0.0.1','::1') -or $l.OwningProcess -ne $script:browser.Id -or -not $owner.Owns([uint32]$l.OwningProcess)){throw 'QA_CDP_LISTENER_UNOWNED'}}
    } catch {
        $code=$_.Exception.GetBaseException().Message
        if($AllowClosing -and $code -in @('QA_CDP_LISTENER_MISSING','QA_BROWSER_EXITED','QA_RETAINED_IDENTITY_REFUSED') -and (Test-ExpectedClose)){return}
        throw
    }
    Save-Json (Join-Path $run 'live.next.json') @{nonce=$script:nonce;chromePid=[int]$script:browser.Id;creation=$script:creation;owned=$true;time=[DateTimeOffset]::UtcNow.ToString('o')}
    [IO.File]::Move((Join-Path $run 'live.next.json'),(Join-Path $run 'live.json'),$true)
}
function Start-Node([string]$label,[string[]]$arguments){
    $c=$owner.Start($label,$node,$arguments,$repo,$envMap,(Join-Path $run "$label.out.log"),(Join-Path $run "$label.err.log"))
    $children.Add($c); $null=Assert-Child $c $node; return $c
}
function Test-ExpectedClose {
    $file=$envMap['QA_BROWSER_LEASE']+'.close.json'
    if(-not(Test-Path -LiteralPath $file)){return $false}
    if((Get-Item -LiteralPath $file).Length -gt 1024){throw 'QA_CLOSE_INTENT_REFUSED'}
    $intent=Get-Content -LiteralPath $file -Raw|ConvertFrom-Json -AsHashtable -DateKind String
    if($intent.Count -ne 5 -or $intent.action -ne 'CLOSE_OWNED_BROWSER' -or $intent.nonce -ne $script:nonce -or $intent.chromePid -ne $script:browser.Id -or $intent.creation -cne $script:creation){throw 'QA_CLOSE_INTENT_REFUSED'}
    $age=([DateTimeOffset]::UtcNow-[DateTimeOffset]::Parse($intent.time,[Globalization.CultureInfo]::InvariantCulture)).TotalMilliseconds
    if($age -lt -250 -or $age -gt 10000){throw 'QA_BROWSER_CLOSURE_DEADLINE'}
    $remaining=@(Get-QaListeners|Where-Object LocalPort -EQ 9281)
    foreach($l in $remaining){if($l.LocalAddress -notin @('127.0.0.1','::1') -or $l.OwningProcess -ne $script:browser.Id -or -not $owner.Owns([uint32]$l.OwningProcess)){throw 'QA_CDP_LISTENER_UNOWNED'}}
    if($script:browser.HasExited){if($script:browser.ExitCode -ne 0){throw 'QA_BROWSER_EXIT_FAILED'}}else{
        # A consumed close intent grants no new connection/startup authority.
        # Image metadata can disappear before the retained exit handle signals.
        # Require current Job membership while live, then retained zero exit;
        # final retained Wait/empty-Job/handle/port proofs remain mandatory.
        if(-not $owner.Owns([uint32]$script:browser.Id)){
            if(-not $script:browser.HasExited){throw 'QA_RETAINED_IDENTITY_REFUSED'}
            if($script:browser.ExitCode -ne 0){throw 'QA_BROWSER_EXIT_FAILED'}
        }
    }
    return $true
}
function Wait-Node($child,[int]$limit,[switch]$AllowBrowserExit){
    $timer=[Diagnostics.Stopwatch]::StartNew()
    while(-not $child.HasExited){
        Assert-ExecutionAvailable
        if($timer.ElapsedMilliseconds -gt $limit){throw 'QA_CHILD_DEADLINE'}
        if($null -ne $script:browser){Publish-Proof -AllowClosing:$AllowBrowserExit}
        Start-Sleep -Milliseconds 100
    }
    return [int]$child.ExitCode
}
function Start-Browser {
    if(Get-QaListeners | Where-Object LocalPort -EQ 9281){throw 'QA_CDP_LISTENER_CONFLICT'}
    $browserProfile=Join-Path $run ('chrome-'+[guid]::NewGuid().ToString('N'))
    $browserArguments=@('--headless=new','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-default-apps','--disable-sync','--metrics-recording-only','--password-store=basic','--remote-debugging-port=9281','--remote-debugging-address=127.0.0.1',"--user-data-dir=$browserProfile",'--proxy-server=http://127.0.0.1:4101','--proxy-bypass-list=<-loopback>;127.0.0.1:3101;127.0.0.1:5181','about:blank')
    $script:browser=$owner.Start('chrome',$chrome,$browserArguments,$repo,$envMap,(Join-Path $run ('chrome-'+$children.Count+'.out.log')),(Join-Path $run ('chrome-'+$children.Count+'.err.log')))
    $children.Add($script:browser); $f=Assert-Child $script:browser $chrome
    $script:creation=$f.Filetime.ToString([Globalization.CultureInfo]::InvariantCulture); $script:nonce=[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLowerInvariant()
    $timer=[Diagnostics.Stopwatch]::StartNew(); $version=$null
    while($null -eq $version){
        Assert-ExecutionAvailable
        if($timer.ElapsedMilliseconds -gt 15000){throw 'QA_BROWSER_STARTUP_DEADLINE'}
        $null=Assert-Child $script:browser $chrome
        $listeners=@(Get-QaListeners | Where-Object LocalPort -EQ 9281)
        foreach($l in $listeners){if($l.LocalAddress -notin @('127.0.0.1','::1') -or $l.OwningProcess -ne $script:browser.Id -or -not $owner.Owns([uint32]$l.OwningProcess)){throw 'QA_CDP_LISTENER_UNOWNED'}}
        if($listeners.Count){$version=Invoke-RestMethod -Uri 'http://127.0.0.1:9281/json/version' -TimeoutSec 3}
        if($null -eq $version){Start-Sleep -Milliseconds 100}
    }
    if($version.webSocketDebuggerUrl -notmatch '^ws://127\.0\.0\.1:9281/devtools/browser/[a-f0-9-]+$'){throw 'QA_CDP_ENDPOINT_REFUSED'}
    $lease=Join-Path $run ('lease-'+[guid]::NewGuid().ToString('N')+'.json')
    Save-Json $lease @{revision=1;repo=$repo;nonce=$script:nonce;chromePid=[int]$script:browser.Id;creation=$script:creation;endpoint=$version.webSocketDebuggerUrl;sources=$pins;ownerSid=$sid}
    $envMap['QA_BROWSER_LEASE']=$lease; $envMap['QA_BROWSER_NONCE']=$script:nonce
    Publish-Proof
}
function Run-Tests([string]$phase,[string]$label,[string]$file=''){
    $script:stage="TEST_$($phase.ToUpperInvariant())"
    Assert-Pins; Publish-Proof
    $envMap['QA_BROWSER_PHASE']=$phase
    $arguments=@('node_modules/@playwright/test/cli.js','test','--config=playwright.backlog.config.ts',"--project=$phase",'--workers=1','--retries=0')
    if($file){$arguments+="tests/browser/$file"}
    $code=Invoke-FileJob $phase $label $arguments
    Assert-Pins
    return $code
}
function New-FileOwner { [DeepLearnerLocal.Owner]::new() }
function Invoke-FileJob([string]$phase,[string]$label,[string[]]$arguments) {
    $fileOwner=$null;$child=$null;$normal=$false;$forced=$false;$empty=$false;$fileFailure=$null;$containmentFailed=$false;$code=$null
    try {
        # CLI/workers get their own existing native Job. Chrome sandbox children
        # need no image inspection to prove this separate worker Job is empty.
        $fileOwner=New-FileOwner
        $child=$fileOwner.Start($label,$node,$arguments,$repo,$envMap,(Join-Path $run "$label.out.log"),(Join-Path $run "$label.err.log"))
        $children.Add($child);$null=Assert-Child $child $node $fileOwner
        $code=Wait-Node $child 600000 -AllowBrowserExit:($phase -eq 'qualification')
        $empty=$fileOwner.WaitEmpty(5000)
        if(-not $empty){throw 'QA_FILE_JOB_NOT_EMPTY'}
        $normal=$true
    } catch {
        $fileFailure=$_.Exception.GetBaseException().GetType().Name
        throw
    } finally {
        try {
            if(-not $normal -and $null -ne $fileOwner){$forced=$true;$fileOwner.ForceStop();$empty=$fileOwner.WaitEmpty(5000)}
        } catch {$containmentFailed=$true}
        finally {if($null -ne $fileOwner){try{$fileOwner.Dispose()}catch{$containmentFailed=$true;if($null -eq $fileFailure){$fileFailure='DISPOSE_FAILED'}}}}
        $closed=$null -eq $child -or $child.HandlesClosed
        Save-Json (Join-Path $run "$label-job.json") @{cliExitCode=$code;normalCleanup=($normal -and $empty -and $closed -and -not $containmentFailed);forcedContainment=$forced;emptyJob=$empty;handlesClosed=$closed;failureType=$fileFailure;containmentFailed=$containmentFailed}
        if($containmentFailed -or -not $empty -or -not $closed){throw 'QA_FILE_CLEANUP_NOT_PROVEN'}
    }
    # Test assertion failures remain failures; safe independent files may continue
    # only after this CLI has exited and its entire native Job is proved empty.
    return $code
}
try {
    $script:stage='EXECUTION_AVAILABILITY'
    Add-Type -Path (Join-Path $PSScriptRoot 'browser-backlog/ExecutionScope.cs')
    $powerScope=[DeepLearnerQa.ExecutionScope]::new()
    Add-Type -Path (Join-Path $PSScriptRoot 'LocalProcessOwner.cs')
    $owner=[DeepLearnerLocal.Owner]::new()
    $script:stage='NATIVE_QUALIFICATION'
    # Actual retained-handle positive proof and a negative query of this unowned parent.
    $probe=Start-Node 'native-probe' @('-e',"process.stdin.once('data',()=>process.exit(0))")
    $native=Assert-Child $probe $node
    if($owner.Owns([uint32]$PID)){throw 'QA_FOREIGN_PROCESS_ACCEPTED'}
    $probe.Send('STOP'); if((Wait-Node $probe 5000) -ne 0 -or -not $owner.WaitEmpty(5000)){throw 'QA_NATIVE_QUALIFICATION_FAILED'}
    Save-Json (Join-Path $run 'native-qualification.json') @{positiveRetainedJob=$native.RetainedJob;positiveIndependentJob=$native.IndependentJob;unownedParentRefused=$true;exit=0;emptyJob=$true;ownerSid=$sid;nodeSha256=(Get-FileHash -LiteralPath $node).Hash;chromeSha256=(Get-FileHash -LiteralPath $chrome).Hash}
    $script:stage='INSTALLED_SAFETY_PROBE'
    $patchProbe=Start-Node 'installed-safety-probe' @('scripts/browser-backlog/patch-playwright.mjs','--verify')
    if((Wait-Node $patchProbe 5000) -ne 0){throw 'QA_INSTALLED_PLAYWRIGHT_NOT_QUALIFIED'}
    if(-not $QualificationOnly){
        foreach($step in @(@('build-types','node_modules/typescript/bin/tsc','-p','packages/shared-types/tsconfig.json'),@('build-validation','node_modules/typescript/bin/tsc','-p','packages/validation/tsconfig.json'),@('build-web','node_modules/next/dist/bin/next','build','apps/web'),@('build-admin','node_modules/vite/bin/vite.js','build','apps/admin'))){
            $script:stage=$step[0].ToUpperInvariant().Replace('-','_')
            $c=Start-Node $step[0] $step[1..($step.Count-1)]; if((Wait-Node $c 120000) -ne 0){throw 'QA_BUILD_FAILED'}
        }
    } else { $envMap['QA_CANARY_ONLY']='1' }
    $script:stage='SERVERS'
    $server=Start-Node 'servers' @('scripts/browser-backlog/servers.mjs')
    $timer=[Diagnostics.Stopwatch]::StartNew(); $ready=$false
    while(-not $ready){
        Assert-ExecutionAvailable
        if($server.HasExited -or $timer.ElapsedMilliseconds -gt 120000){throw 'QA_SERVERS_NOT_READY'}
        $ready=(Test-Path -LiteralPath (Join-Path $run 'servers.out.log')) -and (Read-SharedLog (Join-Path $run 'servers.out.log')).Contains('QA_SERVERS_READY')
        if(-not $ready){Start-Sleep -Milliseconds 100}
    }
    foreach($p in $(if($QualificationOnly){@(4101)}else{@(3101,4101,5181)})){
        $ls=@(Get-QaListeners | Where-Object LocalPort -EQ $p)
        if(-not $ls.Count){throw 'QA_SERVER_LISTENER_MISSING'}
        foreach($l in $ls){if($l.LocalAddress -ne '127.0.0.1' -or -not $owner.Owns([uint32]$l.OwningProcess)){throw 'QA_SERVER_LISTENER_UNOWNED'}}
    }
    Start-Browser
    $envMap['QA_BROWSER_OUTPUT']=Join-Path $run 'qualification'; [IO.Directory]::CreateDirectory($envMap['QA_BROWSER_OUTPUT'])|Out-Null
    $qual=Run-Tests 'qualification' 'qualifier'
    if($qual -ne 0 -or -not $script:browser.Wait(5000) -or $script:browser.ExitCode -ne 0){throw 'QA_BROWSER_QUALIFICATION_FAILED'}
    $script:browser=$null
    if(-not $QualificationOnly){
        Start-Browser
        foreach($phase in @('admin','student')){
            if($Project -ne 'all' -and $Project -ne $phase){continue}
            $files=@(Get-ChildItem -LiteralPath (Join-Path $repo 'tests/browser') -Filter '*.spec.ts' -File | Where-Object { $_.Name -ne 'chrome-smoke.spec.ts' -and ($_.Name.StartsWith('admin-') -eq ($phase -eq 'admin')) } | Sort-Object Name)
            if($Spec){$files=@($files|Where-Object Name -EQ $Spec);if(-not $files.Count){throw 'QA_SPEC_NOT_IN_PROJECT'}}
            foreach($file in $files){
                $label="$phase-$($file.BaseName)"; $envMap['QA_BROWSER_OUTPUT']=Join-Path $run $label; [IO.Directory]::CreateDirectory($envMap['QA_BROWSER_OUTPUT'])|Out-Null
                $codes[$label]=Run-Tests $phase "tests-$label" $file.Name
            }
        }
        $envMap['QA_BROWSER_OUTPUT']=Join-Path $run 'final-qualification'; [IO.Directory]::CreateDirectory($envMap['QA_BROWSER_OUTPUT'])|Out-Null
        $codes['qualification']=Run-Tests 'qualification' 'tests-qualification'
        if(-not $script:browser.Wait(5000) -or $script:browser.ExitCode -ne 0){throw 'QA_BROWSER_EXIT_NOT_PROVEN'}
        $script:browser=$null
    }
    $stats=Invoke-RestMethod -Uri 'http://127.0.0.1:4101/qa/stats' -TimeoutSec 3
    Save-Json (Join-Path $run 'network.json') $stats
    if($stats.apiFallthrough -ne 0 -or $stats.directProbes -ne 0 -or $stats.proxyProbes -lt $(if($QualificationOnly){1}else{2})){throw 'QA_NETWORK_QUALIFICATION_FAILED'}
    $script:stage='NORMAL_CLEANUP'
    $server.Send('STOP'); if((Wait-Node $server 5000) -ne 0){throw 'QA_SERVER_SHUTDOWN_FAILED'}
    if(-not $owner.WaitEmpty(5000)){throw 'QA_JOB_NOT_EMPTY'}
    Assert-Pins; $cleanup=$true
} catch {
    $base=$_.Exception.GetBaseException(); $failure=$base.Message
    if($failure -notmatch '^QA_[A-Z_]+$'){$failure='QA_RUNTIME_FAILED'}
    $operation='UNKNOWN'; if($base.Message -cmatch '^([A-Z][A-Z_]+)(?:\b|:)'){$operation=$Matches[1]}
    $nativeCode=$null; if($base -is [ComponentModel.Win32Exception]){$nativeCode=$base.NativeErrorCode}
    if($base -is [IO.IOException] -and ($base.HResult -band 0xFFFF0000) -eq 0x80070000){$nativeCode=$base.HResult -band 0xFFFF}
    $failureDetails=@{stage=$script:stage;type=$base.GetType().Name;operation=$operation;nativeError=$nativeCode;hresult=('0x'+$base.HResult.ToString('X8'));line=$_.InvocationInfo.ScriptLineNumber;stack=($_.ScriptStackTrace -replace [regex]::Escape($repo),'<qa>')}
}
finally {
    try {
        if($null -ne $owner){
            if(-not $cleanup){ try{$forcedContainment=$true;$owner.ForceStop();$null=$owner.WaitEmpty(5000)}catch{} }
            $owner.Dispose()
        }
    } finally {
        if($null -ne $powerScope){$powerScope.Dispose();$powerReleased=$powerScope.Released}else{$powerReleased=$true}
    }
    if(-not $powerReleased){$cleanup=$false;$failure='QA_POWER_RELEASE_NOT_PROVEN'}
    $closed=@($children|Where-Object{-not $_.HandlesClosed}).Count -eq 0
    $releaseTimer=[Diagnostics.Stopwatch]::StartNew()
    do{$released=@(Get-QaListeners|Where-Object LocalPort -In $ports).Count -eq 0;if(-not $released){Start-Sleep -Milliseconds 100}}while(-not $released -and $releaseTimer.ElapsedMilliseconds -lt 5000)
    Save-Json (Join-Path $run 'closeout.json') @{failure=$failure;details=$failureDetails;normalCleanup=$cleanup;forcedContainment=$forcedContainment;handlesClosed=$closed;portsReleased=$released;powerRequestReleased=$powerReleased;testExitCodes=$codes;sourcePins=$pins;run=$run}
    Write-Output "QA_OUTPUT=$run"
    if(-not $cleanup -or -not $closed -or -not $released -or $codes.Values.Where({$_ -ne 0}).Count){exit 1}
}
