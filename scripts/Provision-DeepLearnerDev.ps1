#Requires -Version 7.0
[CmdletBinding()]
param([Parameter(Mandatory)]$Runtime,[Parameter(Mandatory)]$Plan)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$script:DevSetupRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))

function Get-DevPersistentSetupPolicy {
    return @'
{"id":"DEV-ADDITIVE-SYNTHETIC-27019","status":"ACTIVE","version":1,"target":{"host":"127.0.0.1","port":27019,"database":"deeplearner-dev","replicaSet":"deeplearner-dev-rs"},"actions":["preflight","setup-role","setup-user","schema","accounts","content","verify"]}
'@|ConvertFrom-Json -AsHashtable
}

function Assert-DevSetupOwner($Runtime,$Plan) {
    Assert-DevManualExecutionPolicy -AllowedActions @('RunOwnedMongo')
    Assert-DevMongoPlan $Plan
    if($Runtime.owner -isnot [DeepLearnerLocal.Owner] -or $Runtime.child -isnot [DeepLearnerLocal.Child] -or -not $Runtime.normalTransition){throw 'DEV_SETUP_RETAINED_OWNER_REQUIRED'}
    Assert-DevManualOwned $Runtime $Plan
    Assert-DevManualProvisioner $Plan
    if((Get-DevPersistentSetupPolicy).status -cne 'ACTIVE' -or (Get-DevMongoConfigurationPhase $Plan) -cne 'Normal' -or -not (Get-DevManualStage $Plan 'complete')){throw 'DEV_SETUP_POLICY_REJECTED'}
    $apiRoot=Join-Path $script:DevSetupRepo 'apps/api/src';Assert-DevPath $apiRoot
    $lines=[string[]]@(Get-ChildItem -LiteralPath $apiRoot -Recurse -File|ForEach-Object {Assert-DevPath $_.FullName;if($_.Extension -cne '.ts'){throw 'DEV_SETUP_UNPINNED_SOURCE_ARTIFACT'};$_.FullName.Substring($apiRoot.Length+1).Replace('\','/').ToLowerInvariant()+'|'+(Get-FileHash -LiteralPath $_.FullName).Hash})
    foreach($base in @('dev-local','dev-mongo-bootstrap')){foreach($extension in @('.js','.cjs','.mjs','.jsx')){if(Test-Path -LiteralPath (Join-Path $script:DevSetupRepo ('apps/api/scripts/'+$base+$extension))){throw 'DEV_SETUP_UNPINNED_SOURCE_ARTIFACT'}}}
    [Array]::Sort($lines,[StringComparer]::Ordinal)
    if($lines.Length -ne 173 -or [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes(($lines -join "`n")))) -cne 'AC19767B22EE20FD6AADCA45B59D1A801EBA316F7B84C0D99C4DE7BF9E5E96E0' -or (Get-FileHash -LiteralPath (Join-Path $script:DevSetupRepo 'package-lock.json')).Hash -cne '12147DC7CCB1EF3F6A998546CCA9F6020145D602498C8BDB24752AE97831C37F'){throw 'DEV_SETUP_MODEL_SOURCE_DRIFT'}
    Assert-DevFreePorts
}

function Get-DevSetupPath($Plan,[string]$Name) {
    Assert-DevMongoPlan $Plan
    if($Name -cin @('dev-setup-password.dpapi','demo-student-password.dpapi','demo-admin-password.dpapi','signing-secret.dpapi','profile.json')){return Join-Path $Plan.root $Name}
    if($Name -cin @('local-setup-material.json','local-setup-role-intent.json','local-setup-role.json','local-setup-user-intent.json','local-setup-user.json','local-setup-schema-intent.json','local-setup-schema.json','local-setup-accounts-intent.json','local-setup-accounts.json','local-setup-content-intent.json','local-setup-content.json','local-setup-verify-intent.json','local-setup-verify.json')){return Join-Path $Plan.control $Name}
    throw 'DEV_SETUP_PRIVATE_PATH_REJECTED'
}

function Write-DevSetupFile($Runtime,$Plan,[string]$Name,[byte[]]$Bytes) {
    Assert-DevSetupOwner $Runtime $Plan
    $path=Get-DevSetupPath $Plan $Name;Assert-DevPath $path
    if($Bytes.Length -gt 16384){throw 'DEV_SETUP_PRIVATE_SIZE_REJECTED'}
    $stream=[IO.FileSystemAclExtensions]::Create([IO.FileInfo]::new($path),[IO.FileMode]::CreateNew,[Security.AccessControl.FileSystemRights]::Write,[IO.FileShare]::Read,4096,[IO.FileOptions]::None,(Get-DevMongoAcl 'OwnerOnly' $true))
    try{$stream.Write($Bytes);$stream.Flush($true)}finally{$stream.Dispose()}
    if((Get-Acl -LiteralPath $path).GetSecurityDescriptorSddlForm('Access,Owner') -cne (Get-DevMongoAcl 'OwnerOnly' $true).GetSecurityDescriptorSddlForm('Access,Owner') -or (Get-FileHash -LiteralPath $path).Hash -cne [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($Bytes))){throw 'DEV_SETUP_PRIVATE_WRITE_UNCONFIRMED'}
}

function Read-DevSetupRecord($Plan,[string]$Name) {
    $path=Get-DevSetupPath $Plan $Name;Assert-DevPath $path
    if(-not (Test-Path -LiteralPath $path)){return $null}
    if((Get-Acl -LiteralPath $path).GetSecurityDescriptorSddlForm('Access,Owner') -cne (Get-DevMongoAcl 'OwnerOnly' $true).GetSecurityDescriptorSddlForm('Access,Owner')){throw 'DEV_SETUP_PRIVATE_ACL_REJECTED'}
    $record=Read-DevJson $path
    if($record -isnot [Collections.IDictionary]){throw 'DEV_SETUP_PRIVATE_RECORD_REJECTED'}
    return $record
}

function Get-DevSetupBindingHash($Plan) {return (Get-FileHash -LiteralPath (Join-Path $Plan.control 'local-provisioning-sources.json')).Hash}

function Assert-DevSetupStageFacts($Record,[ValidateSet('role','user','schema','accounts','content','verify')][string]$Phase,[string]$OwnerSid,[string]$BindingHash,[switch]$Result) {
    if($Record -isnot [Collections.IDictionary] -or $Record.Count -ne $(if($Result){5}else{4}) -or ($Record.revision -isnot [int] -and $Record.revision -isnot [long]) -or $Record.revision -ne 1 -or $Record.phase -isnot [string] -or $Record.phase -cne $Phase -or $Record.ownerSid -isnot [string] -or $Record.ownerSid -cne $OwnerSid -or $Record.sourceBindingHash -isnot [string] -or $Record.sourceBindingHash -cnotmatch '^[A-F0-9]{64}$' -or $Record.sourceBindingHash -cne $BindingHash){throw 'DEV_SETUP_STAGE_REJECTED'}
    if($Result -and $Record.result -isnot [Collections.IDictionary]){throw 'DEV_SETUP_STAGE_REJECTED'}
    if($Result){$statuses=@{role='SETUP_ROLE_VERIFIED';user='SETUP_USER_VERIFIED';schema='SCHEMA_VERIFIED';accounts='ACCOUNTS_VERIFIED';content='CONTENT_VERIFIED';verify='PERSISTENT_SETUP_VERIFIED'};if($Record.result.status -isnot [string] -or $Record.result.status -cne $statuses[$Phase]){throw 'DEV_SETUP_STAGE_REJECTED'}}
}

function Get-DevSetupStage($Plan,[string]$Phase) {
    $intent=Read-DevSetupRecord $Plan ('local-setup-'+$Phase+'-intent.json')
    $result=Read-DevSetupRecord $Plan ('local-setup-'+$Phase+'.json')
    $owner=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;$hash=Get-DevSetupBindingHash $Plan
    if($null -ne $intent){Assert-DevSetupStageFacts $intent $Phase $owner $hash}
    if($null -ne $result){Assert-DevSetupStageFacts $result $Phase $owner $hash -Result}
    if(($null -ne $intent) -ne ($null -ne $result)){throw 'DEV_SETUP_OPERATION_UNCONFIRMED'}
    return $result
}

function Initialize-DevSetupMaterial($Runtime,$Plan) {
    Assert-DevSetupOwner $Runtime $Plan
    $names=@('dev-setup-password.dpapi','demo-student-password.dpapi','demo-admin-password.dpapi','signing-secret.dpapi')
    $record=Read-DevSetupRecord $Plan 'local-setup-material.json'
    $existing=@($names|Where-Object {Test-Path -LiteralPath (Get-DevSetupPath $Plan $_)})
    if($null -eq $record){
        if($existing.Count){throw 'DEV_SETUP_PRIVATE_MATERIAL_PARTIAL'}
        $hashes=[ordered]@{}
        foreach($name in $names){
            $random=[Security.Cryptography.RandomNumberGenerator]::GetBytes($(if($name -ceq 'signing-secret.dpapi'){48}else{32}))
            $plain=$null;$secure=$null;$bytes=$null
            try{
                $plain=[Convert]::ToBase64String($random)
                if($name -cne 'signing-secret.dpapi'){$plain=$plain.TrimEnd('=').Replace('+','-').Replace('/','_')}
                $secure=ConvertTo-SecureString $plain -AsPlainText -Force
                $bytes=[Text.Encoding]::UTF8.GetBytes((ConvertFrom-SecureString $secure))
                Write-DevSetupFile $Runtime $Plan $name $bytes
                $hashes[$name]=[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($bytes))
            }finally{[Array]::Clear($random,0,$random.Length);if($null -ne $secure){$secure.Dispose()};$plain=$null;$bytes=$null}
        }
        $record=[ordered]@{revision=1;ownerSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;sourceBindingHash=(Get-DevSetupBindingHash $Plan);files=$hashes}
        Write-DevSetupFile $Runtime $Plan 'local-setup-material.json' ([Text.Encoding]::UTF8.GetBytes(($record|ConvertTo-Json -Depth 5 -Compress)))
        $record=Read-DevSetupRecord $Plan 'local-setup-material.json'
    }
    if($record -isnot [Collections.IDictionary] -or $record.Count -ne 4 -or ($record.revision -isnot [int] -and $record.revision -isnot [long]) -or $record.revision -ne 1 -or $record.ownerSid -isnot [string] -or $record.ownerSid -cne [Security.Principal.WindowsIdentity]::GetCurrent().User.Value -or $record.sourceBindingHash -isnot [string] -or $record.sourceBindingHash -cne (Get-DevSetupBindingHash $Plan) -or $record.files -isnot [Collections.IDictionary] -or $record.files.Count -ne 4){throw 'DEV_SETUP_MATERIAL_REJECTED'}
    foreach($name in $names){$path=Get-DevSetupPath $Plan $name;Assert-DevPath $path;if(-not $record.files.Contains($name) -or $record.files[$name] -isnot [string] -or $record.files[$name] -cne (Get-FileHash -LiteralPath $path).Hash -or (Get-Acl -LiteralPath $path).GetSecurityDescriptorSddlForm('Access,Owner') -cne (Get-DevMongoAcl 'OwnerOnly' $true).GetSecurityDescriptorSddlForm('Access,Owner')){throw 'DEV_SETUP_MATERIAL_CHANGED'}}
}

function Invoke-DevSetupNode($Runtime,$Plan,[string]$Action,[bool]$Completed,[switch]$Material) {
    Assert-DevSetupOwner $Runtime $Plan
    if($Action -cnotin (Get-DevPersistentSetupPolicy).actions){throw 'DEV_SETUP_ACTION_REJECTED'}
    $helperOwner=$null;$request=$null;$uri=$null;$operator=$null;$appPassword=$null
    try{
        $operator=Read-DevSecret $Plan.operatorSecret;$uri=Read-DevSecret $Plan.applicationSecret
        if($uri -cnotmatch '^mongodb://deeplearner-local-app:([A-Za-z0-9_-]{43})@127\.0\.0\.1:27019/deeplearner-dev\?replicaSet=deeplearner-dev-rs&directConnection=true&authSource=deeplearner-dev$'){throw 'DEV_SETUP_APPLICATION_CREDENTIAL_REJECTED'}
        $appPassword=$Matches[1]
        $request=@{action=$Action;ownerSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;target=(Get-DevPersistentSetupPolicy).target;ownedProcessId=$Runtime.child.Id;existingCompleted=$Completed;secrets=@{operator=$operator;application=$appPassword}}
        if($Material){$request.secrets.setup=Read-DevSecret (Get-DevSetupPath $Plan 'dev-setup-password.dpapi');$request.secrets.student=Read-DevSecret (Get-DevSetupPath $Plan 'demo-student-password.dpapi');$request.secrets.admin=Read-DevSecret (Get-DevSetupPath $Plan 'demo-admin-password.dpapi')}
        $node=(Get-Command node.exe -CommandType Application|Select-Object -First 1).Source
        $helperOwner=New-DevManualOwner
        $child=$helperOwner.StartControlled('dev-persistent-setup',$node,@('--import','tsx',(Join-Path $script:DevSetupRepo 'apps/api/scripts/dev-persistent-setup.ts'),'--provision-local'),$script:DevSetupRepo,(New-DevEnvironment $script:DevSetupRepo $node $Plan.logs),'NUL')
        $payload=$request|ConvertTo-Json -Depth 8 -Compress
        if([Text.Encoding]::UTF8.GetByteCount($payload) -gt 8191){throw 'DEV_SETUP_REQUEST_REJECTED'}
        $write=$child.SendFrameAsync($payload);if(-not $write.Wait(10000)){throw 'DEV_SETUP_PRIVATE_PIPE_TIMEOUT'};$child.CloseInput()
        $frame=$child.ReadFrameAsync();if(-not $frame.Wait(180000) -or -not $child.Wait(5000) -or -not $helperOwner.WaitEmpty(5000)){throw 'DEV_SETUP_HELPER_TIMEOUT'}
        $result=$frame.Result|ConvertFrom-Json -AsHashtable
        if($result -isnot [Collections.IDictionary]){throw 'DEV_SETUP_RESPONSE_REJECTED'}
        if($child.ExitCode -ne 0){
            $safeStage=if($result.stage -is [string] -and $result.stage -cin @('ENTRY','SOURCE_BINDING','MODEL_IMPORT','OWNED_TARGET_VERIFICATION','PREFLIGHT','SETUP_ROLE','SETUP_USER','SCHEMA','ACCOUNTS','CONTENT','VERIFY','CREATE_SETUP_ROLE','CREATE_SETUP_USER','CREATE_COLLECTION','CREATE_INDEX','SAVE_ACCOUNT','SAVE_CONTENT')){$result.stage}else{'UNKNOWN'}
            $safeClass=if($result.classification -is [string] -and $result.classification -cin @('WRITE_ACKNOWLEDGEMENT_UNCERTAIN','PARTIAL_ACKNOWLEDGED','REFUSED_OR_READ_FAILED')){$result.classification}else{'UNKNOWN'}
            $safeGate=if($result.gate -is [string] -and $result.gate -cin @('SETUP_SOURCE_DRIFT','NORMAL_SOURCE_DRIFT','MODEL_INVENTORY_REJECTED','UNEXPECTED_DATABASE_CONTENTS','SETUP_POLICY_REJECTED','ACCOUNT_CONFLICT','CONTENT_CONFLICT','INDEX_CONFLICT','INDEX_VERIFICATION_FAILED','SETUP_UNCONFIRMED_OPERATION','SETUP_PHASE_NOT_AUTHORIZED','SETUP_RESPONSE_TOO_LARGE','SETUP_UNKNOWN_METADATA')){$result.gate}else{'UNKNOWN'}
            $safeCode=if(($result.mongoCode -is [int] -or $result.mongoCode -is [long]) -and [Math]::Abs($result.mongoCode) -le 99999){$result.mongoCode}else{$null}
            $safeCount=if(($result.acknowledgedWrites -is [int] -or $result.acknowledgedWrites -is [long]) -and $result.acknowledgedWrites -ge 0 -and $result.acknowledgedWrites -le 1000){$result.acknowledgedWrites}else{$null}
            Write-Host ('Setup failure: '+(@{action=$Action;stage=$safeStage;classification=$safeClass;gate=$safeGate;mongoCode=$safeCode;connectionAttempted=$(if($result.connectionAttempted -is [bool]){$result.connectionAttempted}else{'UNKNOWN'});writeAttempted=$(if($result.writeAttempted -is [bool]){$result.writeAttempted}else{'UNKNOWN'});acknowledgedWrites=$safeCount;exitCode=$child.ExitCode;automaticRetry=$false}|ConvertTo-Json -Compress))
            throw 'DEV_SETUP_HELPER_FAILED'
        }
        $statuses=@{preflight='PREFLIGHT_VERIFIED';'setup-role'='SETUP_ROLE_VERIFIED';'setup-user'='SETUP_USER_VERIFIED';schema='SCHEMA_VERIFIED';accounts='ACCOUNTS_VERIFIED';content='CONTENT_VERIFIED';verify='PERSISTENT_SETUP_VERIFIED'}
        if($result -isnot [Collections.IDictionary] -or $result.status -isnot [string] -or $result.status -cne $statuses[$Action]){throw 'DEV_SETUP_RESPONSE_REJECTED'}
        Assert-DevSetupOwner $Runtime $Plan
        return $result
    }finally{if($null -ne $helperOwner){$helperOwner.Dispose()};$request=$null;$payload=$null;$uri=$null;$operator=$null;$appPassword=$null;if($null -ne $Matches){$Matches.Clear()}}
}

function Invoke-DevPersistentSetup($Runtime,$Plan) {
    Assert-DevSetupOwner $Runtime $Plan
    $allowed=@('local-setup-material.json')+@('role','user','schema','accounts','content','verify'|ForEach-Object {'local-setup-'+$_+'-intent.json';'local-setup-'+$_+'.json'})
    foreach($file in @(Get-ChildItem -LiteralPath $Plan.control -Filter 'local-setup-*' -Force)){Assert-DevPath $file.FullName;if($file.PSIsContainer -or $file.Name -cnotin $allowed){throw 'DEV_SETUP_UNKNOWN_METADATA'}}
    $phases=@('role','user','schema','accounts','content','verify');$stages=@{};$previous=$true
    foreach($phase in $phases){$record=Get-DevSetupStage $Plan $phase;$stages[$phase]=$record;if($null -ne $record -and -not $previous){throw 'DEV_SETUP_STAGE_ORDER_REJECTED'};$previous=$null -ne $record}
    $completed=$null -ne $stages.verify
    $profile=[ordered]@{revision=1;repository=$script:DevSetupRepo;ownerSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;database=[ordered]@{host='127.0.0.1';port=27019;name='deeplearner-dev';replicaSet='deeplearner-dev-rs'};prerequisites=[ordered]@{instance='APPROVED_READY';schema='APPROVED_READY'}}
    $existingProfile=Read-DevSetupRecord $Plan 'profile.json'
    if($null -ne $existingProfile -and (-not $completed -or ($existingProfile|ConvertTo-Json -Depth 5 -Compress) -cne ($profile|ConvertTo-Json -Depth 5 -Compress))){throw 'DEV_SETUP_PROFILE_CONFLICT'}
    $existingMaterial=$null -ne (Read-DevSetupRecord $Plan 'local-setup-material.json')
    if(-not $existingMaterial -and (@('dev-setup-password.dpapi','demo-student-password.dpapi','demo-admin-password.dpapi','signing-secret.dpapi')|Where-Object {Test-Path -LiteralPath (Get-DevSetupPath $Plan $_)})){throw 'DEV_SETUP_PRIVATE_MATERIAL_PARTIAL'}
    if($existingMaterial){Initialize-DevSetupMaterial $Runtime $Plan}
    Invoke-DevSetupNode $Runtime $Plan 'preflight' $completed -Material:$existingMaterial | Out-Null
    Initialize-DevSetupMaterial $Runtime $Plan
    foreach($phase in $phases){
        if($null -ne $stages[$phase]){continue}
        $intent=[ordered]@{revision=1;phase=$phase;ownerSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;sourceBindingHash=(Get-DevSetupBindingHash $Plan)}
        Write-DevSetupFile $Runtime $Plan ('local-setup-'+$phase+'-intent.json') ([Text.Encoding]::UTF8.GetBytes(($intent|ConvertTo-Json -Compress)))
        Assert-DevSetupStageFacts (Read-DevSetupRecord $Plan ('local-setup-'+$phase+'-intent.json')) $phase $intent.ownerSid $intent.sourceBindingHash
        $action=if($phase -cin @('role','user')){'setup-'+$phase}else{$phase}
        $result=Invoke-DevSetupNode $Runtime $Plan $action $false -Material
        $receipt=[ordered]@{revision=1;phase=$phase;ownerSid=$intent.ownerSid;sourceBindingHash=$intent.sourceBindingHash;result=$result}
        Write-DevSetupFile $Runtime $Plan ('local-setup-'+$phase+'.json') ([Text.Encoding]::UTF8.GetBytes(($receipt|ConvertTo-Json -Depth 10 -Compress)))
        Get-DevSetupStage $Plan $phase | Out-Null
        Write-Host ('Persistent setup phase verified: '+$phase)
    }
    # Completed runs are verification-only; no role, account or content replay.
    $verified=Invoke-DevSetupNode $Runtime $Plan 'verify' $true -Material
    $existing=Read-DevSetupRecord $Plan 'profile.json'
    if($null -eq $existing){Write-DevSetupFile $Runtime $Plan 'profile.json' ([Text.Encoding]::UTF8.GetBytes(($profile|ConvertTo-Json -Depth 5 -Compress)))}
    elseif(($existing|ConvertTo-Json -Depth 5 -Compress) -cne ($profile|ConvertTo-Json -Depth 5 -Compress)){throw 'DEV_SETUP_PROFILE_CONFLICT'}
    return @{status=$verified.status;collections=$verified.inventory.Count;accounts=$verified.accounts;contentDocuments=$verified.contentDocuments;studentProgressFabricated=$false;dailyStartupProvisions=$false}
}

if($MyInvocation.InvocationName -ne '.') {Invoke-DevPersistentSetup $Runtime $Plan}
