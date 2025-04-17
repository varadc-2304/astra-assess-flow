
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useAssessment } from '@/contexts/AssessmentContext';
import { useToast } from '@/components/ui/use-toast';

const StudentDashboard = () => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, logout } = useAuth();
  const { setAssessmentCode, loadAssessment } = useAssessment();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!code.trim()) {
      toast({
        title: "Error",
        description: "Please enter an assessment code",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);
    
    try {
      console.log("Setting assessment code:", code);
      setAssessmentCode(code);
      
      console.log("Loading assessment...");
      await loadAssessment(code);
      
      console.log("Navigating to instructions page");
      // Only navigate after successful assessment loading
      navigate('/instructions');
    } catch (error: any) {
      console.error("Error loading assessment:", error);
      toast({
        title: "Invalid Code",
        description: "The assessment code you entered is invalid. Please try again.",
        variant: "destructive",
      });
      // Do not navigate if there was an error
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-xl mx-auto px-4">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-astra-red">Yudh</h1>
            <p className="text-gray-600">Welcome back, {user?.name}</p>
          </div>
          <Button variant="outline" onClick={logout}>Log out</Button>
        </header>
        
        <Card className="shadow-lg border-0">
          <CardHeader>
            <CardTitle>Enter Assessment Code</CardTitle>
            <CardDescription>
              Please enter the assessment code provided by your instructor to begin
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input 
                placeholder="Assessment Code (e.g., DEMO123)"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="text-center font-mono text-lg uppercase"
              />
              
              <Button 
                type="submit" 
                className="w-full bg-astra-red hover:bg-red-600 text-white"
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Continue'}
              </Button>
            </form>
          </CardContent>
        </Card>
        
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-2">Recent Assessments</h2>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-gray-500 text-sm text-center py-6">
              No recent assessments found
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
