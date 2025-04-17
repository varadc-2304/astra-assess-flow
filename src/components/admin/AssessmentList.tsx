
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { formatDistanceToNow, format } from 'date-fns';
import { Edit, Eye, Trash2, UserRound, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Assessment {
  id: string;
  code: string;
  name: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  created_at: string;
}

interface Student {
  id: string;
  name: string;
  email: string;
  completedAt: string;
  score: number;
  totalMarks: number;
}

const AssessmentList = () => {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedAssessment, setSelectedAssessment] = useState<string | null>(null);
  const [studentsDialogOpen, setStudentsDialogOpen] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [deleteStudentDialogOpen, setDeleteStudentDialogOpen] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchAssessments();
  }, []);

  const fetchAssessments = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('assessments')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAssessments(data || []);
    } catch (error: any) {
      toast({
        title: "Error fetching assessments",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getAssessmentStatus = (startTime: string, endTime: string) => {
    const now = new Date();
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (now < start) {
      return { label: "Scheduled", color: "bg-blue-100 text-blue-800" };
    } else if (now >= start && now <= end) {
      return { label: "Active", color: "bg-green-100 text-green-800" };
    } else {
      return { label: "Completed", color: "bg-gray-100 text-gray-800" };
    }
  };

  const deleteAssessment = async (id: string) => {
    setSelectedAssessment(id);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteAssessment = async () => {
    if (!selectedAssessment) return;

    try {
      const { error } = await supabase
        .from('assessments')
        .delete()
        .eq('id', selectedAssessment);

      if (error) throw error;
      
      setAssessments(assessments.filter(assessment => assessment.id !== selectedAssessment));
      
      toast({
        title: "Assessment deleted",
        description: "The assessment has been successfully deleted.",
      });
    } catch (error: any) {
      toast({
        title: "Error deleting assessment",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setSelectedAssessment(null);
    }
  };

  const editAssessment = (id: string) => {
    navigate(`/admin/assessments/${id}/edit`);
  };

  const viewAssessment = (id: string) => {
    navigate(`/admin/assessments/${id}`);
  };

  const viewStudents = async (assessmentId: string) => {
    setSelectedAssessment(assessmentId);
    
    try {
      // Fetch actual submissions data from Supabase
      const { data: submissionsData, error: submissionsError } = await supabase
        .from('submissions')
        .select('*')
        .eq('assessment_id', assessmentId);
        
      if (submissionsError) throw submissionsError;
      
      // Convert submissions to student format
      // In a real app, you would join with user data
      const students: Student[] = (submissionsData || []).map((submission, index) => ({
        id: submission.id,
        name: `Student ${index + 1}`,
        email: `student${index + 1}@example.com`,
        completedAt: submission.completed_at || new Date().toISOString(),
        score: 0, // Would calculate from answers
        totalMarks: 100 // Would calculate from questions
      }));
      
      setStudents(students);
    } catch (error) {
      console.error('Error fetching submissions:', error);
      setStudents([]);
    }
    
    setStudentsDialogOpen(true);
  };

  const deleteStudent = (studentId: string) => {
    setSelectedStudentId(studentId);
    setDeleteStudentDialogOpen(true);
  };

  const confirmDeleteStudent = async () => {
    if (!selectedStudentId) return;

    try {
      // Delete submission from Supabase
      const { error } = await supabase
        .from('submissions')
        .delete()
        .eq('id', selectedStudentId);
        
      if (error) throw error;
      
      setStudents(students.filter(student => student.id !== selectedStudentId));
      
      toast({
        title: "Student result deleted",
        description: "The student's assessment result has been successfully deleted.",
      });
    } catch (error: any) {
      toast({
        title: "Error deleting student result",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeleteStudentDialogOpen(false);
      setSelectedStudentId(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-center items-center h-64">
            <p>Loading assessments...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (assessments.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <p className="text-gray-500 mb-4">No assessments found</p>
            <Button 
              onClick={() => navigate('/admin/create-assessment')}
              className="bg-astra-red hover:bg-red-600 text-white"
            >
              Create Your First Assessment
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Students</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assessments.map((assessment) => {
              const status = getAssessmentStatus(assessment.start_time, assessment.end_time);
              
              return (
                <TableRow key={assessment.id}>
                  <TableCell className="font-medium">{assessment.name}</TableCell>
                  <TableCell className="font-mono uppercase">{assessment.code}</TableCell>
                  <TableCell>{assessment.duration_minutes} min</TableCell>
                  <TableCell>
                    {format(new Date(assessment.start_time), 'PPP')}
                    <div className="text-xs text-gray-500">
                      {formatDistanceToNow(new Date(assessment.start_time), { addSuffix: true })}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={status.color}>
                      {status.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="flex items-center"
                      onClick={() => viewStudents(assessment.id)}
                    >
                      <Users className="h-4 w-4 mr-1" />
                      View Students
                    </Button>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => viewAssessment(assessment.id)} title="View Assessment">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => editAssessment(assessment.id)} title="Edit Assessment">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteAssessment(assessment.id)} title="Delete Assessment">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>

      {/* Delete Assessment Confirmation Dialog */}
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
            <AlertDialogAction onClick={confirmDeleteAssessment} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View Students Dialog */}
      <Dialog open={studentsDialogOpen} onOpenChange={setStudentsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Student Results</DialogTitle>
            <DialogDescription>
              Students who took this assessment
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[400px]">
            {students.length === 0 ? (
              <p className="text-center py-4 text-gray-500">No students have taken this assessment yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map(student => (
                    <TableRow key={student.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <UserRound className="h-4 w-4" />
                          <div>
                            <p className="font-medium">{student.name}</p>
                            <p className="text-xs text-gray-500">{student.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {student.score}/{student.totalMarks}
                        <div className="text-xs text-gray-500">
                          {Math.round((student.score / student.totalMarks) * 100)}%
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => deleteStudent(student.id)}
                          title="Delete Result"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Student Result Confirmation */}
      <AlertDialog open={deleteStudentDialogOpen} onOpenChange={setDeleteStudentDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this student's assessment result? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteStudent} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default AssessmentList;
