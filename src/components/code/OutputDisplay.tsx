
import React from 'react';
import { Terminal } from 'lucide-react';

interface OutputDisplayProps {
  output: string;
}

const OutputDisplay: React.FC<OutputDisplayProps> = ({ output }) => {
  return (
    <div className="h-full bg-gray-900 text-gray-100 p-4 rounded-md font-mono text-sm overflow-auto">
      <div className="flex items-center mb-2">
        <Terminal className="h-4 w-4 mr-2" />
        <span>Output</span>
      </div>
      <pre className="whitespace-pre-wrap">{output || 'Run your code to see output here'}</pre>
    </div>
  );
};

export default OutputDisplay;
