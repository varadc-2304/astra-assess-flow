
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useAssessment } from '@/contexts/AssessmentContext';
import { supabase } from '@/integrations/supabase/client';
import { Play, ArrowRight } from 'lucide-react';

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
        .eq('assessment_id', assessmentData.id);

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
      if (results && results.length > 0 && !assessmentData.reattempt) {
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
        toast({
          title: "Assessment Loaded",
          description: "The assessment has been loaded successfully.",
        });
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
    <div className="max-w-md mx-auto">
      <Card className="card-modern border-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-astra-red/5 to-orange-500/5 opacity-50"></div>
        <CardHeader className="relative pb-6 text-center">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-astra-red to-red-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <Play className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
            Enter Assessment Code
          </CardTitle>
          <CardDescription className="text-gray-600 text-base mt-2">
            Please enter your unique assessment code to begin
          </CardDescription>
        </CardHeader>
        <CardContent className="relative space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Input
                placeholder="Enter assessment code..."
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="input-modern h-14 text-lg text-center font-mono tracking-wider uppercase placeholder:normal-case placeholder:tracking-normal"
                disabled={loading}
              />
            </div>
            <Button 
              type="submit" 
              className="btn-modern w-full h-14 bg-gradient-to-r from-astra-red to-red-600 hover:from-red-600 hover:to-red-700 text-white text-lg font-semibold" 
              disabled={loading || !code.trim()}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-3"></div>
                  Verifying...
                </>
              ) : (
                <>
                  Start Assessment
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AssessmentCodeInput;
