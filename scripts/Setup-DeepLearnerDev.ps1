#Requires -Version 7.0
[CmdletBinding()]
param([ValidateSet('Plan','PrepareStorage','InstallService','StartService','StopService','InitializeReplica','BootstrapFirstUser','ManualPlan','BindManualSources','RunOwnedMongo','BootstrapOwnedMongo','BindRecoverySources','InspectOwnedMongo')][string]$Action='Plan',[switch]$FinalizeNormal,[switch]$ProvisionLocal,[switch]$BindNormalSources,[switch]$UseNormalSourceAmendment,[switch]$BindNormalRuntime,[switch]$UseNormalRuntime)

. "$PSScriptRoot/Start-DeepLearnerDev.ps1"

function Get-DevMongoSourcePolicy {
    # Literal source metadata, also read by the Node CLI; never a private profile.
    return @'
{"id":"DEV-PERSISTENT-27019","status":"ACTIVE","sourceVersion":1,"target":{"host":"127.0.0.1","port":27019,"replicaSet":"deeplearner-dev-rs","database":"deeplearner-dev","service":"DeepLearnerDevMongo27019"},"operations":["PrepareStorage","InstallService","StartService","StopService","BootstrapFirstUser"]}
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
    Assert-DevMongoBootstrapArtifactState $Plan (Get-FileHash -LiteralPath (Join-Path $script:DevRepo 'apps/api/scripts/dev-mongo-bootstrap.ts')).Hash
}

function Assert-DevMongoBootstrapArtifactState($Plan,[string]$HelperHash) {
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
    if ($manifest.helperHash -cne $HelperHash) { throw 'DEV_MONGO_BOOTSTRAP_SOURCE_CHANGED' }
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

function Get-DevManualMongoPolicy {
    return @'
{"id":"DEV-PERSISTENT-27019-MANUAL","status":"ACTIVE","sourceVersion":2,"target":{"host":"127.0.0.1","port":27019,"replicaSet":"deeplearner-dev-rs","database":"deeplearner-dev","runtime":"owned-process"},"operations":["BindManualSources","RunOwnedMongo","BootstrapOwnedMongo","BindRecoverySources","InspectOwnedMongo"]}
'@ | ConvertFrom-Json -AsHashtable
}

function Assert-DevManualPolicyAgreement($Local,$Peer,[bool]$RequireActive=$true) {
    $expected=Get-DevManualMongoPolicy
    foreach($value in @($Local,$Peer)) {
        if($null -eq $value -or $value.Count -ne $expected.Count -or $value.status -cnotin @('INACTIVE','ACTIVE')){throw 'DEV_MANUAL_POLICY_MISMATCH'}
        foreach($key in @('id','sourceVersion')){if(($value[$key] | ConvertTo-Json -Compress) -cne ($expected[$key] | ConvertTo-Json -Compress)){throw 'DEV_MANUAL_POLICY_MISMATCH'}}
        if($value.target.Count -ne $expected.target.Count){throw 'DEV_MANUAL_POLICY_MISMATCH'}
        foreach($key in $expected.target.Keys){if(($value.target[$key] | ConvertTo-Json -Compress) -cne ($expected.target[$key] | ConvertTo-Json -Compress)){throw 'DEV_MANUAL_POLICY_MISMATCH'}}
        if(($value.operations | ConvertTo-Json -Compress) -cne ($expected.operations | ConvertTo-Json -Compress)){throw 'DEV_MANUAL_POLICY_MISMATCH'}
    }
    if($Local.status -cne $Peer.status){throw 'DEV_MANUAL_POLICY_MISMATCH'}
    if($RequireActive -and $Local.status -cne 'ACTIVE'){throw 'DEV_MANUAL_POLICY_INACTIVE'}
}

function Assert-DevManualExecutionPolicy([string[]]$AllowedActions) {
    if((Get-DevManualMongoPolicy).status -cne 'ACTIVE'){throw 'DEV_MANUAL_POLICY_INACTIVE'}
    throw 'DEV_MONGO_EXECUTION_CONTEXT_REQUIRED'
}

function Get-DevManualSourceHashes {
    return [ordered]@{
        powershell=(Get-FileHash -LiteralPath (Join-Path $script:DevRepo 'scripts/Setup-DeepLearnerDev.ps1')).Hash
        validator=(Get-FileHash -LiteralPath (Join-Path $script:DevRepo 'apps/api/scripts/dev-local.ts')).Hash
        helper=(Get-FileHash -LiteralPath (Join-Path $script:DevRepo 'apps/api/scripts/dev-mongo-bootstrap.ts')).Hash
        owner=(Get-FileHash -LiteralPath (Join-Path $script:DevRepo 'scripts/LocalProcessOwner.cs')).Hash
    }
}

function Get-DevManualBinding($Plan) {
    return [ordered]@{revision=1;runtime='owned-process';ownerSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;policy=(Get-DevManualMongoPolicy);preparedManifestHash=(Get-FileHash -LiteralPath $Plan.bootstrapManifest).Hash;preparedHelperHash='9EAED47244A7347BEA0F3AFAA9770FBC070BEF39AB6FEEA5E65568A2B789D675';sources=(Get-DevManualSourceHashes)}
}

function Get-DevManualRecoveryBinding($Plan) {
    return [ordered]@{revision=1;runtime='owned-process-recovery';ownerSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;policy=(Get-DevManualMongoPolicy);parentBindingHash='D0F5315CF1EEF02F80DF29C8321EDFED90F433CE3A6257A9D97FE246987AA35C';initializationIntentHash='62D908896F4A43854BA7FF83BAF0EFB4CD6320FFBF8A07063998B3BF44796B0F';preparedManifestHash=(Get-FileHash -LiteralPath $Plan.bootstrapManifest).Hash;sources=(Get-DevManualSourceHashes)}
}

function Get-DevManualRecoveryV2Binding($Plan) {
    Assert-DevMongoPlan $Plan
    return [ordered]@{revision=2;runtime='owned-process-recovery';ownerSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;policy=(Get-DevManualMongoPolicy);parentBindingHash='D0F5315CF1EEF02F80DF29C8321EDFED90F433CE3A6257A9D97FE246987AA35C';previousRecoveryBindingHash='ACBB9C196E340B91CC5ECE5C9C1191E9FDE55696BB302033F2AE042851A923E2';initializationIntentHash='62D908896F4A43854BA7FF83BAF0EFB4CD6320FFBF8A07063998B3BF44796B0F';preparedManifestHash='4CC2E0F8744F5A8A6ECF443CB2BB51822095E4599DFA58FDA956014250711A29';originalMaterialFingerprint='DB78AA3A5B952C279C29442AD5DB6E1D0F252452D7F740867C4A8F7074D55547';sources=(Get-DevManualSourceHashes);allowedAction='InspectOwnedMongo';maximumAttempts=1}
}

function Assert-DevManualRecoveryV2Facts($Binding,$Expected,[string]$Action='InspectOwnedMongo') {
    if($Action -cne 'InspectOwnedMongo' -or $Binding -isnot [Collections.IDictionary] -or $Expected -isnot [Collections.IDictionary] -or $Binding.Count -ne 12 -or $Expected.Count -ne 12){throw 'DEV_MANUAL_RECOVERY_V_TWO_REJECTED'}
    foreach($key in $Expected.Keys){
        if(-not $Binding.Contains($key)){throw 'DEV_MANUAL_RECOVERY_V_TWO_REJECTED'}
        if($key -ceq 'policy'){Assert-DevManualPolicyAgreement $Expected.policy $Binding.policy}
        elseif($key -ceq 'sources'){
            if($Binding.sources -isnot [Collections.IDictionary] -or $Binding.sources.Count -ne 4){throw 'DEV_MANUAL_RECOVERY_V_TWO_REJECTED'}
            foreach($name in @('powershell','validator','helper','owner')){if(-not $Binding.sources.Contains($name) -or $Binding.sources[$name] -isnot [string] -or $Binding.sources[$name] -cnotmatch '^[A-F0-9]{64}$' -or $Binding.sources[$name] -cne $Expected.sources[$name]){throw 'DEV_MANUAL_RECOVERY_V_TWO_REJECTED'}}
        }elseif(($Binding[$key]|ConvertTo-Json -Compress) -cne ($Expected[$key]|ConvertTo-Json -Compress)){throw 'DEV_MANUAL_RECOVERY_V_TWO_REJECTED'}
    }
}

function Read-DevManualRecoveryV2Record($Plan,[string]$Name) {
    Assert-DevMongoPlan $Plan
    if($Name -cnotin @('manual-recovery-v1.json','manual-recovery-v2.json','manual-replica-inspection-v2-intent.json','manual-replica-inspection-v2.json')){throw 'DEV_MANUAL_PRIVATE_PATH_REJECTED'}
    $path=Join-Path $Plan.control $Name;Assert-DevPath $path
    if((Get-Acl -LiteralPath $path).GetSecurityDescriptorSddlForm('Access,Owner') -cne (Get-DevMongoAcl 'OwnerOnly' $true).GetSecurityDescriptorSddlForm('Access,Owner')){throw 'DEV_MANUAL_RECOVERY_V_TWO_REJECTED'}
    return Read-DevJson $path
}

function Assert-DevManualRecoveryV2Parent($Plan) {
    Read-DevManualRecoveryV2Record $Plan 'manual-recovery-v1.json' | Out-Null
    if((Get-FileHash -LiteralPath (Join-Path $Plan.control 'manual-recovery-v1.json')).Hash -cne 'ACBB9C196E340B91CC5ECE5C9C1191E9FDE55696BB302033F2AE042851A923E2' -or (Get-FileHash -LiteralPath $Plan.bootstrapManifest).Hash -cne '4CC2E0F8744F5A8A6ECF443CB2BB51822095E4599DFA58FDA956014250711A29'){throw 'DEV_MANUAL_RECOVERY_PARENT_CHANGED'}
}

function Get-DevManualBootstrapLineage {
    return [ordered]@{'manual-runtime.json'='D0F5315CF1EEF02F80DF29C8321EDFED90F433CE3A6257A9D97FE246987AA35C';'manual-initialize-intent.json'='62D908896F4A43854BA7FF83BAF0EFB4CD6320FFBF8A07063998B3BF44796B0F';'manual-recovery-v1.json'='ACBB9C196E340B91CC5ECE5C9C1191E9FDE55696BB302033F2AE042851A923E2';'manual-recovery-v2.json'='5ADCE5E996E2D98730DF2580F23DECB12016628E4EFAE3E9F8F529FD251A1BA7';'manual-replica-inspection-v2-intent.json'='99E08F7C43C906DB317886BC1741BB247C55F52EAF87B8F35DA9118335A3FC22';'manual-replica-inspection-v2.json'='3BF3B94AF5D763AB45C03122E1149B523797229EE08808A775A28AFE7DECA772'}
}

function Get-DevManualBootstrapReconciliation($Plan) {
    Assert-DevMongoPlan $Plan;$h=Get-DevManualBootstrapLineage
    return [ordered]@{revision=2;mode='BOOTSTRAP_FROM_VERIFIED_V_TWO';ownerSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;policy=(Get-DevManualMongoPolicy);action='BootstrapOwnedMongo';sources=(Get-DevManualSourceHashes);parentBindingHash=$h['manual-runtime.json'];initializationIntentHash=$h['manual-initialize-intent.json'];recoveryV1Hash=$h['manual-recovery-v1.json'];recoveryV2Hash=$h['manual-recovery-v2.json'];inspectionIntentHash=$h['manual-replica-inspection-v2-intent.json'];inspectionResultHash=$h['manual-replica-inspection-v2.json'];preparedManifestHash='4CC2E0F8744F5A8A6ECF443CB2BB51822095E4599DFA58FDA956014250711A29';originalMaterialFingerprint='DB78AA3A5B952C279C29442AD5DB6E1D0F252452D7F740867C4A8F7074D55547';maximumInitializationAttempts=1}
}

function Assert-DevManualBootstrapReconciliationFacts($Record,$Expected) {
    if($Record -isnot [Collections.IDictionary] -or $Record.Count -ne 15 -or $Expected -isnot [Collections.IDictionary] -or $Expected.Count -ne 15){throw 'DEV_MANUAL_BOOTSTRAP_RECONCILIATION_REJECTED'}
    foreach($key in $Expected.Keys){
        if(-not $Record.Contains($key)){throw 'DEV_MANUAL_BOOTSTRAP_RECONCILIATION_REJECTED'}
        if($key -ceq 'policy'){Assert-DevManualPolicyAgreement $Expected.policy $Record.policy}
        elseif($key -ceq 'sources'){
            if($Record.sources -isnot [Collections.IDictionary] -or $Record.sources.Count -ne 4){throw 'DEV_MANUAL_BOOTSTRAP_RECONCILIATION_REJECTED'}
            foreach($name in @('powershell','validator','helper','owner')){if(-not $Record.sources.Contains($name) -or $Record.sources[$name] -isnot [string] -or $Record.sources[$name] -cnotmatch '^[A-F0-9]{64}$' -or $Record.sources[$name] -cne $Expected.sources[$name]){throw 'DEV_MANUAL_BOOTSTRAP_RECONCILIATION_REJECTED'}}
        }elseif(($Record[$key]|ConvertTo-Json -Compress) -cne ($Expected[$key]|ConvertTo-Json -Compress)){throw 'DEV_MANUAL_BOOTSTRAP_RECONCILIATION_REJECTED'}
    }
}

function Read-DevManualBootstrapReconciliation($Plan) {
    $path=Join-Path $Plan.control 'manual-initialize-reconciliation-v1.json';Assert-DevPath $path
    if((Get-Acl -LiteralPath $path).GetSecurityDescriptorSddlForm('Access,Owner') -cne (Get-DevMongoAcl 'OwnerOnly' $true).GetSecurityDescriptorSddlForm('Access,Owner')){throw 'DEV_MANUAL_BOOTSTRAP_RECONCILIATION_REJECTED'}
    $record=Read-DevJson $path;Assert-DevManualBootstrapReconciliationFacts $record (Get-DevManualBootstrapReconciliation $Plan);return $record
}

function Assert-DevManualBootstrapLineage($Plan) {
    Assert-DevMongoPlan $Plan
    foreach($entry in (Get-DevManualBootstrapLineage).GetEnumerator()){
        $path=Join-Path $Plan.control $entry.Key;Assert-DevPath $path
        if((Get-FileHash -LiteralPath $path).Hash -cne $entry.Value -or (Get-Acl -LiteralPath $path).GetSecurityDescriptorSddlForm('Access,Owner') -cne (Get-DevMongoAcl 'OwnerOnly' $true).GetSecurityDescriptorSddlForm('Access,Owner')){throw 'DEV_MANUAL_BOOTSTRAP_RECONCILIATION_REJECTED'}
    }
    $result=Read-DevJson (Join-Path $Plan.control 'manual-replica-inspection-v2.json')
    if($result.state -cne 'REPLICA_NOT_INITIALIZED' -or $result.cleanup -cne 'FORCED_OWNED_JOB' -or $result.ownerSid -cne [Security.Principal.WindowsIdentity]::GetCurrent().User.Value){throw 'DEV_MANUAL_BOOTSTRAP_RECONCILIATION_REJECTED'}
}


function Get-DevManualNormalLineage {
    return [ordered]@{'manual-administrator-intent.json'='808910F26E372A28AD047388800845DF60CE8198F6155DFB2999171EB2957382';'manual-administrator.json'='12C6471B809DF75A072A9714FBBFE4CC9D3BAD30DBB895391872C2F314BE7D35';'manual-application-role-intent.json'='EE478222984AE9DFBCFC138EF3741008B12FF632A3739D94BA98B78B272CCA31';'manual-application-role.json'='B408ECF5BD6E183E96E8865FA6445D8A823B0A641CB040FE5EA7CC6964ACB2D8';'manual-application-user-intent.json'='BA3310D602961444CF07768829C64B23121B03DB527E4F5B26F15D16CAC707C6';'manual-application.json'='26B14DD74BC7B3734AFAD83B75A997250B2146F23C2D7F66F8CEDD727EF37AFE';'manual-initialize-intent.json'='62D908896F4A43854BA7FF83BAF0EFB4CD6320FFBF8A07063998B3BF44796B0F';'manual-initialize-reconciliation-v1.json'='12D6E72ED4261E09BE434419030E8D1434F7E4CBFED39E6B9D9AB78B10388D0B';'manual-recovery-v1.json'='ACBB9C196E340B91CC5ECE5C9C1191E9FDE55696BB302033F2AE042851A923E2';'manual-recovery-v2.json'='5ADCE5E996E2D98730DF2580F23DECB12016628E4EFAE3E9F8F529FD251A1BA7';'manual-replica-inspection-v2-intent.json'='99E08F7C43C906DB317886BC1741BB247C55F52EAF87B8F35DA9118335A3FC22';'manual-replica-inspection-v2.json'='3BF3B94AF5D763AB45C03122E1149B523797229EE08808A775A28AFE7DECA772';'manual-replica.json'='3B4FFFA77B47743E099C05F7BAF5BAEF5B29C408152CF15AA338B34B2589A34B';'manual-runtime.json'='D0F5315CF1EEF02F80DF29C8321EDFED90F433CE3A6257A9D97FE246987AA35C';'manual-shutdown-grant-intent.json'='8828AE847446E6CF516F6023B9B33619AA1B295639178A793871ACC357C3F784';'manual-shutdown-grant.json'='0D61CAD453A8590D319937B2919C04182E30D62F7A7D157AC6D2129D4593A1A8';'manual-shutdown-role-intent.json'='3FEB3381BDAFDB9A7E16C16F2C965E04C7A5C49B75EDC7D417285665F9178D87';'manual-shutdown-role.json'='14316AC891A0F0E4181396B92C8D3AF956C63A4C9DD4B459F5B8C5E1A6E171F2'}
}

function Assert-DevNormalAmendmentSelection([string]$Operation,[bool]$Bind,[bool]$Use,[bool]$Finalize,[bool]$Provision,[bool]$BindRuntime=$false,[bool]$UseRuntime=$false) {
    if(($BindRuntime -or $UseRuntime) -and (($BindRuntime -and $UseRuntime) -or $Bind -or $Use -or $Finalize -or $Provision -or ($BindRuntime -and $Operation -cne 'BindManualSources') -or ($UseRuntime -and $Operation -cne 'RunOwnedMongo'))){throw 'DEV_MANUAL_NORMAL_RUNTIME_REJECTED'}
    if(($Bind -and ($Use -or $Operation -cne 'BindManualSources')) -or ($Use -and $Operation -cne 'RunOwnedMongo') -or (($Bind -or $Use) -and ($Finalize -or $Provision))){throw 'DEV_MANUAL_NORMAL_AMENDMENT_REJECTED'}
}
function Get-DevNormalPreviousSources {
    return [ordered]@{powershell='FCB73A12DD8641FF23FC4163BD1FB93357BC9E5910440A7EF97E88681876DE61';validator='95D6BE9F15184B663C7517871839D9E345DC2E10A2B5BC24D058B00C830261AC';helper='1369C3AF8B71D2D9085838C3CFDE2EC42CBA526F7A62640891E70EA2240C108D';owner='BA8F2D916D5B04794270769E06C8B5CDB64A98729D28F0169AE9966F89AF9FB9'}
}
function Get-DevNormalAmendmentLineage {
    $lineage=Get-DevManualNormalLineage
    $lineage['manual-normal-transition.json']='27DDABEF2F3D4A466FC5D8730920738A35E282D1E1220606121D5366BD25721B'
    $lineage['manual-complete.json']='E3B63BC61A7762A3D8A63ED86841310225FF30E8F66D8E4E15153F9C81DB3DAB'
    return $lineage
}
function Get-DevNormalSourceAmendment($Plan) {
    Assert-DevMongoPlan $Plan
    $sources=Get-DevManualSourceHashes;$path=Join-Path $script:DevRepo 'scripts/Start-DeepLearnerDev.ps1';Assert-DevPath $path;$sources['starter']=(Get-FileHash $path).Hash
    return [ordered]@{revision=1;purpose='DF_NORMAL_RUNTIME_SOURCE_AMENDMENT';ownerSid='S-1-5-21-3436178198-164699745-524212520-1001';policy=(Get-DevManualMongoPolicy);action='RunOwnedMongo';allowedActions=@('verify-normal','shutdown-normal');maximumAttempts=1;normalConfigurationHash='46DF9958682B4BEE0AA445FC3B7290FDB442ECAF587CB49286195A5CF6A951D8';originalMaterialFingerprint='DB78AA3A5B952C279C29442AD5DB6E1D0F252452D7F740867C4A8F7074D55547';provisioningBindingHash='618AAE9C151A416B483F6116AAD3078C4A3397E5F411E54FB8892C64CE172BDA';previousSources=(Get-DevNormalPreviousSources);sources=$sources;lineage=(Get-DevNormalAmendmentLineage)}
}
function Assert-DevNormalAmendmentKeys($Value,[string[]]$Keys) {
    if($Value -isnot [Collections.IDictionary] -or $Value.psbase.Count -ne $Keys.Count -or @(Compare-Object -CaseSensitive $Keys @($Value.psbase.Keys)).Count){throw 'DEV_MANUAL_NORMAL_AMENDMENT_REJECTED'}
}
function Assert-DevNormalSourceAmendmentFacts($Record,$Expected) {
    if($Record -isnot [Collections.IDictionary] -or $Record.psbase.Count -ne 13 -or $Expected.psbase.Count -ne 13){throw 'DEV_MANUAL_NORMAL_AMENDMENT_REJECTED'}
    Assert-DevNormalAmendmentKeys $Record @($Expected.psbase.Keys)
    foreach($key in $Expected.Keys){
        if(-not $Record.Contains($key)){throw 'DEV_MANUAL_NORMAL_AMENDMENT_REJECTED'}
        if($key -ceq 'policy'){if($Record.policy.status -isnot [string]){throw 'DEV_MANUAL_NORMAL_AMENDMENT_REJECTED'};Assert-DevNormalAmendmentKeys $Record.policy @($Expected.policy.psbase.Keys);Assert-DevNormalAmendmentKeys $Record.policy.target @($Expected.policy.target.psbase.Keys);Assert-DevManualPolicyAgreement $Expected.policy $Record.policy}
        elseif($key -cin @('sources','previousSources','lineage')){
            if($Record[$key] -isnot [Collections.IDictionary] -or $Record[$key].psbase.Count -ne $Expected[$key].psbase.Count){throw 'DEV_MANUAL_NORMAL_AMENDMENT_REJECTED'}
            Assert-DevNormalAmendmentKeys $Record[$key] @($Expected[$key].psbase.Keys)
            foreach($name in $Expected[$key].Keys){if(-not $Record[$key].Contains($name) -or $Record[$key][$name] -isnot [string] -or $Record[$key][$name] -cnotmatch '^[A-F0-9]{64}$' -or $Record[$key][$name] -cne $Expected[$key][$name]){throw 'DEV_MANUAL_NORMAL_AMENDMENT_REJECTED'}}
        }elseif($key -ceq 'allowedActions'){
            if($Record[$key] -isnot [array] -or $Record[$key].Count -ne 2 -or $Record[$key][0] -isnot [string] -or $Record[$key][1] -isnot [string] -or $Record[$key][0] -cne 'verify-normal' -or $Record[$key][1] -cne 'shutdown-normal'){throw 'DEV_MANUAL_NORMAL_AMENDMENT_REJECTED'}
        }elseif($key -cin @('revision','maximumAttempts')){
            if(($Record[$key] -isnot [int] -and $Record[$key] -isnot [long]) -or $Record[$key] -ne 1){throw 'DEV_MANUAL_NORMAL_AMENDMENT_REJECTED'}
        }elseif($Record[$key] -isnot [string] -or $Record[$key] -cne $Expected[$key]){throw 'DEV_MANUAL_NORMAL_AMENDMENT_REJECTED'}
    }
}
function Read-DevNormalSourceAmendment($Plan) {
    $path=Join-Path $Plan.control 'manual-normal-source-amendment.json';Assert-DevPath $path
    if((Get-Acl $path).GetSecurityDescriptorSddlForm('Access,Owner') -cne (Get-DevMongoAcl 'OwnerOnly' $true).GetSecurityDescriptorSddlForm('Access,Owner')){throw 'DEV_MANUAL_NORMAL_AMENDMENT_REJECTED'}
    $record=Read-DevJson $path;Assert-DevNormalSourceAmendmentFacts $record (Get-DevNormalSourceAmendment $Plan);return $record
}
function Assert-DevNormalAmendmentAttemptFacts($Record,[string]$Owner,[string]$Hash) {
    if($Hash -cnotmatch '^[A-F0-9]{64}$' -or $Record -isnot [Collections.IDictionary] -or $Record.psbase.Count -ne 6){throw 'DEV_MANUAL_NORMAL_AMENDMENT_REJECTED'}
    Assert-DevNormalAmendmentKeys $Record @('revision','ownerSid','bindingHash','action','state','attempt')
    foreach($entry in @(@('ownerSid',$Owner),@('bindingHash',$Hash),@('action','RunOwnedMongo'),@('state','CONSUMED_BEFORE_STARTUP'))){if(-not $Record.Contains($entry[0]) -or $Record[$entry[0]] -isnot [string] -or $Record[$entry[0]] -cne $entry[1]){throw 'DEV_MANUAL_NORMAL_AMENDMENT_REJECTED'}}
    foreach($key in @('revision','attempt')){if(-not $Record.Contains($key) -or ($Record[$key] -isnot [int] -and $Record[$key] -isnot [long]) -or $Record[$key] -ne 1){throw 'DEV_MANUAL_NORMAL_AMENDMENT_REJECTED'}}
}
function Read-DevNormalAmendmentAttempt($Plan) {
    $path=Join-Path $Plan.control 'manual-normal-source-amendment-intent.json';Assert-DevPath $path
    if((Get-Acl $path).GetSecurityDescriptorSddlForm('Access,Owner') -cne (Get-DevMongoAcl 'OwnerOnly' $true).GetSecurityDescriptorSddlForm('Access,Owner')){throw 'DEV_MANUAL_NORMAL_AMENDMENT_REJECTED'}
    Assert-DevNormalAmendmentAttemptFacts (Read-DevJson $path) ([Security.Principal.WindowsIdentity]::GetCurrent().User.Value) (Get-FileHash (Join-Path $Plan.control 'manual-normal-source-amendment.json')).Hash
}
function Assert-DevNormalAmendmentUnused($Plan,[switch]$Binding) {
    $names=@('manual-normal-source-amendment-intent.json');if($Binding){$names+='manual-normal-source-amendment.json'}
    Assert-DevPath $Plan.control;$entries=@(Get-ChildItem -LiteralPath $Plan.control -Force)
    foreach($name in $names){if(@($entries|Where-Object {$_.Name -ieq $name}).Count){throw 'DEV_MANUAL_NORMAL_AMENDMENT_CONSUMED'}}
}
function Write-DevNormalAmendmentPrivate($Plan,[string]$Name,$Record) {
    if($Name -ceq 'manual-normal-source-amendment.json'){Assert-DevManualExecutionPolicy -AllowedActions @('BindManualSources');Assert-DevNormalSourceAmendmentFacts $Record (Get-DevNormalSourceAmendment $Plan)}
    elseif($Name -ceq 'manual-normal-source-amendment-intent.json'){Assert-DevManualExecutionPolicy -AllowedActions @('RunOwnedMongo');Read-DevNormalSourceAmendment $Plan|Out-Null;Assert-DevNormalAmendmentAttemptFacts $Record ([Security.Principal.WindowsIdentity]::GetCurrent().User.Value) (Get-FileHash (Join-Path $Plan.control 'manual-normal-source-amendment.json')).Hash}
    else{throw 'DEV_MANUAL_NORMAL_AMENDMENT_REJECTED'}
    Assert-DevNormalAmendmentUnused $Plan -Binding:($Name -ceq 'manual-normal-source-amendment.json')
    $path=Join-Path $Plan.control $Name;Assert-DevPath $path;$bytes=[Text.Encoding]::UTF8.GetBytes(($Record|ConvertTo-Json -Compress -Depth 12))
    $stream=[IO.FileSystemAclExtensions]::Create([IO.FileInfo]::new($path),[IO.FileMode]::CreateNew,[Security.AccessControl.FileSystemRights]::Write,[IO.FileShare]::Read,4096,[IO.FileOptions]::None,(Get-DevMongoAcl 'OwnerOnly' $true))
    try{$stream.Write($bytes);$stream.Flush($true)}finally{$stream.Dispose()}
    if((Get-Acl $path).GetSecurityDescriptorSddlForm('Access,Owner') -cne (Get-DevMongoAcl 'OwnerOnly' $true).GetSecurityDescriptorSddlForm('Access,Owner') -or (Get-FileHash $path).Hash -cne [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($bytes))){throw 'DEV_MANUAL_NORMAL_AMENDMENT_REJECTED'}
}
function Read-DevHistoricalNormalTransition($Plan) {
    $expected=Get-DevManualNormalTransition $Plan;$expected.sources=Get-DevNormalPreviousSources
    $path=Join-Path $Plan.control 'manual-normal-transition.json'
    if((Get-FileHash $path).Hash -cne (Get-DevNormalAmendmentLineage)['manual-normal-transition.json']){throw 'DEV_MANUAL_NORMAL_AMENDMENT_REJECTED'}
    Assert-DevManualNormalTransitionFacts (Read-DevJson $path) $expected
}
function Assert-DevNormalAmendmentDirectoryFacts($Entries) {
    $allowed=@((Get-DevNormalAmendmentLineage).Keys)+@('manual-normal-source-amendment.json','manual-normal-source-amendment-intent.json')
    foreach($entry in $Entries){
        if($entry.Name -isnot [string] -or $entry.Name -ieq 'mongod.next.cfg'){throw 'DEV_MANUAL_NORMAL_AMENDMENT_REJECTED'}
        if($entry.Name -ilike 'manual-*.json'){
            if($entry.PSIsContainer -isnot [bool] -or $entry.PSIsContainer -or $entry.Attributes -isnot [IO.FileAttributes] -or ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $entry.Name -cnotin $allowed){throw 'DEV_MANUAL_NORMAL_AMENDMENT_REJECTED'}
        }
    }
}
function Assert-DevNormalAmendmentState($Plan,[IO.FileStream]$LifecycleLock=$null) {
    Assert-DevManualExecutionPolicy -AllowedActions @('BindManualSources','RunOwnedMongo')
    if([Security.Principal.WindowsIdentity]::GetCurrent().User.Value -cne 'S-1-5-21-3436178198-164699745-524212520-1001'){throw 'DEV_MANUAL_NORMAL_AMENDMENT_REJECTED'}
    Assert-DevManualPrepared $Plan -NormalTransition -NormalSourceAmendment -LifecycleLock $LifecycleLock
    if((Assert-DevManualNormalState $Plan) -cne 'Normal'){throw 'DEV_MANUAL_NORMAL_AMENDMENT_REJECTED'}
    foreach($entry in (Get-DevNormalAmendmentLineage).GetEnumerator()){$path=Join-Path $Plan.control $entry.Key;Assert-DevPath $path;if((Get-FileHash $path).Hash -cne $entry.Value -or (Get-Acl $path).GetSecurityDescriptorSddlForm('Access,Owner') -cne (Get-DevMongoAcl 'OwnerOnly' $true).GetSecurityDescriptorSddlForm('Access,Owner')){throw 'DEV_MANUAL_NORMAL_AMENDMENT_REJECTED'}}
    $allowed=@((Get-DevNormalAmendmentLineage).Keys)+@('manual-normal-source-amendment.json','manual-normal-source-amendment-intent.json')
    $entries=@(Get-ChildItem -LiteralPath $Plan.control -Force);Assert-DevNormalAmendmentDirectoryFacts $entries
    foreach($entry in @($entries|Where-Object {$_.Name -ilike 'manual-*.json'})){Assert-DevPath $entry.FullName}
    $path=Join-Path $Plan.control 'local-provisioning-sources.json';Assert-DevPath $path
    if((Get-FileHash $path).Hash -cne '618AAE9C151A416B483F6116AAD3078C4A3397E5F411E54FB8892C64CE172BDA' -or (Get-Acl $path).GetSecurityDescriptorSddlForm('Access,Owner') -cne (Get-DevMongoAcl 'OwnerOnly' $true).GetSecurityDescriptorSddlForm('Access,Owner')){throw 'DEV_MANUAL_NORMAL_AMENDMENT_REJECTED'}
}
function Invoke-DevNormalSourceBinding {
    Assert-DevManualExecutionPolicy -AllowedActions @('BindManualSources')
    $plan=Get-DevMongoPlan;$lock=$null
    try{
        Assert-DevNormalAmendmentState $plan;Assert-DevNormalAmendmentUnused $plan -Binding;Assert-DevMongoPortFree
        $lock=[IO.File]::Open($plan.operationLock,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
        Assert-DevNormalAmendmentState $plan $lock;Assert-DevNormalAmendmentUnused $plan -Binding
        Write-DevNormalAmendmentPrivate $plan 'manual-normal-source-amendment.json' (Get-DevNormalSourceAmendment $plan)
        Read-DevNormalSourceAmendment $plan|Out-Null;Assert-DevNormalAmendmentState $plan $lock
        return @{status='NORMAL_SOURCE_AMENDMENT_CREATED';runtime='NOT_RUN';originalRecords='PRESERVED'}
    }finally{if($null -ne $lock){$lock.Dispose()}}
}

function Get-DevNormalRuntimeLineage {
    $value=Get-DevNormalAmendmentLineage
    $value['manual-normal-source-amendment.json']='BAEB71F91BA09F1338096EDBE36B04A2F979469C06DE6AF603E53751764F47D8'
    $value['manual-normal-source-amendment-intent.json']='8D25D8D823B273177826C5D93BD232011B93C46202777A8BC8932031A38A2115'
    return $value
}
function Get-DevQualifiedNormalSources {
    return [ordered]@{powershell='ED05287AA9C3DBE5E9E3D73DEE4703C23E59FFE06686047D7EF93A810B740AF6';validator='95D6BE9F15184B663C7517871839D9E345DC2E10A2B5BC24D058B00C830261AC';helper='9E5CBBB306C23A56DC38B865804C27EEC149261DCFFF77775DB46A3F31B532B6';owner='A61F9FBF1EF8A9FACBB58E899FDD0E27F72965CDBE12C9A166413991C421C4B7';starter='15D43A314A1C06926C39564BA6DC41896681EBABCCE76BD819D31B59E6F1DD0C'}
}
function Get-DevNormalRuntimeBinding($Plan) {
    Assert-DevMongoPlan $Plan
    $sources=Get-DevManualSourceHashes;$sources['starter']=(Get-FileHash (Join-Path $script:DevRepo 'scripts/Start-DeepLearnerDev.ps1')).Hash
    return [ordered]@{revision=1;purpose='REUSABLE_NORMAL_RUNTIME';ownerSid='S-1-5-21-3436178198-164699745-524212520-1001';repository='E:\AI\DeepLearner';policy=(Get-DevManualMongoPolicy);action='RunOwnedMongo';lifecycle='REUSABLE_NORMAL';allowedActions=@('verify-normal','shutdown-normal');sources=$sources;lineage=(Get-DevNormalRuntimeLineage);normalConfigurationHash='46DF9958682B4BEE0AA445FC3B7290FDB442ECAF587CB49286195A5CF6A951D8';binaryHash='89C1F5664DA621A6AD8A0B26DF880BAC8265BFA921F430520A1DB158CAF2F8FE';preparedManifestHash='4CC2E0F8744F5A8A6ECF443CB2BB51822095E4599DFA58FDA956014250711A29';originalMaterialFingerprint='DB78AA3A5B952C279C29442AD5DB6E1D0F252452D7F740867C4A8F7074D55547';provisioningBindingHash='618AAE9C151A416B483F6116AAD3078C4A3397E5F411E54FB8892C64CE172BDA'}
}
function Assert-DevNormalRuntimeValue($Value,$Expected) {
    if($Expected -is [Collections.IDictionary]){
        if($Value -isnot [Collections.IDictionary] -or $Value.psbase.Count -ne $Expected.psbase.Count -or @(Compare-Object -CaseSensitive @($Expected.psbase.Keys) @($Value.psbase.Keys)).Count){throw 'DEV_MANUAL_NORMAL_RUNTIME_REJECTED'}
        foreach($key in $Expected.Keys){if(-not $Value.Contains($key)){throw 'DEV_MANUAL_NORMAL_RUNTIME_REJECTED'};Assert-DevNormalRuntimeValue $Value[$key] $Expected[$key]}
    }elseif($Expected -is [array]){
        if($Value -isnot [array] -or $Value.Count -ne $Expected.Count){throw 'DEV_MANUAL_NORMAL_RUNTIME_REJECTED'}
        for($i=0;$i -lt $Expected.Count;$i++){Assert-DevNormalRuntimeValue $Value[$i] $Expected[$i]}
    }elseif($Expected -is [string]){if($Value -isnot [string] -or $Value -cne $Expected){throw 'DEV_MANUAL_NORMAL_RUNTIME_REJECTED'}}
    elseif(($Value -isnot [int] -and $Value -isnot [long]) -or $Value -ne $Expected){throw 'DEV_MANUAL_NORMAL_RUNTIME_REJECTED'}
}
function Assert-DevNormalRuntimeFacts($Record,$Expected) {Assert-DevNormalRuntimeValue $Record $Expected}
function Assert-DevNormalRuntimeOwner([string]$OwnerSid,[string]$Repository,[bool]$Administrator) {
    if($OwnerSid -cne 'S-1-5-21-3436178198-164699745-524212520-1001' -or $Repository -cne 'E:\AI\DeepLearner' -or $Administrator){throw 'DEV_MANUAL_NORMAL_RUNTIME_REJECTED'}
}
function Assert-DevNormalRuntimeDirectoryFacts($Entries) {
    $allowed=@((Get-DevNormalRuntimeLineage).Keys)+@('manual-normal-runtime.json')
    foreach($entry in $Entries){
        if($entry.Name -isnot [string] -or $entry.Name -ieq 'mongod.next.cfg'){throw 'DEV_MANUAL_NORMAL_RUNTIME_REJECTED'}
        if($entry.Name -ilike 'manual-*.json' -and ($entry.Name -cnotin $allowed -or $entry.PSIsContainer -isnot [bool] -or $entry.PSIsContainer -or $entry.Attributes -isnot [IO.FileAttributes] -or ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint))){throw 'DEV_MANUAL_NORMAL_RUNTIME_REJECTED'}
    }
}
function Read-DevNormalRuntimeBinding($Plan) {
    $path=Join-Path $Plan.control 'manual-normal-runtime.json';Assert-DevPath $path
    if((Get-Acl $path).GetSecurityDescriptorSddlForm('Access,Owner') -cne (Get-DevMongoAcl 'OwnerOnly' $true).GetSecurityDescriptorSddlForm('Access,Owner')){throw 'DEV_MANUAL_NORMAL_RUNTIME_REJECTED'}
    $record=Read-DevJson $path;Assert-DevNormalRuntimeFacts $record (Get-DevNormalRuntimeBinding $Plan);return $record
}
function Assert-DevNormalRuntimeState($Plan,[IO.FileStream]$LifecycleLock=$null,[switch]$AllowMissingBinding) {
    Assert-DevManualExecutionPolicy -AllowedActions @('BindManualSources','RunOwnedMongo')
    $identity=[Security.Principal.WindowsIdentity]::GetCurrent()
    Assert-DevNormalRuntimeOwner $identity.User.Value $script:DevRepo ([Security.Principal.WindowsPrincipal]::new($identity)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    Assert-DevManualPrepared $Plan -NormalTransition -NormalRuntime -LifecycleLock $LifecycleLock
    if((Assert-DevManualNormalState $Plan) -cne 'Normal' -or -not (Get-DevManualStage $Plan 'complete')){throw 'DEV_MANUAL_NORMAL_RUNTIME_REJECTED'}
    foreach($entry in (Get-DevNormalRuntimeLineage).GetEnumerator()){$path=Join-Path $Plan.control $entry.Key;Assert-DevPath $path;if((Get-FileHash $path).Hash -cne $entry.Value -or (Get-Acl $path).GetSecurityDescriptorSddlForm('Access,Owner') -cne (Get-DevMongoAcl 'OwnerOnly' $true).GetSecurityDescriptorSddlForm('Access,Owner')){throw 'DEV_MANUAL_NORMAL_RUNTIME_REJECTED'}}
    $archived=Get-DevNormalSourceAmendment $Plan;$archived.sources=Get-DevQualifiedNormalSources
    Assert-DevNormalSourceAmendmentFacts (Read-DevJson (Join-Path $Plan.control 'manual-normal-source-amendment.json')) $archived
    Read-DevNormalAmendmentAttempt $Plan
    Assert-DevNormalRuntimeDirectoryFacts @(Get-ChildItem -LiteralPath $Plan.control -Force)
    $path=Join-Path $Plan.control 'local-provisioning-sources.json';Assert-DevPath $path
    if((Get-FileHash $path).Hash -cne '618AAE9C151A416B483F6116AAD3078C4A3397E5F411E54FB8892C64CE172BDA' -or (Get-Acl $path).GetSecurityDescriptorSddlForm('Access,Owner') -cne (Get-DevMongoAcl 'OwnerOnly' $true).GetSecurityDescriptorSddlForm('Access,Owner')){throw 'DEV_MANUAL_NORMAL_RUNTIME_REJECTED'}
    if(-not $AllowMissingBinding){Read-DevNormalRuntimeBinding $Plan|Out-Null}
}
function Assert-DevNormalRuntimeAbsent($Plan) {
    if(@(Get-ChildItem -LiteralPath $Plan.control -Force|Where-Object Name -IEQ 'manual-normal-runtime.json').Count){throw 'DEV_MANUAL_NORMAL_RUNTIME_EXISTS'}
}
function Assert-DevNormalRuntimeStorage($Plan) {
    Assert-DevMongoPlan $Plan;Assert-DevPath $Plan.storage
    $pending=[Collections.Generic.Stack[object]]::new();$pending.Push(@{path=$Plan.storage;depth=0});$count=0
    while($pending.Count){
        $directory=$pending.Pop()
        foreach($entry in @(Get-ChildItem -LiteralPath $directory.path -Force -ErrorAction Stop)){
            $count++;if($count -gt 100000 -or $directory.depth -ge 128 -or ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'DEV_MANUAL_NORMAL_RUNTIME_REJECTED'}
            $full=[IO.Path]::GetFullPath($entry.FullName)
            if(-not $full.StartsWith($Plan.storage.TrimEnd('\')+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'DEV_MANUAL_NORMAL_RUNTIME_REJECTED'}
            Assert-DevPath $full
            if((Get-Acl -LiteralPath $full -ErrorAction Stop).GetOwner([Security.Principal.SecurityIdentifier]).Value -cne 'S-1-5-21-3436178198-164699745-524212520-1001'){throw 'DEV_MANUAL_NORMAL_RUNTIME_REJECTED'}
            if($entry.PSIsContainer){$pending.Push(@{path=$full;depth=($directory.depth+1)})}
        }
    }
}
function Write-DevNormalRuntimeBinding($Plan,$Record) {
    Assert-DevManualExecutionPolicy -AllowedActions @('BindManualSources')
    Assert-DevNormalRuntimeFacts $Record (Get-DevNormalRuntimeBinding $Plan);Assert-DevNormalRuntimeAbsent $Plan
    $path=Join-Path $Plan.control 'manual-normal-runtime.json';Assert-DevPath $path
    $bytes=[Text.Encoding]::UTF8.GetBytes(($Record|ConvertTo-Json -Compress -Depth 12))
    $stream=[IO.FileSystemAclExtensions]::Create([IO.FileInfo]::new($path),[IO.FileMode]::CreateNew,[Security.AccessControl.FileSystemRights]::Write,[IO.FileShare]::Read,4096,[IO.FileOptions]::None,(Get-DevMongoAcl 'OwnerOnly' $true))
    try{$stream.Write($bytes);$stream.Flush($true)}finally{$stream.Dispose()}
    if((Get-FileHash $path).Hash -cne [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($bytes))){throw 'DEV_MANUAL_NORMAL_RUNTIME_REJECTED'}
    Read-DevNormalRuntimeBinding $Plan|Out-Null
}
function Invoke-DevNormalRuntimeBinding {
    Assert-DevManualExecutionPolicy -AllowedActions @('BindManualSources')
    $plan=Get-DevMongoPlan;$lock=$null
    try{
        Assert-DevNormalRuntimeState $plan -AllowMissingBinding;Assert-DevNormalRuntimeAbsent $plan;Assert-DevMongoPortFree;Assert-DevNormalRuntimeStorage $plan
        $lock=[IO.File]::Open($plan.operationLock,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
        Assert-DevNormalRuntimeState $plan $lock -AllowMissingBinding;Assert-DevNormalRuntimeAbsent $plan;Assert-DevNormalRuntimeStorage $plan
        Write-DevNormalRuntimeBinding $plan (Get-DevNormalRuntimeBinding $plan)
        Assert-DevNormalRuntimeState $plan $lock
        return @{status='NORMAL_RUNTIME_BOUND';runtime='NOT_RUN';historicalRecords='PRESERVED';lifecycle='REUSABLE_NORMAL'}
    }finally{if($null -ne $lock){$lock.Dispose()}}
}

function Get-DevManualNormalTransition($Plan) {
    Assert-DevMongoPlan $Plan
    return [ordered]@{revision=1;purpose='COMPLETED_BOOTSTRAP_NORMAL_TRANSITION';ownerSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;policy=(Get-DevManualMongoPolicy);sources=(Get-DevManualSourceHashes);lineage=(Get-DevManualNormalLineage);normalConfigurationHash='46DF9958682B4BEE0AA445FC3B7290FDB442ECAF587CB49286195A5CF6A951D8';allowedActions=@('verify-normal','shutdown-normal')}
}

function Assert-DevManualProvisioner($Plan) {
    Assert-DevManualExecutionPolicy -AllowedActions @('RunOwnedMongo')
    Assert-DevMongoPlan $Plan
    Read-DevManualNormalTransition $Plan | Out-Null
    $path=Join-Path $Plan.control 'local-provisioning-sources.json';Assert-DevPath $path
    if((Get-Acl -LiteralPath $path).GetSecurityDescriptorSddlForm('Access,Owner') -cne (Get-DevMongoAcl 'OwnerOnly' $true).GetSecurityDescriptorSddlForm('Access,Owner')){throw 'DEV_MANUAL_PROVISIONER_SOURCE_REJECTED'}
    $record=Read-DevJson $path
    if($record -isnot [Collections.IDictionary] -or $record.Count -ne 6 -or $record.revision -isnot [long] -and $record.revision -isnot [int]){throw 'DEV_MANUAL_PROVISIONER_SOURCE_REJECTED'}
    if($record.revision -ne 1 -or $record.purpose -isnot [string] -or $record.purpose -cne 'ADDITIVE_SCHEMA_SYNTHETIC_FIXTURES' -or $record.ownerSid -isnot [string] -or $record.ownerSid -cne [Security.Principal.WindowsIdentity]::GetCurrent().User.Value -or $record.allowedAction -isnot [string] -or $record.allowedAction -cne 'ProvisionLocal' -or $record.normalTransitionHash -isnot [string] -or $record.normalTransitionHash -cne (Get-FileHash -LiteralPath (Join-Path $Plan.control 'manual-normal-transition.json')).Hash -or $record.sources -isnot [Collections.IDictionary] -or $record.sources.Count -ne 2){throw 'DEV_MANUAL_PROVISIONER_SOURCE_REJECTED'}
    foreach($entry in @(@('powershell','scripts/Provision-DeepLearnerDev.ps1'),@('helper','apps/api/scripts/dev-persistent-setup.ts'))){
        $source=Join-Path $script:DevRepo $entry[1];Assert-DevPath $source
        if(-not $record.sources.Contains($entry[0]) -or $record.sources[$entry[0]] -isnot [string] -or $record.sources[$entry[0]] -cnotmatch '^[A-F0-9]{64}$' -or $record.sources[$entry[0]] -cne (Get-FileHash -LiteralPath $source).Hash){throw 'DEV_MANUAL_PROVISIONER_SOURCE_REJECTED'}
    }
}

function Assert-DevManualNormalTransitionFacts($Record,$Expected) {
    if($Record -isnot [Collections.IDictionary] -or $Record.Count -ne 8 -or $Expected -isnot [Collections.IDictionary] -or $Expected.Count -ne 8){throw 'DEV_MANUAL_NORMAL_TRANSITION_REJECTED'}
    foreach($key in $Expected.Keys){
        if(-not $Record.Contains($key)){throw 'DEV_MANUAL_NORMAL_TRANSITION_REJECTED'}
        if($key -ceq 'policy'){Assert-DevManualPolicyAgreement $Expected.policy $Record.policy}
        elseif($key -cin @('sources','lineage')){
            if($Record[$key] -isnot [Collections.IDictionary] -or $Record[$key].Count -ne $Expected[$key].Count){throw 'DEV_MANUAL_NORMAL_TRANSITION_REJECTED'}
            foreach($name in $Expected[$key].Keys){if(-not $Record[$key].Contains($name) -or $Record[$key][$name] -isnot [string] -or $Record[$key][$name] -cnotmatch '^[A-F0-9]{64}$' -or $Record[$key][$name] -cne $Expected[$key][$name]){throw 'DEV_MANUAL_NORMAL_TRANSITION_REJECTED'}}
        }elseif(($Record[$key]|ConvertTo-Json -Compress) -cne ($Expected[$key]|ConvertTo-Json -Compress)){throw 'DEV_MANUAL_NORMAL_TRANSITION_REJECTED'}
    }
}

function Read-DevManualNormalTransition($Plan) {
    $path=Join-Path $Plan.control 'manual-normal-transition.json';Assert-DevPath $path
    if((Get-Acl -LiteralPath $path).GetSecurityDescriptorSddlForm('Access,Owner') -cne (Get-DevMongoAcl 'OwnerOnly' $true).GetSecurityDescriptorSddlForm('Access,Owner')){throw 'DEV_MANUAL_NORMAL_TRANSITION_REJECTED'}
    $record=Read-DevJson $path;Assert-DevManualNormalTransitionFacts $record (Get-DevManualNormalTransition $Plan);return $record
}

function Assert-DevManualNormalLineage($Plan,[switch]$NormalSourceAmendment,[switch]$NormalRuntime) {
    foreach($entry in (Get-DevManualNormalLineage).GetEnumerator()){
        $path=Join-Path $Plan.control $entry.Key;Assert-DevPath $path
        if((Get-FileHash -LiteralPath $path).Hash -cne $entry.Value -or (Get-Acl -LiteralPath $path).GetSecurityDescriptorSddlForm('Access,Owner') -cne (Get-DevMongoAcl 'OwnerOnly' $true).GetSecurityDescriptorSddlForm('Access,Owner')){throw 'DEV_MANUAL_NORMAL_TRANSITION_REJECTED'}
    }
    $allowed=@((Get-DevManualNormalLineage).Keys)+@('manual-normal-transition.json','manual-complete.json');if($NormalSourceAmendment -or $NormalRuntime){$allowed+=@('manual-normal-source-amendment.json','manual-normal-source-amendment-intent.json')};if($NormalRuntime){$allowed+='manual-normal-runtime.json'}
    foreach($file in @(Get-ChildItem -LiteralPath $Plan.control -Filter 'manual-*.json' -File)){if($file.Name -cnotin $allowed){throw 'DEV_MANUAL_NORMAL_TRANSITION_REJECTED'}}
    foreach($stage in @('initialize-intent','replica','administrator-intent','administrator','shutdown-role-intent','shutdown-role','shutdown-grant-intent','shutdown-grant','application-role-intent','application-role','application-user-intent','application')){if(-not (Get-DevManualStage $Plan $stage)){throw 'DEV_MANUAL_NORMAL_TRANSITION_REJECTED'}}
    Get-DevManualStage $Plan 'complete' | Out-Null
}

function Assert-DevManualNormalState($Plan) {
    $phase=Get-DevMongoConfigurationPhase $Plan
    if($phase -ceq 'Bootstrap'){
        if((Get-DevManualStage $Plan 'complete') -or -not (Test-Path -LiteralPath $Plan.nextConfiguration -PathType Leaf)){throw 'DEV_MANUAL_TRANSITION_UNKNOWN_RECONCILE'}
        Assert-DevPath $Plan.nextConfiguration
        if((Get-FileHash -LiteralPath $Plan.nextConfiguration).Hash -cne '46DF9958682B4BEE0AA445FC3B7290FDB442ECAF587CB49286195A5CF6A951D8' -or (Get-Acl -LiteralPath $Plan.nextConfiguration).GetSecurityDescriptorSddlForm('Access,Owner') -cne (Get-DevMongoAcl 'Read' $true).GetSecurityDescriptorSddlForm('Access,Owner')){throw 'DEV_MANUAL_TRANSITION_UNKNOWN_RECONCILE'}
    }elseif($phase -cne 'Normal' -or (Test-Path -LiteralPath $Plan.nextConfiguration)){throw 'DEV_MANUAL_TRANSITION_UNKNOWN_RECONCILE'}
    return $phase
}

function Get-DevManualNativeDiagnostic($ErrorRecord,[ValidateSet('NORMAL_CONFIGURATION_REPLACE')][string]$Stage) {
    $errorObject=$ErrorRecord.Exception
    while($null -ne $errorObject.InnerException){$errorObject=$errorObject.InnerException}
    $kind=if($errorObject -is [ArgumentException]){'ARGUMENT_ERROR'}elseif($errorObject -is [UnauthorizedAccessException]){'ACCESS_DENIED'}elseif($errorObject -is [IO.IOException]){'IO_ERROR'}else{'NATIVE_ERROR'}
    return [ordered]@{stage=$Stage;classification=$kind;exceptionType=$errorObject.GetType().FullName;hresult=$errorObject.HResult;message='Native operation failed; private arguments and raw error text withheld.';mongoConnectionAttempted=$false;state='UNKNOWN';automaticRetry=$false}
}

function Move-DevManualNormalConfiguration($Plan) {
    Assert-DevManualExecutionPolicy -AllowedActions @('BootstrapOwnedMongo')
    Assert-DevMongoPlan $Plan
    try{[IO.File]::Replace($Plan.nextConfiguration,$Plan.configuration,[Management.Automation.Language.NullString]::Value)}
    catch{Write-Host ((Get-DevManualNativeDiagnostic $_ 'NORMAL_CONFIGURATION_REPLACE')|ConvertTo-Json -Compress);throw 'DEV_MANUAL_NORMAL_PROMOTION_FAILED'}
}

function Invoke-DevManualNormalFinalization($Plan,[IO.FileStream]$LifecycleLock=$null) {
    Assert-DevManualExecutionPolicy -AllowedActions @('BootstrapOwnedMongo')
    $runtime=$null
    try{
        Assert-DevManualPrepared $Plan -NormalTransition -AllowUnreconciled -LifecycleLock $LifecycleLock
        Assert-DevMongoPortFree
        $phase=Assert-DevManualNormalState $Plan
        $record=Join-Path $Plan.control 'manual-normal-transition.json'
        if(-not (Test-Path -LiteralPath $record)){
            if($phase -cne 'Bootstrap'){throw 'DEV_MANUAL_NORMAL_TRANSITION_REJECTED'}
            Write-DevManualPrivate $Plan 'manual-normal-transition.json' ([Text.Encoding]::UTF8.GetBytes(((Get-DevManualNormalTransition $Plan)|ConvertTo-Json -Compress -Depth 10)))
        }
        Read-DevManualNormalTransition $Plan | Out-Null
        if($phase -ceq 'Bootstrap'){
            Assert-DevManualNormalState $Plan | Out-Null
            Move-DevManualNormalConfiguration $Plan
            Assert-DevManualPrepared $Plan -NormalTransition -LifecycleLock $LifecycleLock
            if((Assert-DevManualNormalState $Plan) -cne 'Normal'){throw 'DEV_MANUAL_NORMAL_PROMOTION_FAILED'}
        }
        foreach($attempt in 1..2){
            $runtime=Start-DevManualOwned $Plan -NormalTransition -LifecycleLock $LifecycleLock
            if((Invoke-DevManualNode $runtime $Plan 'verify-normal') -cne 'NORMAL_AUTHENTICATION_VERIFIED'){throw 'DEV_MANUAL_RESULT_REJECTED'}
            Stop-DevManualOwned $runtime $Plan 'Normal';$runtime=$null
            Write-Host ('Normal authentication and graceful stop verified: '+$attempt+'/2')
        }
        if(-not (Get-DevManualStage $Plan 'complete')){Write-DevManualStage $Plan 'complete'}
        return @{status='NORMAL_AUTHENTICATION_RESTART_VERIFIED';bootstrapReplayed=$false;transaction='NOT_VERIFIED'}
    }finally{if($null -ne $runtime){Write-Host 'Normal verification incomplete: forced containment of this retained Job only.';$runtime.owner.Dispose()}}
}

function Assert-DevManualPrepared($Plan,[switch]$Unbound,[switch]$RecoveryParentOnly,[switch]$RecoveryV2,[switch]$BootstrapReconciliation,[switch]$NormalTransition,[switch]$AllowUnreconciled,[IO.FileStream]$LifecycleLock=$null,[switch]$NormalSourceAmendment,[switch]$NormalRuntime) {
    Assert-DevManualExecutionPolicy -AllowedActions @('BindManualSources','RunOwnedMongo','BootstrapOwnedMongo','BindRecoverySources','InspectOwnedMongo')
    if($RecoveryParentOnly){Assert-DevManualExecutionPolicy -AllowedActions @('BindRecoverySources')}
    if($RecoveryV2){Assert-DevManualExecutionPolicy -AllowedActions @('InspectOwnedMongo')}
    if($NormalTransition -and ($BootstrapReconciliation -or $RecoveryV2 -or $RecoveryParentOnly -or $Unbound)){throw 'DEV_MANUAL_NORMAL_TRANSITION_REJECTED'}
    if(($NormalSourceAmendment -and $NormalRuntime) -or ($NormalRuntime -and -not $NormalTransition)){throw 'DEV_MANUAL_NORMAL_RUNTIME_REJECTED'}
    if($NormalSourceAmendment -and -not $NormalTransition){throw 'DEV_MANUAL_NORMAL_AMENDMENT_REJECTED'}
    if($NormalTransition){Assert-DevManualExecutionPolicy -AllowedActions $(if($NormalSourceAmendment -or $NormalRuntime){@('BindManualSources','RunOwnedMongo')}else{@('BootstrapOwnedMongo','RunOwnedMongo')})}
    if($AllowUnreconciled -and -not ($BootstrapReconciliation -or $NormalTransition)){throw 'DEV_MANUAL_BOOTSTRAP_RECONCILIATION_REJECTED'}
    if($BootstrapReconciliation){Assert-DevManualExecutionPolicy -AllowedActions @('BootstrapOwnedMongo')}
    Assert-DevMongoPlan $Plan; Assert-DevMongoBinary $Plan
    if([IO.Path]::GetFullPath((Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'DeepLearner/dev')) -cne $Plan.root){throw 'DEV_MONGO_OWNER_ROOT_MISMATCH'}
    Assert-DevMongoParentAcl (Get-Acl -LiteralPath ([IO.Path]::GetDirectoryName($Plan.root))) ([Security.Principal.WindowsIdentity]::GetCurrent().User.Value)
    foreach($path in @($Plan.root,$Plan.storage,$Plan.control,$Plan.logs,$Plan.configuration,$Plan.keyFile,$Plan.receipt)) {
        Assert-DevPath $path
        $kind=if($path -ceq $Plan.root){'Traverse'}elseif($path -ceq $Plan.storage -or $path -ceq $Plan.logs){'Modify'}elseif($path -ceq $Plan.receipt){'OwnerOnly'}else{'Read'}
        if((Get-Acl -LiteralPath $path).GetSecurityDescriptorSddlForm('Access,Owner') -cne (Get-DevMongoAcl $kind (Test-Path -LiteralPath $path -PathType Leaf)).GetSecurityDescriptorSddlForm('Access,Owner')){throw 'DEV_MONGO_PRIVATE_ACL_MISMATCH'}
    }
    $record=Read-DevJson $Plan.receipt
    if($record.revision -ne 2 -or $record.ownerSid -cne [Security.Principal.WindowsIdentity]::GetCurrent().User.Value -or $record.target -cne ($Plan | ConvertTo-Json -Compress -Depth 5) -or $record.keyHash -cne (Get-FileHash -LiteralPath $Plan.keyFile).Hash){throw 'DEV_MONGO_RECEIPT_MISMATCH'}
    Get-DevMongoConfigurationPhase $Plan | Out-Null
    Assert-DevMongoBootstrapArtifactState $Plan '9EAED47244A7347BEA0F3AFAA9770FBC070BEF39AB6FEEA5E65568A2B789D675'
    if(Test-Path -LiteralPath ('HKLM:\SYSTEM\CurrentControlSet\Services\'+$Plan.serviceName)){throw 'DEV_MANUAL_SERVICE_CONFLICT'}
    if(Test-Path -LiteralPath $Plan.serviceReceipt){throw 'DEV_MANUAL_SERVICE_CONFLICT'}
    if(-not $Unbound) {
        $path=Join-Path $Plan.control 'manual-runtime.json'; Assert-DevPath $path
        if((Get-Acl -LiteralPath $path).GetSecurityDescriptorSddlForm('Access,Owner') -cne (Get-DevMongoAcl 'OwnerOnly' $true).GetSecurityDescriptorSddlForm('Access,Owner')){throw 'DEV_MANUAL_SOURCE_BINDING_REJECTED'}
        if((Get-FileHash -LiteralPath $path).Hash -cne 'D0F5315CF1EEF02F80DF29C8321EDFED90F433CE3A6257A9D97FE246987AA35C' -or (Get-FileHash -LiteralPath (Join-Path $Plan.control 'manual-initialize-intent.json')).Hash -cne '62D908896F4A43854BA7FF83BAF0EFB4CD6320FFBF8A07063998B3BF44796B0F'){throw 'DEV_MANUAL_RECOVERY_PARENT_CHANGED'}
        if((Get-FileHash -LiteralPath $Plan.bootstrapManifest).Hash -cne (Read-DevJson $path).preparedManifestHash){throw 'DEV_MANUAL_RECOVERY_PARENT_CHANGED'}
        if($RecoveryParentOnly -or $RecoveryV2){Assert-DevManualRecoveryV2Parent $Plan}
        if($NormalTransition){
            Assert-DevManualNormalLineage $Plan -NormalSourceAmendment:$NormalSourceAmendment -NormalRuntime:$NormalRuntime
            Assert-DevManualRecoveryMaterial $Plan $LifecycleLock -NormalConfiguration:((Get-DevMongoConfigurationPhase $Plan) -ceq 'Normal') -NormalSourceAmendment:$NormalSourceAmendment -NormalRuntime:$NormalRuntime
            if($NormalSourceAmendment -or $NormalRuntime){Read-DevHistoricalNormalTransition $Plan}
            elseif(Test-Path -LiteralPath (Join-Path $Plan.control 'manual-normal-transition.json')){Read-DevManualNormalTransition $Plan|Out-Null}
            elseif(-not $AllowUnreconciled){throw 'DEV_MANUAL_NORMAL_TRANSITION_REJECTED'}
        }
        elseif($BootstrapReconciliation){
            Assert-DevManualBootstrapLineage $Plan
            Assert-DevManualRecoveryMaterial $Plan $LifecycleLock -NormalConfiguration:((Get-DevMongoConfigurationPhase $Plan) -ceq 'Normal')
            if(Test-Path -LiteralPath (Join-Path $Plan.control 'manual-initialize-reconciliation-v1.json')){Read-DevManualBootstrapReconciliation $Plan|Out-Null}
            elseif(-not $AllowUnreconciled){throw 'DEV_MANUAL_BOOTSTRAP_RECONCILIATION_REJECTED'}
        }
        elseif($RecoveryV2){Assert-DevManualRecoveryV2Facts (Read-DevManualRecoveryV2Record $Plan 'manual-recovery-v2.json') (Get-DevManualRecoveryV2Binding $Plan)}
        elseif(-not $RecoveryParentOnly){
            $path=Join-Path $Plan.control 'manual-recovery-v1.json';Assert-DevPath $path
            if((Get-Acl -LiteralPath $path).GetSecurityDescriptorSddlForm('Access,Owner') -cne (Get-DevMongoAcl 'OwnerOnly' $true).GetSecurityDescriptorSddlForm('Access,Owner')){throw 'DEV_MANUAL_RECOVERY_BINDING_REJECTED'}
            $binding=Read-DevJson $path;$expected=Get-DevManualRecoveryBinding $Plan
            if(($binding | ConvertTo-Json -Compress -Depth 10) -cne ($expected | ConvertTo-Json -Compress -Depth 10)){throw 'DEV_MANUAL_RECOVERY_BINDING_REJECTED'}
        }
    }
}

function Write-DevManualPrivate($Plan,[string]$Name,[byte[]]$Bytes) {
    $v2Binding=$Name -ceq 'manual-recovery-v2.json';$v2Inspection=$Name -cin @('manual-replica-inspection-v2-intent.json','manual-replica-inspection-v2.json')
    $binding=$Name -ceq 'manual-runtime.json'
    $recovery=$Name -ceq 'manual-recovery-v1.json';$inspection=$Name -ceq 'manual-replica-inspection-v1.json'
    Assert-DevManualExecutionPolicy -AllowedActions $(if($binding){@('BindManualSources')}elseif($recovery -or $v2Binding){@('BindRecoverySources')}elseif($inspection -or $v2Inspection){@('InspectOwnedMongo')}else{@('BootstrapOwnedMongo')})
    Assert-DevMongoPlan $Plan
    $names=@('initialize-intent','replica','administrator-intent','administrator','shutdown-role-intent','shutdown-role','shutdown-grant-intent','shutdown-grant','application-role-intent','application-role','application-user-intent','application','complete')
    if(-not $binding -and -not $recovery -and -not $inspection -and -not $v2Binding -and -not $v2Inspection -and $Name -cnotin @('mongod.next.cfg','manual-initialize-reconciliation-v1.json','manual-normal-transition.json') -and $Name -cnotin @($names | ForEach-Object {'manual-'+$_+'.json'})){throw 'DEV_MANUAL_PRIVATE_PATH_REJECTED'}
    $path=Join-Path $Plan.control $Name; Assert-DevPath $path
    $kind=if($Name -ceq 'mongod.next.cfg'){'Read'}else{'OwnerOnly'}
    $stream=[IO.FileSystemAclExtensions]::Create([IO.FileInfo]::new($path),[IO.FileMode]::CreateNew,[Security.AccessControl.FileSystemRights]::Write,[IO.FileShare]::Read,4096,[IO.FileOptions]::None,(Get-DevMongoAcl $kind $true))
    try{$stream.Write($Bytes);$stream.Flush($true)}finally{$stream.Dispose()}
}

function Get-DevManualStage($Plan,[string]$Name) {
    $path=Join-Path $Plan.control ('manual-'+$Name+'.json'); Assert-DevPath $path
    if(-not (Test-Path -LiteralPath $path)){return $false}
    if((Get-Acl -LiteralPath $path).GetSecurityDescriptorSddlForm('Access,Owner') -cne (Get-DevMongoAcl 'OwnerOnly' $true).GetSecurityDescriptorSddlForm('Access,Owner')){throw 'DEV_MANUAL_STAGE_REJECTED'}
    $record=Read-DevJson $path
    if($record.Count -ne 4 -or $record.revision -ne 1 -or $record.stage -cne $Name -or $record.ownerSid -cne [Security.Principal.WindowsIdentity]::GetCurrent().User.Value -or $record.bindingHash -cne (Get-FileHash -LiteralPath (Join-Path $Plan.control 'manual-runtime.json')).Hash){throw 'DEV_MANUAL_STAGE_REJECTED'}
    return $true
}

function Write-DevManualStage($Plan,[string]$Name) {
    $record=@{revision=1;stage=$Name;ownerSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;bindingHash=(Get-FileHash -LiteralPath (Join-Path $Plan.control 'manual-runtime.json')).Hash}
    Write-DevManualPrivate $Plan ('manual-'+$Name+'.json') ([Text.Encoding]::UTF8.GetBytes(($record | ConvertTo-Json -Compress)))
}

function Assert-DevManualProcessFacts($Facts,$Plan,[uint32]$ProcessId) {
    Assert-DevMongoPlan $Plan
    if($ProcessId -le 0 -or $Facts.Pid -ne $ProcessId -or $Facts.IndependentPid -ne $ProcessId -or $Facts.Filetime -le 0 -or $Facts.Filetime -ne $Facts.IndependentFiletime -or $Facts.Executable -ine $Plan.executable -or -not $Facts.RetainedJob -or -not $Facts.IndependentJob -or -not $Facts.Live){throw 'DEV_MANUAL_PROCESS_IDENTITY_REJECTED'}
}

function Assert-DevManualOwned($Runtime,$Plan) {
    Assert-DevManualExecutionPolicy -AllowedActions @('RunOwnedMongo','BootstrapOwnedMongo','InspectOwnedMongo')
    $v2=$Runtime -is [Collections.IDictionary] -and $Runtime.Contains('recoveryV2') -and $Runtime.recoveryV2 -eq $true
    $bootstrap=$Runtime -is [Collections.IDictionary] -and $Runtime.Contains('bootstrapReconciliation') -and $Runtime.bootstrapReconciliation -eq $true
    $normal=$Runtime -is [Collections.IDictionary] -and $Runtime.Contains('normalTransition') -and $Runtime.normalTransition -eq $true
    $retainedLock=if($bootstrap -or $normal){$Runtime.lifecycleLock}else{$null}
    $amended=$Runtime -is [Collections.IDictionary] -and $Runtime.Contains('normalSourceAmendment') -and $Runtime.normalSourceAmendment -eq $true
    $reusable=$Runtime -is [Collections.IDictionary] -and $Runtime.Contains('normalRuntime') -and $Runtime.normalRuntime -eq $true
    Assert-DevManualPrepared $Plan -RecoveryV2:$v2 -BootstrapReconciliation:$bootstrap -NormalTransition:$normal -LifecycleLock $retainedLock -NormalSourceAmendment:$amended -NormalRuntime:$reusable
    if($reusable){Assert-DevNormalRuntimeState $Plan $retainedLock}
    if($amended){Assert-DevManualExecutionPolicy -AllowedActions @('RunOwnedMongo');Assert-DevNormalAmendmentState $Plan $retainedLock;Read-DevNormalSourceAmendment $Plan|Out-Null;Read-DevNormalAmendmentAttempt $Plan}
    Assert-DevManualProcessFacts ($Runtime.owner.Observe($Runtime.child)) $Plan $Runtime.child.Id
    Assert-DevMongoListenerRows @(Get-DevMongoPortRows) $Runtime.child.Id
}

function New-DevManualOwner {
    Assert-DevManualExecutionPolicy -AllowedActions @('RunOwnedMongo','BootstrapOwnedMongo','InspectOwnedMongo')
    if(-not ('DeepLearnerLocal.Owner' -as [type])){Add-Type -Path (Join-Path $PSScriptRoot 'LocalProcessOwner.cs')}
    return [DeepLearnerLocal.Owner]::new()
}

function Start-DevManualOwned($Plan,[switch]$RecoveryV2,[switch]$BootstrapReconciliation,[switch]$NormalTransition,[IO.FileStream]$LifecycleLock=$null,[switch]$NormalSourceAmendment,[switch]$NormalRuntime) {
    Assert-DevManualExecutionPolicy -AllowedActions @('RunOwnedMongo','BootstrapOwnedMongo','InspectOwnedMongo')
    Assert-DevManualPrepared $Plan -RecoveryV2:$RecoveryV2 -BootstrapReconciliation:$BootstrapReconciliation -NormalTransition:$NormalTransition -LifecycleLock $LifecycleLock -NormalSourceAmendment:$NormalSourceAmendment -NormalRuntime:$NormalRuntime; Assert-DevMongoPortFree
    if($NormalRuntime){Assert-DevNormalRuntimeState $Plan $LifecycleLock;Assert-DevNormalRuntimeStorage $Plan}
    if($NormalSourceAmendment){Assert-DevManualExecutionPolicy -AllowedActions @('RunOwnedMongo');Assert-DevNormalAmendmentState $Plan $LifecycleLock;Read-DevNormalSourceAmendment $Plan|Out-Null;Read-DevNormalAmendmentAttempt $Plan}
    $owner=New-DevManualOwner; $node=(Get-Command node.exe -CommandType Application | Select-Object -First 1).Source
    try {
        $run=[guid]::NewGuid().ToString('N')
        $child=$owner.Start('mongo',$Plan.executable,@('--config',$Plan.configuration),$script:DevRepo,(New-DevEnvironment $script:DevRepo $node $Plan.logs),(Join-Path $Plan.logs ('manual-'+$run+'.out.log')),(Join-Path $Plan.logs ('manual-'+$run+'.err.log')))
        $runtime=@{owner=$owner;child=$child;recoveryV2=[bool]$RecoveryV2;bootstrapReconciliation=[bool]$BootstrapReconciliation;normalTransition=[bool]$NormalTransition;normalSourceAmendment=[bool]$NormalSourceAmendment;normalRuntime=[bool]$NormalRuntime;lifecycleLock=$LifecycleLock}
        $clock=[Diagnostics.Stopwatch]::StartNew()
        do {
            Assert-DevManualProcessFacts ($owner.Observe($child)) $Plan $child.Id
            $rows=@(Get-DevMongoPortRows)
            if($rows.Count){Assert-DevMongoListenerRows $rows $child.Id;Assert-DevManualOwned $runtime $Plan;return $runtime}
            Start-Sleep -Milliseconds 100
        }while($clock.ElapsedMilliseconds -lt 30000)
        throw 'DEV_MANUAL_START_TIMEOUT'
    }catch{Write-Host 'Manual MongoDB startup failed; retained owned Job containment, not graceful shutdown.';$owner.Dispose();throw}
}

function Invoke-DevManualNode($Runtime,$Plan,[string]$Step) {
    $normal=$Runtime -is [Collections.IDictionary] -and $Runtime.Contains('normalTransition') -and $Runtime.normalTransition -eq $true
    if($normal){Assert-DevManualExecutionPolicy -AllowedActions @('BootstrapOwnedMongo','RunOwnedMongo');if($Step -cnotin @('verify-normal','shutdown-normal')){throw 'DEV_MANUAL_NORMAL_TRANSITION_REJECTED'}}
    $bootstrap=$Runtime -is [Collections.IDictionary] -and $Runtime.Contains('bootstrapReconciliation') -and $Runtime.bootstrapReconciliation -eq $true
    if($bootstrap){Assert-DevManualExecutionPolicy -AllowedActions @('BootstrapOwnedMongo');if($Step -cnotin @('initialize','administrator','inspect-administrator','shutdown-role','inspect-shutdown-role','shutdown-grant','inspect-shutdown-grant','application-role','inspect-application-role','application-user','verify-application','verify-normal','shutdown-bootstrap','shutdown-normal')){throw 'DEV_MANUAL_BOOTSTRAP_RECONCILIATION_REJECTED'}}
    if($Runtime -is [Collections.IDictionary] -and $Runtime.Contains('recoveryV2') -and $Runtime.recoveryV2 -eq $true){Assert-DevManualExecutionPolicy -AllowedActions @('InspectOwnedMongo');if($Step -cne 'inspect-replica'){throw 'DEV_MANUAL_RECOVERY_V_TWO_REJECTED'}}
    Assert-DevManualOwned $Runtime $Plan
    $helperOwner=$null;$operatorPassword=$null;$uri=$null;$applicationPassword=$null;$request=$null
    try {
        $operatorPassword=Read-DevSecret $Plan.operatorSecret; $uri=Read-DevSecret $Plan.applicationSecret
        if($uri -cnotmatch '^mongodb://deeplearner-local-app:([A-Za-z0-9_-]{43})@127\.0\.0\.1:27019/deeplearner-dev\?replicaSet=deeplearner-dev-rs&directConnection=true&authSource=deeplearner-dev$'){throw 'DEV_MONGO_PRIVATE_CREDENTIAL_REJECTED'}
        $applicationPassword=$Matches[1];$manifest=Read-DevJson $Plan.bootstrapManifest
        $transport=if($Step -ceq 'shutdown-normal'){'verify-normal'}elseif($Step -ceq 'inspect-replica' -or $Step -like '*shutdown*'){'inspect-administrator'}else{$Step}
        $phase=Get-DevMongoConfigurationPhase $Plan
        if(($transport -ceq 'verify-normal') -ne ($phase -ceq 'Normal')){throw 'DEV_MANUAL_TRANSPORT_REJECTED'}
        $request=@{runtime='owned-process';action=$Step;request=@{action=$transport;target=@{host=$Plan.host;port=$Plan.port;name=$Plan.database;replicaSet=$Plan.replicaSet;member=$Plan.member;service=$Plan.serviceName};operatorPassword=$operatorPassword;applicationPassword=$applicationPassword;certificates=$manifest.certificates}}
        $node=(Get-Command node.exe -CommandType Application | Select-Object -First 1).Source
        $helperOwner=New-DevManualOwner
        $amended=$Runtime -is [Collections.IDictionary] -and $Runtime.Contains('normalSourceAmendment') -and $Runtime.normalSourceAmendment -eq $true
        $reusable=$Runtime -is [Collections.IDictionary] -and $Runtime.Contains('normalRuntime') -and $Runtime.normalRuntime -eq $true
        $selector=if($reusable){'--normal-runtime-action'}elseif($amended){'--normal-amendment-action'}elseif($normal){'--normal-action'}elseif($bootstrap){'--bootstrap-action'}else{'--manual-action'}
        $child=$helperOwner.StartControlled('manual-mongo-helper',$node,@('--import','tsx',(Join-Path $script:DevRepo 'apps/api/scripts/dev-mongo-bootstrap.ts'),$selector,$Step),$script:DevRepo,(New-DevEnvironment $script:DevRepo $node $Plan.bootstrap),'NUL')
        $frame=Send-DevManualRequest $child ($request | ConvertTo-Json -Compress -Depth 10) -Action $Step
        if(-not $helperOwner.WaitEmpty(5000)){throw 'DEV_MANUAL_HELPER_NOT_EMPTY'}
        $result=$frame | ConvertFrom-Json -AsHashtable
        if($result.Count -ne 1 -or $result.status -cnotin @('REPLICA_NOT_INITIALIZED','REPLICA_INITIALIZED_PRIMARY','REPLICA_INITIALIZED','ADMINISTRATOR_VERIFIED','SHUTDOWN_ROLE_VERIFIED','SHUTDOWN_GRANT_VERIFIED','APPLICATION_ROLE_VERIFIED','APPLICATION_VERIFIED','NORMAL_AUTHENTICATION_VERIFIED','SHUTDOWN_REQUESTED')){throw 'DEV_MANUAL_HELPER_RESULT_REJECTED'}
        if($Step -cnotin @('shutdown-bootstrap','shutdown-normal')){Assert-DevManualOwned $Runtime $Plan}
        return $result.status
    }finally{if($null -ne $helperOwner){$helperOwner.Dispose()};$operatorPassword=$null;$uri=$null;$applicationPassword=$null;$request=$null}
}

function Get-DevManualResponseDiagnostic($Frame,$ExitCode,[string]$Stage='RESPONSE',[string]$Action='UNKNOWN') {
    # Pure reporting only: never retain raw frames, requests, exception text or paths.
    $record=[ordered]@{helperAction='UNKNOWN';invocationStage='RESPONSE';exitCode=$null;classification='UNEXPECTED_RESPONSE';message='Helper response was not an accepted result.';helperPhase='UNKNOWN';gate='NONE';code='NONE';connectionAttempted='UNKNOWN';inspectedState='UNKNOWN';cleanupCompleted='UNKNOWN'}
    if($Action -cin @('initialize','administrator','inspect-administrator','application-role','inspect-application-role','application-user','verify-application','verify-normal','shutdown-role','inspect-shutdown-role','shutdown-grant','inspect-shutdown-grant','shutdown-bootstrap','shutdown-normal','inspect-replica')){$record.helperAction=$Action}
    if($Stage -cin @('REQUEST_WRITE','RESPONSE_WAIT','RESPONSE','RESULT_VALIDATION')){$record.invocationStage=$Stage}
    if($null -ne $ExitCode -and $ExitCode -is [ValueType] -and $ExitCode -isnot [bool]){
        try{$number=[decimal]$ExitCode;if($number -ge 0 -and $number -le [uint32]::MaxValue -and [decimal]::Truncate($number) -eq $number){$record.exitCode=[uint32]$number}}catch{}
    }
    if($null -eq $Frame -or ($Frame -is [string] -and $Frame.Length -eq 0)){$record.classification='MISSING_RESPONSE';$record.message='Helper returned no response.';return $record}
    if($Frame -isnot [string] -or [Text.Encoding]::UTF8.GetByteCount($Frame) -gt 8192){$record.classification='MALFORMED_RESPONSE';$record.message='Helper response was malformed or exceeded the frame bound.';return $record}
    try{$safe=ConvertFrom-Json -InputObject $Frame -AsHashtable -ErrorAction Stop}catch{$record.classification='MALFORMED_RESPONSE';$record.message='Helper response was malformed or exceeded the frame bound.';return $record}
    if($safe -isnot [Collections.IDictionary]){return $record}
    $success=@('REPLICA_NOT_INITIALIZED','REPLICA_INITIALIZED_PRIMARY','REPLICA_INITIALIZED','ADMINISTRATOR_VERIFIED','SHUTDOWN_ROLE_VERIFIED','SHUTDOWN_GRANT_VERIFIED','APPLICATION_ROLE_VERIFIED','APPLICATION_VERIFIED','NORMAL_AUTHENTICATION_VERIFIED','SHUTDOWN_REQUESTED')
    if($safe.Count -eq 1 -and $safe.Contains('status') -and $safe.status -is [string] -and $safe.status -cin $success){
        if($null -ne $record.exitCode -and $record.exitCode -eq 0){$record.classification=$safe.status;$record.message='Helper returned an accepted result; parent validation remains required.'}
        else{$record.classification='EXIT_RESPONSE_CONFLICT';$record.message='Helper result conflicts with its exit status.'}
        return $record
    }
    $keys=@('status','phase','gate','code');$hasConnection=$safe.Contains('connectionAttempted')
    if($hasConnection){$keys+='connectionAttempted'}
    if(@(Compare-Object ($keys|Sort-Object) @($safe.Keys|Sort-Object)).Count -or $safe.status -cne 'HELPER_FAILED' -or $safe.phase -isnot [string] -or $safe.phase -cnotin @('ENTRY','SOURCE_BINDING','CERTIFICATE_FILES','DRIVER_LOAD','CONNECT','CERTIFICATE_PROBE','PROTOCOL_READ','PROTOCOL_WRITE') -or $safe.gate -isnot [string] -or $safe.gate -cnotmatch '^DEV_[A-Z_]{1,80}$' -or $safe.code -isnot [string] -or $safe.code -cnotmatch '^(NONE|ERR_[A-Z0-9_]{1,50}|E[A-Z]{1,30}|MONGO_[0-9]{1,6})$' -or ($hasConnection -and $safe.connectionAttempted -isnot [bool])){return $record}
    $gates=@('DEV_MANUAL_ACTION_REJECTED','DEV_MANUAL_CONTEXT_REJECTED','DEV_MANUAL_HELPER_REJECTED','DEV_MANUAL_NODE_VERSION_REJECTED','DEV_MANUAL_OPERATOR_ROLES_REJECTED','DEV_MANUAL_POLICY_MISMATCH','DEV_MANUAL_RECOVERY_BINDING_REJECTED','DEV_MANUAL_REPLICA_INSPECTION_UNKNOWN','DEV_MANUAL_SHUTDOWN_PRIVILEGES_REJECTED','DEV_MANUAL_SOURCE_BINDING_REJECTED','DEV_MANUAL_TRANSPORT_REJECTED','DEV_MANUAL_NORMAL_RUNTIME_REJECTED','DEV_MONGO_ACTION_REJECTED','DEV_MONGO_APPLICATION_AUTHENTICATION_REJECTED','DEV_MONGO_BOOTSTRAP_REQUEST_REJECTED','DEV_MONGO_BOOTSTRAP_STOPPED_RECONCILE','DEV_MONGO_CERTIFICATE_REJECTED','DEV_MONGO_CERTIFICATE_REQUIREMENT_UNKNOWN','DEV_MONGO_EXECUTION_CONTEXT_REQUIRED','DEV_MONGO_OPERATOR_PRIVILEGES_REJECTED','DEV_MONGO_OUTCOME_UNKNOWN_RECONCILE','DEV_MONGO_OWNER_REJECTED','DEV_MONGO_PRIMARY_OR_TARGET_UNKNOWN','DEV_MONGO_PRIMARY_TIMEOUT_RECONCILE','DEV_MONGO_PRIVATE_CREDENTIAL_REJECTED','DEV_MONGO_PRIVILEGES_REJECTED','DEV_MONGO_REINITIALIZATION_REFUSED','DEV_MONGO_REPLICA_CONFIGURATION_REJECTED','DEV_MONGO_SERVER_CERTIFICATE_REJECTED','DEV_MONGO_SOURCE_POLICY_MISMATCH','DEV_MONGO_TARGET_REJECTED','DEV_MONGO_UNAUTHENTICATED_ACCESS_NOT_REFUSED','DEV_PERSISTENT_POLICY_NOT_ACTIVE')
    $gates+=@('DEV_MANUAL_RECOVERY_V_TWO_REJECTED','DEV_MANUAL_INSPECTION_ATTEMPT_REJECTED','DEV_MANUAL_BOOTSTRAP_RECONCILIATION_REJECTED','DEV_MANUAL_NORMAL_TRANSITION_REJECTED','DEV_MANUAL_NORMAL_AMENDMENT_REJECTED')
    $codes=@('NONE','ERR_SSL_SSLV3_ALERT_HANDSHAKE_FAILURE','ERR_SSL_TLSV13_ALERT_CERTIFICATE_REQUIRED','ERR_TLS_CERT_ALTNAME_INVALID','ERR_OSSL_PEM_NO_START_LINE','ERR_STREAM_PREMATURE_CLOSE','ERR_STREAM_DESTROYED','EACCES','EPERM','ENOENT','ECONNREFUSED','ECONNRESET','ETIMEDOUT','EPIPE','ENOTFOUND','EHOSTUNREACH','EADDRNOTAVAIL')
    $record.helperPhase=$safe.phase;$record.gate=if($safe.gate -cin $gates){$safe.gate}else{'DEV_MANUAL_HELPER_REJECTED'};$record.code=if($safe.code -cin $codes -or $safe.code -cmatch '^MONGO_[0-9]{1,6}$'){$safe.code}else{'NONE'}
    if($hasConnection){$record.connectionAttempted=if($safe.connectionAttempted){'YES'}else{'NO'}}
    $record.classification=if($null -ne $record.exitCode -and $record.exitCode -ne 0){'HELPER_REPORTED_FAILURE'}else{'EXIT_RESPONSE_CONFLICT'}
    $record.message=if($record.classification -ceq 'HELPER_REPORTED_FAILURE'){'Helper reported a sanitized failure; inspected state is unknown.'}else{'Helper failure conflicts with its exit status.'}
    return $record
}

function Send-DevManualRequest($Child,[string]$Request,[string]$Action='UNKNOWN') {
    if([Text.Encoding]::UTF8.GetByteCount($Request) -gt 8192){throw 'DEV_CONFIGURATION_REJECTED'}
    $frame=$null;$stage='REQUEST_WRITE';$reported=$false
    try {
        $frame=$Child.ReadFrameAsync();$write=$Child.SendFrameAsync($Request)
        if(-not $write.Wait(180000)){throw 'DEV_VALIDATION_TIMEOUT'}
        $Child.CloseInput();$stage='RESPONSE_WAIT'
        if(-not $frame.Wait(180000) -or -not $Child.Wait(5000)){throw 'DEV_VALIDATION_TIMEOUT'}
        $stage='RESPONSE'
        $diagnostic=Get-DevManualResponseDiagnostic $frame.Result $Child.ExitCode $stage $Action
        if($Child.ExitCode -ne 0){
            Write-Host ('Manual helper diagnostic: '+($diagnostic|ConvertTo-Json -Compress))
            $reported=$true;$failure=[Exception]::new('DEV_MANUAL_HELPER_FAILED');$failure.Data['DevManualDiagnostic']=$diagnostic;throw $failure
        }
        if($diagnostic.classification -cin @('MISSING_RESPONSE','MALFORMED_RESPONSE','UNEXPECTED_RESPONSE','EXIT_RESPONSE_CONFLICT')){Write-Host ('Manual helper diagnostic: '+($diagnostic|ConvertTo-Json -Compress))}
        return $frame.Result
    }catch{
        if(-not $reported){
            $exit=$null
            # HasExited is a zero-time observational query, never a new wait/retry.
            try{if($Child.HasExited){$exit=$Child.ExitCode}}catch{}
            $diagnostic=Get-DevManualResponseDiagnostic $null $exit $stage $Action
            $diagnostic.classification='HELPER_TRANSPORT_FAILURE';$diagnostic.message='Helper transport did not complete; inspected state is unknown.'
            Write-Host ('Manual helper diagnostic: '+($diagnostic|ConvertTo-Json -Compress))
        }
        throw
    }
}

function Get-DevManualInspection($Plan) {
    $path=Join-Path $Plan.control 'manual-replica-inspection-v1.json';Assert-DevPath $path
    if(-not (Test-Path -LiteralPath $path)){return $false}
    if((Get-Acl -LiteralPath $path).GetSecurityDescriptorSddlForm('Access,Owner') -cne (Get-DevMongoAcl 'OwnerOnly' $true).GetSecurityDescriptorSddlForm('Access,Owner')){throw 'DEV_MANUAL_INSPECTION_REJECTED'}
    $record=Read-DevJson $path
    if($record.Count -ne 6 -or $record.revision -ne 1 -or $record.ownerSid -cne [Security.Principal.WindowsIdentity]::GetCurrent().User.Value -or $record.parentBindingHash -cne 'D0F5315CF1EEF02F80DF29C8321EDFED90F433CE3A6257A9D97FE246987AA35C' -or $record.recoveryBindingHash -cne (Get-FileHash -LiteralPath (Join-Path $Plan.control 'manual-recovery-v1.json')).Hash -or $record.state -cnotin @('REPLICA_NOT_INITIALIZED','REPLICA_INITIALIZED_PRIMARY') -or $record.cleanup -cne 'FORCED_OWNED_JOB'){throw 'DEV_MANUAL_INSPECTION_REJECTED'}
    return $record
}

function Invoke-DevManualInspection($Plan,[IO.FileStream]$LifecycleLock=$null) {
    Assert-DevManualExecutionPolicy -AllowedActions @('InspectOwnedMongo')
    Assert-DevManualRecoveryV2State $Plan -Bound -LifecycleLock $LifecycleLock
    if((Get-DevMongoConfigurationPhase $Plan) -cne 'Bootstrap' -or -not (Get-DevManualStage $Plan 'initialize-intent') -or (Get-DevManualStage $Plan 'replica') -or (Get-DevManualStage $Plan 'administrator-intent') -or (Get-DevManualInspection $Plan)){throw 'DEV_MANUAL_INSPECTION_STATE_REJECTED'}
    $runtime=$null
    try {
        $bindingHash=(Get-FileHash -LiteralPath (Join-Path $Plan.control 'manual-recovery-v2.json')).Hash
        $intent=[ordered]@{revision=2;ownerSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;successorBindingHash=$bindingHash;action='InspectOwnedMongo';inspectedState='UNKNOWN'}
        Write-DevManualPrivate $Plan 'manual-replica-inspection-v2-intent.json' ([Text.Encoding]::UTF8.GetBytes(($intent|ConvertTo-Json -Compress)))
        Assert-DevManualRecoveryV2Attempt (Read-DevManualRecoveryV2Record $Plan 'manual-replica-inspection-v2-intent.json') $intent.ownerSid $bindingHash
        $attemptHash=(Get-FileHash -LiteralPath (Join-Path $Plan.control 'manual-replica-inspection-v2-intent.json')).Hash
        $runtime=Start-DevManualOwned $Plan -RecoveryV2
        $state=Invoke-DevManualNode $runtime $Plan 'inspect-replica'
        if($state -cnotin @('REPLICA_NOT_INITIALIZED','REPLICA_INITIALIZED_PRIMARY')){throw 'DEV_MANUAL_INSPECTION_REJECTED'}
        # No shutdown authority exists yet. Contain ONLY the retained owned Job,
        # explicitly report crash-style cleanup, and never claim B/persistence PASS.
        $runtime.owner.ForceStop()
        if(-not $runtime.child.Wait(5000) -or -not $runtime.owner.WaitEmpty(5000)){throw 'DEV_MANUAL_INSPECTION_CLEANUP_UNKNOWN'}
        $runtime.owner.Dispose();$runtime=$null
        if(@(Get-DevMongoPortRows | Where-Object state -EQ 'LISTENING').Count){throw 'DEV_MANUAL_INSPECTION_CLEANUP_UNKNOWN'}
        $record=@{revision=2;ownerSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;successorBindingHash=$bindingHash;attemptIntentHash=$attemptHash;state=$state;cleanup='FORCED_OWNED_JOB'}
        Write-DevManualPrivate $Plan 'manual-replica-inspection-v2.json' ([Text.Encoding]::UTF8.GetBytes(($record | ConvertTo-Json -Compress)))
        return @{status=$state;cleanup='FORCED_OWNED_JOB';bootstrap='NOT_REPLAYED';persistence='NOT_VERIFIED'}
    }finally{if($null -ne $runtime){Write-Host 'Recovery inspection cleanup: forced containment of retained owned Job only.';try{$runtime.owner.Dispose()}finally{Write-Host 'Manual inspection diagnostic: {"cleanupCompleted":"UNKNOWN","inspectedState":"UNKNOWN","message":"Owned Job disposal was attempted; retained exit and empty Job were not verified."}'}}}
}

function Assert-DevManualRecoveryV2Attempt($Record,[string]$OwnerSid,[string]$BindingHash) {
    $expected=[ordered]@{revision=2;ownerSid=$OwnerSid;successorBindingHash=$BindingHash;action='InspectOwnedMongo';inspectedState='UNKNOWN'}
    if($BindingHash -cnotmatch '^[A-F0-9]{64}$' -or $Record -isnot [Collections.IDictionary] -or $Record.Count -ne 5){throw 'DEV_MANUAL_INSPECTION_ATTEMPT_REJECTED'}
    foreach($key in $expected.Keys){if(-not $Record.Contains($key) -or ($Record[$key]|ConvertTo-Json -Compress) -cne ($expected[$key]|ConvertTo-Json -Compress)){throw 'DEV_MANUAL_INSPECTION_ATTEMPT_REJECTED'}}
}

function Assert-DevManualRecoveryV2State($Plan,[switch]$Bound,[IO.FileStream]$LifecycleLock=$null) {
    Assert-DevManualExecutionPolicy -AllowedActions $(if($Bound){@('InspectOwnedMongo')}else{@('BindRecoverySources')})
    Assert-DevMongoPlan $Plan;Assert-DevManualRecoveryMaterial $Plan $LifecycleLock;Assert-DevManualRecoveryV2Parent $Plan
    if((Get-DevMongoConfigurationPhase $Plan) -cne 'Bootstrap' -or -not (Get-DevManualStage $Plan 'initialize-intent') -or (Test-Path -LiteralPath $Plan.nextConfiguration)){throw 'DEV_MANUAL_RECOVERY_STATE_REJECTED'}
    foreach($stage in @('initialize-intent','replica','administrator-intent','administrator','application-role-intent','application-role','application-user-intent','application','complete')){if(Test-Path -LiteralPath (Get-DevMongoStagePath $Plan $stage)){throw 'DEV_MANUAL_RECOVERY_STATE_REJECTED'}}
    $allowed=@('manual-runtime.json','manual-initialize-intent.json','manual-recovery-v1.json')
    if($Bound){$allowed+='manual-recovery-v2.json'}
    $actual=@(Get-ChildItem -LiteralPath $Plan.control -Filter 'manual-*.json' -File|ForEach-Object Name)
    if(@(Compare-Object ($allowed|Sort-Object) ($actual|Sort-Object)).Count){throw 'DEV_MANUAL_INSPECTION_ATTEMPT_REJECTED'}
    if($Bound){Assert-DevManualRecoveryV2Facts (Read-DevManualRecoveryV2Record $Plan 'manual-recovery-v2.json') (Get-DevManualRecoveryV2Binding $Plan)}
}

function Assert-DevManualRecoveryState($Plan,[switch]$Bound,[IO.FileStream]$LifecycleLock=$null) {
    Assert-DevMongoPlan $Plan
    Assert-DevManualRecoveryMaterial $Plan $LifecycleLock
    if((Get-DevMongoConfigurationPhase $Plan) -cne 'Bootstrap' -or -not (Get-DevManualStage $Plan 'initialize-intent') -or (Test-Path -LiteralPath $Plan.nextConfiguration)){throw 'DEV_MANUAL_RECOVERY_STATE_REJECTED'}
    foreach($stage in @('initialize-intent','replica','administrator-intent','administrator','application-role-intent','application-role','application-user-intent','application','complete')){if(Test-Path -LiteralPath (Get-DevMongoStagePath $Plan $stage)){throw 'DEV_MANUAL_RECOVERY_STATE_REJECTED'}}
    $allowed=@('manual-runtime.json','manual-initialize-intent.json')
    if($Bound){$allowed+=@('manual-recovery-v1.json')}
    foreach($file in @(Get-ChildItem -LiteralPath $Plan.control -Filter 'manual-*.json' -File)){if($file.Name -cnotin $allowed){throw 'DEV_MANUAL_RECOVERY_STATE_REJECTED'}}
}

function Assert-DevManualRecoveryMaterial($Plan,[IO.FileStream]$LifecycleLock=$null,[switch]$NormalConfiguration,[switch]$NormalSourceAmendment,[switch]$NormalRuntime) {
    Assert-DevMongoPlan $Plan
    $originalConfiguration=$null
    if($NormalSourceAmendment -and -not $NormalConfiguration){throw 'DEV_MANUAL_NORMAL_AMENDMENT_REJECTED'}
    if($NormalConfiguration){
        Assert-DevManualExecutionPolicy -AllowedActions $(if($NormalSourceAmendment -or $NormalRuntime){@('BindManualSources','RunOwnedMongo')}else{@('BootstrapOwnedMongo','RunOwnedMongo')})
        $normalBytes=[Text.Encoding]::UTF8.GetBytes((Get-DevMongoConfiguration $Plan 'Normal'))
        if((Get-DevMongoConfigurationPhase $Plan) -cne 'Normal' -or (Get-FileHash -LiteralPath $Plan.configuration).Hash -cne [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($normalBytes))){throw 'DEV_MONGO_PRIVATE_CONFIGURATION_CHANGED'}
        $originalConfiguration=[Text.Encoding]::UTF8.GetBytes((Get-DevMongoConfiguration $Plan 'Bootstrap'))
    }
    if($null -ne $LifecycleLock -and ($LifecycleLock.Name -ine $Plan.operationLock -or -not $LifecycleLock.CanRead -or -not $LifecycleLock.CanWrite -or $LifecycleLock.SafeFileHandle.IsClosed)){throw 'DEV_MANUAL_LOCK_REJECTED'}
    $original=@($Plan.configuration,$Plan.keyFile,$Plan.receipt,$Plan.operationLock,$Plan.ca,$Plan.caKey,$Plan.serverCertificate,$Plan.clientCertificate,$Plan.operatorSecret,$Plan.applicationSecret,$Plan.bootstrapManifest)
    $inventory=@($original | ForEach-Object {Assert-DevPath $_;Get-Item -LiteralPath $_} | Sort-Object FullName | ForEach-Object {$length=$_.Length;$hash=if($null -ne $originalConfiguration -and $_.FullName -ieq $Plan.configuration){$length=$originalConfiguration.Length;[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($originalConfiguration))}elseif($null -ne $LifecycleLock -and $_.FullName -ieq $Plan.operationLock){$LifecycleLock.Position=0;(Get-FileHash -InputStream $LifecycleLock).Hash}else{(Get-FileHash -LiteralPath $_.FullName).Hash};$_.FullName+'|'+$length+'|'+$hash+'|'+(Get-Acl -LiteralPath $_.FullName).GetSecurityDescriptorSddlForm('Access,Owner')})
    if([Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes(($inventory -join "`n")))) -cne 'DB78AA3A5B952C279C29442AD5DB6E1D0F252452D7F740867C4A8F7074D55547'){throw 'DEV_MANUAL_ORIGINAL_MATERIAL_CHANGED'}
}

function Stop-DevManualOwned($Runtime,$Plan,[string]$Phase) {
    $step=if($Phase -ceq 'Normal'){'shutdown-normal'}else{'shutdown-bootstrap'}
    if((Invoke-DevManualNode $Runtime $Plan $step) -cne 'SHUTDOWN_REQUESTED'){throw 'DEV_MANUAL_SHUTDOWN_REJECTED'}
    if(-not $Runtime.child.Wait(30000) -or $Runtime.child.ExitCode -ne 0 -or -not $Runtime.owner.WaitEmpty(5000)){throw 'DEV_MANUAL_GRACEFUL_EXIT_NOT_VERIFIED'}
    Assert-DevMongoPortFree
    $Runtime.owner.Dispose()
}

function Get-DevManualRecoveryStep([string]$Action,[string]$Inspection,[bool]$Complete,[bool]$Attempted) {
    if($Complete -and -not $Attempted){throw 'DEV_MANUAL_STAGE_REJECTED'}
    if($Complete -or $Attempted){return $Inspection}
    return $Action
}

function Set-DevManualNormalConfiguration($Plan,[IO.FileStream]$LifecycleLock=$null) {
    Assert-DevManualExecutionPolicy -AllowedActions @('BootstrapOwnedMongo')
    Assert-DevManualPrepared $Plan -BootstrapReconciliation -LifecycleLock $LifecycleLock;Assert-DevMongoPortFree
    foreach($stage in @('administrator','shutdown-role','shutdown-grant','application-role','application')){if(-not (Get-DevManualStage $Plan $stage)){throw 'DEV_MANUAL_STAGE_REJECTED'}}
    if((Get-DevMongoConfigurationPhase $Plan) -cne 'Bootstrap' -or (Test-Path -LiteralPath $Plan.nextConfiguration)){throw 'DEV_MANUAL_TRANSITION_UNKNOWN_RECONCILE'}
    Write-DevManualPrivate $Plan 'mongod.next.cfg' ([Text.Encoding]::UTF8.GetBytes((Get-DevMongoConfiguration $Plan 'Normal')))
    Move-DevManualNormalConfiguration $Plan
    Assert-DevManualPrepared $Plan -BootstrapReconciliation -LifecycleLock $LifecycleLock
}

function Invoke-DevManualBootstrap($Plan,[IO.FileStream]$LifecycleLock=$null) {
    $runtime=$null
    try {
        Assert-DevManualExecutionPolicy -AllowedActions @('BootstrapOwnedMongo')
        $pending=-not (Test-Path -LiteralPath (Join-Path $Plan.control 'manual-initialize-reconciliation-v1.json'))
        Assert-DevManualPrepared $Plan -BootstrapReconciliation -AllowUnreconciled:$pending -LifecycleLock $LifecycleLock
        $phase=Assert-DevManualBootstrapState $Plan -AllowUnreconciled:$pending
        if($pending){
            Assert-DevMongoPortFree
            Write-DevManualPrivate $Plan 'manual-initialize-reconciliation-v1.json' ([Text.Encoding]::UTF8.GetBytes(((Get-DevManualBootstrapReconciliation $Plan)|ConvertTo-Json -Compress -Depth 10)))
        }
        # Exact readback before startup. Existing receipt without replica completion
        # was rejected by the pre-consumption state check; it cannot initialize again.
        Read-DevManualBootstrapReconciliation $Plan | Out-Null
        $runtime=Start-DevManualOwned $Plan -BootstrapReconciliation -LifecycleLock $LifecycleLock
        if($phase -ceq 'Bootstrap') {
            if(-not (Get-DevManualStage $Plan 'replica')) {
                # Existing initialize protocol independently demands fresh exact94
                # before its single replSetInitiate. Historical inspection is not enough.
                if((Invoke-DevManualNode $runtime $Plan 'initialize') -cne 'REPLICA_INITIALIZED'){throw 'DEV_MANUAL_RESULT_REJECTED'}
                Write-DevManualStage $Plan 'replica'
            }
            foreach($row in @(@('administrator','administrator-intent','administrator','inspect-administrator','ADMINISTRATOR_VERIFIED'),@('shutdown-role','shutdown-role-intent','shutdown-role','inspect-shutdown-role','SHUTDOWN_ROLE_VERIFIED'),@('shutdown-grant','shutdown-grant-intent','shutdown-grant','inspect-shutdown-grant','SHUTDOWN_GRANT_VERIFIED'),@('application-role','application-role-intent','application-role','inspect-application-role','APPLICATION_ROLE_VERIFIED'),@('application','application-user-intent','application-user','verify-application','APPLICATION_VERIFIED'))) {
                $done=Get-DevManualStage $Plan $row[0];$attempted=Get-DevManualStage $Plan $row[1]
                $step=Get-DevManualRecoveryStep $row[2] $row[3] $done $attempted
                if(-not $attempted){Write-DevManualStage $Plan $row[1]}
                if((Invoke-DevManualNode $runtime $Plan $step) -cne $row[4]){throw 'DEV_MANUAL_RESULT_REJECTED'}
                if(-not $done){Write-DevManualStage $Plan $row[0]}
            }
            Stop-DevManualOwned $runtime $Plan 'Bootstrap';$runtime=$null
            Set-DevManualNormalConfiguration $Plan $LifecycleLock
            $runtime=Start-DevManualOwned $Plan -BootstrapReconciliation -LifecycleLock $LifecycleLock
        }
        if((Invoke-DevManualNode $runtime $Plan 'verify-normal') -cne 'NORMAL_AUTHENTICATION_VERIFIED'){throw 'DEV_MANUAL_RESULT_REJECTED'}
        Stop-DevManualOwned $runtime $Plan 'Normal';$runtime=$null
        # Fresh owned-process restart, never replay bootstrap writes.
        $runtime=Start-DevManualOwned $Plan -BootstrapReconciliation -LifecycleLock $LifecycleLock
        if((Invoke-DevManualNode $runtime $Plan 'verify-normal') -cne 'NORMAL_AUTHENTICATION_VERIFIED'){throw 'DEV_MANUAL_RESULT_REJECTED'}
        Stop-DevManualOwned $runtime $Plan 'Normal';$runtime=$null
        if(-not (Get-DevManualStage $Plan 'complete')){Write-DevManualStage $Plan 'complete'}
        return @{status='MANUAL_BOOTSTRAP_RESTART_VERIFIED';applicationProfile='NOT_ACTIVATED'}
    }finally{if($null -ne $runtime){Write-Host 'Manual MongoDB incomplete: forced containment of this retained Job only; persistent state preserved.';$runtime.owner.Dispose()}}
}

function Assert-DevManualBootstrapState($Plan,[switch]$AllowUnreconciled) {
    $phase=Get-DevMongoConfigurationPhase $Plan
    Assert-DevManualKnownMetadata $Plan -BootstrapReconciliation
    foreach($stage in @('initialize-intent','replica','administrator-intent','administrator','application-role-intent','application-role','application-user-intent','application','complete')){if(Test-Path -LiteralPath (Get-DevMongoStagePath $Plan $stage)){throw 'DEV_MANUAL_STAGE_REJECTED'}}
    if(Test-Path -LiteralPath $Plan.nextConfiguration){throw 'DEV_MANUAL_TRANSITION_UNKNOWN_RECONCILE'}
    if(-not (Get-DevManualStage $Plan 'initialize-intent')){throw 'DEV_MANUAL_BOOTSTRAP_RECONCILIATION_REJECTED'}
    $consumed=Test-Path -LiteralPath (Join-Path $Plan.control 'manual-initialize-reconciliation-v1.json')
    if($consumed){Read-DevManualBootstrapReconciliation $Plan|Out-Null}
    elseif(-not $AllowUnreconciled -or $phase -cne 'Bootstrap'){throw 'DEV_MANUAL_BOOTSTRAP_RECONCILIATION_REJECTED'}
    $previous=$true
    foreach($pair in @(@('replica','initialize-intent'),@('administrator','administrator-intent'),@('shutdown-role','shutdown-role-intent'),@('shutdown-grant','shutdown-grant-intent'),@('application-role','application-role-intent'),@('application','application-user-intent'))) {
        $done=Get-DevManualStage $Plan $pair[0];$attempted=Get-DevManualStage $Plan $pair[1]
        if(-not $consumed -and $pair[0] -cne 'replica' -and ($done -or $attempted)){throw 'DEV_MANUAL_STAGE_REJECTED'}
        if(($done -and -not $attempted) -or (($done -or $attempted) -and -not $previous)){throw 'DEV_MANUAL_STAGE_REJECTED'}
        if($pair[0] -ceq 'replica' -and $attempted -and -not $done){
            if($consumed -or -not $AllowUnreconciled){throw 'DEV_MANUAL_INITIALIZATION_UNKNOWN_RECONCILE'}
        }
        if($pair[0] -ceq 'replica' -and $done -and -not $consumed){throw 'DEV_MANUAL_STAGE_REJECTED'}
        if($phase -ceq 'Normal' -and -not $done){throw 'DEV_MANUAL_STAGE_REJECTED'}
        $previous=$done
    }
    if((Get-DevManualStage $Plan 'complete') -and ($phase -cne 'Normal' -or -not $previous)){throw 'DEV_MANUAL_STAGE_REJECTED'}
    return $phase
}

function Assert-DevManualKnownMetadata($Plan,[switch]$BootstrapReconciliation) {
    Assert-DevMongoPlan $Plan
    $allowed=@('manual-runtime.json','manual-recovery-v1.json','manual-replica-inspection-v1.json','manual-initialize-reconciliation-v1.json')
    if($BootstrapReconciliation){$allowed=@((Get-DevManualBootstrapLineage).Keys)+@('manual-initialize-reconciliation-v1.json')}
    $allowed+=@('initialize-intent','replica','administrator-intent','administrator','shutdown-role-intent','shutdown-role','shutdown-grant-intent','shutdown-grant','application-role-intent','application-role','application-user-intent','application','complete' | ForEach-Object {'manual-'+$_+'.json'})
    foreach($file in @(Get-ChildItem -LiteralPath $Plan.control -Filter 'manual-*.json' -File)){if($file.Name -cnotin $allowed){throw 'DEV_MANUAL_STAGE_REJECTED'}}
}

function Invoke-DevManualMongo([string]$Operation='ManualPlan') {
    Assert-DevNormalAmendmentSelection $Operation ([bool]$BindNormalSources) ([bool]$UseNormalSourceAmendment) ([bool]$FinalizeNormal) ([bool]$ProvisionLocal) ([bool]$BindNormalRuntime) ([bool]$UseNormalRuntime)
    if($BindNormalRuntime){return Invoke-DevNormalRuntimeBinding}
    if($BindNormalSources){return Invoke-DevNormalSourceBinding}
    if($Operation -ceq 'ManualPlan'){return @{operation='PLAN_ONLY';policy=(Get-DevManualMongoPolicy);sourcePinMigration='SEPARATE_REVIEW_REQUIRED';operational='NOT_QUALIFIED'}}
    Assert-DevManualExecutionPolicy -AllowedActions @($Operation)
    if($Operation -cnotin (Get-DevManualMongoPolicy).operations){throw 'DEV_MANUAL_ACTION_REJECTED'}
    $normal=$Operation -ceq 'RunOwnedMongo' -or ($Operation -ceq 'BootstrapOwnedMongo' -and $FinalizeNormal)
    if(($FinalizeNormal -and $Operation -cne 'BootstrapOwnedMongo') -or ($ProvisionLocal -and $Operation -cne 'RunOwnedMongo')){throw 'DEV_MANUAL_ACTION_REJECTED'}
    if($ProvisionLocal){Assert-DevManualProvisioner (Get-DevMongoPlan)}
    $plan=Get-DevMongoPlan;$lock=$null;$runtime=$null;$oldControl=$null
    try {
        Assert-DevManualPrepared $plan -Unbound:($Operation -ceq 'BindManualSources') -RecoveryParentOnly:($Operation -ceq 'BindRecoverySources') -RecoveryV2:($Operation -ceq 'InspectOwnedMongo') -BootstrapReconciliation:($Operation -ceq 'BootstrapOwnedMongo' -and -not $normal) -NormalTransition:$normal -AllowUnreconciled:($Operation -ceq 'BootstrapOwnedMongo') -NormalSourceAmendment:$UseNormalSourceAmendment -NormalRuntime:$UseNormalRuntime
        if($UseNormalRuntime){Assert-DevNormalRuntimeState $plan}
        # Existing prepared lock only. No adoption or creation of a missing lock.
        Assert-DevPath $plan.operationLock
        if((Get-Acl -LiteralPath $plan.operationLock).GetSecurityDescriptorSddlForm('Access,Owner') -cne (Get-DevMongoAcl 'OwnerOnly' $true).GetSecurityDescriptorSddlForm('Access,Owner')){throw 'DEV_MANUAL_LOCK_REJECTED'}
        $lock=[IO.File]::Open($plan.operationLock,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
        if($Operation -ceq 'BindRecoverySources'){
            Assert-DevMongoPortFree
            Assert-DevManualRecoveryV2State $plan -LifecycleLock $lock
            if((Get-DevMongoConfigurationPhase $plan) -cne 'Bootstrap' -or -not (Get-DevManualStage $plan 'initialize-intent') -or (Get-DevManualStage $plan 'replica') -or (Get-DevManualStage $plan 'administrator-intent')){throw 'DEV_MANUAL_RECOVERY_STATE_REJECTED'}
            Write-DevManualPrivate $plan 'manual-recovery-v2.json' ([Text.Encoding]::UTF8.GetBytes(((Get-DevManualRecoveryV2Binding $plan) | ConvertTo-Json -Compress -Depth 10)))
            return @{status='RECOVERY_SOURCES_BOUND';parentBinding='PRESERVED';intent='PRESERVED'}
        }
        if($Operation -ceq 'InspectOwnedMongo'){return Invoke-DevManualInspection $plan $lock}
        if($Operation -ceq 'BindManualSources') {
            Assert-DevMongoPortFree
            if(@(Get-ChildItem -LiteralPath $plan.storage -Force).Count -or (Get-DevMongoConfigurationPhase $plan) -cne 'Bootstrap'){throw 'DEV_MANUAL_MIGRATION_NOT_PRISTINE'}
            foreach($stage in @('initialize-intent','replica','administrator-intent','administrator','application-role-intent','application-role','application-user-intent','application','complete')){if(Test-Path -LiteralPath (Get-DevMongoStagePath $plan $stage)){throw 'DEV_MANUAL_MIGRATION_NOT_PRISTINE'}}
            if(@(Get-ChildItem -LiteralPath $plan.control -Filter 'manual-*.json').Count -or (Test-Path -LiteralPath $plan.nextConfiguration)){throw 'DEV_MANUAL_MIGRATION_NOT_PRISTINE'}
            Write-DevManualPrivate $plan 'manual-runtime.json' ([Text.Encoding]::UTF8.GetBytes(((Get-DevManualBinding $plan) | ConvertTo-Json -Compress -Depth 10)))
            return @{status='MANUAL_SOURCES_BOUND';credentials='UNCHANGED'}
        }
        if($Operation -ceq 'BootstrapOwnedMongo'){if($FinalizeNormal){return Invoke-DevManualNormalFinalization $plan $lock};return Invoke-DevManualBootstrap $plan $lock}
        if((Assert-DevManualNormalState $plan) -cne 'Normal' -or -not (Get-DevManualStage $plan 'complete')){throw 'DEV_MANUAL_BOOTSTRAP_REQUIRED'}
        if(-not $ProvisionLocal){if([Console]::IsInputRedirected){throw 'DEV_MANUAL_INTERACTIVE_TERMINAL_REQUIRED'};$oldControl=[Console]::TreatControlCAsInput;[Console]::TreatControlCAsInput=$true}
        if($UseNormalSourceAmendment){
            Assert-DevNormalAmendmentState $plan $lock;Read-DevNormalSourceAmendment $plan|Out-Null;Assert-DevNormalAmendmentUnused $plan
            $attempt=@{revision=1;ownerSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;bindingHash=(Get-FileHash (Join-Path $plan.control 'manual-normal-source-amendment.json')).Hash;action='RunOwnedMongo';state='CONSUMED_BEFORE_STARTUP';attempt=1}
            Write-DevNormalAmendmentPrivate $plan 'manual-normal-source-amendment-intent.json' $attempt;Read-DevNormalAmendmentAttempt $plan
        }
        $runtime=Start-DevManualOwned $plan -NormalTransition -LifecycleLock $lock -NormalSourceAmendment:$UseNormalSourceAmendment -NormalRuntime:$UseNormalRuntime
        if((Invoke-DevManualNode $runtime $plan 'verify-normal') -cne 'NORMAL_AUTHENTICATION_VERIFIED'){throw 'DEV_MANUAL_RESULT_REJECTED'}
        if($ProvisionLocal){
            # Fixed, separately reviewed setup entry; receives retained native ownership, never an arbitrary PID or callback.
            Assert-DevManualOwned $runtime $plan
            Assert-DevManualProvisioner $plan
            & (Join-Path $PSScriptRoot 'Provision-DeepLearnerDev.ps1') -Runtime $runtime -Plan $plan
            Assert-DevManualOwned $runtime $plan
            Stop-DevManualOwned $runtime $plan 'Normal';$runtime=$null
            return @{status='LOCAL_PROVISIONER_COMPLETED_AND_OWNED_MONGO_STOPPED'}
        }
        Write-Host 'Owned MongoDB ready on 127.0.0.1:27019. Ctrl+C stops only this process; data persists.'
        while($true){Assert-DevManualOwned $runtime $plan;if([Console]::KeyAvailable){$key=[Console]::ReadKey($true);if($key.Key -eq 'C' -and ($key.Modifiers -band [ConsoleModifiers]::Control)){break}};Start-Sleep -Milliseconds 250}
        Stop-DevManualOwned $runtime $plan 'Normal';$runtime=$null
        return @{status='MANUAL_GRACEFUL_STOP_VERIFIED'}
    }finally{if($null -ne $runtime){Write-Host 'Manual MongoDB cleanup: forced retained-Job containment, not graceful shutdown.';$runtime.owner.Dispose()};if($null -ne $oldControl){[Console]::TreatControlCAsInput=$oldControl};if($null -ne $lock){$lock.Dispose()}}
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
    $lease=$null; $closedGuard=${function:Assert-DevMongoExecutionPolicy};$closedManualGuard=${function:Assert-DevManualExecutionPolicy}
    try {
        Assert-DevNormalAmendmentSelection $Action ([bool]$BindNormalSources) ([bool]$UseNormalSourceAmendment) ([bool]$FinalizeNormal) ([bool]$ProvisionLocal) ([bool]$BindNormalRuntime) ([bool]$UseNormalRuntime)
        if(($FinalizeNormal -and $Action -cne 'BootstrapOwnedMongo') -or ($ProvisionLocal -and $Action -cne 'RunOwnedMongo')){throw 'DEV_MANUAL_ACTION_REJECTED'}
        $manual=$Action -ceq 'ManualPlan' -or $Action -cin (Get-DevManualMongoPolicy).operations
        if($manual -and $Action -cne 'ManualPlan') {
            $policy=Get-DevManualMongoPolicy;Assert-DevManualPolicyAgreement $policy $policy
            $node=(Get-Command node.exe -CommandType Application | Select-Object -First 1).Source
            if(-not ('DeepLearnerLocal.Owner' -as [type])){Add-Type -Path (Join-Path $PSScriptRoot 'LocalProcessOwner.cs')}
            $probe=[DeepLearnerLocal.Owner]::new()
            try {
                $child=$probe.StartControlled('manual-policy',$node,@('--import','tsx',(Join-Path $script:DevRepo 'apps/api/scripts/dev-mongo-bootstrap.ts'),'--check-manual-policy'),$script:DevRepo,(New-DevEnvironment $script:DevRepo $node ([IO.Path]::GetTempPath())),'NUL')
                $child.CloseInput();$frame=$child.ReadFrameAsync()
                if(-not $frame.Wait(10000) -or -not $probe.WaitEmpty(5000) -or $child.ExitCode -ne 0){throw 'DEV_MANUAL_POLICY_MISMATCH'}
                $peer=$frame.Result | ConvertFrom-Json -AsHashtable
            }finally{$probe.Dispose()}
            Assert-DevManualPolicyAgreement $policy $peer
            $ownerSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
            if([IO.Path]::GetFullPath((Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'DeepLearner/dev')) -cne (Get-DevMongoPlan).root){throw 'DEV_MONGO_OWNER_ROOT_MISMATCH'}
            $lease=@{alive=$true;action=$Action;ownerSid=$ownerSid;target=($policy.target | ConvertTo-Json -Compress)}
            $accepted=$lease;$fixedTarget=$policy.target | ConvertTo-Json -Compress;$validateInvocation=${function:Assert-DevMongoInvocation}
            Set-Item Function:Assert-DevManualExecutionPolicy -Value ({param([string[]]$AllowedActions) & $validateInvocation $accepted $AllowedActions ([Security.Principal.WindowsIdentity]::GetCurrent().User.Value) $fixedTarget}.GetNewClosure())
        } elseif(-not $manual -and $Action -notin @('Plan','InitializeReplica')) {
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
        if($manual){Invoke-DevManualMongo $Action | ConvertTo-Json -Depth 10}else{Invoke-DevMongoSetup $Action | ConvertTo-Json -Depth 8}
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
        Set-Item Function:Assert-DevManualExecutionPolicy -Value $closedManualGuard
        $accepted=$null; $lease=$null
    }
}
