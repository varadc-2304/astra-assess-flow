
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useAssessment } from '@/contexts/AssessmentContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

const AssessmentCodeInput = () => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { loadAssessment } = useAssessment();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!code.trim()) {
      toast({
        title: "Missing Code",
        description: "Please enter an assessment code.",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);

    try {
      console.log("Verifying assessment code:", code);
      
      // Store code for later use
      localStorage.setItem('assessmentCode', code.trim().toUpperCase());
      
      // Attempt to load the assessment
      const success = await loadAssessment(code.trim().toUpperCase());
      
      if (success) {
        toast({
          title: "Assessment Found",
          description: "The assessment has been loaded successfully.",
        });
        navigate('/instructions');
      } else {
        toast({
          title: "Invalid Code",
          description: "Please check the assessment code and try again.",
          variant: "destructive",
        });
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
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : "Start Assessment"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default AssessmentCodeInput;
