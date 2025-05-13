
import React from 'react';

interface LogsDisplayProps {
  logs: string[];
}

const LogsDisplay: React.FC<LogsDisplayProps> = ({ logs }) => {
  return (
    <div>
      <h4 className="text-sm font-medium mb-1">Debug Log</h4>
      <div className="bg-black/70 text-green-400 p-2 rounded h-32 overflow-y-auto font-mono text-xs">
        {logs.length === 0 ? (
          <p>No logs yet</p>
        ) : (
          logs.map((log, i) => <div key={i}>{log}</div>)
        )}
      </div>
    </div>
  );
};

export default LogsDisplay;
