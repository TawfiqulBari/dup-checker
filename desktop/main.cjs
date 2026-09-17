const { app, BrowserWindow, ipcMain, dialog, protocol, shell } = require('electron');
const fs = require('node:fs/promises');
const { createReadStream } = require('node:fs');
const { Readable } = require('node:stream');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const { validateRegisteredFile } = require('./fileSafety.cjs');

protocol.registerSchemesAsPrivileged([{ scheme: 'dupmedia', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } }]);
const roots = new Map();
const files = new Map();
let permittedRemovals = new Set();
let window;
const smoke = process.argv.includes('--smoke-test');
let smokeFolder;
const mime = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.bmp': 'image/bmp', '.avif': 'image/avif', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.mkv': 'video/x-matroska', '.avi': 'video/x-msvideo' };

async function validate(id) {
  return validateRegisteredFile(files, id);
}
function handle(name, callback) {
  ipcMain.handle(name, (event, ...args) => {
    if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error('Untrusted request');
    return callback(...args);
  });
}

app.whenReady().then(async () => {
  if (smoke) {
    smokeFolder = await fs.mkdtemp(path.join(require('node:os').tmpdir(), 'dup-checker-smoke-'));
    const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRXsAAAAASUVORK5CYII=', 'base64');
    await fs.writeFile(path.join(smokeFolder, 'original.png'), pixel);
    await fs.writeFile(path.join(smokeFolder, 'copy.png'), pixel);
  }
  handle('gpu-info', async () => {
    const info = await app.getGPUInfo('complete');
    return info.gpuDevice || [];
  });
  handle('reset-scan', () => { roots.clear(); files.clear(); permittedRemovals.clear(); });
  handle('choose-folder', async () => {
    const result = smoke ? { canceled: false, filePaths: [smokeFolder] } : await dialog.showOpenDialog(window, { properties: ['openDirectory'], title: 'Select a folder to scan' });
    if (result.canceled) return null;
    const absolute = await fs.realpath(result.filePaths[0]);
    const id = randomUUID();
    roots.set(id, absolute);
    return { id, name: path.basename(absolute), absolute };
  });
  handle('list-folder', async id => {
    const root = roots.get(id);
    if (!root) throw new Error('Select a folder first.');
    const result = [];
    const walk = async directory => {
      for (const child of await fs.readdir(directory, { withFileTypes: true })) {
        if (child.isSymbolicLink()) continue;
        const absolute = path.join(directory, child.name);
        if (child.isDirectory()) { await walk(absolute); continue; }
        const type = mime[path.extname(child.name).toLowerCase()];
        if (!child.isFile() || !type) continue;
        const stat = await fs.lstat(absolute);
        const token = randomUUID();
        const entry = { id: token, absolute, name: child.name, path: path.relative(root, absolute).split(path.sep).join('/'), size: stat.size, mtime: stat.mtimeMs, ino: stat.ino, type };
        files.set(token, entry);
        result.push(entry);
      }
    };
    await walk(root);
    return result;
  });
  handle('validate-file', async id => { await validate(id); });
  handle('hash-file', async id => {
    const entry = await validate(id);
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(entry.absolute)) hash.update(chunk);
    await validate(id);
    return hash.digest('hex');
  });
  handle('confirm-removal', async ids => {
    if (!Array.isArray(ids) || !ids.length || ids.some(id => !files.has(id))) throw new Error('Invalid selection');
    permittedRemovals.clear();
    const result = await dialog.showMessageBox(window, { type: 'warning', buttons: ['Cancel', 'Move to Recycle Bin'], defaultId: 0, cancelId: 0, title: 'Review selected copies', message: `Move ${ids.length} selected file(s) to the Recycle Bin?`, detail: 'Your KEEP files will remain. Review visual matches before continuing. If the Recycle Bin is unavailable, removal will fail; files will not be permanently deleted.' });
    if (result.response !== 1) return false;
    permittedRemovals = new Set(ids);
    return true;
  });
  handle('trash-file', async id => {
    if (!permittedRemovals.delete(id)) throw new Error('Removal was not confirmed.');
    const entry = await validate(id);
    await shell.trashItem(entry.absolute);
    files.delete(id);
  });
  protocol.handle('dupmedia', async request => {
    try {
      const entry = await validate(new URL(request.url).hostname);
      let start = 0, end = entry.size - 1;
      const range = request.headers.get('range');
      if (range) {
        const match = /^bytes=(\d+)-(\d*)$/.exec(range);
        if (!match) return new Response(null, { status: 416 });
        start = Number(match[1]);
        if (match[2]) end = Math.min(end, Number(match[2]));
        if (start > end) return new Response(null, { status: 416 });
      }
      const headers = { 'Content-Type': entry.type, 'Accept-Ranges': 'bytes', 'Content-Length': String(Math.max(0, end - start + 1)), 'Access-Control-Allow-Origin': '*' };
      if (range) headers['Content-Range'] = `bytes ${start}-${end}/${entry.size}`;
      const body = entry.size ? Readable.toWeb(createReadStream(entry.absolute, { start, end })) : null;
      return new Response(body, { status: range ? 206 : 200, headers });
    } catch { return new Response('File unavailable', { status: 404 }); }
  });
  window = new BrowserWindow({ width: 1280, height: 850, minWidth: 760, minHeight: 600, show: !smoke, title: 'Dup-Checker', autoHideMenuBar: true, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, additionalArguments: smoke ? ['--dup-smoke'] : [] } });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  if (smoke) {
    handle('smoke-result', async result => {
      await fs.writeFile(path.join(process.cwd(), 'desktop-smoke-result.json'), JSON.stringify(result, null, 2));
      // Only clean up the two files created by this smoke test.
      await fs.unlink(path.join(smokeFolder, 'original.png'));
      await fs.unlink(path.join(smokeFolder, 'copy.png'));
      await fs.rmdir(smokeFolder);
      app.exit(result.ok ? 0 : 1);
    });
    setTimeout(() => app.exit(2), 60000).unref();
  }
  await window.loadFile(path.join(__dirname, '../dist/index.html'));
});
app.on('window-all-closed', () => app.quit());
