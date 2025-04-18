
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
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
  Edit, 
  FileText, 
  Trash2, 
  Users,
  AlertTriangle 
} from 'lucide-react';
import QuestionList from '@/components/admin/QuestionList';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';

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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

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

  const handleEdit = () => {
    navigate(`/admin/assessments/${id}/edit`);
  };

  const handleDelete = () => {
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    try {
      if (!id) return;

      // Delete all questions associated with this assessment
      const { error: questionError } = await supabase
        .from('questions')
        .delete()
        .eq('assessment_id', id);

      if (questionError) throw questionError;

      // Delete the assessment
      const { error } = await supabase
        .from('assessments')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Assessment deleted successfully",
      });
      
      navigate('/admin');
    } catch (error: any) {
      console.error('Error deleting assessment:', error);
      toast({
        title: "Error",
        description: `Error deleting assessment: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
    }
  };

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
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-2xl font-bold">{assessment.name}</CardTitle>
                {getStatusBadge(assessment.status)}
              </div>
              <CardDescription>
                Code: <span className="font-mono uppercase">{assessment.code}</span>
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleEdit}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button variant="outline" className="text-red-600" onClick={handleDelete}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
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
              Manage the questions for this assessment
            </CardDescription>
          </CardHeader>
          <CardContent>
            <QuestionList assessmentId={id || ''} />
          </CardContent>
          <CardFooter className="border-t p-4 flex justify-end">
            <Button
              className="bg-astra-red hover:bg-red-600 text-white"
              onClick={() => navigate(`/admin/assessments/${id}/questions/new`)}
            >
              Add Question
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this assessment? This action cannot be undone.
              All associated questions and student submissions will also be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AssessmentDetail;
