
import React from 'react';
import { Button } from '@/components/ui/button';
import { Play, Check, Loader2 } from 'lucide-react';

interface ActionButtonsProps {
  onRun: () => void;
  onSubmit: () => void;
  isRunning: boolean;
  isSubmitting: boolean;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({
  onRun,
  onSubmit,
  isRunning,
  isSubmitting,
}) => {
  return (
    <div className="flex gap-2">
      <Button 
        variant="secondary" 
        size="sm"
        onClick={onRun}
        disabled={isRunning || isSubmitting}
      >
        {isRunning ? (
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        ) : (
          <Play className="h-4 w-4 mr-1" />
        )}
        Run
      </Button>
      <Button 
        className="bg-astra-red hover:bg-red-600 text-white"
        size="sm"
        onClick={onSubmit}
        disabled={isRunning || isSubmitting}
      >
        {isSubmitting ? (
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        ) : (
          <Check className="h-4 w-4 mr-1" />
        )}
        Submit
      </Button>
    </div>
  );
};

export default ActionButtons;
