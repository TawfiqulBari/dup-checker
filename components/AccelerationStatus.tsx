import React, { useEffect, useSyncExternalStore } from 'react';
import { getAccelerationStatus, initializeAcceleration, subscribeAcceleration } from '../services/gpu';

export default function AccelerationStatus() {
  const status = useSyncExternalStore(subscribeAcceleration, getAccelerationStatus);
  useEffect(() => { void initializeAcceleration(); }, []);
  if (!window.desktopAPI) return null;
  return <div className="mt-2 text-sm" role="status"><span className="font-semibold">{status.mode === 'gpu' ? `GPU ready: ${status.device}` : status.mode === 'cpu' ? 'CPU mode' : 'Detecting GPU…'}</span><span className="block text-slate-500 dark:text-slate-400">{status.detail}{status.batches > 0 && ` ${status.batches} GPU batches completed.`}</span></div>;
}
