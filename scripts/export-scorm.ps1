$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$DistRoot = Join-Path $ProjectRoot "dist"
$BuildRoot = Join-Path $DistRoot "scorm-build"
$ZipPath = Join-Path $DistRoot "curso-demo-scorm.zip"

if (Test-Path $BuildRoot) {
  Remove-Item -LiteralPath $BuildRoot -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $BuildRoot | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $BuildRoot "assets") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $BuildRoot "scorm") | Out-Null

$CoursePath = Join-Path $ProjectRoot "course\course-data.json"
$Course = Get-Content -LiteralPath $CoursePath -Raw | ConvertFrom-Json

function ConvertTo-XmlText($Value) {
  return [System.Security.SecurityElement]::Escape([string]$Value)
}

$ManifestIdentifier = ConvertTo-XmlText $Course.id
$ManifestTitle = ConvertTo-XmlText $Course.title

Copy-Item -LiteralPath (Join-Path $ProjectRoot "src\runtime\index.html") -Destination (Join-Path $BuildRoot "index.html")
Copy-Item -LiteralPath $CoursePath -Destination (Join-Path $BuildRoot "course-data.json")
Copy-Item -LiteralPath (Join-Path $ProjectRoot "src\runtime\main.js") -Destination (Join-Path $BuildRoot "assets\main.js")
Copy-Item -LiteralPath (Join-Path $ProjectRoot "src\runtime\styles.css") -Destination (Join-Path $BuildRoot "assets\styles.css")
Copy-Item -LiteralPath (Join-Path $ProjectRoot "src\runtime\demo-learning.svg") -Destination (Join-Path $BuildRoot "assets\demo-learning.svg")
Copy-Item -LiteralPath (Join-Path $ProjectRoot "src\runtime\scorm-api-wrapper.js") -Destination (Join-Path $BuildRoot "scorm\scorm-api-wrapper.js")

$Manifest = @"
<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="$ManifestIdentifier" version="1.0"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd
                      http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="ORG-1">
    <organization identifier="ORG-1">
      <title>$ManifestTitle</title>
      <item identifier="ITEM-1" identifierref="RES-1">
        <title>$ManifestTitle</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES-1" type="webcontent" adlcp:scormtype="sco" href="index.html">
      <file href="index.html" />
      <file href="course-data.json" />
      <file href="assets/main.js" />
      <file href="assets/styles.css" />
      <file href="assets/demo-learning.svg" />
      <file href="scorm/scorm-api-wrapper.js" />
    </resource>
  </resources>
</manifest>
"@

Set-Content -LiteralPath (Join-Path $BuildRoot "imsmanifest.xml") -Value $Manifest -Encoding UTF8

if (Test-Path $ZipPath) {
  Remove-Item -LiteralPath $ZipPath -Force
}

Compress-Archive -Path (Join-Path $BuildRoot "*") -DestinationPath $ZipPath -Force

Write-Host "SCORM package generated:"
Write-Host $ZipPath
