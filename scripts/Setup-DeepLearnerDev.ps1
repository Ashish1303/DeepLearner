#Requires -Version 7.0
[CmdletBinding()]
param([ValidateSet('Plan','PrepareStorage','InstallService','StartService','StopService','InitializeReplica')][string]$Action='Plan')

. "$PSScriptRoot/Start-DeepLearnerDev.ps1"

function Assert-DevMongoExecutionPolicy {
    # No CLI flag/profile/receipt activates this policy. A separately reviewed source
    # amendment and particular execution approval are required before this can change.
    throw 'DEV_PERSISTENT_POLICY_NOT_ACTIVE'
}

function Assert-DevMongoAuthenticatedBootstrap {
    # A fresh authenticated service must not be left with an unqualified bootstrap
    # window. Starting and initializing remain unavailable until that contract exists.
    throw 'DEV_MONGO_AUTHENTICATED_BOOTSTRAP_REQUIRED'
}

function Get-DevMongoPlan {
    $root='C:\Users\Shreeji\AppData\Local\DeepLearner\dev'
    $plan=[ordered]@{
        revision=1; policy='PROPOSED / NOT ACTIVE'; executable='C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe'
        binaryVersion='8.2.7'; binarySha256='89C1F5664DA621A6AD8A0B26DF880BAC8265BFA921F430520A1DB158CAF2F8FE'
        host='127.0.0.1'; port=27019; replicaSet='deeplearner-dev-rs'; member='localhost:27019'; database='deeplearner-dev'
        root=$root; storage=(Join-Path $root 'mongodb'); control=(Join-Path $root 'mongo-control'); logs=(Join-Path $root 'mongo-logs')
        configuration=(Join-Path $root 'mongo-control/mongod.cfg'); keyFile=(Join-Path $root 'mongo-control/replica.key')
        receipt=(Join-Path $root 'mongo-control/ownership.json'); serviceReceipt=(Join-Path $root 'mongo-control/service-registration.json'); operationLock=(Join-Path $root 'mongo-control/lifecycle.lock'); logFile=(Join-Path $root 'mongo-logs/mongod.log')
        serviceName='DeepLearnerDevMongo27019'; serviceAccount='NT SERVICE\DeepLearnerDevMongo27019'; serviceSid='S-1-5-80-2447178277-443755655-1194985995-2441376728-635657853'; startup='Manual'
    }
    return $plan
}

function Assert-DevMongoPlan($Plan) {
    $expected=Get-DevMongoPlan
    if ($Plan.Count -ne $expected.Count) { throw 'DEV_MONGO_TARGET_REJECTED' }
    foreach ($key in $expected.Keys) {
        if (-not $Plan.Contains($key) -or [string]$Plan[$key] -cne [string]$expected[$key]) { throw 'DEV_MONGO_TARGET_REJECTED' }
    }
}

function Get-DevMongoConfiguration($Plan) {
    Assert-DevMongoPlan $Plan
    $storage=$Plan.storage | ConvertTo-Json -Compress
    $log=$Plan.logFile | ConvertTo-Json -Compress
    $key=$Plan.keyFile | ConvertTo-Json -Compress
    return "storage:`n  dbPath: $storage`nsystemLog:`n  destination: file`n  logAppend: true`n  path: $log`nnet:`n  bindIp: 127.0.0.1`n  port: 27019`nreplication:`n  replSetName: deeplearner-dev-rs`nsecurity:`n  authorization: enabled`n  keyFile: $key`n"
}

function ConvertFrom-DevMongoListeners([string[]]$Lines) {
    $rows=@($Lines | ForEach-Object {
        $columns=$_.Trim() -split '\s+'
        if ($_ -match '^\s*TCP\s+\S*:27019(?:\s|$)' -and ($columns.Count -ne 5 -or $columns[-1] -notmatch '^[0-9]+$' -or $columns[3] -notin @('LISTENING','ESTABLISHED','TIME_WAIT','CLOSE_WAIT','FIN_WAIT_1','FIN_WAIT_2','CLOSING','LAST_ACK','SYN_SENT','SYN_RECEIVED','DELETE_TCB','CLOSED'))) { throw 'DEV_MONGO_PORT_UNKNOWN' }
        if ($columns.Count -eq 5 -and $columns[0] -eq 'TCP') { [pscustomobject]@{local=$columns[1]; state=$columns[3]; processId=$columns[4]} }
    })
    if (-not @($rows | Where-Object state -EQ 'LISTENING').Count -and -not (($Lines -join "`n") -match 'Local Address\s+Foreign Address\s+State')) { throw 'DEV_MONGO_PORT_UNKNOWN' }
    return @($rows | Where-Object { $_.local -match ':27019$' })
}

function Get-DevMongoPortRows {
    $command=Join-Path ([Environment]::GetFolderPath('System')) 'netstat.exe'
    $lines=@(& $command -ano)
    if ($LASTEXITCODE -ne 0) { throw 'DEV_MONGO_PORT_UNKNOWN' }
    return @(ConvertFrom-DevMongoListeners $lines)
}

function Assert-DevMongoPortFree {
    if (@(Get-DevMongoPortRows).Count) { throw 'DEV_MONGO_PORT_OCCUPIED' }
}

function Assert-DevMongoBinary($Plan) {
    Assert-DevMongoPlan $Plan
    Assert-DevPath $Plan.executable
    $file=Get-Item -LiteralPath $Plan.executable
    if ($file.VersionInfo.FileVersion.Trim() -ne $Plan.binaryVersion -or (Get-FileHash -LiteralPath $Plan.executable -Algorithm SHA256).Hash -ne $Plan.binarySha256) { throw 'DEV_MONGO_BINARY_CHANGED' }
}

function Get-DevMongoAcl([string]$Kind, [bool]$File=$false) {
    $acl=$(if($File){[Security.AccessControl.FileSecurity]::new()}else{[Security.AccessControl.DirectorySecurity]::new()})
    $acl.SetAccessRuleProtection($true,$false)
    $current=[Security.Principal.WindowsIdentity]::GetCurrent().User
    $acl.SetOwner($current)
    $inherit=$(if($File){[Security.AccessControl.InheritanceFlags]::None}else{[Security.AccessControl.InheritanceFlags]'ContainerInherit,ObjectInherit'})
    foreach ($sid in @($current.Value,'S-1-5-18','S-1-5-32-544')) {
        $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($sid),'FullControl',$inherit,'None','Allow'))
    }
    if ($Kind -ne 'OwnerOnly') {
        $rights=switch($Kind){'Traverse'{'Traverse'} 'Read'{if($File){'Read'}else{'ReadAndExecute'}} 'Modify'{'Modify'} default{throw 'DEV_MONGO_ACL_KIND_REJECTED'}}
        $serviceInheritance=$(if($Kind -eq 'Traverse'){[Security.AccessControl.InheritanceFlags]::None}else{$inherit})
        $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new((Get-DevMongoPlan).serviceSid),$rights,$serviceInheritance,'None','Allow'))
    }
    return $acl
}

function Import-DevMongoAtomicDirectory {
    if ('DeepLearnerMongoIO' -as [type]) { return }
    Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
public static class DeepLearnerMongoIO {
    [StructLayout(LayoutKind.Sequential)] struct Security { public int Length; public IntPtr Descriptor; public int Inherit; }
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, ExactSpelling=true, SetLastError=true)]
    static extern bool CreateDirectoryW(string path, ref Security security);
    public static void CreateExclusive(string path, byte[] descriptor) {
        var pinned=GCHandle.Alloc(descriptor,GCHandleType.Pinned);
        try {
            var security=new Security {Length=Marshal.SizeOf<Security>(),Descriptor=pinned.AddrOfPinnedObject(),Inherit=0};
            if(!CreateDirectoryW(path,ref security)) throw new Win32Exception(Marshal.GetLastWin32Error(),"DEV_MONGO_EXCLUSIVE_CREATE_FAILED");
        } finally { pinned.Free(); }
    }
}
'@
}

function New-DevMongoDirectory([string]$Path,[string]$Kind) {
    $plan=Get-DevMongoPlan
    $expected=if($Path -ceq $plan.root){'Traverse'}elseif($Path -ceq $plan.storage -or $Path -ceq $plan.logs){'Modify'}elseif($Path -ceq $plan.control){'Read'}else{throw 'DEV_MONGO_TARGET_REJECTED'}
    if ($Kind -cne $expected) { throw 'DEV_MONGO_TARGET_REJECTED' }
    Assert-DevMongoExecutionPolicy
    Assert-DevPath $Path
    if (Test-Path -LiteralPath $Path) { throw 'DEV_MONGO_EXISTING_STORAGE_REFUSED' }
    Import-DevMongoAtomicDirectory
    [DeepLearnerMongoIO]::CreateExclusive($Path,(Get-DevMongoAcl $Kind).GetSecurityDescriptorBinaryForm())
}

function Write-DevMongoPrivateFile([string]$Path,[byte[]]$Bytes,[string]$Kind) {
    $plan=Get-DevMongoPlan
    $expected=if($Path -ceq $plan.keyFile -or $Path -ceq $plan.configuration){'Read'}elseif($Path -ceq $plan.receipt -or $Path -ceq $plan.serviceReceipt -or $Path -ceq $plan.operationLock){'OwnerOnly'}else{throw 'DEV_MONGO_TARGET_REJECTED'}
    if ($Kind -cne $expected) { throw 'DEV_MONGO_TARGET_REJECTED' }
    Assert-DevMongoExecutionPolicy
    Assert-DevPath $Path
    $stream=[IO.FileSystemAclExtensions]::Create([IO.FileInfo]::new($Path),[IO.FileMode]::CreateNew,[Security.AccessControl.FileSystemRights]::Write,[IO.FileShare]::Read,4096,[IO.FileOptions]::None,(Get-DevMongoAcl $Kind $true))
    try { $stream.Write($Bytes,0,$Bytes.Length); $stream.Flush($true) } finally { $stream.Dispose() }
}

function Get-DevMongoService($Plan) {
    Assert-DevMongoPlan $Plan
    $key='HKLM:\SYSTEM\CurrentControlSet\Services\' + $Plan.serviceName
    if (-not (Test-Path -LiteralPath $key)) { return $null }
    $entry=Get-ItemProperty -LiteralPath $key
    $registration=Read-DevJson $Plan.serviceReceipt
    if ($registration.revision -ne 1 -or $registration.ownerSid -ne [Security.Principal.WindowsIdentity]::GetCurrent().User.Value -or $registration.target -cne ($Plan | ConvertTo-Json -Compress -Depth 5)) { throw 'DEV_MONGO_UNKNOWN_SERVICE' }
    if ((Get-Acl -LiteralPath $Plan.serviceReceipt).GetSecurityDescriptorSddlForm('Access,Owner') -cne (Get-DevMongoAcl 'OwnerOnly' $true).GetSecurityDescriptorSddlForm('Access,Owner')) { throw 'DEV_MONGO_PRIVATE_ACL_MISMATCH' }
    $expected='"' + $Plan.executable + '" --config "' + $Plan.configuration + '" --service'
    if ($entry.ImagePath -cne $expected -or $entry.ObjectName -ne $Plan.serviceAccount -or $entry.Start -ne 3) { throw 'DEV_MONGO_UNKNOWN_SERVICE' }
    return Get-Service -Name $Plan.serviceName -ErrorAction Stop
}

function Assert-DevMongoPrepared($Plan) {
    Assert-DevMongoPlan $Plan; Assert-DevMongoBinary $Plan
    foreach ($path in @($Plan.root,$Plan.storage,$Plan.control,$Plan.logs,$Plan.configuration,$Plan.keyFile,$Plan.receipt)) { Assert-DevPath $path }
    $record=Read-DevJson $Plan.receipt
    $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    if ($record.revision -ne 1 -or $record.ownerSid -ne $sid -or $record.target -ne ($Plan | ConvertTo-Json -Compress -Depth 5)) { throw 'DEV_MONGO_RECEIPT_MISMATCH' }
    foreach ($path in @($Plan.root,$Plan.storage,$Plan.control,$Plan.logs,$Plan.configuration,$Plan.keyFile,$Plan.receipt)) {
        $acl=Get-Acl -LiteralPath $path
        $kind=if($path -eq $Plan.root){'Traverse'}elseif($path -eq $Plan.storage -or $path -eq $Plan.logs){'Modify'}elseif($path -eq $Plan.receipt){'OwnerOnly'}else{'Read'}
        $expected=Get-DevMongoAcl $kind (Test-Path -LiteralPath $path -PathType Leaf)
        if ($acl.GetSecurityDescriptorSddlForm('Access,Owner') -cne $expected.GetSecurityDescriptorSddlForm('Access,Owner')) { throw 'DEV_MONGO_PRIVATE_ACL_MISMATCH' }
    }
    if ([IO.File]::ReadAllText($Plan.configuration) -cne (Get-DevMongoConfiguration $Plan) -or (Get-FileHash -LiteralPath $Plan.keyFile).Hash -ne $record.keyHash) { throw 'DEV_MONGO_PRIVATE_CONFIGURATION_CHANGED' }
}

function Assert-DevMongoRunningIdentity($Plan,$Service) {
    Assert-DevMongoPrepared $Plan
    $Service.Refresh()
    if ($Service.ServiceName -ne $Plan.serviceName -or $Service.Status -ne 'Running') { throw 'DEV_MONGO_SERVICE_NOT_RUNNING' }
    $sc=Join-Path ([Environment]::GetFolderPath('System')) 'sc.exe'
    $status=@(& $sc queryex $Plan.serviceName)
    if ($LASTEXITCODE -ne 0) { throw 'DEV_MONGO_SERVICE_IDENTITY_UNKNOWN' }
    $matches=@($status | Where-Object { $_ -match '^\s*PID\s*:\s*([0-9]+)\s*$' })
    if ($matches.Count -ne 1) { throw 'DEV_MONGO_SERVICE_IDENTITY_UNKNOWN' }
    $serviceProcessId=[int]([regex]::Match($matches[0],'[0-9]+').Value)
    Assert-DevMongoListenerRows @(Get-DevMongoPortRows) $serviceProcessId
    $process=Get-Process -Id $serviceProcessId -ErrorAction Stop
    try { if ($process.Path -ne $Plan.executable) { throw 'DEV_MONGO_SERVICE_IDENTITY_UNKNOWN' } }
    finally { $process.Dispose() }
}

function Assert-DevMongoListenerRows([object[]]$Rows,[int]$ExpectedProcessId) {
    $listeners=@($Rows | Where-Object state -EQ 'LISTENING')
    if ($ExpectedProcessId -le 0 -or $listeners.Count -ne 1 -or $listeners[0].local -ne '127.0.0.1:27019' -or [int]$listeners[0].processId -ne $ExpectedProcessId) { throw 'DEV_MONGO_LISTENER_IDENTITY_UNKNOWN' }
}

function Assert-DevMongoParentAcl($Acl,[string]$CurrentSid) {
    if ($Acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $CurrentSid) { throw 'DEV_MONGO_PARENT_OWNER_MISMATCH' }
    $trusted=@($CurrentSid,'S-1-5-18','S-1-5-32-544')
    $write=([long][Security.AccessControl.FileSystemRights]'Write,Delete,DeleteSubdirectoriesAndFiles,ChangePermissions,TakeOwnership') -bor 0x10000000 -bor 0x40000000
    foreach ($rule in $Acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])) {
        if ($rule.AccessControlType -eq 'Allow' -and -not ($rule.PropagationFlags -band [Security.AccessControl.PropagationFlags]::InheritOnly) -and
            $rule.IdentityReference.Value -notin $trusted -and (([long]$rule.FileSystemRights -band 4294967295L) -band $write)) { throw 'DEV_MONGO_PARENT_SHARED_WRITE_REFUSED' }
    }
}

function Invoke-DevMongoPrepare($Plan) {
    Assert-DevMongoExecutionPolicy
    Assert-DevMongoPlan $Plan; Assert-DevMongoBinary $Plan; Assert-DevMongoPortFree
    $existing=Get-DevMongoService $Plan
    if ($existing) { $existing.Dispose(); throw 'DEV_MONGO_EXISTING_SERVICE_REFUSED' }
    $normal=Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'DeepLearner/dev'
    if ([IO.Path]::GetFullPath($normal) -ne $Plan.root) { throw 'DEV_MONGO_OWNER_ROOT_MISMATCH' }
    Assert-DevPath $Plan.root
    $parent=Get-Acl -LiteralPath ([IO.Path]::GetDirectoryName($Plan.root))
    Assert-DevMongoParentAcl $parent ([Security.Principal.WindowsIdentity]::GetCurrent().User.Value)
    if (Test-Path -LiteralPath $Plan.root) { throw 'DEV_MONGO_EXISTING_STORAGE_REFUSED' }
    # One insert-only attempt. On partial failure, preserve state and require review;
    # never delete, roll back, overwrite, adopt, repair or retry automatically.
    New-DevMongoDirectory $Plan.root 'Traverse'
    New-DevMongoDirectory $Plan.storage 'Modify'; New-DevMongoDirectory $Plan.control 'Read'; New-DevMongoDirectory $Plan.logs 'Modify'
    $keyBytes=$null; $keyTextBytes=$null
    try {
        $keyBytes=[Security.Cryptography.RandomNumberGenerator]::GetBytes(756)
        $keyTextBytes=[Text.Encoding]::UTF8.GetBytes([Convert]::ToBase64String($keyBytes))
        Write-DevMongoPrivateFile $Plan.keyFile $keyTextBytes 'Read'
        Write-DevMongoPrivateFile $Plan.configuration ([Text.Encoding]::UTF8.GetBytes((Get-DevMongoConfiguration $Plan))) 'Read'
        $record=@{revision=1; ownerSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value; target=($Plan | ConvertTo-Json -Compress -Depth 5); keyHash=(Get-FileHash -LiteralPath $Plan.keyFile).Hash}
        Write-DevMongoPrivateFile $Plan.receipt ([Text.Encoding]::UTF8.GetBytes(($record | ConvertTo-Json -Compress))) 'OwnerOnly'
    } finally {
        if ($keyBytes) { [Array]::Clear($keyBytes,0,$keyBytes.Length) }
        if ($keyTextBytes) { [Array]::Clear($keyTextBytes,0,$keyTextBytes.Length) }
    }
}

function Invoke-DevMongoInstall($Plan) {
    Assert-DevMongoExecutionPolicy
    Assert-DevMongoPrepared $Plan; Assert-DevMongoPortFree
    $existing=Get-DevMongoService $Plan
    if ($existing) { $existing.Dispose(); throw 'DEV_MONGO_EXISTING_SERVICE_REFUSED' }
    $principal=[Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'DEV_MONGO_SEPARATE_ADMIN_INSTALL_REQUIRED' }
    $command='"' + $Plan.executable + '" --config "' + $Plan.configuration + '" --service'
    $empty=[Security.SecureString]::new()
    try { New-Service -Name $Plan.serviceName -BinaryPathName $command -StartupType Manual -Credential ([Management.Automation.PSCredential]::new($Plan.serviceAccount,$empty)) | Out-Null }
    finally { $empty.Dispose() }
    $registration=@{revision=1; ownerSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value; target=($Plan | ConvertTo-Json -Compress -Depth 5)}
    Write-DevMongoPrivateFile $Plan.serviceReceipt ([Text.Encoding]::UTF8.GetBytes(($registration | ConvertTo-Json -Compress))) 'OwnerOnly'
}

function Invoke-DevMongoStart($Plan) {
    Assert-DevMongoExecutionPolicy
    Assert-DevMongoAuthenticatedBootstrap
    Assert-DevMongoPrepared $Plan
    $service=Get-DevMongoService $Plan
    if (-not $service) { throw 'DEV_MONGO_SERVICE_NOT_INSTALLED' }
    try {
        if ($service.Status -eq 'Running') { Assert-DevMongoRunningIdentity $Plan $service; return }
        if ($service.Status -ne 'Stopped') { throw 'DEV_MONGO_SERVICE_STATE_UNKNOWN' }
        Assert-DevMongoPortFree; $service.Start(); $service.WaitForStatus('Running',[timespan]::FromSeconds(30))
        Assert-DevMongoRunningIdentity $Plan $service
    } finally { $service.Dispose() }
}

function Invoke-DevMongoStop($Plan) {
    Assert-DevMongoExecutionPolicy
    Assert-DevMongoPrepared $Plan
    $service=Get-DevMongoService $Plan
    if (-not $service) { throw 'DEV_MONGO_SERVICE_NOT_INSTALLED' }
    try {
        if ($service.Status -eq 'Stopped') { Assert-DevMongoPortFree; return }
        Assert-DevMongoRunningIdentity $Plan $service
        $service.Stop(); $service.WaitForStatus('Stopped',[timespan]::FromSeconds(30)); Assert-DevMongoPortFree
    } finally { $service.Dispose() }
}

function Invoke-DevMongoInitialize($Plan) {
    Assert-DevMongoExecutionPolicy
    Assert-DevMongoPlan $Plan
    # A pre-connection PID/receipt snapshot cannot bind an unauthenticated write
    # to that endpoint. Do not add a localhost-exception execution shortcut.
    Assert-DevMongoAuthenticatedBootstrap
}

function Open-DevMongoLifecycleLock($Plan) {
    Assert-DevMongoExecutionPolicy
    Assert-DevMongoPrepared $Plan
    Assert-DevPath $Plan.operationLock
    if (-not (Test-Path -LiteralPath $Plan.operationLock)) { Write-DevMongoPrivateFile $Plan.operationLock ([byte[]]::new(0)) 'OwnerOnly' }
    if ((Get-Acl -LiteralPath $Plan.operationLock).GetSecurityDescriptorSddlForm('Access,Owner') -cne (Get-DevMongoAcl 'OwnerOnly' $true).GetSecurityDescriptorSddlForm('Access,Owner')) { throw 'DEV_MONGO_PRIVATE_ACL_MISMATCH' }
    return [IO.File]::Open($Plan.operationLock,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
}

function Invoke-DevMongoSetup([string]$Operation='Plan') {
    $plan=Get-DevMongoPlan; Assert-DevMongoPlan $plan
    if ($Operation -eq 'Plan') { return [ordered]@{operation='PLAN_ONLY'; target=$plan; configurationTemplate=(Get-DevMongoConfiguration $plan); initialization=@{_id=$plan.replicaSet; members=@(@{_id=0; host=$plan.member})}; execution='REFUSED: policy inactive; no activation flag'; portQualification='RECHECK_REQUIRED before any future provisioning'; pending='Service/ACL/install/authenticated connection-bound bootstrap/account/index/profile approvals and runtime ownership/transaction qualification'} }
    if ($Operation -eq 'PrepareStorage') { Invoke-DevMongoPrepare $plan; return }
    if ($Operation -eq 'InitializeReplica') { Invoke-DevMongoInitialize $plan; return }
    if ($Operation -notin @('InstallService','StartService','StopService')) { throw 'DEV_MONGO_ACTION_REJECTED' }
    Assert-DevMongoExecutionPolicy
    $lock=Open-DevMongoLifecycleLock $plan
    try {
        switch ($Operation) {
            'InstallService' { Invoke-DevMongoInstall $plan }
            'StartService' { Invoke-DevMongoStart $plan }
            'StopService' { Invoke-DevMongoStop $plan }
        }
    } finally { $lock.Dispose() }
}

if ($MyInvocation.InvocationName -ne '.') {
    try { Invoke-DevMongoSetup $Action | ConvertTo-Json -Depth 8 }
    catch {
        $code=$_.Exception.Message
        if ($code -notmatch '^DEV_[A-Z_]+$') { $code='DEV_MONGO_OUTCOME_UNKNOWN_RECONCILE' }
        Write-Host "MongoDB setup refused: $code. No automatic retry/repair or fallback target."
        exit 1
    }
}
