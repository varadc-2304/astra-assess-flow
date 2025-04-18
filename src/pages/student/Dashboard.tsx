
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAssessment } from '@/contexts/AssessmentContext';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from "@/components/ui/calendar"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

const StudentDashboard = () => {
  const { user } = useAuth();
  const { startAssessment, assessment, checkReattemptAvailability } = useAssessment();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [assessments, setAssessments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = React.useState<Date | undefined>(new Date())
  const formattedDate = date ? format(date, "yyyy-MM-dd") : null

  useEffect(() => {
    const fetchAssessments = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('assessments')
          .select('*')
          .order('start_time', { ascending: true });

        if (error) {
          console.error('Error fetching assessments:', error);
          toast({
            title: "Error",
            description: "Failed to load assessments. Please try again.",
            variant: "destructive"
          });
        } else {
          setAssessments(data || []);
        }
      } catch (error) {
        console.error('Error fetching assessments:', error);
        toast({
          title: "Error",
          description: "Failed to load assessments. Please try again.",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    fetchAssessments();
  }, [toast]);

  const handleStartAssessment = async (assessmentId: string) => {
    try {
      // Check if user has already completed this assessment
      const { data: results } = await supabase
        .from('results')
        .select('*')
        .eq('user_id', user?.id)
        .eq('assessment_id', assessmentId)
        .order('completed_at', { ascending: false })
        .limit(1);

      // Get assessment details to check reattempt flag
      const { data: assessment } = await supabase
        .from('assessments')
        .select('*')
        .eq('id', assessmentId)
        .single();

      if (results && results.length > 0 && !assessment?.reattempt) {
        toast({
          title: "Assessment Already Completed",
          description: "This assessment cannot be retaken as re-attempts are not allowed.",
          variant: "destructive"
        });
        return;
      }

      const selectedAssessment = assessments.find(a => a.id === assessmentId);

      if (!selectedAssessment) {
        toast({
          title: "Error",
          description: "Assessment not found.",
          variant: "destructive"
        });
        return;
      }

      if (new Date(selectedAssessment.start_time) > new Date()) {
        toast({
          title: "Assessment Not Yet Available",
          description: "This assessment has not yet started.",
          variant: "destructive"
        });
        return;
      }

      if (selectedAssessment.end_time && new Date(selectedAssessment.end_time) < new Date()) {
        toast({
          title: "Assessment Expired",
          description: "This assessment has already ended.",
          variant: "destructive"
        });
        return;
      }

      // Check if reattempt is allowed using the context function
      const reattemptAllowed = await checkReattemptAvailability(assessmentId);
      
      if (!reattemptAllowed) {
        return;
      }

      await startAssessment();
      navigate('/instructions');
    } catch (error) {
      console.error('Error starting assessment:', error);
      toast({
        title: "Error",
        description: "Failed to start assessment. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4">Student Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Calendar Card */}
        <Card className="col-span-1 md:col-span-1">
          <CardHeader className="space-y-1">
            <CardTitle className="text-lg">Upcoming Assessments</CardTitle>
            <CardDescription>Select a date to view assessments.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  disabled={(date) =>
                    date > new Date()
                  }
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </CardContent>
        </Card>

        {/* Assessments List */}
        <div className="col-span-1 md:col-span-2">
          <h2 className="text-xl font-semibold mb-2">Available Assessments</h2>
          {loading ? (
            <p>Loading assessments...</p>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {assessments.filter(assessment => {
                if (!formattedDate) return true;
                const assessmentDate = format(new Date(assessment.start_time), "yyyy-MM-dd");
                return assessmentDate === formattedDate;
              }).map(assessment => (
                <Card key={assessment.id}>
                  <CardHeader>
                    <CardTitle>{assessment.name}</CardTitle>
                    <CardDescription>{assessment.instructions}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p>Code: {assessment.code}</p>
                    <p>Duration: {assessment.duration_minutes} minutes</p>
                    <Button onClick={() => handleStartAssessment(assessment.id)}>
                      Start Assessment
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
