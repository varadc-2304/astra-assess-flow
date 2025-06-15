
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useAssessment } from '@/contexts/AssessmentContext';
import { supabase } from '@/integrations/supabase/client';

const AssessmentCodeInput = () => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { user } = useAuth();
  const { loadAssessment } = useAssessment();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Check if the assessment exists and get its details
      const { data: assessmentData, error: assessmentError } = await supabase
        .from('assessments')
        .select('*')
        .eq('code', code.trim().toUpperCase())
        .single();

      if (assessmentError || !assessmentData) {
        setError('Please check the assessment code and try again.');
        setLoading(false);
        return;
      }

      // Check if user has this assessment assigned
      const { data: authData, error: authError } = await supabase
        .from('auth')
        .select('assigned_assessments')
        .eq('id', user?.id)
        .single();

      if (authError || !authData) {
        setError('Unable to verify your assessment permissions.');
        setLoading(false);
        return;
      }

      const assignedAssessments = authData.assigned_assessments || [];
      if (!assignedAssessments.includes(assessmentData.code)) {
        setError('You are not authorized to access this assessment.');
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
        setError('Failed to verify your previous attempts. Please try again.');
        setLoading(false);
        return;
      }

      // If results exist and reattempt is not allowed, prevent access
      if (results && results.length > 0 && !assessmentData.reattempt) {
        setError('You have already completed this assessment and retakes are not allowed.');
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
      setError('An error occurred while verifying the assessment code.');
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
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Verifying..." : "Start Assessment"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default AssessmentCodeInput;
