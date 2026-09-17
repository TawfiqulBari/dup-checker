const { DatabaseSync } = require('node:sqlite');
const { randomUUID } = require('node:crypto');

const ALGORITHM = 'sha256-dhash9x8-video10-v1';
const fingerprint = entry => JSON.stringify([entry.size, entry.mtime, entry.ctime, entry.ino]);

function applyDelta(session, manifest) {
  const algorithmChanged = session.algorithm !== ALGORITHM;
  const wasComplete = session.status === 'done' && !(session.warnings || []).length && !algorithmChanged;
  const previous = new Map(session.manifest.map(file => [file.id, file]));
  const unchanged = new Set();
  const delta = { unchanged: 0, added: 0, changed: 0, removed: 0 };
  for (const file of manifest) {
    const old = previous.get(file.id);
    if (!old) delta.added++;
    else if (fingerprint(old.entry) === fingerprint(file.entry)) { delta.unchanged++; unchanged.add(file.id); }
    else delta.changed++;
    previous.delete(file.id);
  }
  delta.removed = previous.size;
  if (algorithmChanged) unchanged.clear();
  const unchangedGroup = key => key.split('\0').every(id => unchanged.has(id));
  session.review.keepers = Object.fromEntries(Object.entries(session.review.keepers || {}).filter(([key]) => unchangedGroup(key)));
  session.review.reviewed = (session.review.reviewed || []).filter(unchangedGroup);
  session.selectedFiles = session.selectedFiles.filter(id => unchanged.has(id));
  const hasChanges = delta.added + delta.changed + delta.removed > 0 || algorithmChanged;
  if (hasChanges) session.review.scrollY = 0;
  session.manifest = manifest;
  session.delta = delta;
  session.status = wasComplete && !hasChanges ? 'done' : 'scanning';
  session.algorithm = ALGORITHM;
  if (session.status === 'done') session.progress = { status: 'Done', processed: manifest.length, total: manifest.length, cachedFiles: manifest.length };
  return session;
}

class ScanStore {
  constructor(filename) {
    this.db = new DatabaseSync(filename);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS hashes (path TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, algorithm TEXT NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, updated INTEGER NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS manifests (id TEXT PRIMARY KEY, data TEXT NOT NULL);`);
  }
  cached(entry) {
    const row = this.db.prepare('SELECT * FROM hashes WHERE path = ?').get(entry.absolute);
    return row && row.algorithm === ALGORITHM && row.fingerprint === fingerprint(entry) ? JSON.parse(row.data) : {};
  }
  cache(entry, data) {
    const merged = { ...this.cached(entry), ...data };
    this.db.prepare('INSERT OR REPLACE INTO hashes VALUES (?, ?, ?, ?)').run(entry.absolute, fingerprint(entry), ALGORITHM, JSON.stringify(merged));
  }
  create(manifest, roots) {
    const session = { id: randomUUID(), label: roots.map(root => root.absolute).join(' ↔ '), roots, manifest, status: 'scanning', groups: [], selectedFiles: [], review: {}, warnings: [], progress: { status: 'Starting scan', processed: 0, total: manifest.length }, algorithm: ALGORITHM };
    return this.save(session);
  }
  save(session) {
    session.updated = Date.now();
    const { manifest, ...state } = session;
    state.count = manifest.length;
    this.db.exec('BEGIN');
    try {
      this.db.prepare('INSERT OR REPLACE INTO manifests VALUES (?, ?)').run(session.id, JSON.stringify(manifest));
      this.db.prepare('INSERT OR REPLACE INTO sessions VALUES (?, ?, ?)').run(session.id, session.updated, JSON.stringify(state));
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
    return session;
  }
  get(id) {
    const row = this.db.prepare('SELECT data FROM sessions WHERE id = ?').get(id);
    if (!row) throw new Error('Saved scan not found.');
    const session = JSON.parse(row.data);
    session.manifest ??= JSON.parse(this.db.prepare('SELECT data FROM manifests WHERE id = ?').get(id).data);
    return session;
  }
  patch(id, patch) {
    const row = this.db.prepare('SELECT data FROM sessions WHERE id = ?').get(id);
    if (!row) throw new Error('Saved scan not found.');
    const session = JSON.parse(row.data);
    for (const key of ['status', 'groups', 'selectedFiles', 'review', 'warnings', 'progress']) if (patch[key] !== undefined) session[key] = patch[key];
    session.updated = Date.now();
    this.db.prepare('UPDATE sessions SET updated = ?, data = ? WHERE id = ?').run(session.updated, JSON.stringify(session), id);
  }
  list() {
    return this.db.prepare('SELECT data FROM sessions ORDER BY updated DESC').all().map(row => {
      const { id, label, updated, status, count, manifest, progress, groups, review } = JSON.parse(row.data);
      const validGroups = new Set(groups.map(group => [...group].sort().join('\0')));
      return { id, label, updated, status: status === 'scanning' ? 'paused' : status, count: count ?? manifest.length, progress, groups: groups.length, reviewed: (review.reviewed || []).filter(key => validGroups.has(key)).length };
    });
  }
  forget(id) {
    this.db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
    this.db.prepare('DELETE FROM manifests WHERE id = ?').run(id);
  }
  close() { this.db.close(); }
}
module.exports = { ScanStore, fingerprint, ALGORITHM, applyDelta };
