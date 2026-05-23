$files = Get-ChildItem -Path 'c:\kargax2\frontend\src' -Recurse -Filter '*.ts' -Exclude '*.tsx'
$count = 0
foreach ($file in $files) {
    $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
    if ($content.Contains('amber')) {
        $content = $content.Replace('amber-700', 'orange-700')
        $content = $content.Replace('amber-600', 'orange-600')
        $content = $content.Replace('amber-500', 'orange-500')
        $content = $content.Replace('amber-400', 'orange-400')
        $content = $content.Replace('amber-200', 'orange-200')
        $content = $content.Replace('amber-100', 'orange-100')
        $content = $content.Replace('amber-50','orange-50')
        [System.IO.File]::WriteAllText($file.FullName, $content, [System.Text.Encoding]::UTF8)
        $count++
        Write-Host "Updated: $($file.Name)"
    }
}
Write-Host "Total updated: $count"
