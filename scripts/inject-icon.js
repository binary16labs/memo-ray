const fs = require('fs');
const path = require('path');
const resedit = require('resedit');

const exePath = path.resolve(__dirname, '..', 'dist', 'memo-ray-win.exe');
const icoPath = path.resolve(__dirname, '..', 'agent-os-dashboard', 'server', 'icon.ico');

if (!fs.existsSync(exePath)) {
    console.warn('[Icon Injector] Warning: Compiled executable not found at:', exePath);
    console.warn('[Icon Injector] Skipping icon injection (normal if not building Windows target).');
    process.exit(0);
}

try {
    console.log('▸ Loading executable resources...');
    const data = fs.readFileSync(exePath);
    
    // Parse NT Executable
    const exe = resedit.NtExecutable.from(data);
    const res = resedit.NtExecutableResource.from(exe);
    
    // Parse ICO file
    console.log('▸ Loading custom icon...');
    const iconFile = resedit.Data.IconFile.from(fs.readFileSync(icoPath));
    
    // Replace icon resources
    console.log('▸ Injecting icon into resources...');
    resedit.Resource.IconGroupEntry.replaceIconsForResource(
        res.entries,
        1,
        1033,
        iconFile.icons.map(icon => icon.data)
    );
    
    // Output resources back to the binary
    res.outputResource(exe);
    const updatedData = exe.generate();
    
    fs.writeFileSync(exePath, Buffer.from(updatedData));
    console.log('✓ Successfully injected custom icon into Windows executable!');
} catch (err) {
    console.error('✗ Failed to inject icon:', err.message);
    process.exit(1);
}
