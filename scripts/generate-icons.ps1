# EduFrais icon generator
# Produces two 1024x1024 PNG assets:
#   - icon.png          : iOS + legacy Android launcher (solid bg, rounded corners)
#   - adaptive-icon.png : Android adaptive foreground (transparent bg, safe-zone content)
# Re-run any time the brand mark changes.

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$size        = 1024
$brand       = [System.Drawing.Color]::FromArgb(255, 75, 73, 172)    # #4B49AC
$brandDark   = [System.Drawing.Color]::FromArgb(255, 58, 56, 140)    # slightly darker for depth
$accent      = [System.Drawing.Color]::FromArgb(255, 255, 206,  90)  # warm gold accent (coin)
$white       = [System.Drawing.Color]::White
$transparent = [System.Drawing.Color]::Transparent

$scriptRoot = Split-Path -Parent $PSCommandPath
$assetsDir  = Join-Path (Split-Path -Parent $scriptRoot) 'assets'

function New-RoundedRectPath {
    param(
        [float]$x, [float]$y, [float]$w, [float]$h, [float]$r
    )
    $gp = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $r * 2
    [void]$gp.AddArc($x,           $y,           $d, $d, 180, 90)
    [void]$gp.AddArc($x + $w - $d, $y,           $d, $d, 270, 90)
    [void]$gp.AddArc($x + $w - $d, $y + $h - $d, $d, $d,   0, 90)
    [void]$gp.AddArc($x,           $y + $h - $d, $d, $d,  90, 90)
    [void]$gp.CloseFigure()
    ,$gp  # comma-unary forces single-object return, blocks array unrolling
}

function Draw-Mark {
    param(
        [Parameter(Mandatory)] [System.Drawing.Graphics]$g,
        [Parameter(Mandatory)] [int]$canvas,
        [Parameter(Mandatory)] [bool]$forAdaptive
    )

    # Adaptive icons must keep content inside the inner 66% safe zone;
    # full-bleed icons can use the whole canvas.
    $scale = if ($forAdaptive) { 0.66 } else { 1.0 }
    $cx    = [float]($canvas / 2.0)
    $cy    = [float]($canvas / 2.0)
    $box   = [float]($canvas * $scale)

    $whiteBrush = New-Object System.Drawing.SolidBrush $white

    # ── Graduation cap (mortarboard) above the monogram ──────────────
    $capW  = [float]($box * 0.55)
    $capH  = [float]($capW * 0.22)
    $capX  = [float]($cx - ($capW / 2.0))
    $capY  = [float]($cy - ($box * 0.30))

    $capPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    [void]$capPath.AddPolygon([System.Drawing.PointF[]]@(
        (New-Object System.Drawing.PointF($cx,          $capY)),
        (New-Object System.Drawing.PointF(($capX + $capW), ($capY + $capH / 2.0))),
        (New-Object System.Drawing.PointF($cx,          ($capY + $capH))),
        (New-Object System.Drawing.PointF($capX,        ($capY + $capH / 2.0)))
    ))
    $g.FillPath($whiteBrush, $capPath)

    # Tassel on the right side
    $tassW = [float]($capW * 0.08)
    $tassH = [float]($capH * 1.6)
    $tassX = [float]($capX + $capW - ($tassW / 2.0))
    $tassY = [float]($capY + ($capH / 2.0))
    $g.FillRectangle($whiteBrush, $tassX, $tassY, $tassW, $tassH)
    $tassCircleD = [float]($tassW * 2.4)
    $g.FillEllipse(
        $whiteBrush,
        [float]($tassX - ($tassCircleD - $tassW) / 2.0),
        [float]($tassY + $tassH - ($tassCircleD * 0.3)),
        $tassCircleD,
        $tassCircleD
    )

    # ── Monogram "EF" in the center ───────────────────────────────────
    $fontSize = [float]($box * 0.40)
    $fontFamily = $null
    foreach ($name in @('Segoe UI Black', 'Arial Black', 'Segoe UI', 'Arial')) {
        try {
            $fontFamily = New-Object System.Drawing.FontFamily $name
            break
        } catch {}
    }
    if (-not $fontFamily) {
        $fontFamily = [System.Drawing.FontFamily]::GenericSansSerif
    }
    $font = New-Object System.Drawing.Font(
        $fontFamily,
        $fontSize,
        [System.Drawing.FontStyle]::Bold,
        [System.Drawing.GraphicsUnit]::Pixel
    )
    $fmt = New-Object System.Drawing.StringFormat
    $fmt.Alignment     = [System.Drawing.StringAlignment]::Center
    $fmt.LineAlignment = [System.Drawing.StringAlignment]::Center
    $textRect = New-Object System.Drawing.RectangleF(
        0,
        [float]($cy - $box * 0.02),
        [float]$canvas,
        [float]($box * 0.45)
    )
    $g.DrawString('EF', $font, $whiteBrush, $textRect, $fmt)

    # ── Coin accent (the "fee" part of EduFrais) ──────────────────────
    $coinD = [float]($box * 0.20)
    $coinX = [float]($cx + ($box * 0.18))
    $coinY = [float]($cy + ($box * 0.20))
    $coinBrush = New-Object System.Drawing.SolidBrush $accent
    $g.FillEllipse($coinBrush, $coinX, $coinY, $coinD, $coinD)
    # "€" glyph on the coin
    $coinFontSize = [float]($coinD * 0.70)
    $coinFont = New-Object System.Drawing.Font(
        $fontFamily,
        $coinFontSize,
        [System.Drawing.FontStyle]::Bold,
        [System.Drawing.GraphicsUnit]::Pixel
    )
    $coinRect = New-Object System.Drawing.RectangleF($coinX, $coinY, $coinD, $coinD)
    $coinTextBrush = New-Object System.Drawing.SolidBrush $brandDark
    $g.DrawString([char]0x20AC, $coinFont, $coinTextBrush, $coinRect, $fmt)
}

function Save-Icon {
    param(
        [Parameter(Mandatory)] [string]$OutPath,
        [Parameter(Mandatory)] [bool]$Adaptive
    )

    $bmp = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g   = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

    if (-not $Adaptive) {
        # Solid rounded-rect brand background (iOS ignores rounded corners
        # because it applies its own mask, Android renders them as-is).
        $g.Clear($transparent)
        $radius = [float]($size * 0.22)
        $bgPath = New-RoundedRectPath 0 0 $size $size $radius
        $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
            (New-Object System.Drawing.PointF(0, 0)),
            (New-Object System.Drawing.PointF(0, $size)),
            $brand,
            $brandDark
        )
        $g.FillPath($bgBrush, $bgPath)
        Draw-Mark -g $g -canvas $size -forAdaptive $false
    } else {
        # Adaptive foreground — transparent canvas, content confined to
        # the inner 66% safe zone so Android's mask doesn't crop it.
        $g.Clear($transparent)
        Draw-Mark -g $g -canvas $size -forAdaptive $true
    }

    $g.Dispose()
    $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Wrote $OutPath"
}

Save-Icon -OutPath (Join-Path $assetsDir 'icon.png')          -Adaptive $false
Save-Icon -OutPath (Join-Path $assetsDir 'adaptive-icon.png') -Adaptive $true
