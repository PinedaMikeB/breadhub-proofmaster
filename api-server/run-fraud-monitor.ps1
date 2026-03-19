param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Arguments
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

& node "$scriptDir\run-fraud-monitor.js" @Arguments
exit $LASTEXITCODE
