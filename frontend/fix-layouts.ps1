# Fix ALL fractional split layouts in the frontend
# Replaces ugly grid-cols-[0.85fr_1.15fr] patterns with proper full-width layouts
$files = Get-ChildItem -Path 'c:\kargax2\frontend\src' -Recurse -Filter '*.tsx'
$count = 0
foreach ($file in $files) {
    $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
    $original = $content

    # Replace fractional grid splits with responsive stacked layouts
    # These patterns create ugly unbalanced columns
    $content = $content.Replace('grid-cols-[0.85fr_1.15fr]', 'grid-cols-1 lg:grid-cols-2')
    $content = $content.Replace('grid-cols-[0.86fr_1.14fr]', 'grid-cols-1 lg:grid-cols-2')
    $content = $content.Replace('grid-cols-[0.88fr_1.12fr]', 'grid-cols-1 lg:grid-cols-2')
    $content = $content.Replace('grid-cols-[0.9fr_1.1fr]', 'grid-cols-1 lg:grid-cols-2')
    $content = $content.Replace('grid-cols-[0.92fr_1.08fr]', 'grid-cols-1 lg:grid-cols-2')
    $content = $content.Replace('grid-cols-[0.95fr_1.05fr]', 'grid-cols-1 lg:grid-cols-2')
    $content = $content.Replace('grid-cols-[1.05fr_0.95fr]', 'grid-cols-1 lg:grid-cols-2')
    $content = $content.Replace('grid-cols-[1.1fr_0.9fr]', 'grid-cols-1 lg:grid-cols-2')
    $content = $content.Replace('grid-cols-[1.15fr_0.85fr]', 'grid-cols-1 lg:grid-cols-2')
    $content = $content.Replace('grid-cols-[1.2fr_0.8fr]', 'grid-cols-1 lg:grid-cols-2')

    # Fix legacy CSS tokens -> direct Tailwind
    $content = $content.Replace('bg-card', 'bg-white dark:bg-slate-900')
    $content = $content.Replace('text-foreground', 'text-slate-900 dark:text-white')
    $content = $content.Replace('text-muted-foreground', 'text-slate-500 dark:text-slate-400')
    $content = $content.Replace('bg-muted', 'bg-slate-50 dark:bg-slate-800')
    $content = $content.Replace('bg-input', 'bg-white dark:bg-slate-800')
    $content = $content.Replace('border-border', 'border-slate-200 dark:border-slate-700')
    $content = $content.Replace('focus:ring-ring', 'focus:ring-green-500/40')
    $content = $content.Replace('shadow-elevated', 'shadow-xl')
    $content = $content.Replace('shadow-subtle', 'shadow-sm')
    $content = $content.Replace('font-heading', 'font-bold')
    $content = $content.Replace('bg-primary ', 'bg-green-600 ')
    $content = $content.Replace('text-primary-foreground', 'text-white')
    $content = $content.Replace('text-primary ', 'text-green-600 ')
    $content = $content.Replace('hover:bg-primary-light', 'hover:bg-green-500')
    $content = $content.Replace('hover:text-primary-light', 'hover:text-green-500')
    $content = $content.Replace('bg-primary', 'bg-green-600')
    $content = $content.Replace('text-primary', 'text-green-600')
    $content = $content.Replace('bg-accent/10', 'bg-orange-500/10')
    $content = $content.Replace('bg-primary/10', 'bg-green-600/10')
    $content = $content.Replace('transition-hover', 'transition-colors')

    if ($content -ne $original) {
        [System.IO.File]::WriteAllText($file.FullName, $content, [System.Text.Encoding]::UTF8)
        $count++
        Write-Host "Fixed: $($file.Name)"
    }
}
Write-Host "`nTotal files fixed: $count"
