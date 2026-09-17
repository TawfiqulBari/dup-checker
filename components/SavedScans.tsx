import React, { useEffect, useState } from 'react';
import { SessionSummary } from '../services/sessionTypes';

export default function SavedScans({ onOpen, onUpdate }: { onOpen: (id: string) => void; onUpdate: (id: string) => void }) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [error, setError] = useState('');
  useEffect(() => { window.desktopAPI?.listSessions().then(setSessions).catch(error => setError(String(error))); }, []);
  if (!window.desktopAPI || (!sessions.length && !error)) return null;
  return <section className="max-w-4xl mx-auto mt-8"><h2 className="text-xl font-bold mb-3">Saved scans</h2>
    <p className="text-sm text-slate-500 mb-4">Resume unfinished scans or reopen your review. Update changes checks the folders and reuses unchanged file hashes.</p>
    {error && <p role="alert">{error}</p>}
    <div className="space-y-3">{sessions.map(session => <div key={session.id} className="p-4 rounded-lg bg-white dark:bg-slate-800 shadow-sm">
      <p className="font-semibold break-all">{session.label}</p>
      <p className="text-sm text-slate-500 my-2">{new Date(session.updated).toLocaleString()} · {session.count} files · {session.status === 'done' ? `${session.reviewed}/${session.groups} sets reviewed` : `Paused: ${session.progress.status} (${session.progress.processed}/${session.progress.total})`}</p>
      <div className="flex flex-wrap gap-3">
        {session.status === 'done' && <button onClick={() => onOpen(session.id)} className="px-4 py-2 bg-indigo-600 text-white rounded">Open results</button>}
        <button onClick={() => onUpdate(session.id)} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded">{session.status === 'done' ? 'Update changes' : 'Continue scan'}</button>
        <button onClick={async () => { try { await window.desktopAPI!.forgetSession(session.id); setSessions(current => current.filter(item => item.id !== session.id)); } catch (error) { setError(String(error)); } }} className="px-4 py-2 text-slate-500">Forget saved results</button>
      </div>
    </div>)}</div>
  </section>;
}
