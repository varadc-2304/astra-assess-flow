
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useAssessment } from '@/contexts/AssessmentContext';
import { supabase } from '@/integrations/supabase/client';

const AssessmentCodeInput = () => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { loadAssessment } = useAssessment();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Check if the assessment exists and get its details
      const { data: assessmentData, error: assessmentError } = await supabase
        .from('assessments')
        .select('*')
        .eq('code', code.trim().toUpperCase())
        .single();

      if (assessmentError || !assessmentData) {
        toast({
          title: "Invalid Code",
          description: "Please check the assessment code and try again.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Check if user has already completed this assessment
      const { data: results, error: resultsError } = await supabase
        .from('results')
        .select('*')
        .eq('user_id', user?.id)
        .eq('assessment_id', assessmentData.id)
        .maybeSingle();

      if (resultsError) {
        console.error('Error checking previous attempts:', resultsError);
        toast({
          title: "Error",
          description: "Failed to verify your previous attempts. Please try again.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // If results exist and reattempt is not allowed, prevent access
      if (results && !assessmentData.reattempt) {
        toast({
          title: "Assessment Already Completed",
          description: "You have already completed this assessment and retakes are not allowed.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Load the assessment and navigate to instructions
      const success = await loadAssessment(code);
      if (success) {
        navigate('/instructions');
      }

    } catch (error) {
      console.error('Error verifying assessment code:', error);
      toast({
        title: "Error",
        description: "An error occurred while verifying the assessment code.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Enter Assessment Code</CardTitle>
        <CardDescription>
          Please enter your assessment code to begin
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            placeholder="Enter code..."
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="uppercase"
            disabled={loading}
          />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Verifying..." : "Start Assessment"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default AssessmentCodeInput;
