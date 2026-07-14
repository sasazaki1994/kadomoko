[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$ArtifactDirectory,
  [Parameter(Mandatory=$true)][string]$ReportPath,
  [switch]$LaunchSmoke,
  [switch]$IncludeMachineName
)
$ErrorActionPreference = 'Stop'
function Add-Check($Name, $Status, $Message, $Data = $null) { [pscustomobject]@{ name=$Name; status=$Status; message=$Message; data=$Data } }
$checks = New-Object System.Collections.Generic.List[object]
$failed = $false
function Fail($Name, $Message, $Data=$null) { $script:failed = $true; $script:checks.Add((Add-Check $Name 'FAIL' $Message $Data)) }
function Pass($Name, $Message, $Data=$null) { $script:checks.Add((Add-Check $Name 'PASS' $Message $Data)) }
function Warn($Name, $Message, $Data=$null) { $script:checks.Add((Add-Check $Name 'WARN' $Message $Data)) }

$artifactDir = Resolve-Path $ArtifactDirectory
$manifestPath = Join-Path $artifactDir 'rc-manifest.json'
if (!(Test-Path $manifestPath)) { Fail 'manifest.exists' 'rc-manifest.json was not found.' } else { Pass 'manifest.exists' 'rc-manifest.json found.' }
$manifest = if (Test-Path $manifestPath) { Get-Content $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json } else { $null }
$exe = Get-ChildItem $artifactDir -Filter 'KadoMoco-*.exe' | Select-Object -First 1
$zip = Get-ChildItem $artifactDir -Filter 'KadoMoco-*.zip' | Select-Object -First 1
if ($exe) { Pass 'exe.exists' 'Installer EXE found.' $exe.Name } else { Fail 'exe.exists' 'Installer EXE missing.' }
if ($zip) { Pass 'zip.exists' 'ZIP package found.' $zip.Name } else { Fail 'zip.exists' 'ZIP package missing.' }
foreach ($file in @($exe,$zip)) {
  if ($null -eq $file) { continue }
  if ($file.Length -gt 0) { Pass "size.$($file.Name)" 'File is non-empty.' $file.Length } else { Fail "size.$($file.Name)" 'File is empty.' }
  $hash = (Get-FileHash $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
  $expected = $manifest.artifacts | Where-Object { $_.artifactName -eq $file.Name } | Select-Object -ExpandProperty sha256 -First 1
  if ($expected -and $hash -eq $expected) { Pass "sha256.$($file.Name)" 'SHA-256 matches manifest.' $hash } else { Fail "sha256.$($file.Name)" 'SHA-256 does not match manifest.' @{ actual=$hash; expected=$expected } }
}
if ($exe) {
  $version = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($exe.FullName)
  if ($version.ProductName -eq 'KadoMoco') { Pass 'version.productName' 'ProductName is KadoMoco.' } else { Fail 'version.productName' 'ProductName mismatch.' $version.ProductName }
  if ($manifest -and $version.FileVersion -like "$($manifest.version)*") { Pass 'version.fileVersion' 'FileVersion matches manifest version.' $version.FileVersion } else { Fail 'version.fileVersion' 'FileVersion does not match manifest version.' @{ fileVersion=$version.FileVersion; version=$manifest.version } }
  $sig = Get-AuthenticodeSignature $exe.FullName
  if ($sig.Status -eq 'Valid') { Pass 'signature.status' 'Authenticode signature is valid.' $sig.Status.ToString() }
  elseif ($sig.Status -eq 'NotSigned') { Warn 'signature.status' 'File is not signed; expected warning for v0.1.0 RC.' $sig.Status.ToString() }
  else { Fail 'signature.status' 'Signature status may indicate corruption or trust failure.' $sig.Status.ToString() }
}
if ($zip) {
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $archive = [System.IO.Compression.ZipFile]::OpenRead($zip.FullName)
  try {
    $names = $archive.Entries | ForEach-Object { $_.FullName -replace '\\','/' }
    foreach ($required in @('KadoMoco.exe','resources/app.asar','resources/tray-icon.png')) {
      if ($names | Where-Object { $_ -eq $required -or $_ -like "*/$required" }) { Pass "zip.contains.$required" "ZIP contains $required." } else { Fail "zip.contains.$required" "ZIP missing $required." }
    }
  } finally { $archive.Dispose() }
}
if ($LaunchSmoke -and $zip) {
  $extract = Join-Path $env:TEMP "kadomoco-rc-smoke-$([guid]::NewGuid())"
  Expand-Archive -Path $zip.FullName -DestinationPath $extract
  $app = Get-ChildItem $extract -Filter 'KadoMoco.exe' -Recurse | Select-Object -First 1
  if ($app) {
    $p = Start-Process -FilePath $app.FullName -PassThru
    Start-Sleep -Seconds 5
    if ($p.HasExited) { Fail 'launchSmoke.process' 'KadoMoco exited during smoke window.' $p.ExitCode } else { Pass 'launchSmoke.process' 'KadoMoco process stayed running. The script did not terminate it.' $p.Id }
  } else { Fail 'launchSmoke.process' 'KadoMoco.exe not found after ZIP extraction.' }
}
$report = [pscustomobject]@{
  generatedAtUtc = (Get-Date).ToUniversalTime().ToString('o')
  machineName = if ($IncludeMachineName) { $env:COMPUTERNAME } else { 'redacted' }
  windowsVersion = (Get-CimInstance Win32_OperatingSystem).Caption + ' ' + (Get-CimInstance Win32_OperatingSystem).Version
  displayLanguage = (Get-Culture).Name
  powerShellVersion = $PSVersionTable.PSVersion.ToString()
  monitorCount = @(Get-CimInstance -Namespace root\wmi -ClassName WmiMonitorBasicDisplayParams -ErrorAction SilentlyContinue).Count
  artifactDirectory = $artifactDir.Path
  checks = $checks
  overallStatus = if ($failed) { 'FAIL' } else { 'PASS_WITH_WARNINGS_ALLOWED' }
}
New-Item -ItemType Directory -Force -Path (Split-Path $ReportPath) | Out-Null
$report | ConvertTo-Json -Depth 8 | Set-Content -Path $ReportPath -Encoding utf8
if ($failed) { exit 1 }
