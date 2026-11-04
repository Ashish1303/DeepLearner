# Actual guard/finally bodies with inert doubles; no power/process/network APIs.
#Requires -Version 7.5
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$t=$null;$e=$null
$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot '../Test-BrowserBacklog.ps1'),[ref]$t,[ref]$e)
if($e.Count){throw 'PARSE_FAILED'}
$wait=$ast.Find({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Wait-Node'},$true)
. ([ScriptBlock]::Create($wait.Extent.Text))
function Assert-ExecutionAvailable {throw 'QA_AC_POWER_REQUIRED'}
function Publish-Proof {throw 'PROOF_MUST_NOT_RUN_AFTER_AC_LOSS'}
$script:browser=$null
try{Wait-Node ([pscustomobject]@{HasExited=$false}) 1000;throw 'AC_LOSS_ACCEPTED'}catch{if($_.Exception.Message -ne 'QA_AC_POWER_REQUIRED'){throw}}
$main=@($ast.EndBlock.Statements|Where-Object {$_ -is [Management.Automation.Language.TryStatementAst]})
if($main.Count -ne 1 -or $null -eq $main[0].Finally){throw 'MAIN_FINALLY_MISSING'}
$body=$main[0].Finally.Extent.Text.Trim();$body=$body.Substring(1,$body.Length-2)
$cleanup=$true;$powerReleased=$false
$owner=[pscustomobject]@{};$owner|Add-Member ScriptMethod Dispose {throw 'QA_SYNTHETIC_OWNER_DISPOSE'}
$powerScope=[pscustomobject]@{Released=$false};$powerScope|Add-Member ScriptMethod Dispose {$this.Released=$true}
try{. ([ScriptBlock]::Create($body));throw 'OWNER_FAILURE_LOST'}catch{if($_.Exception.GetBaseException().Message -ne 'QA_SYNTHETIC_OWNER_DISPOSE'){throw}}
if(-not $powerScope.Released -or -not $powerReleased){throw 'POWER_RELEASE_SKIPPED'}
Write-Output 'QA_EXECUTION_AVAILABILITY_CONTROLS_PASS=2'
