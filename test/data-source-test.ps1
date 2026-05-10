$Urls = @(
    @{name="OpenAI Blog"; url="https://openai.com/news/rss.xml"},
    @{name="HuggingFace Blog"; url="https://huggingface.co/blog/feed.xml"},
    @{name="GitHub openai-python"; url="https://github.com/openai/openai-python/releases.atom"},
    @{name="GitHub transformers"; url="https://github.com/huggingface/transformers/releases.atom"},
    @{name="Anthropic News"; url="https://www.anthropic.com/news/rss.xml"},
    @{name="DeepMind Blog"; url="https://deepmind.google/blog/rss.xml"},
    @{name="HackerNews API"; url="https://hn.algolia.com/api/v1/search?query=test"},
    @{name="Google News RSS"; url="https://news.google.com/rss/search?q=AI"},
    @{name="DuckDuckGo HTML"; url="https://html.duckduckgo.com/html/?q=AI"}
)

$results = @()

foreach ($item in $Urls) {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        $headers = @{
            "User-Agent" = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            "Accept" = "*/*"
        }
        $r = Invoke-WebRequest -Uri $item.url -Headers $headers -TimeoutSec 20 -UseBasicParsing -ErrorAction Stop
        $sw.Stop()

        $results += [PSCustomObject]@{
            Name = $item.name
            Status = "OK"
            StatusCode = $r.StatusCode
            DurationMs = $sw.ElapsedMilliseconds
            ContentType = $r.Headers["Content-Type"]
            BodyLength = $r.Content.Length
            Error = ""
        }
    } catch {
        $sw.Stop()
        $errMsg = $_.Exception.Message
        if ($errMsg.Length -gt 80) {
            $errMsg = $errMsg.Substring(0, 80)
        }
        $results += [PSCustomObject]@{
            Name = $item.name
            Status = "FAIL"
            StatusCode = 0
            DurationMs = $sw.ElapsedMilliseconds
            ContentType = ""
            BodyLength = 0
            Error = $errMsg
        }
    }
}

$results | Format-Table -AutoSize
