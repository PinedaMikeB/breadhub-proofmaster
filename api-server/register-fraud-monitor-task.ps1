param(
    [string]$TaskName = 'BreadHub Fraud Monitor',
    [int]$IntervalMinutes = 5,
    [int]$LookbackHours = 12
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$runner = Join-Path $scriptDir 'run-fraud-monitor.ps1'
$taskCommand = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$runner`" --once --hours=$LookbackHours"

Write-Host "Registering scheduled task: $TaskName"
schtasks /Create /SC MINUTE /MO $IntervalMinutes /TN $TaskName /TR $taskCommand /F
