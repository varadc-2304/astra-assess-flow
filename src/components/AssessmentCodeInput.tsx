
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useAssessment } from '@/contexts/AssessmentContext';
import { supabase } from '@/integrations/supabase/client';
import { Shield } from 'lucide-react';

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
    <Card className="w-full max-w-md mx-auto shadow-lg border-0 bg-gradient-to-br from-white to-gray-50">
      <CardHeader className="text-center pb-6">
        <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-astra-red/10 to-astra-red/5 rounded-full flex items-center justify-center">
          <Shield className="h-8 w-8 text-astra-red" />
        </div>
        <CardTitle className="text-xl font-semibold text-gray-900">Enter Assessment Code</CardTitle>
        <CardDescription className="text-gray-600">
          Please enter your assessment code to begin
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            placeholder="Enter code..."
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="uppercase text-center text-lg font-mono tracking-wider bg-gray-50 border-gray-200 focus:border-astra-red focus:ring-red-100"
            disabled={loading}
          />
          <Button 
            type="submit" 
            className="w-full bg-astra-red hover:bg-red-600 text-white font-medium py-3 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5" 
            disabled={loading}
          >
            {loading ? "Verifying..." : "Start Assessment"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default AssessmentCodeInput;
