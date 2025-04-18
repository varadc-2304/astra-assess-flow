
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { FileCode, HelpCircle } from 'lucide-react';
import { Question } from '@/types/database';

interface QuestionViewDialogProps {
  question: Question | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const QuestionViewDialog: React.FC<QuestionViewDialogProps> = ({
  question,
  open,
  onOpenChange,
}) => {
  if (!question) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={
                question.type === 'mcq'
                  ? 'bg-purple-100 text-purple-800 border-purple-200'
                  : 'bg-blue-100 text-blue-800 border-blue-200'
              }
            >
              {question.type === 'mcq' ? (
                <HelpCircle className="h-3 w-3 mr-1" />
              ) : (
                <FileCode className="h-3 w-3 mr-1" />
              )}
              {question.type.toUpperCase()}
            </Badge>
            <span>{question.title}</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Description */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Description</h3>
            <p className="text-gray-900">{question.description}</p>
          </div>
          
          {/* Marks */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Marks</h3>
            <p className="text-gray-900">{question.marks} points</p>
          </div>
          
          {/* Image if present */}
          {question.image_url && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Image</h3>
              <img 
                src={question.image_url} 
                alt="Question illustration"
                className="rounded-md border border-gray-200 max-h-[200px] object-contain"
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QuestionViewDialog;
