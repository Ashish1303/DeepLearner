#Requires -Version 7.0
[CmdletBinding()]
param([ValidateSet('Plan','PrepareStorage','InstallService','StartService','StopService','InitializeReplica','BootstrapFirstUser')][string]$Action='Plan')

. "$PSScriptRoot/Start-DeepLearnerDev.ps1"

function Get-DevMongoSourcePolicy {
    # Literal source metadata, also read by the Node CLI; never a private profile.
    return @'
{"id":"DEV-PERSISTENT-27019","status":"PROPOSED / NOT ACTIVE","sourceVersion":1,"target":{"host":"127.0.0.1","port":27019,"replicaSet":"deeplearner-dev-rs","database":"deeplearner-dev","service":"DeepLearnerDevMongo27019"},"operations":["PrepareStorage","InstallService","StartService","StopService","BootstrapFirstUser"]}
'@ | ConvertFrom-Json -AsHashtable
}

# Pure comparison. Synthetic ACTIVE facts in tests cannot create a CLI context.
function Assert-DevMongoPolicyAgreement($Local,$Peer,[bool]$RequireActive=$true) {
    $expected=Get-DevMongoSourcePolicy
    foreach($value in @($Local,$Peer)) {
        if($null -eq $value -or $value.Count -ne $expected.Count -or $value.status -cnotin @('ACTIVE','PROPOSED / NOT ACTIVE')){throw 'DEV_MONGO_SOURCE_POLICY_MISMATCH'}
        foreach($key in @('id','sourceVersion')){if(($value[$key] | ConvertTo-Json -Compress) -cne ($expected[$key] | ConvertTo-Json -Compress)){throw 'DEV_MONGO_SOURCE_POLICY_MISMATCH'}}
        if($value.target.Count -ne $expected.target.Count){throw 'DEV_MONGO_SOURCE_POLICY_MISMATCH'}
        foreach($key in $expected.target.Keys){if(($value.target[$key] | ConvertTo-Json -Compress) -cne ($expected.target[$key] | ConvertTo-Json -Compress)){throw 'DEV_MONGO_SOURCE_POLICY_MISMATCH'}}
        if(($value.operations | ConvertTo-Json -Compress) -cne ($expected.operations | ConvertTo-Json -Compress)){throw 'DEV_MONGO_SOURCE_POLICY_MISMATCH'}
    }
    if($Local.status -cne $Peer.status){throw 'DEV_MONGO_SOURCE_POLICY_MISMATCH'}
    if($RequireActive -and $Local.status -cne 'ACTIVE'){throw 'DEV_PERSISTENT_POLICY_NOT_ACTIVE'}
}

function Assert-DevMongoInvocation($Context,[string[]]$AllowedActions,[string]$OwnerSid,[string]$FixedTarget) {
    # Pure facts check; this cannot issue or install an accepted context.
    if($null -eq $Context -or $Context.Count -ne 4 -or -not $Context.alive){throw 'DEV_MONGO_EXECUTION_CONTEXT_REQUIRED'}
    if($Context.action -cnotin $AllowedActions){throw 'DEV_MONGO_ACTION_REJECTED'}
    if($Context.target -cne $FixedTarget){throw 'DEV_MONGO_TARGET_REJECTED'}
    if($OwnerSid -cnotmatch '^S-1-5-21-(?:\d+-){2}\d+-\d+$' -or $Context.ownerSid -cne $OwnerSid){throw 'DEV_MONGO_OWNER_REJECTED'}
}

function Assert-DevMongoExecutionPolicy([string[]]$AllowedActions) {
    # The context-bearing replacement exists only inside the actual CLI try/finally.
    # Dot-source, public calls and caller-supplied objects can never construct it.
    if((Get-DevMongoSourcePolicy).status -cne 'ACTIVE'){throw 'DEV_PERSISTENT_POLICY_NOT_ACTIVE'}
    throw 'DEV_MONGO_EXECUTION_CONTEXT_REQUIRED'
}

function Assert-DevMongoAuthenticatedBootstrap {
    Assert-DevMongoExecutionPolicy -AllowedActions @('StartService')
    $plan=Get-DevMongoPlan
    Assert-DevMongoStage $plan 'complete' | Out-Null
    if ((Get-DevMongoConfigurationPhase $plan) -ne 'Normal') { throw 'DEV_MONGO_AUTHENTICATED_BOOTSTRAP_REQUIRED' }
}

function Get-DevMongoPlan {
    $root='C:\Users\Shreeji\AppData\Local\DeepLearner\dev'
    $plan=[ordered]@{
        revision=2; policy=(Get-DevMongoSourcePolicy).status; executable='C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe'
        binaryVersion='8.2.7'; binarySha256='89C1F5664DA621A6AD8A0B26DF880BAC8265BFA921F430520A1DB158CAF2F8FE'
        host='127.0.0.1'; port=27019; replicaSet='deeplearner-dev-rs'; member='localhost:27019'; database='deeplearner-dev'
        root=$root; storage=(Join-Path $root 'mongodb'); control=(Join-Path $root 'mongo-control'); logs=(Join-Path $root 'mongo-logs')
        configuration=(Join-Path $root 'mongo-control/mongod.cfg'); keyFile=(Join-Path $root 'mongo-control/replica.key')
        receipt=(Join-Path $root 'mongo-control/ownership.json'); serviceReceipt=(Join-Path $root 'mongo-control/service-registration.json'); operationLock=(Join-Path $root 'mongo-control/lifecycle.lock'); logFile=(Join-Path $root 'mongo-logs/mongod.log')
        serviceName='DeepLearnerDevMongo27019'; serviceAccount='NT SERVICE\DeepLearnerDevMongo27019'; serviceSid='S-1-5-80-2447178277-443755655-1194985995-2441376728-635657853'; startup='Manual'
        bootstrap=(Join-Path $root 'mongo-control/bootstrap'); ca=(Join-Path $root 'mongo-control/bootstrap/ca.crt'); caKey=(Join-Path $root 'mongo-control/bootstrap/ca-key.dpapi')
        serverCertificate=(Join-Path $root 'mongo-control/bootstrap/server.pem'); clientCertificate=(Join-Path $root 'mongo-control/bootstrap/client.pem')
        operatorSecret=(Join-Path $root 'mongo-control/bootstrap/operator-password.dpapi'); applicationSecret=(Join-Path $root 'mongodb-uri.dpapi')
        bootstrapManifest=(Join-Path $root 'mongo-control/bootstrap/bootstrap-plan.json'); nextConfiguration=(Join-Path $root 'mongo-control/mongod.next.cfg')
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

function Get-DevMongoConfiguration($Plan,[ValidateSet('Bootstrap','Normal')][string]$Phase='Bootstrap') {
    Assert-DevMongoPlan $Plan
    $storage=$Plan.storage | ConvertTo-Json -Compress
    $log=$Plan.logFile | ConvertTo-Json -Compress
    $key=$Plan.keyFile | ConvertTo-Json -Compress
    $transport=if($Phase -eq 'Bootstrap'){
        $certificate=$Plan.serverCertificate | ConvertTo-Json -Compress; $ca=$Plan.ca | ConvertTo-Json -Compress
        "  tls:`n    mode: requireTLS`n    certificateKeyFile: $certificate`n    CAFile: $ca`n    allowConnectionsWithoutCertificates: false`n    allowInvalidCertificates: false`n    allowInvalidHostnames: false`n    disabledProtocols: TLS1_0,TLS1_1`n"
    }else{"  tls:`n    mode: disabled`n"}
    $bypass=if($Phase -eq 'Bootstrap'){'true'}else{'false'}
    return "storage:`n  dbPath: $storage`nsystemLog:`n  destination: file`n  logAppend: true`n  path: $log`nnet:`n  bindIp: 127.0.0.1`n  port: 27019`n${transport}replication:`n  replSetName: deeplearner-dev-rs`nsecurity:`n  authorization: enabled`n  clusterAuthMode: keyFile`n  keyFile: $key`nsetParameter:`n  enableLocalhostAuthBypass: $bypass`n"
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
    $expected=if($Path -ceq $plan.root){'Traverse'}elseif($Path -ceq $plan.storage -or $Path -ceq $plan.logs){'Modify'}elseif($Path -ceq $plan.control -or $Path -ceq $plan.bootstrap){'Read'}else{throw 'DEV_MONGO_TARGET_REJECTED'}
    if ($Kind -cne $expected) { throw 'DEV_MONGO_TARGET_REJECTED' }
    Assert-DevMongoExecutionPolicy -AllowedActions @('PrepareStorage')
    Assert-DevPath $Path
    if (Test-Path -LiteralPath $Path) { throw 'DEV_MONGO_EXISTING_STORAGE_REFUSED' }
    Import-DevMongoAtomicDirectory
    [DeepLearnerMongoIO]::CreateExclusive($Path,(Get-DevMongoAcl $Kind).GetSecurityDescriptorBinaryForm())
}

function Get-DevMongoFileActions($Plan,[string]$Path) {
    Get-DevMongoPrivateFileKind $Plan $Path | Out-Null
    $allowed=@('PrepareStorage')
    if($Path -ceq $Plan.serviceReceipt){$allowed=@('InstallService')}
    elseif($Path -ceq $Plan.operationLock){$allowed=@('InstallService','StartService','StopService','BootstrapFirstUser')}
    elseif($Path -ceq $Plan.nextConfiguration -or $Path -cin @('initialize-intent','replica','administrator-intent','administrator','application-role-intent','application-role','application-user-intent','application','complete' | ForEach-Object {Get-DevMongoStagePath $Plan $_})){$allowed=@('BootstrapFirstUser')}
    return $allowed
}

function Write-DevMongoPrivateFile([string]$Path,[byte[]]$Bytes,[string]$Kind) {
    $plan=Get-DevMongoPlan
    $expected=Get-DevMongoPrivateFileKind $plan $Path
    if ($Kind -cne $expected) { throw 'DEV_MONGO_TARGET_REJECTED' }
    Assert-DevMongoExecutionPolicy -AllowedActions @(Get-DevMongoFileActions $plan $Path)
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
    if ($registration.revision -ne 2 -or $registration.ownerSid -ne [Security.Principal.WindowsIdentity]::GetCurrent().User.Value -or $registration.target -cne ($Plan | ConvertTo-Json -Compress -Depth 5)) { throw 'DEV_MONGO_UNKNOWN_SERVICE' }
    if ((Get-Acl -LiteralPath $Plan.serviceReceipt).GetSecurityDescriptorSddlForm('Access,Owner') -cne (Get-DevMongoAcl 'OwnerOnly' $true).GetSecurityDescriptorSddlForm('Access,Owner')) { throw 'DEV_MONGO_PRIVATE_ACL_MISMATCH' }
    $expected='"' + $Plan.executable + '" --config "' + $Plan.configuration + '" --service'
    if ($entry.ImagePath -cne $expected -or $entry.ObjectName -ne $Plan.serviceAccount -or $entry.Start -ne 3) { throw 'DEV_MONGO_UNKNOWN_SERVICE' }
    Assert-DevMongoApprovedServiceSecurity (Read-DevMongoServiceSecurity $Plan) ([Security.Principal.WindowsIdentity]::GetCurrent().User.Value)
    return Get-Service -Name $Plan.serviceName -ErrorAction Stop
}

function Assert-DevMongoPrepared($Plan) {
    Assert-DevMongoPlan $Plan; Assert-DevMongoBinary $Plan
    foreach ($path in @($Plan.root,$Plan.storage,$Plan.control,$Plan.logs,$Plan.configuration,$Plan.keyFile,$Plan.receipt)) { Assert-DevPath $path }
    $record=Read-DevJson $Plan.receipt
    $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    if ($record.revision -ne 2 -or $record.ownerSid -ne $sid -or $record.target -ne ($Plan | ConvertTo-Json -Compress -Depth 5)) { throw 'DEV_MONGO_RECEIPT_MISMATCH' }
    foreach ($path in @($Plan.root,$Plan.storage,$Plan.control,$Plan.logs,$Plan.configuration,$Plan.keyFile,$Plan.receipt)) {
        $acl=Get-Acl -LiteralPath $path
        $kind=if($path -eq $Plan.root){'Traverse'}elseif($path -eq $Plan.storage -or $path -eq $Plan.logs){'Modify'}elseif($path -eq $Plan.receipt){'OwnerOnly'}else{'Read'}
        $expected=Get-DevMongoAcl $kind (Test-Path -LiteralPath $path -PathType Leaf)
        if ($acl.GetSecurityDescriptorSddlForm('Access,Owner') -cne $expected.GetSecurityDescriptorSddlForm('Access,Owner')) { throw 'DEV_MONGO_PRIVATE_ACL_MISMATCH' }
    }
    Get-DevMongoConfigurationPhase $Plan | Out-Null
    if ((Get-FileHash -LiteralPath $Plan.keyFile).Hash -ne $record.keyHash) { throw 'DEV_MONGO_PRIVATE_CONFIGURATION_CHANGED' }
    Assert-DevMongoBootstrapArtifacts $Plan
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

function Get-DevMongoStagePath($Plan,[ValidateSet('initialize-intent','replica','administrator-intent','administrator','application-role-intent','application-role','application-user-intent','application','complete')][string]$Stage) {
    return Join-Path $Plan.bootstrap ($Stage + '.json')
}

function Get-DevMongoPrivateFileKind($Plan,[string]$Path) {
    if ($Path -cin @($Plan.keyFile,$Plan.configuration,$Plan.nextConfiguration,$Plan.ca,$Plan.serverCertificate)) { return 'Read' }
    $ownerFiles=@($Plan.receipt,$Plan.serviceReceipt,$Plan.operationLock,$Plan.caKey,$Plan.clientCertificate,$Plan.operatorSecret,$Plan.applicationSecret,$Plan.bootstrapManifest)
    foreach ($stage in @('initialize-intent','replica','administrator-intent','administrator','application-role-intent','application-role','application-user-intent','application','complete')) { $ownerFiles+=Get-DevMongoStagePath $Plan $stage }
    if ($Path -cin $ownerFiles) { return 'OwnerOnly' }
    throw 'DEV_MONGO_TARGET_REJECTED'
}

function Get-DevMongoConfigurationPhase($Plan) {
    Assert-DevMongoPlan $Plan
    Assert-DevPath $Plan.configuration
    return Get-DevMongoConfigurationPhaseFromText $Plan ([IO.File]::ReadAllText($Plan.configuration))
}

function Get-DevMongoConfigurationPhaseFromText($Plan,[string]$bytes) {
    Assert-DevMongoPlan $Plan
    if ($bytes -ceq (Get-DevMongoConfiguration $Plan 'Bootstrap')) { return 'Bootstrap' }
    if ($bytes -ceq (Get-DevMongoConfiguration $Plan 'Normal')) { return 'Normal' }
    throw 'DEV_MONGO_PRIVATE_CONFIGURATION_CHANGED'
}

function Assert-DevMongoBootstrapArtifacts($Plan) {
    Assert-DevMongoPlan $Plan
    $bootstrapAcl=Get-Acl -LiteralPath $Plan.bootstrap
    if ($bootstrapAcl.GetSecurityDescriptorSddlForm('Access,Owner') -cne (Get-DevMongoAcl 'Read').GetSecurityDescriptorSddlForm('Access,Owner')) { throw 'DEV_MONGO_PRIVATE_ACL_MISMATCH' }
    foreach ($path in @($Plan.bootstrap,$Plan.ca,$Plan.caKey,$Plan.serverCertificate,$Plan.clientCertificate,$Plan.operatorSecret,$Plan.applicationSecret,$Plan.bootstrapManifest)) {
        Assert-DevPath $path
        if ($path -eq $Plan.bootstrap) { continue }
        if ((Get-Acl -LiteralPath $path).GetSecurityDescriptorSddlForm('Access,Owner') -cne (Get-DevMongoAcl (Get-DevMongoPrivateFileKind $Plan $path) $true).GetSecurityDescriptorSddlForm('Access,Owner')) { throw 'DEV_MONGO_PRIVATE_ACL_MISMATCH' }
    }
    $manifest=Read-DevJson $Plan.bootstrapManifest
    if ($manifest.revision -ne 2 -or $manifest.ownerSid -cne [Security.Principal.WindowsIdentity]::GetCurrent().User.Value -or $manifest.target -cne ($Plan | ConvertTo-Json -Compress -Depth 5)) { throw 'DEV_MONGO_BOOTSTRAP_MANIFEST_REJECTED' }
    if ($manifest.helperHash -cne (Get-FileHash -LiteralPath (Join-Path $script:DevRepo 'apps/api/scripts/dev-mongo-bootstrap.ts')).Hash) { throw 'DEV_MONGO_BOOTSTRAP_SOURCE_CHANGED' }
    foreach($entry in @(@('ca',$Plan.ca),@('server',$Plan.serverCertificate),@('client',$Plan.clientCertificate))){
        $pem=[IO.File]::ReadAllText($entry[1])
        if($pem.Length -gt 32768){throw 'DEV_MONGO_CERTIFICATE_REJECTED'}
        $match=[regex]::Match($pem,'-----BEGIN CERTIFICATE-----([\s\S]*?)-----END CERTIFICATE-----')
        if(-not $match.Success){throw 'DEV_MONGO_CERTIFICATE_REJECTED'}
        $certificate=[Security.Cryptography.X509Certificates.X509Certificate2]::new([Convert]::FromBase64String($match.Groups[1].Value))
        try { if ($certificate.GetCertHashString([Security.Cryptography.HashAlgorithmName]::SHA256) -cne $manifest.certificates[$entry[0]]) { throw 'DEV_MONGO_CERTIFICATE_REJECTED' } } finally { $certificate.Dispose() }
    }
}

function Protect-DevMongoValue([string]$Value) {
    Assert-DevMongoExecutionPolicy -AllowedActions @('PrepareStorage')
    $secure=ConvertTo-SecureString $Value -AsPlainText -Force
    try { return [Text.Encoding]::UTF8.GetBytes((ConvertFrom-SecureString $secure)) } finally { $secure.Dispose() }
}

function New-DevMongoPassword {
    Assert-DevMongoExecutionPolicy -AllowedActions @('PrepareStorage')
    $bytes=[Security.Cryptography.RandomNumberGenerator]::GetBytes(32)
    try { return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_') } finally { [Array]::Clear($bytes,0,$bytes.Length) }
}

function Initialize-DevMongoPrivateMaterial($Plan) {
    Assert-DevMongoExecutionPolicy -AllowedActions @('PrepareStorage')
    Assert-DevMongoPlan $Plan
    # Creation-only and original-owner DPAPI. No certificate store changes.
    $caKey=$null; $serverKey=$null; $clientKey=$null; $ca=$null; $server=$null; $client=$null
    $operatorPassword=$null; $applicationPassword=$null; $uri=$null; $privateBytes=$null
    try {
        $caKey=[Security.Cryptography.RSA]::Create(3072)
        $request=[Security.Cryptography.X509Certificates.CertificateRequest]::new('CN=DeepLearner local bootstrap CA',$caKey,[Security.Cryptography.HashAlgorithmName]::SHA256,[Security.Cryptography.RSASignaturePadding]::Pkcs1)
        $request.CertificateExtensions.Add([Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($true,$false,0,$true))
        $request.CertificateExtensions.Add([Security.Cryptography.X509Certificates.X509KeyUsageExtension]::new([Security.Cryptography.X509Certificates.X509KeyUsageFlags]'KeyCertSign,CrlSign',$true))
        $from=[DateTimeOffset]::FromUnixTimeSeconds([DateTimeOffset]::UtcNow.ToUnixTimeSeconds()).AddMinutes(-5); $until=$from.AddDays(365)
        $ca=$request.CreateSelfSigned($from,$until)
        Write-DevMongoPrivateFile $Plan.ca ([Text.Encoding]::UTF8.GetBytes($ca.ExportCertificatePem())) 'Read'
        Write-DevMongoPrivateFile $Plan.caKey (Protect-DevMongoValue $caKey.ExportPkcs8PrivateKeyPem()) 'OwnerOnly'
        foreach($kind in @('server','client')){
            $key=[Security.Cryptography.RSA]::Create(3072)
            if($kind -eq 'server'){$serverKey=$key}else{$clientKey=$key}
            $leaf=[Security.Cryptography.X509Certificates.CertificateRequest]::new(('CN=DeepLearner local bootstrap '+$kind),$key,[Security.Cryptography.HashAlgorithmName]::SHA256,[Security.Cryptography.RSASignaturePadding]::Pkcs1)
            $leaf.CertificateExtensions.Add([Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($false,$false,0,$true))
            $leaf.CertificateExtensions.Add([Security.Cryptography.X509Certificates.X509KeyUsageExtension]::new([Security.Cryptography.X509Certificates.X509KeyUsageFlags]'DigitalSignature,KeyEncipherment',$true))
            $eku=[Security.Cryptography.OidCollection]::new(); $eku.Add([Security.Cryptography.Oid]::new('1.3.6.1.5.5.7.3.2')) | Out-Null
            if($kind -eq 'server'){
                $eku.Add([Security.Cryptography.Oid]::new('1.3.6.1.5.5.7.3.1')) | Out-Null
                $san=[Security.Cryptography.X509Certificates.SubjectAlternativeNameBuilder]::new(); $san.AddDnsName('localhost'); $san.AddIpAddress([Net.IPAddress]::Parse('127.0.0.1')); $leaf.CertificateExtensions.Add($san.Build())
            }
            $leaf.CertificateExtensions.Add([Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension]::new($eku,$true))
            $serial=[Security.Cryptography.RandomNumberGenerator]::GetBytes(16)
            try { $certificate=$leaf.Create($ca,$from,$until,$serial) } finally { [Array]::Clear($serial,0,$serial.Length) }
            $pem=$certificate.ExportCertificatePem()+"`n"+$key.ExportPkcs8PrivateKeyPem()+"`n"
            if($kind -eq 'server'){$server=$certificate; Write-DevMongoPrivateFile $Plan.serverCertificate ([Text.Encoding]::UTF8.GetBytes($pem)) 'Read'}
            else{$client=$certificate; Write-DevMongoPrivateFile $Plan.clientCertificate ([Text.Encoding]::UTF8.GetBytes($pem)) 'OwnerOnly'}
            $pem=$null
        }
        $operatorPassword=New-DevMongoPassword; $applicationPassword=New-DevMongoPassword
        Write-DevMongoPrivateFile $Plan.operatorSecret (Protect-DevMongoValue $operatorPassword) 'OwnerOnly'
        $uri='mongodb://deeplearner-local-app:'+[Uri]::EscapeDataString($applicationPassword)+'@127.0.0.1:27019/deeplearner-dev?replicaSet=deeplearner-dev-rs&directConnection=true&authSource=deeplearner-dev'
        Write-DevMongoPrivateFile $Plan.applicationSecret (Protect-DevMongoValue $uri) 'OwnerOnly'
        $manifest=@{revision=2; ownerSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value; target=($Plan | ConvertTo-Json -Compress -Depth 5); helperHash=(Get-FileHash -LiteralPath (Join-Path $script:DevRepo 'apps/api/scripts/dev-mongo-bootstrap.ts')).Hash; certificates=@{ca=$ca.GetCertHashString([Security.Cryptography.HashAlgorithmName]::SHA256); server=$server.GetCertHashString([Security.Cryptography.HashAlgorithmName]::SHA256); client=$client.GetCertHashString([Security.Cryptography.HashAlgorithmName]::SHA256)}}
        Write-DevMongoPrivateFile $Plan.bootstrapManifest ([Text.Encoding]::UTF8.GetBytes(($manifest | ConvertTo-Json -Compress -Depth 8))) 'OwnerOnly'
    } finally {
        foreach($item in @($ca,$server,$client,$caKey,$serverKey,$clientKey)){if($null -ne $item){$item.Dispose()}}
        $operatorPassword=$null; $applicationPassword=$null; $uri=$null; $privateBytes=$null
        # Managed string memory cannot be guaranteed erased; no plaintext is persisted
        # except the ACL-protected PEM leaf keys required by MongoDB and its client.
    }
}

function Get-DevMongoServiceOwnerMask { return 0x1200B5 } # query/start/stop/interrogate/synchronize/read-control; no ChangeConfig/WriteDac/delete.

function Import-DevMongoServiceSecurityReader {
    if('DeepLearnerMongoServiceSecurity' -as [type]){return}
    Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
public static class DeepLearnerMongoServiceSecurity {
    [DllImport("advapi32.dll", CharSet=CharSet.Unicode, ExactSpelling=true, SetLastError=true)] static extern IntPtr OpenSCManagerW(string machine,string database,uint rights);
    [DllImport("advapi32.dll", CharSet=CharSet.Unicode, ExactSpelling=true, SetLastError=true)] static extern IntPtr OpenServiceW(IntPtr manager,string name,uint rights);
    [DllImport("advapi32.dll", SetLastError=true)] static extern bool QueryServiceObjectSecurity(IntPtr service,uint information,byte[] descriptor,uint size,out uint needed);
    [DllImport("advapi32.dll")] static extern bool CloseServiceHandle(IntPtr handle);
    public static byte[] Read() {
        var manager=OpenSCManagerW(null,null,1);
        if(manager==IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error());
        try {
            var service=OpenServiceW(manager,"DeepLearnerDevMongo27019",0x20000);
            if(service==IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error());
            try {
                uint needed; QueryServiceObjectSecurity(service,5,null,0,out needed);
                if(Marshal.GetLastWin32Error()!=122 || needed==0 || needed>65536) throw new InvalidOperationException("DEV_MONGO_SERVICE_PERMISSIONS_UNKNOWN");
                var bytes=new byte[needed];
                if(!QueryServiceObjectSecurity(service,5,bytes,needed,out needed)) throw new Win32Exception(Marshal.GetLastWin32Error());
                return bytes;
            } finally { CloseServiceHandle(service); }
        } finally { CloseServiceHandle(manager); }
    }
}
'@
}

function Read-DevMongoServiceSecurity($Plan) {
    Assert-DevMongoPlan $Plan
    Import-DevMongoServiceSecurityReader
    return [Security.AccessControl.RawSecurityDescriptor]::new([DeepLearnerMongoServiceSecurity]::Read(),0)
}

function Assert-DevMongoServiceSecurity([Security.AccessControl.RawSecurityDescriptor]$Descriptor,[string]$OwnerSid) {
    $trusted=@($OwnerSid,'S-1-5-18','S-1-5-32-544')
    if($null -eq $Descriptor.Owner -or $Descriptor.Owner.Value -notin $trusted -or $null -eq $Descriptor.DiscretionaryAcl){throw 'DEV_MONGO_SERVICE_PERMISSIONS_UNKNOWN'}
    $control=0x2L -bor 0x10L -bor 0x20L -bor 0x40L -bor 0x100L -bor 0x10000L -bor 0x40000L -bor 0x80000L -bor 0x10000000L -bor 0x20000000L -bor 0x40000000L
    foreach($ace in $Descriptor.DiscretionaryAcl){
        if($ace -isnot [Security.AccessControl.QualifiedAce]){throw 'DEV_MONGO_SERVICE_PERMISSIONS_UNKNOWN'}
        if($ace.AceQualifier -eq [Security.AccessControl.AceQualifier]::AccessAllowed -and -not ($ace.AceFlags -band [Security.AccessControl.AceFlags]::InheritOnly) -and $ace.SecurityIdentifier.Value -notin $trusted -and (([long]$ace.AccessMask -band 4294967295L) -band $control)){throw 'DEV_MONGO_FOREIGN_SERVICE_CONTROL_REFUSED'}
    }
}

function Get-DevMongoServiceSecurityDescriptor([string]$OwnerSid) {
    try { $sid=[Security.Principal.SecurityIdentifier]::new($OwnerSid) } catch { throw 'DEV_MONGO_SERVICE_OWNER_REJECTED' }
    if($sid.Value -cne $OwnerSid -or $OwnerSid -in @('S-1-5-18','S-1-5-32-544')){throw 'DEV_MONGO_SERVICE_OWNER_REJECTED'}
    # Explicit service masks avoid generic-right mapping differences on readback.
    # SYSTEM/Administrators retain control of this service only; the original
    # owner gets the reviewed query/start/stop mask, without change-config rights.
    return 'D:P(A;;0xF01FF;;;SY)(A;;0xF01FF;;;BA)(A;;0x'+(Get-DevMongoServiceOwnerMask).ToString('X')+';;;'+$sid.Value+')'
}

function Assert-DevMongoApprovedServiceSecurity([Security.AccessControl.RawSecurityDescriptor]$Descriptor,[string]$OwnerSid) {
    if($null -eq $Descriptor){throw 'DEV_MONGO_SERVICE_PERMISSIONS_UNKNOWN'}
    Assert-DevMongoServiceSecurity $Descriptor $OwnerSid
    $expected=[Security.AccessControl.RawSecurityDescriptor]::new((Get-DevMongoServiceSecurityDescriptor $OwnerSid))
    if(-not ($Descriptor.ControlFlags -band [Security.AccessControl.ControlFlags]::DiscretionaryAclProtected) -or $Descriptor.DiscretionaryAcl.Count -ne $expected.DiscretionaryAcl.Count){throw 'DEV_MONGO_SERVICE_ACL_MISMATCH'}
    $actualEntries=@()
    foreach($ace in $Descriptor.DiscretionaryAcl){
        if($ace -isnot [Security.AccessControl.CommonAce] -or $ace.IsCallback -or $ace.AceQualifier -ne [Security.AccessControl.AceQualifier]::AccessAllowed -or $ace.AceFlags -ne [Security.AccessControl.AceFlags]::None){throw 'DEV_MONGO_SERVICE_ACL_MISMATCH'}
        $actualEntries+=($ace.SecurityIdentifier.Value+'='+([long]$ace.AccessMask -band 4294967295L))
    }
    $expectedEntries=@($expected.DiscretionaryAcl | ForEach-Object { $_.SecurityIdentifier.Value+'='+([long]$_.AccessMask -band 4294967295L) })
    if((($actualEntries | Sort-Object) -join ';') -cne (($expectedEntries | Sort-Object) -join ';')){throw 'DEV_MONGO_SERVICE_ACL_MISMATCH'}
}

function Assert-DevMongoServiceCreationSecurity($Plan) {
    Assert-DevMongoExecutionPolicy -AllowedActions @('InstallService')
    Assert-DevMongoPlan $Plan
    Assert-DevMongoApprovedServiceSecurity (Read-DevMongoServiceSecurity $Plan) ([Security.Principal.WindowsIdentity]::GetCurrent().User.Value)
}

function Assert-DevMongoInstallAdministrator {
    Assert-DevMongoExecutionPolicy -AllowedActions @('InstallService')
    $principal=[Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
    if(-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){throw 'DEV_MONGO_SEPARATE_ADMIN_INSTALL_REQUIRED'}
}

function Write-DevMongoStage($Plan,[string]$Stage,[string]$Status) {
    Assert-DevMongoExecutionPolicy -AllowedActions @('BootstrapFirstUser')
    $path=Get-DevMongoStagePath $Plan $Stage
    $record=@{revision=2; stage=$Stage; status=$Status; ownerSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value; target=($Plan | ConvertTo-Json -Compress -Depth 5); manifestHash=(Get-FileHash -LiteralPath $Plan.bootstrapManifest).Hash}
    Write-DevMongoPrivateFile $path ([Text.Encoding]::UTF8.GetBytes(($record | ConvertTo-Json -Compress -Depth 8))) 'OwnerOnly'
}

function Assert-DevMongoStage($Plan,[string]$Stage) {
    $path=Get-DevMongoStagePath $Plan $Stage
    Assert-DevPath $path
    if((Get-Acl -LiteralPath $path).GetSecurityDescriptorSddlForm('Access,Owner') -cne (Get-DevMongoAcl 'OwnerOnly' $true).GetSecurityDescriptorSddlForm('Access,Owner')){throw 'DEV_MONGO_PRIVATE_ACL_MISMATCH'}
    $record=Read-DevJson $path
    $expectedStatus=switch($Stage){'replica'{'REPLICA_INITIALIZED'} 'administrator'{'ADMINISTRATOR_VERIFIED'} 'application-role'{'APPLICATION_ROLE_VERIFIED'} 'application'{'APPLICATION_VERIFIED'} 'complete'{'NORMAL_AUTHENTICATION_VERIFIED'} default{'ATTEMPTED'}}
    if($record.Count -ne 6 -or $record.revision -ne 2 -or $record.stage -cne $Stage -or $record.status -cne $expectedStatus -or $record.ownerSid -cne [Security.Principal.WindowsIdentity]::GetCurrent().User.Value -or $record.target -cne ($Plan | ConvertTo-Json -Compress -Depth 5) -or $record.manifestHash -cne (Get-FileHash -LiteralPath $Plan.bootstrapManifest).Hash){throw 'DEV_MONGO_BOOTSTRAP_STAGE_REJECTED'}
    return $record
}

function Get-DevMongoRecoveryStep([ValidateSet('administrator','application-role','application-user')][string]$Operation,[bool]$Completed,[bool]$Attempted) {
    if($Completed -and -not $Attempted){throw 'DEV_MONGO_BOOTSTRAP_STAGE_REJECTED'}
    if(-not $Completed -and -not $Attempted){return $Operation}
    switch($Operation){'administrator'{return 'inspect-administrator'} 'application-role'{return 'inspect-application-role'} 'application-user'{return 'verify-application'}}
}

function Invoke-DevMongoNodeStep($Plan,[ValidateSet('initialize','administrator','inspect-administrator','application-role','inspect-application-role','application-user','verify-application','verify-normal')][string]$Step) {
    Assert-DevMongoExecutionPolicy -AllowedActions $(if($Step -ceq 'verify-normal'){@('BootstrapFirstUser','StartService')}else{@('BootstrapFirstUser')})
    Assert-DevMongoPrepared $Plan
    $phase=Get-DevMongoConfigurationPhase $Plan
    if(($Step -eq 'verify-normal') -ne ($phase -eq 'Normal')){throw 'DEV_MONGO_TRANSPORT_PHASE_REJECTED'}
    $service=Get-DevMongoService $Plan
    if(-not $service){throw 'DEV_MONGO_SERVICE_NOT_INSTALLED'}
    $owner=$null; $operatorPassword=$null; $applicationPassword=$null; $uri=$null; $request=$null
    try {
        Assert-DevMongoRunningIdentity $Plan $service
        $operatorPassword=Read-DevSecret $Plan.operatorSecret
        $uri=Read-DevSecret $Plan.applicationSecret
        if($uri -cnotmatch '^mongodb://deeplearner-local-app:([A-Za-z0-9_-]{43})@127\.0\.0\.1:27019/deeplearner-dev\?replicaSet=deeplearner-dev-rs&directConnection=true&authSource=deeplearner-dev$'){throw 'DEV_MONGO_PRIVATE_CREDENTIAL_REJECTED'}
        $applicationPassword=$Matches[1]
        $manifest=Read-DevJson $Plan.bootstrapManifest
        $request=@{action=$Step; target=@{host=$Plan.host; port=$Plan.port; name=$Plan.database; replicaSet=$Plan.replicaSet; member=$Plan.member; service=$Plan.serviceName}; operatorPassword=$operatorPassword; applicationPassword=$applicationPassword; certificates=$manifest.certificates}
        $node=(Get-Command node.exe -CommandType Application | Select-Object -First 1).Source
        if(-not ('DeepLearnerLocal.Owner' -as [type])){Add-Type -Path (Join-Path $PSScriptRoot 'LocalProcessOwner.cs')}
        $owner=[DeepLearnerLocal.Owner]::new()
        $child=$owner.StartControlled('mongo-bootstrap',$node,@('--import','tsx',(Join-Path $script:DevRepo 'apps/api/scripts/dev-mongo-bootstrap.ts'),'--action',$Step),$script:DevRepo,(New-DevEnvironment $script:DevRepo $node $Plan.bootstrap),'NUL')
        $frame=Send-DevValidationRequest $child ($request | ConvertTo-Json -Compress -Depth 8) 180000
        if(-not $owner.WaitEmpty(5000)){throw 'DEV_MONGO_BOOTSTRAP_HELPER_NOT_EMPTY'}
        $result=$frame | ConvertFrom-Json -AsHashtable
        if($result.Count -ne 1 -or $result.status -cnotin @('REPLICA_INITIALIZED','ADMINISTRATOR_VERIFIED','APPLICATION_ROLE_VERIFIED','APPLICATION_VERIFIED','NORMAL_AUTHENTICATION_VERIFIED')){throw 'DEV_MONGO_BOOTSTRAP_RESULT_REJECTED'}
        Assert-DevMongoRunningIdentity $Plan $service
        return $result.status
    } finally {
        if($null -ne $owner){$owner.Dispose()}; $service.Dispose()
        $operatorPassword=$null; $applicationPassword=$null; $uri=$null; $request=$null
    }
}

function Set-DevMongoNormalConfiguration($Plan) {
    Assert-DevMongoExecutionPolicy -AllowedActions @('BootstrapFirstUser')
    Assert-DevMongoPrepared $Plan
    Assert-DevMongoStage $Plan 'administrator' | Out-Null; Assert-DevMongoStage $Plan 'application' | Out-Null
    $service=Get-DevMongoService $Plan
    if(-not $service){throw 'DEV_MONGO_SERVICE_NOT_INSTALLED'}
    try { $service.Refresh(); if($service.Status -ne 'Stopped'){throw 'DEV_MONGO_CONFIG_TRANSITION_REQUIRES_STOPPED'}; Assert-DevMongoPortFree } finally { $service.Dispose() }
    if((Get-DevMongoConfigurationPhase $Plan) -ne 'Bootstrap'){throw 'DEV_MONGO_CONFIG_TRANSITION_ALREADY_ATTEMPTED'}
    if(Test-Path -LiteralPath $Plan.nextConfiguration){throw 'DEV_MONGO_CONFIG_TRANSITION_UNKNOWN_RECONCILE'}
    Write-DevMongoPrivateFile $Plan.nextConfiguration ([Text.Encoding]::UTF8.GetBytes((Get-DevMongoConfiguration $Plan 'Normal'))) 'Read'
    [IO.File]::Replace($Plan.nextConfiguration,$Plan.configuration,$null)
    Assert-DevMongoPrepared $Plan
    if((Get-DevMongoConfigurationPhase $Plan) -ne 'Normal'){throw 'DEV_MONGO_CONFIG_TRANSITION_UNKNOWN_RECONCILE'}
}

function Invoke-DevMongoBootstrap($Plan) {
    Assert-DevMongoExecutionPolicy -AllowedActions @('BootstrapFirstUser')
    $lock=Open-DevMongoLifecycleLock $Plan
    $service=$null
    try {
        Assert-DevMongoPrepared $Plan
        $phase=Get-DevMongoConfigurationPhase $Plan
        $complete=Test-Path -LiteralPath (Get-DevMongoStagePath $Plan 'complete')
        if($complete){Assert-DevMongoStage $Plan 'complete' | Out-Null; if($phase -ne 'Normal'){throw 'DEV_MONGO_BOOTSTRAP_REENTRY_REJECTED'}}
        if($phase -eq 'Normal'){
            Assert-DevMongoStage $Plan 'administrator' | Out-Null; Assert-DevMongoStage $Plan 'application' | Out-Null
        }
        $service=Get-DevMongoService $Plan
        if(-not $service){throw 'DEV_MONGO_SERVICE_NOT_INSTALLED'}
        $service.Refresh()
        if($service.Status -eq 'Stopped'){Assert-DevMongoPortFree; $service.Start(); $service.WaitForStatus('Running',[timespan]::FromSeconds(30))}
        Assert-DevMongoRunningIdentity $Plan $service
        if($phase -eq 'Bootstrap'){
            if(-not (Test-Path -LiteralPath (Get-DevMongoStagePath $Plan 'replica'))){
                if(Test-Path -LiteralPath (Get-DevMongoStagePath $Plan 'initialize-intent')){throw 'DEV_MONGO_INITIALIZATION_OUTCOME_UNKNOWN_RECONCILE'}
                Write-DevMongoStage $Plan 'initialize-intent' 'ATTEMPTED'
                $status=Invoke-DevMongoNodeStep $Plan 'initialize'
                if($status -ne 'REPLICA_INITIALIZED'){throw 'DEV_MONGO_BOOTSTRAP_RESULT_REJECTED'}
                Write-DevMongoStage $Plan 'replica' $status
            }else{Assert-DevMongoStage $Plan 'replica' | Out-Null}
            foreach($stage in @(@('administrator','administrator-intent','administrator','inspect-administrator','ADMINISTRATOR_VERIFIED'),@('application-role','application-role-intent','application-role','inspect-application-role','APPLICATION_ROLE_VERIFIED'),@('application','application-user-intent','application-user','verify-application','APPLICATION_VERIFIED'))){
                $done=Test-Path -LiteralPath (Get-DevMongoStagePath $Plan $stage[0]); $attempted=Test-Path -LiteralPath (Get-DevMongoStagePath $Plan $stage[1])
                if($done){Assert-DevMongoStage $Plan $stage[0] | Out-Null}
                if($attempted){Assert-DevMongoStage $Plan $stage[1] | Out-Null}
                $operation=Get-DevMongoRecoveryStep $stage[2] $done $attempted
                if(-not $attempted){Write-DevMongoStage $Plan $stage[1] 'ATTEMPTED'}
                $status=Invoke-DevMongoNodeStep $Plan $operation
                if($status -cne $stage[4]){throw 'DEV_MONGO_BOOTSTRAP_RESULT_REJECTED'}
                if(-not $done){Write-DevMongoStage $Plan $stage[0] $status}
            }
            Assert-DevMongoRunningIdentity $Plan $service
            $service.Stop(); $service.WaitForStatus('Stopped',[timespan]::FromSeconds(30))
            Set-DevMongoNormalConfiguration $Plan
            Assert-DevMongoPortFree; $service.Start(); $service.WaitForStatus('Running',[timespan]::FromSeconds(30))
        }
        if((Invoke-DevMongoNodeStep $Plan 'verify-normal') -cne 'NORMAL_AUTHENTICATION_VERIFIED'){throw 'DEV_MONGO_BOOTSTRAP_RESULT_REJECTED'}
        if(-not $complete){Write-DevMongoStage $Plan 'complete' 'NORMAL_AUTHENTICATION_VERIFIED'}
        return @{status='NORMAL_AUTHENTICATION_VERIFIED'; policy=(Get-DevMongoSourcePolicy).status; applicationProfile='NOT_ACTIVATED'}
    } finally {if($null -ne $service){$service.Dispose()}; $lock.Dispose()}
}

function Invoke-DevMongoPrepare($Plan) {
    Assert-DevMongoExecutionPolicy -AllowedActions @('PrepareStorage')
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
    New-DevMongoDirectory $Plan.bootstrap 'Read'
    $keyBytes=$null; $keyTextBytes=$null
    try {
        $keyBytes=[Security.Cryptography.RandomNumberGenerator]::GetBytes(756)
        $keyTextBytes=[Text.Encoding]::UTF8.GetBytes([Convert]::ToBase64String($keyBytes))
        Write-DevMongoPrivateFile $Plan.keyFile $keyTextBytes 'Read'
        Write-DevMongoPrivateFile $Plan.configuration ([Text.Encoding]::UTF8.GetBytes((Get-DevMongoConfiguration $Plan))) 'Read'
        Initialize-DevMongoPrivateMaterial $Plan
        $record=@{revision=2; ownerSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value; target=($Plan | ConvertTo-Json -Compress -Depth 5); keyHash=(Get-FileHash -LiteralPath $Plan.keyFile).Hash}
        Write-DevMongoPrivateFile $Plan.receipt ([Text.Encoding]::UTF8.GetBytes(($record | ConvertTo-Json -Compress))) 'OwnerOnly'
    } finally {
        if ($keyBytes) { [Array]::Clear($keyBytes,0,$keyBytes.Length) }
        if ($keyTextBytes) { [Array]::Clear($keyTextBytes,0,$keyTextBytes.Length) }
    }
}

function Invoke-DevMongoInstall($Plan) {
    Assert-DevMongoExecutionPolicy -AllowedActions @('InstallService')
    Assert-DevMongoPlan $Plan
    Assert-DevMongoPrepared $Plan; Assert-DevMongoPortFree
    $existing=Get-DevMongoService $Plan
    if ($existing) { $existing.Dispose(); throw 'DEV_MONGO_EXISTING_SERVICE_REFUSED' }
    Assert-DevMongoInstallAdministrator
    $command='"' + $Plan.executable + '" --config "' + $Plan.configuration + '" --service'
    $empty=[Security.SecureString]::new()
    $created=$null
    try {
        $ownerSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
        $sddl=Get-DevMongoServiceSecurityDescriptor $ownerSid
        $created=New-Service -Name $Plan.serviceName -BinaryPathName $command -StartupType Manual -Credential ([Management.Automation.PSCredential]::new($Plan.serviceAccount,$empty)) -SecurityDescriptorSddl $sddl -ErrorAction Stop
        # Creation failures, unavailable readback and any permission mismatch stop
        # before the receipt. Preserve a partial registration for owner review;
        # never adopt, retry, rewrite its ACL, start or delete it automatically.
        Assert-DevMongoServiceCreationSecurity $Plan
        $registration=@{revision=2; ownerSid=$ownerSid; target=($Plan | ConvertTo-Json -Compress -Depth 5)}
        Write-DevMongoPrivateFile $Plan.serviceReceipt ([Text.Encoding]::UTF8.GetBytes(($registration | ConvertTo-Json -Compress))) 'OwnerOnly'
    } finally {
        if($null -ne $created){$created.Dispose()}
        $empty.Dispose()
    }
}

function Invoke-DevMongoStart($Plan) {
    Assert-DevMongoExecutionPolicy -AllowedActions @('StartService')
    Assert-DevMongoAuthenticatedBootstrap
    Assert-DevMongoPrepared $Plan
    $service=Get-DevMongoService $Plan
    if (-not $service) { throw 'DEV_MONGO_SERVICE_NOT_INSTALLED' }
    try {
        if ($service.Status -eq 'Running') { Assert-DevMongoRunningIdentity $Plan $service; Invoke-DevMongoNodeStep $Plan 'verify-normal' | Out-Null; return }
        if ($service.Status -ne 'Stopped') { throw 'DEV_MONGO_SERVICE_STATE_UNKNOWN' }
        Assert-DevMongoPortFree; $service.Start(); $service.WaitForStatus('Running',[timespan]::FromSeconds(30))
        Assert-DevMongoRunningIdentity $Plan $service
        Invoke-DevMongoNodeStep $Plan 'verify-normal' | Out-Null
    } finally { $service.Dispose() }
}

function Invoke-DevMongoStop($Plan) {
    Assert-DevMongoExecutionPolicy -AllowedActions @('StopService')
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
    throw 'DEV_MONGO_LEGACY_INITIALIZATION_DISABLED'
}

function Open-DevMongoLifecycleLock($Plan) {
    Assert-DevMongoExecutionPolicy -AllowedActions @('InstallService','StartService','StopService','BootstrapFirstUser')
    Assert-DevMongoPrepared $Plan
    Assert-DevPath $Plan.operationLock
    if (-not (Test-Path -LiteralPath $Plan.operationLock)) { Write-DevMongoPrivateFile $Plan.operationLock ([byte[]]::new(0)) 'OwnerOnly' }
    if ((Get-Acl -LiteralPath $Plan.operationLock).GetSecurityDescriptorSddlForm('Access,Owner') -cne (Get-DevMongoAcl 'OwnerOnly' $true).GetSecurityDescriptorSddlForm('Access,Owner')) { throw 'DEV_MONGO_PRIVATE_ACL_MISMATCH' }
    return [IO.File]::Open($Plan.operationLock,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
}

function Invoke-DevMongoSetup([string]$Operation='Plan') {
    $plan=Get-DevMongoPlan; Assert-DevMongoPlan $plan
    if ($Operation -eq 'Plan') { return [ordered]@{operation='PLAN_ONLY'; policyDefinition=(Get-DevMongoSourcePolicy); target=$plan; configurationTemplate=(Get-DevMongoConfiguration $plan); normalConfigurationTemplate=(Get-DevMongoConfiguration $plan 'Normal'); bootstrapAction='BootstrapFirstUser'; initialization=@{_id=$plan.replicaSet; members=@(@{_id=0; host=$plan.member})}; execution=('Source policy: '+(Get-DevMongoSourcePolicy).status+'; separate invocation approval required'); portQualification='RECHECK_REQUIRED before any future provisioning'; pending='Service/ACL/install/policy/particular-execution approvals and real TLS/authentication/ownership/transaction qualification'} }
    if($Operation -eq 'InitializeReplica'){throw 'DEV_MONGO_LEGACY_INITIALIZATION_DISABLED'}
    if($Operation -cnotin (Get-DevMongoSourcePolicy).operations){throw 'DEV_MONGO_ACTION_REJECTED'}
    Assert-DevMongoExecutionPolicy -AllowedActions @($Operation)
    if ($Operation -eq 'PrepareStorage') { Invoke-DevMongoPrepare $plan; return }
    if ($Operation -eq 'InitializeReplica') { Invoke-DevMongoInitialize $plan; return }
    if ($Operation -eq 'BootstrapFirstUser') { Invoke-DevMongoBootstrap $plan; return }
    if ($Operation -notin @('InstallService','StartService','StopService')) { throw 'DEV_MONGO_ACTION_REJECTED' }
    Assert-DevMongoExecutionPolicy -AllowedActions @($Operation)
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
    $lease=$null; $closedGuard=${function:Assert-DevMongoExecutionPolicy}
    try {
        if($Action -notin @('Plan','InitializeReplica')) {
            $policy=Get-DevMongoSourcePolicy
            # Reject inactive source before process launch or private-path access.
            Assert-DevMongoPolicyAgreement $policy $policy
            $node=(Get-Command node.exe -CommandType Application | Select-Object -First 1).Source
            if(-not ('DeepLearnerLocal.Owner' -as [type])){Add-Type -Path (Join-Path $PSScriptRoot 'LocalProcessOwner.cs')}
            $probe=[DeepLearnerLocal.Owner]::new()
            try {
                $child=$probe.StartControlled('mongo-policy',$node,@('--import','tsx',(Join-Path $script:DevRepo 'apps/api/scripts/dev-mongo-bootstrap.ts'),'--check-policy'),$script:DevRepo,(New-DevEnvironment $script:DevRepo $node ([IO.Path]::GetTempPath())),'NUL')
                $child.CloseInput(); $frame=$child.ReadFrameAsync()
                if(-not $frame.Wait(10000) -or -not $probe.WaitEmpty(5000) -or $child.ExitCode -ne 0){throw 'DEV_MONGO_SOURCE_POLICY_MISMATCH'}
                $peer=$frame.Result | ConvertFrom-Json -AsHashtable
            } finally {$probe.Dispose()}
            Assert-DevMongoPolicyAgreement $policy $peer
            $ownerSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
            if([IO.Path]::GetFullPath((Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'DeepLearner/dev')) -cne (Get-DevMongoPlan).root){throw 'DEV_MONGO_OWNER_ROOT_MISMATCH'}
            # Private closure identity, never read from argv, stdin, profile or environment.
            $lease=@{alive=$true; action=$Action; ownerSid=$ownerSid; target=($policy.target | ConvertTo-Json -Compress)}
            $accepted=$lease; $fixedTarget=$policy.target | ConvertTo-Json -Compress
            $validateInvocation=${function:Assert-DevMongoInvocation}
            Set-Item Function:Assert-DevMongoExecutionPolicy -Value ({
                param([string[]]$AllowedActions)
                & $validateInvocation $accepted $AllowedActions ([Security.Principal.WindowsIdentity]::GetCurrent().User.Value) $fixedTarget
            }.GetNewClosure())
        }
        Invoke-DevMongoSetup $Action | ConvertTo-Json -Depth 8
    }
    catch {
        $code=$_.Exception.Message
        if ($code -notmatch '^DEV_[A-Z_]+$') { $code='DEV_MONGO_OUTCOME_UNKNOWN_RECONCILE' }
        Write-Host "MongoDB setup refused: $code. No automatic retry/repair or fallback target."
        exit 1
    }
    finally {
        if($null -ne $lease){$lease.alive=$false; $lease.Clear()}
        Set-Item Function:Assert-DevMongoExecutionPolicy -Value $closedGuard
        $accepted=$null; $lease=$null
    }
}
