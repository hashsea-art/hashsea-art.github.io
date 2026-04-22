$root = Split-Path $PSScriptRoot -Parent
$csvPath = Join-Path $root "data\movies.csv"
$rows = Import-Csv $csvPath

$filmMap = @{}
foreach ($r in $rows) {
    $key = "$($r.movie)|$($r.year)"
    if (-not $filmMap.ContainsKey($key)) { $filmMap[$key] = @() }
    $filmMap[$key] += $r
}

$scoreFreq = @{}
$ratingFreq = @{}
$filmsList = [System.Collections.Generic.List[PSCustomObject]]::new()

foreach ($key in $filmMap.Keys) {
    $entries = $filmMap[$key] | Sort-Object {
        $d = $_.date_watched.Trim()
        if ($d -eq '') { [DateTime]::MaxValue } else { [DateTime]::Parse($d) }
    }
    $parts = $key -split '\|', 2
    $filmsList.Add([PSCustomObject]@{ movie = $parts[0]; year = $parts[1] })

    $latestScore = $null
    foreach ($e in $entries) { if ($e.score -ne '') { $latestScore = [int]$e.score } }
    if ($null -ne $latestScore) {
        if (-not $scoreFreq.ContainsKey($latestScore)) { $scoreFreq[$latestScore] = 0 }
        $scoreFreq[$latestScore]++
    }

    $latestRating = $null
    foreach ($e in $entries) { if ($e.rating -ne '') { $latestRating = $e.rating } }
    if ($null -ne $latestRating) {
        if (-not $ratingFreq.ContainsKey($latestRating)) { $ratingFreq[$latestRating] = 0 }
        $ratingFreq[$latestRating]++
    }
}

# score_frequency.csv
$scoreTotal = 0
$scoreLines = @("score,count")
for ($s = 1; $s -le 100; $s++) {
    $c = if ($scoreFreq.ContainsKey($s)) { $scoreFreq[$s] } else { 0 }
    $scoreLines += "$s,$c"
    $scoreTotal += $c
}
$scoreLines += "total,$scoreTotal"
$scoreLines -join "`n" | Out-File -FilePath (Join-Path $root "data\metadata\score_frequency.csv") -Encoding utf8 -NoNewline

# rating_frequency.csv
$ratingTotal = 0
$allRatings = @(0.5,1,1.5,2,2.5,3,3.5,4,4.5,5)
$ratingLines = @("rating,count")
foreach ($r in $allRatings) {
    $rk = $r.ToString()
    $c = if ($ratingFreq.ContainsKey($rk)) { $ratingFreq[$rk] } else { 0 }
    $ratingLines += "$rk,$c"
    $ratingTotal += $c
}
$ratingLines += "total,$ratingTotal"
$ratingLines -join "`n" | Out-File -FilePath (Join-Path $root "data\metadata\rating_frequency.csv") -Encoding utf8 -NoNewline

# films_alphabetical.csv
$sorted = $filmsList | Sort-Object movie, year
$filmLines = @("movie,year")
foreach ($f in $sorted) {
    $m = $f.movie -replace '"','""'
    $filmLines += "`"$m`",$($f.year)"
}
$filmLines += "total,$($sorted.Count)"
$filmLines -join "`n" | Out-File -FilePath (Join-Path $root "data\metadata\films_alphabetical.csv") -Encoding utf8 -NoNewline

Write-Host "Metadata generated: $($filmMap.Count) films, $scoreTotal scored, $ratingTotal rated"
