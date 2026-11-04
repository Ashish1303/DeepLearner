#Requires -Version 7.5
# Inert tests of the actual guard function: no browser, process or TCP operations.
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$tokens=$null; $errors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $repo 'scripts/Test-BrowserBacklog.ps1'),[ref]$tokens,[ref]$errors)
if($errors.Count){throw 'PARSE_FAILED'}
$definition=$ast.Find({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Test-ExpectedClose'},$true)
if($null -eq $definition){throw 'ACTUAL_FUNCTION_MISSING'}
. ([ScriptBlock]::Create($definition.Extent.Text))
$folder=Join-Path $repo ('.cache/browser-backlog/close-contract-'+[guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($folder)|Out-Null
$script:envMap=@{QA_BROWSER_LEASE=(Join-Path $folder 'lease.json')}
$script:browser=[pscustomobject]@{Id=123;HasExited=$false;ExitCode=0;Owned=$true}
$script:nonce='a'*64; $script:creation='123456789012345678'; $script:chrome='synthetic'
$script:listeners=@(); $script:membership=$true; $script:checks=0; $script:exitDuringRead=$false; $script:forbidImageQuery=$true
$owner=[pscustomobject]@{}
$owner|Add-Member ScriptMethod Owns {param($processId) if($script:exitDuringRead){$script:browser.HasExited=$true;return $false};return $script:membership}
function Get-QaListeners { return $script:listeners }
function Assert-ExecutionAvailable {}
function Assert-Child($child,$exe){if($script:forbidImageQuery){throw 'QA_CLOSE_IMAGE_QUERY_FORBIDDEN'};if(-not $child.Owned){throw 'QA_RETAINED_IDENTITY_REFUSED'};return @{Live=$true}}
function Write-Intent($changes=@{}) {
    $value=@{action='CLOSE_OWNED_BROWSER';nonce=$script:nonce;chromePid=123;creation=$script:creation;time=[DateTimeOffset]::UtcNow.ToString('o')}
    foreach($key in $changes.Keys){$value[$key]=$changes[$key]}
    [IO.File]::WriteAllText(($script:envMap.QA_BROWSER_LEASE+'.close.json'),($value|ConvertTo-Json),[Text.UTF8Encoding]::new($false))
}
function Expect-Refusal([scriptblock]$operation){
    $refused=$false
    try{&$operation}catch{if($_.Exception.Message -notmatch '^QA_(CLOSE_INTENT_REFUSED|BROWSER_CLOSURE_DEADLINE|CDP_LISTENER_UNOWNED|BROWSER_EXIT_FAILED|RETAINED_IDENTITY_REFUSED)$'){throw};$refused=$true}
    if(-not $refused){throw 'EXPECTED_REFUSAL'}
    $script:checks++
}
if(Test-ExpectedClose){throw 'MISSING_INTENT_ACCEPTED'}; $script:checks++
Write-Intent; if(-not(Test-ExpectedClose)){throw 'VALID_CLOSE_REFUSED'}; $script:checks++
foreach($change in @(@{nonce='b'*64},@{chromePid=124},@{creation='123456789012345679'},@{action='ADOPT_BROWSER'},@{extra=$true},@{time=[DateTimeOffset]::UtcNow.AddSeconds(-11).ToString('o')},@{time=[DateTimeOffset]::UtcNow.AddSeconds(1).ToString('o')})){
    Write-Intent $change; Expect-Refusal {Test-ExpectedClose}
}
Write-Intent; $script:listeners=@([pscustomobject]@{LocalAddress='127.0.0.1';LocalPort=9281;OwningProcess=123})
if(-not(Test-ExpectedClose)){throw 'OWNED_CLOSING_LISTENER_REFUSED'}; $script:checks++
$script:membership=$false; Expect-Refusal {Test-ExpectedClose}; $script:membership=$true
$script:listeners=@([pscustomobject]@{LocalAddress='127.0.0.1';LocalPort=9281;OwningProcess=124}); Expect-Refusal {Test-ExpectedClose}
$script:listeners=@(); $script:membership=$false; Expect-Refusal {Test-ExpectedClose}; $script:membership=$true
$script:browser.HasExited=$true; if(-not(Test-ExpectedClose)){throw 'CONFIRMED_ZERO_EXIT_REFUSED'}; $script:checks++
$script:browser.ExitCode=1; Expect-Refusal {Test-ExpectedClose}
$script:browser.HasExited=$false;$script:browser.ExitCode=0;$script:browser.Owned=$true;$script:exitDuringRead=$true
if(-not(Test-ExpectedClose)){throw 'CONFIRMED_EXIT_RACE_REFUSED'};$script:checks++
$script:browser.HasExited=$false;$script:browser.ExitCode=1;Expect-Refusal {Test-ExpectedClose}
$script:exitDuringRead=$false
Write-Output "QA_CLOSE_CONTRACT_PASS=$script:checks"
$script:forbidImageQuery=$false
$publish=$ast.Find({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Publish-Proof'},$true)
. ([ScriptBlock]::Create($publish.Extent.Text))
$script:serverFailure=$false
function Assert-Servers {if($script:serverFailure){throw 'QA_SERVER_LISTENER_UNOWNED'};return @()}
$script:browser.ExitCode=0; Write-Intent
Publish-Proof -AllowClosing
$script:serverFailure=$true
try{Publish-Proof -AllowClosing;throw 'SERVER_FAILURE_WAIVED'}catch{if($_.Exception.Message -ne 'QA_SERVER_LISTENER_UNOWNED'){throw}}
$script:serverFailure=$false; $envMap.QA_BROWSER_LEASE=Join-Path $folder 'missing.json'
try{Publish-Proof -AllowClosing;throw 'UNEXPECTED_EXIT_ACCEPTED'}catch{if($_.Exception.Message -ne 'QA_BROWSER_EXITED'){throw}}
Write-Output 'QA_PUBLISH_CLOSE_BOUNDARIES_PASS=3'
