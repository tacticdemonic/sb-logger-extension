# DEPRECATED: OddsHarvester removed
# The previous approach used OddsHarvester to scrape OddsPortal for CLV data.
# That approach has been removed from the project. Use the CSV-based CLV system
# (football-data.co.uk) and the Player Props Poller instead. See CLV_SYSTEM_OVERVIEW.md
# for details and how to populate CSV cache if needed.

param(
    [switch]$Visible,
    [string]$Sport = "",
    [string]$League = "",
    [string]$Season = "2024-2025"
)

# OddsHarvester related environment variables removed.
Write-Host "This script is deprecated and no longer available. OddsHarvester has been removed from the project."
Exit 1

# Mapping of Surebet tournament names to OddsPortal league slugs
# Format: @{ "sport" = @( @("oddsportal-league-slug", "season-format"), ... ) }
# NOTE: League slugs MUST match exactly what's in OddsHarvester's sport_league_constants.py
$LeagueMappings = @{
    "football" = @(
        # Major European Leagues (verified in sport_league_constants.py)
        @("england-premier-league", "2024-2025"),
        @("england-championship", "2024-2025"),
        @("spain-laliga", "2024-2025"),                 # La Liga (NOT spain-primera-division!)
        @("spain-laliga2", "2024-2025"),               # La Liga 2
        @("germany-bundesliga", "2024-2025"),
        @("germany-bundesliga-2", "2024-2025"),
        @("italy-serie-a", "2024-2025"),
        @("italy-serie-b", "2024-2025"),
        @("france-ligue-1", "2024-2025"),
        @("france-ligue-2", "2024-2025"),
        @("eredivisie", "2024-2025"),                   # Netherlands
        @("jupiler-pro-league", "2024-2025"),          # Belgium
        @("liga-portugal", "2024-2025"),
        @("scotland-premiership", "2024-2025"),
        @("turkey-super-lig", "2024-2025"),
        @("greece-super-league", "2024-2025"),
        @("switzerland-super-league", "2024-2025"),
        @("austria-bundesliga", "2024-2025"),
        @("denmark-superliga", "2024-2025"),
        @("norway-eliteserien", "2024"),
        @("romania-superliga", "2024-2025"),
        @("bulgaria-parva-liga", "2024-2025"),
        
        # UEFA Competitions
        @("champions-league", "2024-2025"),
        @("europa-league", "2024-2025"),
        
        # Americas
        @("brazil-serie-a", "2024"),
        @("usa-mls", "2024"),
        @("mexico-liga-mx", "2024-2025"),
        @("colombia-primera-a", "2024"),
        
        # Other
        @("australia-a-league", "2024-2025"),
        @("saudi-professional-league", "2024-2025")
    ),
    
    "tennis" = @(
        # ATP tournaments (check sport_league_constants.py for exact slugs)
        @("atp-australian-open", "2024"),
        @("atp-french-open", "2024"),
        @("atp-wimbledon", "2024"),
        @("atp-us-open", "2024")
    ),
    
    "basketball" = @(
        @("nba", "2024-2025"),
        @("euroleague", "2024-2025"),
        @("acb-spain", "2024-2025")
    ),
    
    "ice-hockey" = @(
        @("nhl", "2024-2025")
    )
}

# Stats tracking
$totalScraped = 0
$totalFailed = 0
$results = @()

function Scrape-League {
    param(
        [string]$Sport,
        [string]$LeagueSlug,
        [string]$SeasonYear,
        [switch]$Headless
    )
    
    $headlessArg = if ($Headless) { "--headless" } else { "" }
    
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "Scraping: $Sport / $LeagueSlug / $SeasonYear" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Cyan
    
    $startTime = Get-Date
    
    try {
        $args = @(
            "-m", "src.main", "scrape_historic",
            "--sport", $Sport,
            "--leagues", $LeagueSlug,
            "--season", $SeasonYear,
            "--scrape_odds_history"
        )
        if ($Headless) { $args += "--headless" }
        
        $process = Start-Process -FilePath $PythonExe -ArgumentList $args -WorkingDirectory $OddsHarvesterPath -Wait -PassThru -NoNewWindow
        
        $duration = (Get-Date) - $startTime
        
        if ($process.ExitCode -eq 0) {
            Write-Host "✅ Success! Duration: $($duration.ToString('mm\:ss'))" -ForegroundColor Green
            return @{ Success = $true; League = $LeagueSlug; Duration = $duration }
        } else {
            Write-Host "❌ Failed (exit code: $($process.ExitCode))" -ForegroundColor Red
            return @{ Success = $false; League = $LeagueSlug; Error = "Exit code $($process.ExitCode)" }
        }
    }
    catch {
        Write-Host "❌ Error: $_" -ForegroundColor Red
        return @{ Success = $false; League = $LeagueSlug; Error = $_.ToString() }
    }
}

# Main execution
Write-Host @"

╔══════════════════════════════════════════════════════════════╗
║          CLV Cache Population Script                         ║
║          OddsHarvester Batch Scraper                         ║
╚══════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Cyan

# Check prerequisites
if (-not (Test-Path $PythonExe)) {
    Write-Host "❌ Python not found at: $PythonExe" -ForegroundColor Red
    Write-Host "   Run the OddsHarvester API installer first." -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path $OddsHarvesterPath)) {
    Write-Host "❌ OddsHarvester not found at: $OddsHarvesterPath" -ForegroundColor Red
    exit 1
}

$headlessMode = -not $Visible
Write-Host "Mode: $(if ($headlessMode) { 'Headless (background)' } else { 'Visible (browser shown)' })" -ForegroundColor Cyan

# Filter leagues if specific sport/league requested
$leaguesToScrape = @()

if ($League) {
    # Single league mode
    $sportKey = if ($Sport) { $Sport.ToLower() } else { "football" }
    $leaguesToScrape += @{ Sport = $sportKey; League = $League; Season = $Season }
    Write-Host "Single league mode: $sportKey / $League / $Season" -ForegroundColor Yellow
}
elseif ($Sport) {
    # Single sport mode
    $sportKey = $Sport.ToLower()
    if ($LeagueMappings.ContainsKey($sportKey)) {
        foreach ($leagueInfo in $LeagueMappings[$sportKey]) {
            $leaguesToScrape += @{ Sport = $sportKey; League = $leagueInfo[0]; Season = $leagueInfo[1] }
        }
        Write-Host "Sport mode: Scraping all $($leaguesToScrape.Count) $sportKey leagues" -ForegroundColor Yellow
    } else {
        Write-Host "❌ Unknown sport: $sportKey" -ForegroundColor Red
        Write-Host "   Available: $($LeagueMappings.Keys -join ', ')" -ForegroundColor Yellow
        exit 1
    }
}
else {
    # All leagues mode
    foreach ($sportKey in $LeagueMappings.Keys) {
        foreach ($leagueInfo in $LeagueMappings[$sportKey]) {
            $leaguesToScrape += @{ Sport = $sportKey; League = $leagueInfo[0]; Season = $leagueInfo[1] }
        }
    }
    Write-Host "Full mode: Scraping all $($leaguesToScrape.Count) leagues across all sports" -ForegroundColor Yellow
}

Write-Host "`nLeagues to scrape: $($leaguesToScrape.Count)" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to cancel, or wait 5 seconds to begin..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

$overallStart = Get-Date

foreach ($item in $leaguesToScrape) {
    $result = Scrape-League -Sport $item.Sport -LeagueSlug $item.League -SeasonYear $item.Season -Headless:$headlessMode
    $results += $result
    
    if ($result.Success) {
        $totalScraped++
    } else {
        $totalFailed++
    }
    
    # Brief pause between leagues to avoid rate limiting
    Start-Sleep -Seconds 2
}

$overallDuration = (Get-Date) - $overallStart

# Summary
Write-Host @"

╔══════════════════════════════════════════════════════════════╗
║                      SCRAPING COMPLETE                       ║
╚══════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Cyan

Write-Host "Total Duration: $($overallDuration.ToString('hh\:mm\:ss'))" -ForegroundColor Cyan
Write-Host "Successful: $totalScraped" -ForegroundColor Green
Write-Host "Failed: $totalFailed" -ForegroundColor $(if ($totalFailed -gt 0) { "Red" } else { "Green" })

if ($totalFailed -gt 0) {
    Write-Host "`nFailed leagues:" -ForegroundColor Yellow
    $results | Where-Object { -not $_.Success } | ForEach-Object {
        Write-Host "  - $($_.League): $($_.Error)" -ForegroundColor Red
    }
}

# Cache size check
$cacheDb = "$env:LOCALAPPDATA\SurebetHelper\OddsHarvesterAPI\clv_cache.db"
if (Test-Path $cacheDb) {
    $cacheSizeMB = [math]::Round((Get-Item $cacheDb).Length / 1MB, 2)
    Write-Host "`nCache size: $cacheSizeMB MB" -ForegroundColor Cyan
}

Write-Host "`nDone! You can now use Force CLV Check in the extension." -ForegroundColor Green
