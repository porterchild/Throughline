#!/bin/bash
# Create simple placeholder icons using ImageMagick

# Check if imagemagick is installed
if ! command -v convert &> /dev/null; then
    echo "ImageMagick not found, installing..."
    sudo apt-get update && sudo apt-get install -y imagemagick
fi

# Create 128x128 icon
convert -size 128x128 xc:'#4285f4' \
  -gravity center \
  -pointsize 60 -fill white -annotate +0+0 '📚' \
  icon128.png

# Create 48x48 icon
convert icon128.png -resize 48x48 icon48.png

# Create 16x16 icon
convert icon128.png -resize 16x16 icon16.png

echo "Icons created successfully"
