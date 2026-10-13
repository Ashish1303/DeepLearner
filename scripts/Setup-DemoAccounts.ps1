#Requires -Version 7.0
[CmdletBinding()] param([switch]$ApprovedLocalWrite)
. "$PSScriptRoot/Start-DeepLearner.ps1"
Invoke-LocalRun -Mode Accounts -ApprovedLocalWrite:$ApprovedLocalWrite
