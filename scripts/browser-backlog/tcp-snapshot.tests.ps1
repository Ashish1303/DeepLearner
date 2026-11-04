# Pure parser controls plus read-only comparison against Windows' existing collector.
# No listeners, connections, or child processes are created by this script.
#Requires -Version 7.5
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
Add-Type -Path (Join-Path $PSScriptRoot 'TcpSnapshot.cs')
$checks=0
function Refused($bytes,$ipv6){
    try{$null=[DeepLearnerQa.TcpSnapshot]::Parse($bytes,$ipv6);throw 'EXPECTED_REFUSAL'}catch{if($_.Exception.GetBaseException().Message -notmatch '^QA_TCP_'){throw}}
    $script:checks++
}
foreach($ipv6 in @($false,$true)){
    $row=[byte[]]::new($(if($ipv6){60}else{28}))
    [BitConverter]::GetBytes([uint32]1).CopyTo($row,0)
    $start=4; $port=$start+$(if($ipv6){20}else{8}); $state=$start+$(if($ipv6){48}else{0}); $pidOffset=$start+$(if($ipv6){52}else{20})
    [BitConverter]::GetBytes([uint32]2).CopyTo($row,$state)
    [BitConverter]::GetBytes([uint32]123).CopyTo($row,$pidOffset)
    $row[$port]=36; $row[$port+1]=65 # 9281 in network byte order
    if($ipv6){$row[19]=1}else{$row[8]=127;$row[11]=1}
    $parsed=[DeepLearnerQa.TcpSnapshot]::Parse($row,$ipv6)
    if($parsed.Count -ne 1 -or $parsed[0].LocalPort -ne 9281 -or $parsed[0].OwningProcess -ne 123 -or $parsed[0].LocalAddress -ne $(if($ipv6){'::1'}else{'127.0.0.1'})){throw 'PARSER_RESULT_INVALID'}
    $checks++
    $bad=$row.Clone();$bad[$state]=1;Refused $bad $ipv6
    $bad=$row.Clone();[Array]::Clear($bad,$pidOffset,4);Refused $bad $ipv6
    $bad=$row.Clone();[Array]::Clear($bad,$port,4);Refused $bad $ipv6
    $bad=$row.Clone();$bad[0]=2;Refused $bad $ipv6
    Refused ([byte[]]::new(3)) $ipv6
}
$timer=[Diagnostics.Stopwatch]::StartNew();$native=[DeepLearnerQa.TcpSnapshot]::Read();$timer.Stop();$nativeMs=$timer.ElapsedMilliseconds
$timer.Restart();$cim=Get-NetTCPConnection -State Listen;$timer.Stop();$cimMs=$timer.ElapsedMilliseconds
# Compare only the task's isolated ports. Metadata alone never proves ownership.
$ports=@(3101,4101,5181,9281)
$a=@($native|Where-Object LocalPort -In $ports|ForEach-Object{"$($_.LocalAddress):$($_.LocalPort):$($_.OwningProcess)"}|Sort-Object)
$b=@($cim|Where-Object LocalPort -In $ports|ForEach-Object{"$($_.LocalAddress):$($_.LocalPort):$($_.OwningProcess)"}|Sort-Object)
if(($a -join '|') -cne ($b -join '|')){throw 'QA_COLLECTOR_COMPARISON_FAILED'}
[pscustomobject]@{ParserChecks=$checks;NativeMs=$nativeMs;CimMs=$cimMs;QaRowsCompared=$a.Count;Agreement=$true}|ConvertTo-Json -Compress
