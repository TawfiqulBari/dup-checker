import React, { useEffect, useRef } from 'react';

const InstructionsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }} className="p-0 rounded-lg shadow-xl max-w-lg w-full bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 backdrop:bg-black/60">
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Paths copied</h2>
      <p className="mb-4">Paste the list into a text editor and review each file before removing it with your file manager. Use the Recycle Bin or Trash so you can undo a mistake.</p>
      <p className="mb-4">Paths include the selected folder name and are relative to its parent folder. Your browser does not reveal the full location on your computer.</p>
      <p className="mb-6">Visual matches are suggestions, not proof of identical content. KEEP marks your chosen file, or the largest file by default.</p>
      <button autoFocus onClick={onClose} className="px-4 py-2 bg-indigo-600 text-white rounded-md">Got it</button>
    </div>
  </dialog>;
};
export default InstructionsModal;
