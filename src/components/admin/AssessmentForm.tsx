
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { generateRandomCode } from '@/lib/utils';
import QuestionForm from '@/components/admin/QuestionForm';
import QuestionList from '@/components/admin/QuestionList';

// Form schema
const formSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  code: z.string().min(3, 'Code must be at least 3 characters').max(10, 'Code cannot exceed 10 characters'),
  instructions: z.string().min(10, 'Instructions should be more detailed'),
  durationMinutes: z.number().min(5, 'Duration must be at least 5 minutes').max(240, 'Duration cannot exceed 240 minutes'),
  startTime: z.date(),
  endTime: z.date(),
});

type FormSchema = z.infer<typeof formSchema>;

interface AssessmentFormProps {
  assessmentId?: string;
}

const AssessmentForm: React.FC<AssessmentFormProps> = ({ assessmentId }) => {
  const [activeTab, setActiveTab] = useState('details');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [assessmentCreated, setAssessmentCreated] = useState(false);
  const [currentAssessmentId, setCurrentAssessmentId] = useState<string | undefined>(assessmentId);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Initialize form
  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      code: generateRandomCode(),
      instructions: '',
      durationMinutes: 60,
      startTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // tomorrow
      endTime: new Date(Date.now() + 25 * 60 * 60 * 1000), // tomorrow + 1h
    },
  });

  // Load assessment data if editing
  React.useEffect(() => {
    const fetchAssessment = async () => {
      if (!assessmentId) return;
      
      try {
        const { data, error } = await supabase
          .from('assessments')
          .select('*')
          .eq('id', assessmentId)
          .single();
          
        if (error) throw error;
        if (data) {
          form.reset({
            name: data.name,
            code: data.code,
            instructions: data.instructions || '',
            durationMinutes: data.duration_minutes,
            startTime: new Date(data.start_time),
            endTime: new Date(data.end_time),
          });
          setCurrentAssessmentId(assessmentId);
          setAssessmentCreated(true);
        }
      } catch (error: any) {
        toast({
          title: "Error loading assessment",
          description: error.message,
          variant: "destructive",
        });
      }
    };
    
    fetchAssessment();
  }, [assessmentId]);

  const onSubmit = async (data: FormSchema) => {
    if (!user) return;
    setIsSubmitting(true);
    
    try {
      // Validate date range
      if (data.endTime <= data.startTime) {
        toast({
          title: "Invalid date range",
          description: "End time must be after start time",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
      
      // Format data for Supabase
      const assessmentData = {
        name: data.name,
        code: data.code.toUpperCase(),
        instructions: data.instructions,
        duration_minutes: data.durationMinutes,
        start_time: data.startTime.toISOString(),
        end_time: data.endTime.toISOString(),
        created_by: user.id,
      };
      
      let response;
      
      if (currentAssessmentId) {
        // Update existing assessment
        response = await supabase
          .from('assessments')
          .update(assessmentData)
          .eq('id', currentAssessmentId);
      } else {
        // Insert new assessment
        response = await supabase
          .from('assessments')
          .insert(assessmentData)
          .select();
      }
      
      const { data: responseData, error } = response;
      
      if (error) throw error;
      
      toast({
        title: currentAssessmentId ? "Assessment updated" : "Assessment created",
        description: `${data.name} has been saved successfully.`,
      });
      
      if (!currentAssessmentId && responseData) {
        setCurrentAssessmentId(responseData[0].id);
        setAssessmentCreated(true);
        setActiveTab('questions');
      }
    } catch (error: any) {
      toast({
        title: "Error saving assessment",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateCode = () => {
    form.setValue('code', generateRandomCode());
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="details">Assessment Details</TabsTrigger>
          <TabsTrigger value="questions" disabled={!assessmentCreated}>
            Questions
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle>{currentAssessmentId ? 'Edit Assessment' : 'Create New Assessment'}</CardTitle>
              <CardDescription>
                Fill in the details for your assessment. After saving these details, you'll be able to add questions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Assessment Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Programming Fundamentals Midterm" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Assessment Code</FormLabel>
                          <FormControl>
                            <div className="flex gap-2">
                              <Input 
                                placeholder="e.g. CS101MID" 
                                {...field} 
                                value={field.value.toUpperCase()} 
                                className="uppercase font-mono"
                              />
                              <Button 
                                type="button"
                                variant="outline"
                                onClick={handleGenerateCode}
                              >
                                Generate
                              </Button>
                            </div>
                          </FormControl>
                          <FormDescription>
                            Students will use this code to access the assessment
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="instructions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Instructions</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Enter detailed instructions for students taking this assessment..." 
                            className="min-h-32" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="durationMinutes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Duration (minutes)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min={5}
                            max={240}
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="startTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Start Date & Time</FormLabel>
                          <FormControl>
                            <DateTimePicker 
                              date={field.value}
                              setDate={field.onChange}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="endTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>End Date & Time</FormLabel>
                          <FormControl>
                            <DateTimePicker 
                              date={field.value}
                              setDate={field.onChange}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="flex justify-end space-x-2">
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={() => navigate('/admin')}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={isSubmitting}
                      className="bg-astra-red hover:bg-red-600 text-white"
                    >
                      {isSubmitting 
                        ? 'Saving...' 
                        : currentAssessmentId 
                          ? 'Update Assessment' 
                          : 'Create Assessment'}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="questions">
          {currentAssessmentId && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Questions</CardTitle>
                  <CardDescription>
                    Add and manage questions for this assessment
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <QuestionList assessmentId={currentAssessmentId} />
                </CardContent>
                <CardFooter className="border-t p-4 flex justify-end">
                  <Button
                    className="bg-astra-red hover:bg-red-600 text-white"
                    onClick={() => navigate(`/admin/assessments/${currentAssessmentId}/questions/new`)}
                  >
                    Add Question
                  </Button>
                </CardFooter>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AssessmentForm;
