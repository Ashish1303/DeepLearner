# Inert tests of the actual per-file Job lifecycle; no native/process APIs.
#Requires -Version 7.5
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$t=$null;$e=$null
$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot '../Test-BrowserBacklog.ps1'),[ref]$t,[ref]$e)
if($e.Count){throw 'PARSE_FAILED'}
$definition=$ast.Find({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Invoke-FileJob'},$true)
if($null -eq $definition){throw 'ACTUAL_FUNCTION_MISSING'}
. ([ScriptBlock]::Create($definition.Extent.Text))
$repo='synthetic';$run=$PSScriptRoot;$node='synthetic-node';$envMap=@{}
$children=[Collections.Generic.List[object]]::new()
function New-FileOwner {if($script:fault -eq 'CREATION'){throw 'QA_SYNTHETIC_CREATION'};return $script:fake}
function Assert-Child($child,$exe,$authority){if($authority -ne $script:fake){throw 'WRONG_AUTHORITY'};if($script:fault -eq 'IDENTITY'){throw 'QA_SYNTHETIC_IDENTITY'}}
function Wait-Node($child,$limit,[switch]$AllowBrowserExit){if($limit -ne 600000){throw 'DEADLINE_CHANGED'};if($script:fault -eq 'WAIT'){throw 'QA_SYNTHETIC_WAIT'};return $script:exitCode}
function Save-Json($path,$value){$script:evidence=$value}
$checks=0
foreach($fault in @('NONE','TEST_FAIL','CREATION','START','IDENTITY','WAIT','LIVE_WORKER','CONTAINMENT','HANDLES','DISPOSE')) {
    $script:fault=$fault;$script:exitCode=$(if($fault -eq 'TEST_FAIL'){1}else{0});$script:forced=$false;$script:disposed=$false;$script:evidence=$null
    $script:child=[pscustomobject]@{HandlesClosed=$false}
    $script:fake=[pscustomobject]@{}
    $fake|Add-Member ScriptMethod Start {param($label,$exe,$arguments,$cwd,$env,$out,$err)if($script:fault -eq 'START'){throw 'QA_SYNTHETIC_START'};return $script:child}
    $fake|Add-Member ScriptMethod WaitEmpty {param($ms)if($ms -ne 5000){throw 'CLEANUP_DEADLINE_CHANGED'};return ($script:fault -notin @('LIVE_WORKER','CONTAINMENT') -or $script:forced)}
    $fake|Add-Member ScriptMethod ForceStop {$script:forced=$true;if($script:fault -eq 'CONTAINMENT'){throw 'QA_SYNTHETIC_CONTAINMENT'}}
    $fake|Add-Member ScriptMethod Dispose {$script:disposed=$true;if($script:fault -eq 'DISPOSE'){throw 'QA_SYNTHETIC_DISPOSE'};if($script:fault -ne 'HANDLES'){$script:child.HandlesClosed=$true}}
    $failed=$false;try{$code=Invoke-FileJob 'student' 'synthetic' @('inert')}catch{$failed=$true}
    $expectedFailure=$fault -notin @('NONE','TEST_FAIL')
    if($failed -ne $expectedFailure -or ($fault -ne 'CREATION' -and -not $script:disposed) -or $null -eq $script:evidence){throw "LIFECYCLE_CONTROL_FAILED_$fault"}
    if(-not $failed){if($code -ne $script:exitCode -or -not $evidence.normalCleanup -or $evidence.forcedContainment -or -not $evidence.emptyJob -or -not $evidence.handlesClosed){throw 'NORMAL_RESULT_INVALID'}}
    elseif($fault -notin @('CREATION','HANDLES','DISPOSE') -and (-not $forced -or $evidence.normalCleanup)){throw 'FAILURE_CONTAINMENT_INVALID'}
    if($failed -and $evidence.normalCleanup){throw 'INCOMPLETE_CLEANUP_REPORTED_NORMAL'}
    $checks++
}
Write-Output "QA_FILE_JOB_CONTROLS_PASS=$checks"
