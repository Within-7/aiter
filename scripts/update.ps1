# AiTer Update Script for Windows
# This script is called by the application to perform self-update
# It waits for the app to exit, runs the installer, and restarts

param(
    [Parameter(Mandatory=$true)]
    [int]$AppPID,

    [Parameter(Mandatory=$true)]
    [string]$InstallerPath,

    [Parameter(Mandatory=$false)]
    [string]$AppPath = "",

    [Parameter(Mandatory=$false)]
    [bool]$Restart = $true,

    [Parameter(Mandatory=$false)]
    [bool]$Silent = $true
)

# Log file
$LogDir = Join-Path $env:LOCALAPPDATA "AiTer\Logs"
if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}
$LogFile = Join-Path $LogDir "update.log"

# Logging function
function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] $Message"
    Add-Content -Path $LogFile -Value $logMessage -Encoding UTF8
    Write-Host $Message
}

Write-Log "=========================================="
Write-Log "AiTer Update Script Started"
Write-Log "PID to wait: $AppPID"
Write-Log "Installer path: $InstallerPath"
Write-Log "App path: $AppPath"
Write-Log "Restart: $Restart"
Write-Log "Silent: $Silent"
Write-Log "=========================================="

# Validate arguments
if (-not (Test-Path $InstallerPath)) {
    Write-Log "ERROR: Installer file not found: $InstallerPath"
    exit 1
}

# Wait for the application to exit
Write-Log "Waiting for application to exit (PID: $AppPID)..."
$maxWait = 60  # Maximum wait time in seconds
$waitCount = 0

try {
    $process = Get-Process -Id $AppPID -ErrorAction SilentlyContinue
    while ($process -and -not $process.HasExited) {
        Start-Sleep -Seconds 1
        $waitCount++

        if ($waitCount -ge $maxWait) {
            Write-Log "WARNING: Application did not exit within $maxWait seconds, force killing..."
            Stop-Process -Id $AppPID -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 2
            break
        }

        $process = Get-Process -Id $AppPID -ErrorAction SilentlyContinue
    }
} catch {
    Write-Log "Process already exited or not found"
}

Write-Log "Application has exited"

# Determine if installer is NSIS (.exe) or zip
$extension = [System.IO.Path]::GetExtension($InstallerPath).ToLower()

if ($extension -eq ".exe") {
    # Run NSIS installer
    Write-Log "Running NSIS installer..."

    $arguments = @()
    if ($Silent) {
        $arguments += "/S"  # Silent install
    }

    try {
        $installerProcess = Start-Process -FilePath $InstallerPath -ArgumentList $arguments -Wait -PassThru -ErrorAction Stop

        if ($installerProcess.ExitCode -eq 0) {
            Write-Log "Installation completed successfully (exit code: 0)"
        } else {
            Write-Log "WARNING: Installer exited with code: $($installerProcess.ExitCode)"
        }
    } catch {
        Write-Log "ERROR: Failed to run installer: $($_.Exception.Message)"
        exit 1
    }
} elseif ($extension -eq ".zip") {
    # Extract zip file
    Write-Log "Extracting zip update package..."

    $tempDir = Join-Path $env:TEMP "AiTer-Update-$(Get-Date -Format 'yyyyMMddHHmmss')"

    try {
        Expand-Archive -Path $InstallerPath -DestinationPath $tempDir -Force
        Write-Log "Extracted to: $tempDir"

        # Find the app executable or folder
        $newApp = Get-ChildItem -Path $tempDir -Filter "AiTer.exe" -Recurse | Select-Object -First 1

        if (-not $newApp) {
            $newApp = Get-ChildItem -Path $tempDir -Filter "AiTer" -Directory -Recurse | Select-Object -First 1
        }

        if ($newApp) {
            Write-Log "Found new app: $($newApp.FullName)"

            # Determine installation directory
            if ([string]::IsNullOrEmpty($AppPath)) {
                $AppPath = Join-Path $env:LOCALAPPDATA "Programs\AiTer"
            }

            # Copy new files
            Write-Log "Installing to: $AppPath"
            $sourceDir = $newApp.DirectoryName
            if ($newApp.PSIsContainer) {
                $sourceDir = $newApp.FullName
            }

            Copy-Item -Path "$sourceDir\*" -Destination $AppPath -Recurse -Force
            Write-Log "Files copied successfully"
        } else {
            Write-Log "ERROR: Could not find AiTer in update package"
            Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
            exit 1
        }

        # Cleanup temp directory
        Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    } catch {
        Write-Log "ERROR: Failed to extract/install: $($_.Exception.Message)"
        exit 1
    }
}

# Cleanup installer file
Write-Log "Cleaning up installer..."
Remove-Item -Path $InstallerPath -Force -ErrorAction SilentlyContinue

Write-Log "Update completed successfully!"

# Restart application if requested
if ($Restart) {
    Write-Log "Restarting application..."
    Start-Sleep -Seconds 1

    # Find the installed app
    $appExe = $null

    # Try common installation paths
    $possiblePaths = @(
        (Join-Path $env:LOCALAPPDATA "Programs\AiTer\AiTer.exe"),
        (Join-Path $env:ProgramFiles "AiTer\AiTer.exe"),
        (Join-Path ${env:ProgramFiles(x86)} "AiTer\AiTer.exe")
    )

    if (-not [string]::IsNullOrEmpty($AppPath)) {
        $possiblePaths = @((Join-Path $AppPath "AiTer.exe")) + $possiblePaths
    }

    foreach ($path in $possiblePaths) {
        if (Test-Path $path) {
            $appExe = $path
            break
        }
    }

    if ($appExe) {
        Write-Log "Starting: $appExe"
        Start-Process -FilePath $appExe
        Write-Log "Application restarted"
    } else {
        Write-Log "WARNING: Could not find AiTer executable to restart"
    }
}

Write-Log "Update script finished"
exit 0
