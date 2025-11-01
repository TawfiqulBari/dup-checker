# Building Windows Installer for Dup-Checker

This guide explains how to create Windows installers (.exe) for the Dup-Checker desktop application.

## Quick Start (Windows Only)

### Method 1: Using the Build Script (Easiest)

1. **Double-click** `build-windows.bat`
2. **Wait** for the build to complete (2-5 minutes)
3. **Find** your installers in the `release` folder

### Method 2: Manual Build

```cmd
# Install dependencies (first time only)
npm install

# Build Windows installer
npm run build:electron:win
```

## Prerequisites

### Required Software

1. **Node.js** (v18 or higher)
   - Download: https://nodejs.org/
   - During installation, check "Add to PATH"
   - Verify: `node --version` in Command Prompt

2. **Git** (for cloning the repository)
   - Download: https://git-scm.com/download/win
   - Or use GitHub Desktop: https://desktop.github.com/

3. **Python** (v3.x) - Required by electron-builder
   - Download: https://www.python.org/downloads/
   - **Important**: Check "Add Python to PATH" during installation

4. **Windows Build Tools** (optional, only if build fails)
   ```powershell
   # Run PowerShell as Administrator
   npm install --global windows-build-tools
   ```

## Step-by-Step Build Instructions

### 1. Clone the Repository

```powershell
# Navigate to your preferred folder
cd C:\Users\YourUsername\Documents

# Clone the repo
git clone https://github.com/TawfiqulBari/dup-checker.git

# Enter the directory
cd dup-checker

# Switch to the Electron branch
git checkout feature/electron-desktop
```

### 2. Install Dependencies

```powershell
npm install
```

This downloads ~380 packages (takes 2-3 minutes).

### 3. Build the Windows Installer

**Option A: Using the script (recommended)**

```cmd
build-windows.bat
```

**Option B: Using npm directly**

```powershell
npm run build:electron:win
```

### 4. Locate Your Installers

After successful build, you'll find:

```
release/
├── Dup-Checker Setup 0.1.0.exe    (NSIS Installer - ~95MB)
└── Dup-Checker 0.1.0.exe          (Portable - ~95MB)
```

## Output Files Explained

### 1. NSIS Installer (`Dup-Checker Setup 0.1.0.exe`)

**Features:**
- ✅ Professional Windows installer
- ✅ Installs to Program Files
- ✅ Creates Start Menu shortcut
- ✅ Creates Desktop shortcut (optional)
- ✅ Includes uninstaller
- ✅ Automatic updates support (future)

**Best for:**
- Distribution to users
- Professional deployments
- Public releases

**How to use:**
1. Double-click to run
2. Follow installation wizard
3. App appears in Start Menu

### 2. Portable Version (`Dup-Checker 0.1.0.exe`)

**Features:**
- ✅ No installation required
- ✅ Run from anywhere
- ✅ USB drive compatible
- ✅ No registry changes
- ✅ Easy cleanup (just delete)

**Best for:**
- Testing
- USB drives
- Portable usage
- No admin rights

**How to use:**
1. Copy to desired location
2. Double-click to run
3. Done!

## Build Configuration

The build process creates Windows executables with these settings:

- **Target OS**: Windows 7+ (32-bit & 64-bit)
- **Architecture**: x64 (64-bit)
- **Installer Type**: NSIS (modern Windows installer)
- **App ID**: `com.dupchecker.app`
- **Output Folder**: `release/`

## Customization

Edit `package.json` to customize the build:

```json
{
  "build": {
    "appId": "com.dupchecker.app",
    "productName": "Dup-Checker",
    "win": {
      "target": ["nsis", "portable"],
      "icon": "build/icon.ico"  // Add custom icon
    }
  }
}
```

### Adding a Custom Icon

1. Create a 256x256 icon: `build/icon.ico`
2. Update `package.json` (see above)
3. Rebuild

## Troubleshooting

### Build Fails with "Python not found"

```powershell
# Install Python and add to PATH
# Download from: https://www.python.org/downloads/
```

### Build Fails with "MSBuild not found"

```powershell
# Install Visual Studio Build Tools
# Or run as Administrator:
npm install --global windows-build-tools
```

### "EPERM: operation not permitted" Error

```powershell
# Close any running Dup-Checker instances
# Delete the release folder:
rmdir /s /q release
# Try building again
```

### Antivirus Blocking the Build

- Add your project folder to antivirus exceptions
- Temporarily disable antivirus during build
- Windows Defender may flag unsigned executables

### "Out of Memory" Error

```powershell
# Increase Node.js memory:
set NODE_OPTIONS=--max_old_space_size=4096
npm run build:electron:win
```

## Code Signing (Optional)

To remove "Unknown Publisher" warnings:

1. Obtain a code signing certificate
2. Install the certificate
3. Update `package.json`:

```json
{
  "build": {
    "win": {
      "certificateFile": "path/to/cert.pfx",
      "certificatePassword": "your-password"
    }
  }
}
```

## Distribution Checklist

Before distributing your installers:

- [ ] Test the NSIS installer on a clean Windows machine
- [ ] Test the portable version
- [ ] Verify all features work
- [ ] Test file deletion functionality
- [ ] Check app icon displays correctly
- [ ] Verify uninstaller works
- [ ] Scan with antivirus
- [ ] Create release notes
- [ ] Upload to GitHub Releases

## GitHub Actions (Automated Builds)

To automate Windows builds on every commit:

Create `.github/workflows/build.yml`:

```yaml
name: Build Windows Installer

on: [push]

jobs:
  build:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run build:electron:win
      - uses: actions/upload-artifact@v3
        with:
          name: windows-installer
          path: release/*.exe
```

## Build Times

Expected build times:

- **First build**: 3-5 minutes (downloads Electron)
- **Subsequent builds**: 1-2 minutes (cached)
- **Clean build**: 2-3 minutes

## File Sizes

Expected file sizes:

- **NSIS Installer**: ~95-100 MB
- **Portable**: ~95-100 MB
- **Unpacked**: ~150-180 MB

## Support

Having issues? Check:

1. [Electron Builder Docs](https://www.electron.build/)
2. [Node.js Installation Guide](https://nodejs.org/)
3. [GitHub Issues](https://github.com/TawfiqulBari/dup-checker/issues)

## Next Steps

After building:

1. **Test** on multiple Windows versions (7, 10, 11)
2. **Sign** your code (recommended for distribution)
3. **Create** GitHub Release
4. **Upload** installers for users to download
5. **Document** installation instructions

---

Built with ❤️ using Electron, React, and TypeScript
