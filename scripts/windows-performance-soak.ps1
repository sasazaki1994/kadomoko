[CmdletBinding()]
param(
  [int]$DurationMinutes = 30,
  [int]$SampleIntervalSeconds = 10,
  [string]$OutputDirectory = '.\qa-results',
  [int]$ProcessId = 0,
  [string]$CommitSha = ''
)
$ErrorActionPreference = 'Stop'
if ($DurationMinutes -lt 1 -or $SampleIntervalSeconds -lt 1) { throw 'DurationMinutes and SampleIntervalSeconds must be positive.' }

function Get-Summary([double[]]$Values) {
  if ($Values.Count -eq 0) { return [pscustomobject]@{ minimum=$null; average=$null; median=$null; maximum=$null } }
  $sorted = @($Values | Sort-Object); $middle = [math]::Floor($sorted.Count / 2)
  $median = if ($sorted.Count % 2) { $sorted[$middle] } else { ($sorted[$middle - 1] + $sorted[$middle]) / 2 }
  $measure = $Values | Measure-Object -Minimum -Maximum -Average
  [pscustomobject]@{ minimum=[math]::Round($measure.Minimum,3); average=[math]::Round($measure.Average,3); median=[math]::Round($median,3); maximum=[math]::Round($measure.Maximum,3) }
}

$process = if ($ProcessId) { Get-Process -Id $ProcessId -ErrorAction Stop } else { Get-Process -Name 'KadoMoco' -ErrorAction Stop | Sort-Object StartTime | Select-Object -First 1 }
$started = (Get-Date).ToUniversalTime(); $deadline = $started.AddMinutes($DurationMinutes); $samples = @(); $exited = $false
$previousCpu = $process.CPU; $previousAt = Get-Date
while ((Get-Date).ToUniversalTime() -lt $deadline) {
  Start-Sleep -Seconds $SampleIntervalSeconds
  try { $process.Refresh(); if ($process.HasExited) { $exited = $true; break } } catch { $exited = $true; break }
  $now = Get-Date; $elapsed = ($now - $previousAt).TotalSeconds
  $cpu = if ($elapsed -gt 0) { (($process.CPU - $previousCpu) / $elapsed / [Environment]::ProcessorCount) * 100 } else { 0 }
  $samples += [pscustomobject]@{ sampledAt=$now.ToUniversalTime().ToString('o'); cpuPercent=[math]::Max(0,$cpu); workingSetMb=$process.WorkingSet64 / 1MB }
  $previousCpu = $process.CPU; $previousAt = $now
}
$ended = (Get-Date).ToUniversalTime(); $cpuSummary = Get-Summary @($samples | ForEach-Object cpuPercent); $memorySummary = Get-Summary @($samples | ForEach-Object workingSetMb)
$startMemory = if ($samples.Count) { $samples[0].workingSetMb } else { $null }; $endMemory = if ($samples.Count) { $samples[-1].workingSetMb } else { $null }
$package = Get-Content (Join-Path $PSScriptRoot '..\package.json') -Raw | ConvertFrom-Json
if (!$CommitSha) { try { $CommitSha = (& git -C (Join-Path $PSScriptRoot '..') rev-parse HEAD).Trim() } catch { $CommitSha = '' } }
$report = [ordered]@{
  schemaVersion=1; appVersion=$package.version; commitSha=$CommitSha; startedAt=$started.ToString('o'); endedAt=$ended.ToString('o')
  durationSeconds=[math]::Round(($ended-$started).TotalSeconds,3); sampleIntervalSeconds=$SampleIntervalSeconds; sampleCount=$samples.Count
  cpuPercentMinimum=$cpuSummary.minimum; cpuPercentAverage=$cpuSummary.average; cpuPercentMedian=$cpuSummary.median; cpuPercentMaximum=$cpuSummary.maximum
  workingSetMbMinimum=$memorySummary.minimum; workingSetMbAverage=$memorySummary.average; workingSetMbMedian=$memorySummary.median; workingSetMbMaximum=$memorySummary.maximum
  workingSetMbStart=$startMemory; workingSetMbEnd=$endMemory; workingSetGrowthMb=if ($samples.Count) {[math]::Round($endMemory-$startMemory,3)} else {$null}
  processExitedUnexpectedly=$exited; environment=[ordered]@{ windowsVersion=[Environment]::OSVersion.VersionString; logicalProcessorCount=[Environment]::ProcessorCount; processId=$process.Id }
  samples=$samples
}
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$stamp = $started.ToString('yyyyMMdd-HHmmss'); $base = Join-Path $OutputDirectory "performance-$stamp"; $suffix=0
while ((Test-Path "$base.json") -or (Test-Path "$base.md")) { $suffix++; $base = Join-Path $OutputDirectory "performance-$stamp-$suffix" }
$report | ConvertTo-Json -Depth 8 | Set-Content "$base.json" -Encoding utf8
@("# KadoMoco Performance Soak",'',"- Process: $($process.Id)","- Samples: $($samples.Count)","- CPU average / median / max: $($cpuSummary.average)% / $($cpuSummary.median)% / $($cpuSummary.maximum)%","- Working set average / max: $($memorySummary.average) MB / $($memorySummary.maximum) MB","- Working set growth: $($report.workingSetGrowthMb) MB","- Unexpected exit: $exited",'', '> The v0.1 targets are diagnostic goals, not an automatic release gate.') | Set-Content "$base.md" -Encoding utf8
Write-Output "$base.json"; if ($exited) { exit 1 }
