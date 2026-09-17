const fs = require('node:fs/promises');

async function validateRegisteredFile(files, id) {
  const entry = files.get(id);
  if (!entry) throw new Error('File is not part of a selected folder. Scan again.');
  const stat = await fs.lstat(entry.absolute);
  if (!stat.isFile() || stat.isSymbolicLink() || await fs.realpath(entry.absolute) !== entry.absolute || stat.size !== entry.size || stat.mtimeMs !== entry.mtime || stat.ino !== entry.ino) {
    throw new Error('File changed or was replaced since scanning. Scan again.');
  }
  return entry;
}
module.exports = { validateRegisteredFile };
