const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const srcPng = process.argv[2];
if (!srcPng) {
    console.error('Usage: node scripts/convert-icon.js <path-to-png>');
    process.exit(1);
}

const destPng = path.resolve(__dirname, '..', 'agent-os-dashboard', 'client', 'src', 'assets', 'benny.png');
const publicDir = path.resolve(__dirname, '..', 'agent-os-dashboard', 'client', 'public');
const destFavicon = path.join(publicDir, 'favicon.png');
const destIco = path.resolve(__dirname, '..', 'agent-os-dashboard', 'server', 'icon.ico');
const temp32Png = path.resolve(__dirname, '..', 'agent-os-dashboard', 'server', 'temp_32.png');

try {
    // 1a. Copy high-res PNG to client assets
    const assetsDir = path.dirname(destPng);
    if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
    }
    fs.copyFileSync(srcPng, destPng);
    console.log('✓ Copied high-res PNG to client assets:', destPng);

    // 1b. Copy high-res PNG to client public favicon
    if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
    }
    fs.copyFileSync(srcPng, destFavicon);
    console.log('✓ Copied high-res PNG to client public favicon:', destFavicon);

    // 2. Resize PNG to 32x32 using PowerShell on Windows
    console.log('▸ Resizing PNG to 32x32 for system tray...');
    const psCommand = `
        Add-Type -AssemblyName System.Drawing;
        $src = [System.Drawing.Image]::FromFile('${srcPng.replace(/'/g, "''")}');
        $bmp = New-Object System.Drawing.Bitmap(32, 32);
        $g = [System.Drawing.Graphics]::FromImage($bmp);
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic;
        $g.DrawImage($src, 0, 0, 32, 32);
        $bmp.Save('${temp32Png.replace(/'/g, "''")}', [System.Drawing.Imaging.ImageFormat]::Png);
        $g.Dispose();
        $bmp.Dispose();
        $src.Dispose();
    `;
    
    // Run PowerShell
    execSync(`powershell -NoProfile -Command "${psCommand.replace(/\n/g, ' ')}"`);
    console.log('✓ Resized 32x32 PNG generated at:', temp32Png);

    // 3. Convert 32x32 PNG to ICO wrapper
    const png32Buffer = fs.readFileSync(temp32Png);
    const pngSize = png32Buffer.length;

    // Create 22-byte ICO header for a single 32x32 image
    const icoHeader = Buffer.alloc(22);
    icoHeader.writeUInt16LE(0, 0);     // Reserved
    icoHeader.writeUInt16LE(1, 2);     // Image type (1 = ICO)
    icoHeader.writeUInt16LE(1, 4);     // Number of images (1)

    // Directory entry
    icoHeader.writeUInt8(32, 6);        // Width (32)
    icoHeader.writeUInt8(32, 7);        // Height (32)
    icoHeader.writeUInt8(0, 8);        // Color palette (0)
    icoHeader.writeUInt8(0, 9);        // Reserved (0)
    icoHeader.writeUInt16LE(1, 10);    // Color planes (1)
    icoHeader.writeUInt16LE(32, 12);   // Bits per pixel (32)
    icoHeader.writeUInt32LE(pngSize, 14); // Size of PNG data
    icoHeader.writeUInt32LE(22, 18);   // Offset to PNG data (22 bytes)

    const icoBuffer = Buffer.concat([icoHeader, png32Buffer]);
    fs.writeFileSync(destIco, icoBuffer);
    console.log('✓ Created 32x32 ICO at:', destIco);

    // Clean up temp file
    if (fs.existsSync(temp32Png)) {
        fs.unlinkSync(temp32Png);
    }
} catch (err) {
    console.error('✗ Failed to copy/convert icon:', err.message);
    if (fs.existsSync(temp32Png)) {
        fs.unlinkSync(temp32Png);
    }
    process.exit(1);
}
