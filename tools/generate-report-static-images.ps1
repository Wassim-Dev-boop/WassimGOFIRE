param(
  [string]$OutputRoot = "C:\Users\wassi\Open Uml\images-rapport"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

function New-Canvas {
  param([int]$Width, [int]$Height, [System.Drawing.Color]$Color)
  $bmp = New-Object System.Drawing.Bitmap $Width, $Height
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $g.Clear($Color)
  return @{ Bitmap = $bmp; Graphics = $g }
}

function Save-Png {
  param($Bitmap, [string]$Path)
  $Bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
}

function Save-Jpg {
  param($Bitmap, [string]$Path)
  $encoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
  $params = New-Object System.Drawing.Imaging.EncoderParameters 1
  $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 92L
  $Bitmap.Save($Path, $encoder, $params)
}

function Draw-CenteredText {
  param($Graphics, [string]$Text, [System.Drawing.Font]$Font, [System.Drawing.Brush]$Brush, [System.Drawing.RectangleF]$Rect)
  $sf = New-Object System.Drawing.StringFormat
  $sf.Alignment = [System.Drawing.StringAlignment]::Center
  $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
  $Graphics.DrawString($Text, $Font, $Brush, $Rect, $sf)
  $sf.Dispose()
}

function Draw-Logo {
  param(
    [string]$Path,
    [string]$Title,
    [string]$Subtitle,
    [System.Drawing.Color]$Primary,
    [System.Drawing.Color]$Secondary
  )
  $c = New-Canvas -Width 600 -Height 600 -Color ([System.Drawing.Color]::Transparent)
  $g = $c.Graphics
  $pen = New-Object System.Drawing.Pen $Primary, 18
  $brushPrimary = New-Object System.Drawing.SolidBrush $Primary
  $brushSecondary = New-Object System.Drawing.SolidBrush $Secondary
  $brushText = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(28, 37, 65))
  $rect = New-Object System.Drawing.Rectangle 75, 55, 450, 450
  $g.DrawEllipse($pen, $rect)
  $g.FillEllipse($brushSecondary, 205, 145, 190, 190)
  $g.FillRectangle($brushPrimary, 242, 238, 116, 185)
  $g.FillEllipse([System.Drawing.Brushes]::White, 256, 160, 88, 88)
  $g.FillEllipse($brushSecondary, 278, 160, 88, 88)
  $fontTitle = New-Object System.Drawing.Font "Arial", 54, ([System.Drawing.FontStyle]::Bold)
  $fontSub = New-Object System.Drawing.Font "Arial", 22, ([System.Drawing.FontStyle]::Regular)
  Draw-CenteredText $g $Title $fontTitle $brushText ([System.Drawing.RectangleF]::new(0, 420, 600, 72))
  Draw-CenteredText $g $Subtitle $fontSub $brushText ([System.Drawing.RectangleF]::new(50, 500, 500, 50))
  Save-Png $c.Bitmap $Path
  $fontTitle.Dispose(); $fontSub.Dispose(); $pen.Dispose(); $brushPrimary.Dispose(); $brushSecondary.Dispose(); $brushText.Dispose(); $g.Dispose(); $c.Bitmap.Dispose()
}

function Draw-PlaceholderPhoto {
  param([string]$Path)
  $c = New-Canvas -Width 1400 -Height 900 -Color ([System.Drawing.Color]::FromArgb(245, 247, 250))
  $g = $c.Graphics
  $sky = New-Object System.Drawing.Drawing2D.LinearGradientBrush ([System.Drawing.Rectangle]::new(0,0,1400,540)), ([System.Drawing.Color]::FromArgb(220,235,247)), ([System.Drawing.Color]::FromArgb(245,247,250)), 90
  $g.FillRectangle($sky, 0, 0, 1400, 540)
  $g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(220, 230, 214))), 0, 610, 1400, 290)
  $building = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(236, 239, 244))
  $edge = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(144, 155, 175)), 5
  $g.FillRectangle($building, 260, 300, 880, 300)
  $g.DrawRectangle($edge, 260, 300, 880, 300)
  for ($i = 0; $i -lt 8; $i++) {
    $g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(170, 205, 225))), 320 + ($i * 95), 355, 54, 60)
    $g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(170, 205, 225))), 320 + ($i * 95), 455, 54, 60)
  }
  $font1 = New-Object System.Drawing.Font "Arial", 42, ([System.Drawing.FontStyle]::Bold)
  $font2 = New-Object System.Drawing.Font "Arial", 28
  $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(35, 45, 67))
  Draw-CenteredText $g "Siege du CNSTN - Sidi Thabet" $font1 $brush ([System.Drawing.RectangleF]::new(0, 80, 1400, 70))
  Draw-CenteredText $g "Photo officielle a fournir par le CNSTN" $font2 $brush ([System.Drawing.RectangleF]::new(0, 160, 1400, 55))
  Save-Jpg $c.Bitmap $Path
  $sky.Dispose(); $building.Dispose(); $edge.Dispose(); $font1.Dispose(); $font2.Dispose(); $brush.Dispose(); $g.Dispose(); $c.Bitmap.Dispose()
}

function Draw-Organigramme {
  param([string]$Path)
  $c = New-Canvas -Width 1240 -Height 1754 -Color ([System.Drawing.Color]::White)
  $g = $c.Graphics
  $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(50, 70, 110)), 3
  $boxBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(239, 244, 250))
  $topBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(29, 78, 137))
  $whiteBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
  $darkBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(30, 41, 59))
  $fontTitle = New-Object System.Drawing.Font "Arial", 36, ([System.Drawing.FontStyle]::Bold)
  $font = New-Object System.Drawing.Font "Arial", 23, ([System.Drawing.FontStyle]::Bold)
  Draw-CenteredText $g "Organigramme CNSTN" $fontTitle $darkBrush ([System.Drawing.RectangleF]::new(0, 70, 1240, 60))
  Draw-CenteredText $g "Version officielle a fournir par le service RH" (New-Object System.Drawing.Font "Arial", 24) $darkBrush ([System.Drawing.RectangleF]::new(0, 135, 1240, 45))
  $boxes = @(
    @{x=370;y=260;w=500;h=90;t="Direction Generale";top=$true},
    @{x=130;y=455;w=300;h=85;t="Qualite"},
    @{x=470;y=455;w=300;h=85;t="DSI"},
    @{x=810;y=455;w=300;h=85;t="Securite"},
    @{x=130;y=650;w=300;h=85;t="Recherche"},
    @{x=470;y=650;w=300;h=85;t="Radioprotection"},
    @{x=810;y=650;w=300;h=85;t="Administration"},
    @{x=300;y=845;w=300;h=85;t="Laboratoires"},
    @{x=640;y=845;w=300;h=85;t="Logistique"}
  )
  foreach ($b in $boxes) {
    $brush = if ($b.top) { $topBrush } else { $boxBrush }
    $textBrush = if ($b.top) { $whiteBrush } else { $darkBrush }
    $rect = [System.Drawing.Rectangle]::new($b.x, $b.y, $b.w, $b.h)
    $g.FillRectangle($brush, $rect)
    $g.DrawRectangle($pen, $rect)
    Draw-CenteredText $g $b.t $font $textBrush ([System.Drawing.RectangleF]::new($b.x, $b.y, $b.w, $b.h))
  }
  $g.DrawLine($pen, 620, 350, 620, 420)
  $g.DrawLine($pen, 280, 420, 960, 420)
  foreach ($x in @(280,620,960)) { $g.DrawLine($pen, $x, 420, $x, 455) }
  $g.DrawLine($pen, 620, 540, 620, 615)
  $g.DrawLine($pen, 280, 615, 960, 615)
  foreach ($x in @(280,620,960)) { $g.DrawLine($pen, $x, 615, $x, 650) }
  Draw-CenteredText $g "Placeholder propre pour compilation LaTeX" (New-Object System.Drawing.Font "Arial", 26) $darkBrush ([System.Drawing.RectangleF]::new(0, 1120, 1240, 55))
  Save-Png $c.Bitmap $Path
  $pen.Dispose(); $boxBrush.Dispose(); $topBrush.Dispose(); $whiteBrush.Dispose(); $darkBrush.Dispose(); $fontTitle.Dispose(); $font.Dispose(); $g.Dispose(); $c.Bitmap.Dispose()
}

function Draw-ArabicResume {
  param([string]$Path)
  $c = New-Canvas -Width 1800 -Height 2400 -Color ([System.Drawing.Color]::White)
  $g = $c.Graphics
  $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(25, 33, 49))
  $accent = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(148, 28, 38))
  $fontTitle = New-Object System.Drawing.Font "Arial", 54, ([System.Drawing.FontStyle]::Bold)
  $fontBody = New-Object System.Drawing.Font "Arial", 36, ([System.Drawing.FontStyle]::Regular)
  $sf = New-Object System.Drawing.StringFormat
  $sf.Alignment = [System.Drawing.StringAlignment]::Far
  $sf.LineAlignment = [System.Drawing.StringAlignment]::Near
  $sf.FormatFlags = $sf.FormatFlags -bor [System.Drawing.StringFormatFlags]::DirectionRightToLeft
  $title = "ملخص"
  $body = @"
يهدف هذا المشروع إلى تصميم وإنجاز منصة إنترانت موجهة للمركز الوطني للعلوم والتكنولوجيات النووية. توفر المنصة فضاء موحدا لإدارة المستخدمين والصلاحيات، وتنظيم الأحداث، وحجز القاعات والتجهيزات، وإدارة الوثائق الإلكترونية، ومتابعة تدخلات الدعم الإعلامي.

اعتمد العمل على معمارية خدمات مصغرة باستعمال Spring Boot و Spring Cloud، مع واجهة Angular ونظام مصادقة مركزي عبر Keycloak. كما تم استعمال Docker لتسهيل النشر والتشغيل المحلي، وقاعدة PostgreSQL لتخزين البيانات المهنية لكل خدمة.

تسمح المنصة بتحسين التعاون الداخلي، وتتبع مسارات الموافقة، وتوثيق العمليات الحساسة، وتوفير لوحات متابعة تساعد المسؤولين على اتخاذ القرار. وقد تم إعداد بيانات عرض واقعية وحسابات تجريبية من أجل اختبار مختلف الأدوار والسيناريوهات الوظيفية.
"@
  $g.FillRectangle($accent, 150, 120, 1500, 10)
  $g.DrawString($title, $fontTitle, $accent, [System.Drawing.RectangleF]::new(150, 190, 1500, 90), $sf)
  $g.DrawString($body, $fontBody, $brush, [System.Drawing.RectangleF]::new(150, 340, 1500, 1700), $sf)
  Save-Png $c.Bitmap $Path
  $sf.Dispose(); $fontTitle.Dispose(); $fontBody.Dispose(); $brush.Dispose(); $accent.Dispose(); $g.Dispose(); $c.Bitmap.Dispose()
}

$logos = Join-Path $OutputRoot "logos"
$photos = Join-Path $OutputRoot "photos"
$resume = Join-Path $OutputRoot "resume"
New-Item -ItemType Directory -Force -Path $logos, $photos, $resume | Out-Null

Draw-Logo -Path (Join-Path $logos "iset-bizerte.png") -Title "ISET" -Subtitle "Bizerte" -Primary ([System.Drawing.Color]::FromArgb(18, 96, 170)) -Secondary ([System.Drawing.Color]::FromArgb(246, 176, 38))
Draw-Logo -Path (Join-Path $logos "cnstn.png") -Title "CNSTN" -Subtitle "Sidi Thabet" -Primary ([System.Drawing.Color]::FromArgb(19, 111, 92)) -Secondary ([System.Drawing.Color]::FromArgb(208, 42, 46))
Draw-Logo -Path (Join-Path $logos "republique.png") -Title "TN" -Subtitle "Republique Tunisienne" -Primary ([System.Drawing.Color]::FromArgb(191, 32, 38)) -Secondary ([System.Drawing.Color]::FromArgb(255, 255, 255))
Draw-PlaceholderPhoto -Path (Join-Path $photos "cnstn-siege.jpg")
Draw-Organigramme -Path (Join-Path $photos "organigramme.png")
Draw-ArabicResume -Path (Join-Path $resume "resume-arabe.png")
