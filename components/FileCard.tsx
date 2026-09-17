
import React, { useState } from 'react';
import { FileWithHandle } from '../types';

interface FileCardProps {
  file: FileWithHandle;
  isOriginal: boolean;
  isSelected: boolean;
  onToggleSelection: (fileId: string) => void;
  onKeep: () => void;
}

const FileCard: React.FC<FileCardProps> = ({ file, isOriginal, isSelected, onToggleSelection, onKeep }) => {
  const [dimensions, setDimensions] = useState(file.metadata.dimensions);
  const [duration, setDuration] = useState(file.metadata.duration);
  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };
  
  const formatDuration = (seconds: number) => {
    if (isNaN(seconds)) return '00:00';
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`relative border-2 rounded-lg overflow-hidden transition-all duration-200 ${isSelected ? 'border-red-500 shadow-xl scale-105' : 'border-transparent'}`}>
       <div className="absolute top-1 right-1 z-10">
        {!isOriginal && (
          <input
            type="checkbox"
            aria-label={`Select ${file.path}`}
            checked={isSelected}
            onChange={() => onToggleSelection(file.id)}
            className="h-6 w-6 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer"
          />
        )}
      </div>

       {isOriginal && (
         <div className="absolute top-1 left-1 z-10 bg-green-600 text-white text-xs font-bold px-2 py-1 rounded">
           KEEP
         </div>
       )}

      <div className="aspect-square w-full bg-slate-200 dark:bg-slate-700">
        {file.file.type.startsWith('image/') ? (
          <img src={file.thumbnail} alt={file.file.name} loading="lazy" onLoad={event => setDimensions({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} className="object-contain w-full h-full" />
        ) : (
          <video src={file.thumbnail} preload="metadata" onLoadedMetadata={event => setDuration(event.currentTarget.duration)} controls className="object-contain w-full h-full" muted />
        )}
      </div>
      
      <div className="p-2 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm text-xs">
        <p className="font-bold text-slate-800 dark:text-slate-100 truncate" title={file.file.name}>{file.file.name}</p>
        <p className="truncate text-slate-500" title={file.path}>{file.path}</p>
        {file.folderSide && <p className="mt-1 font-semibold text-indigo-600 dark:text-indigo-400">Folder {file.folderSide === 'first' ? '1' : '2'}</p>}
        {!isOriginal && <button onClick={onKeep} className="mt-2 text-indigo-600 dark:text-indigo-400 font-semibold">Keep this file</button>}
        <div className="flex justify-between text-slate-600 dark:text-slate-300 mt-1">
          <span>{formatBytes(file.metadata.size)}</span>
          {dimensions && <span>{`${dimensions.width}x${dimensions.height}`}</span>}
          {duration !== undefined && Number.isFinite(duration) && <span>{formatDuration(duration)}</span>}
        </div>
      </div>
    </div>
  );
};

export default FileCard;
