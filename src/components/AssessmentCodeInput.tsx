
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAssessmentAccess } from '@/hooks/useAssessmentAccess';

const AssessmentCodeInput = () => {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { canAccessAssessment } = useAssessmentAccess();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!code.trim()) {
      toast({
        title: "Invalid Code",
        description: "Please enter an assessment code",
        variant: "destructive",
        duration: 1000,
      });
      return;
    }

    // Check if user has access to this assessment
    if (!canAccessAssessment(code.trim().toUpperCase())) {
      toast({
        title: "Access Denied",
        description: "You don't have access to this assessment. Please contact your instructor.",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    setIsLoading(true);

    try {
      // Validate assessment code exists and is active
      const { data: assessment, error } = await supabase
        .from('assessments')
        .select('*')
        .eq('code', code.trim().toUpperCase())
        .single();

      if (error || !assessment) {
        toast({
          title: "Invalid Code",
          description: "Assessment not found. Please check the code and try again.",
          variant: "destructive",
          duration: 1000,
        });
        return;
      }

      // Check if assessment is active
      const now = new Date();
      const startTime = new Date(assessment.start_time);
      const endTime = assessment.end_time ? new Date(assessment.end_time) : null;

      if (now < startTime) {
        toast({
          title: "Assessment Not Started",
          description: "This assessment hasn't started yet.",
          variant: "destructive",
          duration: 1000,
        });
        return;
      }

      if (endTime && now > endTime) {
        toast({
          title: "Assessment Ended",
          description: "This assessment has already ended.",
          variant: "destructive",
          duration: 1000,
        });
        return;
      }

      // Store assessment code and navigate
      localStorage.setItem('assessmentCode', code.trim().toUpperCase());
      
      toast({
        title: "Code Accepted",
        description: "Redirecting to instructions...",
        duration: 1000,
      });

      navigate('/instructions');
    } catch (error) {
      console.error('Error validating assessment code:', error);
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
        duration: 1000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2">
          <Lock className="h-5 w-5" />
          Enter Assessment Code
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="text"
            placeholder="Enter assessment code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="text-center text-lg font-mono"
            disabled={isLoading}
          />
          <Button 
            type="submit" 
            className="w-full" 
            disabled={isLoading || !code.trim()}
          >
            {isLoading ? (
              "Validating..."
            ) : (
              <>
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default AssessmentCodeInput;
