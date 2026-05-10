param(
    [string[]]$Urls = @(
        "https://github.com",
        "https://huggingface.co",
        "https://news.google.com",
        "https://html.duckduckgo.com",
        "https://hn.algolia.com",
        "https://openai.com"
    )
)

$results = @()

foreach ($url in $Urls) {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        $r = Invoke-WebRequest -Uri $url -Method Head -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
        $sw.Stop()
        $results += [PSCustomObject]@{
            Url = $url
            Status = "OK"
            StatusCode = $r.StatusCode
            DurationMs = $sw.ElapsedMilliseconds
            Error = ""
        }
    } catch {
        $sw.Stop()
        $results += [PSCustomObject]@{
            Url = $url
            Status = "FAIL"
            StatusCode = 0
            DurationMs = $sw.ElapsedMilliseconds
            Error = $_.Exception.Message.Substring(0, [Math]::Min(100, $_.Exception.Message.Length))
        }
    }
}

$results | Format-Table -AutoSize
