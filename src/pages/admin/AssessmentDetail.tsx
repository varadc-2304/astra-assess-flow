
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { 
  AlarmClock, 
  CalendarIcon, 
  FileText,
  AlertTriangle,
  Users
} from 'lucide-react';
import QuestionList from '@/components/admin/QuestionList';

interface Assessment {
  id: string;
  code: string;
  name: string;
  instructions: string | null;
  duration_minutes: number;
  start_time: string;
  end_time: string;
  created_at: string;
  status: string;
}

const AssessmentDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAssessment = async () => {
      setIsLoading(true);
      try {
        if (!id) return;

        const { data, error } = await supabase
          .from('assessments')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;
        setAssessment(data);
      } catch (error: any) {
        console.error('Error fetching assessment:', error);
        toast({
          title: "Error",
          description: `Error fetching assessment: ${error.message}`,
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchAssessment();
  }, [id, toast]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Active':
        return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case 'Scheduled':
        return <Badge className="bg-blue-100 text-blue-800">Scheduled</Badge>;
      case 'Completed':
        return <Badge className="bg-gray-100 text-gray-800">Completed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-5xl mx-auto">
          <Card>
            <CardContent className="flex items-center justify-center h-64">
              <p>Loading assessment details...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-5xl mx-auto">
          <Card>
            <CardContent className="p-6">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  Assessment not found. The assessment may have been deleted or you don't have permission to view it.
                </AlertDescription>
              </Alert>
              <div className="mt-4 flex justify-end">
                <Button onClick={() => navigate('/admin')}>
                  Return to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Back button */}
        <Button 
          variant="ghost" 
          onClick={() => navigate('/admin')}
          className="mb-4"
        >
          ← Back to Dashboard
        </Button>
        
        {/* Assessment details */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle className="text-2xl font-bold">{assessment.name}</CardTitle>
              {getStatusBadge(assessment.status)}
            </div>
            <CardDescription>
              Code: <span className="font-mono uppercase">{assessment.code}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Basic information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-start gap-2">
                  <CalendarIcon className="h-5 w-5 text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-500">Start Date</p>
                    <p className="font-medium">
                      {format(new Date(assessment.start_time), 'PPP')} at {format(new Date(assessment.start_time), 'p')}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-2">
                  <CalendarIcon className="h-5 w-5 text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-500">End Date</p>
                    <p className="font-medium">
                      {format(new Date(assessment.end_time), 'PPP')} at {format(new Date(assessment.end_time), 'p')}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-start gap-2">
                  <AlarmClock className="h-5 w-5 text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-500">Duration</p>
                    <p className="font-medium">{assessment.duration_minutes} minutes</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-2">
                  <Users className="h-5 w-5 text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-500">Students</p>
                    <Button 
                      variant="link" 
                      className="p-0 h-auto font-medium"
                      onClick={() => navigate(`/admin/results?assessment=${id}`)}
                    >
                      View Student Results
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Instructions */}
            {assessment.instructions && (
              <div>
                <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Instructions
                </h3>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <p className="whitespace-pre-line">{assessment.instructions}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Questions section */}
        <Card>
          <CardHeader>
            <CardTitle>Questions</CardTitle>
            <CardDescription>
              View the questions for this assessment
            </CardDescription>
          </CardHeader>
          <CardContent>
            <QuestionList assessmentId={id || ''} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AssessmentDetail;
