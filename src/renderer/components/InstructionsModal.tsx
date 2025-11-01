import React, { useState } from 'react';

interface InstructionsModalProps {
  onClose: () => void;
}

const InstructionsModal: React.FC<InstructionsModalProps> = ({ onClose }) => {
  const [copiedCommand, setCopiedCommand] = useState<'powershell' | 'bash' | null>(null);

  const powershellCommand = `Get-Clipboard | ForEach-Object { Remove-Item -LiteralPath $_ -Force -Verbose }`;
  const bashCommand = `pbpaste | xargs -I {} rm -v "{}"`;

  const handleCopyCommand = (command: string, type: 'powershell' | 'bash') => {
    navigator.clipboard.writeText(command).then(() => {
      setCopiedCommand(type);
      setTimeout(() => setCopiedCommand(null), 2000); // Reset after 2 seconds
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
      <div className="relative bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl text-slate-800 dark:text-slate-200" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div className="text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="mt-2 text-2xl font-bold">Paths Copied to Clipboard!</h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Now, follow these steps to delete the files using your computer's terminal.
            </p>
          </div>
          
          <div className="mt-6 text-left space-y-6">
            <div className="bg-amber-100 dark:bg-amber-900/30 border-l-4 border-amber-500 text-amber-800 dark:text-amber-200 p-4 rounded-md">
              <p className="font-bold">Important First Step</p>
              <p className="text-sm">Before running any command, you MUST open your terminal and navigate to the folder you originally selected for the scan. For example:</p>
              <code className="block bg-slate-200 dark:bg-slate-700 p-2 rounded-md mt-2 text-sm font-mono">cd "path/to/your/scanned/folder"</code>
            </div>

            <div>
              <h4 className="text-lg font-semibold mb-2">For Windows (PowerShell)</h4>
              <div className="relative bg-slate-100 dark:bg-slate-900 rounded-md p-3">
                <code className="font-mono text-sm text-indigo-600 dark:text-indigo-400">{powershellCommand}</code>
                <button
                  onClick={() => handleCopyCommand(powershellCommand, 'powershell')}
                  className="absolute top-2 right-2 p-1.5 bg-slate-200 dark:bg-slate-700 rounded-md hover:bg-slate-300 dark:hover:bg-slate-600"
                  aria-label="Copy PowerShell command"
                >
                  {copiedCommand === 'powershell' ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  )}
                </button>
              </div>
            </div>

            <div>
              <h4 className="text-lg font-semibold mb-2">For macOS / Linux (Terminal)</h4>
              <div className="relative bg-slate-100 dark:bg-slate-900 rounded-md p-3">
                <code className="font-mono text-sm text-indigo-600 dark:text-indigo-400">{bashCommand}</code>
                <button
                  onClick={() => handleCopyCommand(bashCommand, 'bash')}
                  className="absolute top-2 right-2 p-1.5 bg-slate-200 dark:bg-slate-700 rounded-md hover:bg-slate-300 dark:hover:bg-slate-600"
                  aria-label="Copy Terminal command"
                >
                  {copiedCommand === 'bash' ? (
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  ) : (
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 text-right rounded-b-lg">
          <button
            onClick={onClose}
            type="button"
            className="inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:text-sm"
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
};

export default InstructionsModal;