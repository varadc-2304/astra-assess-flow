
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
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { formatDistanceToNow, format } from 'date-fns';
import { Edit, Eye, Trash2, UserRound, Users, Download, FileText, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Assessment {
  id: string;
  code: string;
  name: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  created_at: string;
  status?: string;
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
  const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null);
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
      
      const assessmentsWithStatus = data?.map(assessment => {
        const status = getAssessmentStatus(assessment.start_time, assessment.end_time);
        return {
          ...assessment,
          status: status.label
        };
      }) || [];
      
      setAssessments(assessmentsWithStatus);
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

  const deleteAssessment = async () => {
    setDeleteDialogOpen(true);
  };

  const confirmDeleteAssessment = async () => {
    if (!selectedAssessment) return;

    try {
      const { error } = await supabase
        .from('assessments')
        .delete()
        .eq('id', selectedAssessment.id);

      if (error) throw error;
      
      setAssessments(assessments.filter(assessment => assessment.id !== selectedAssessment.id));
      
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

  const handleStatusChange = async (assessmentId: string, newStatus: string) => {
    try {
      const assessment = assessments.find(a => a.id === assessmentId);
      if (!assessment) return;
      
      let updatedData: Partial<Assessment> = {};
      const now = new Date();
      
      if (newStatus === 'Scheduled') {
        // Set start time to future (tomorrow)
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        updatedData = {
          start_time: tomorrow.toISOString(),
          end_time: new Date(tomorrow.getTime() + assessment.duration_minutes * 60000).toISOString()
        };
      } else if (newStatus === 'Active') {
        // Set start time to now and end time based on duration
        updatedData = {
          start_time: now.toISOString(),
          end_time: new Date(now.getTime() + assessment.duration_minutes * 60000).toISOString()
        };
      } else if (newStatus === 'Completed') {
        // Set start time to past and end time to now
        const pastTime = new Date();
        pastTime.setHours(pastTime.getHours() - 1);
        updatedData = {
          start_time: pastTime.toISOString(),
          end_time: now.toISOString()
        };
      }
      
      const { error } = await supabase
        .from('assessments')
        .update(updatedData)
        .eq('id', assessmentId);
      
      if (error) throw error;
      
      // Update local state
      setAssessments(prevAssessments => 
        prevAssessments.map(assessment => 
          assessment.id === assessmentId 
            ? { ...assessment, ...updatedData, status: newStatus }
            : assessment
        )
      );
      
      toast({
        title: "Status updated",
        description: `Assessment status changed to ${newStatus}`,
      });
    } catch (error: any) {
      toast({
        title: "Error updating status",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const editAssessment = (id: string) => {
    navigate(`/admin/assessments/${id}/edit`);
  };

  const viewAssessment = (id: string) => {
    navigate(`/admin/assessments/${id}`);
  };

  const viewStudents = async (assessment: Assessment) => {
    setSelectedAssessment(assessment);
    
    try {
      // Fetch actual results data from Supabase
      const { data: resultsData, error: resultsError } = await supabase
        .from('results')
        .select('*')
        .eq('assessment_id', assessment.id);
        
      if (resultsError) throw resultsError;
      
      // Convert results to student format
      const students: Student[] = (resultsData || []).map((result, index) => ({
        id: result.user_id,
        name: `Student ${index + 1}`,
        email: `student${index + 1}@example.com`,
        completedAt: result.completed_at,
        score: result.total_score,
        totalMarks: result.total_marks
      }));
      
      setStudents(students);
    } catch (error) {
      console.error('Error fetching results:', error);
      setStudents([]);
    }
    
    setStudentsDialogOpen(true);
  };

  const deleteStudent = (studentId: string) => {
    setSelectedStudentId(studentId);
    setDeleteStudentDialogOpen(true);
  };

  const confirmDeleteStudent = async () => {
    if (!selectedStudentId || !selectedAssessment) return;

    try {
      // Delete result from Supabase
      const { error } = await supabase
        .from('results')
        .delete()
        .eq('user_id', selectedStudentId)
        .eq('assessment_id', selectedAssessment.id);
        
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

  const downloadResults = () => {
    if (!selectedAssessment || students.length === 0) return;
    
    try {
      // Create HTML content
      let htmlContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Assessment Results - ${selectedAssessment.name}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
            h1 { color: #333; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background-color: #f2f2f2; }
            .header { margin-bottom: 30px; }
            .score { font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Assessment Results</h1>
            <p>Assessment: ${selectedAssessment.name}</p>
            <p>Code: ${selectedAssessment.code}</p>
            <p>Date: ${format(new Date(), 'PPP')}</p>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Email</th>
                <th>Score</th>
                <th>Percentage</th>
                <th>Completion Date</th>
              </tr>
            </thead>
            <tbody>
      `;
      
      students.forEach(student => {
        const percentage = ((student.score / student.totalMarks) * 100).toFixed(1);
        htmlContent += `
          <tr>
            <td>${student.name}</td>
            <td>${student.email}</td>
            <td class="score">${student.score}/${student.totalMarks}</td>
            <td>${percentage}%</td>
            <td>${format(new Date(student.completedAt), 'PPP')}</td>
          </tr>
        `;
      });
      
      htmlContent += `
            </tbody>
          </table>
        </body>
        </html>
      `;
      
      // Create blob and download
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${selectedAssessment.code}_results.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Results downloaded",
        description: "The results have been downloaded as HTML file.",
      });
    } catch (error) {
      console.error('Error downloading results:', error);
      toast({
        title: "Error downloading results",
        description: "Failed to download results",
        variant: "destructive"
      });
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
              <TableHead>Change Status</TableHead>
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
                    <Select
                      onValueChange={(value) => handleStatusChange(assessment.id, value)}
                      defaultValue={status.label}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Change status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Scheduled">Scheduled</SelectItem>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => viewAssessment(assessment.id)}
                        className="flex items-center gap-2"
                      >
                        <FileText className="h-4 w-4" />
                        Details
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => editAssessment(assessment.id)}
                        className="flex items-center gap-2"
                      >
                        <Edit className="h-4 w-4" />
                        Edit
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => viewStudents(assessment)}
                        className="flex items-center gap-2"
                      >
                        <Users className="h-4 w-4" />
                        Students
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setSelectedAssessment(assessment);
                          deleteAssessment();
                        }}
                        className="flex items-center gap-2 border-red-200 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                        Delete
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
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Student Results</span>
              {students.length > 0 && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={downloadResults}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download Results
                </Button>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedAssessment ? `Students who took "${selectedAssessment.name}"` : 'Loading...'}
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
                    <TableHead>Email</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map(student => (
                    <TableRow key={student.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <UserRound className="h-4 w-4 text-gray-500" />
                          <span className="font-medium">{student.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-600">{student.email}</TableCell>
                      <TableCell>
                        <div className="font-medium">{student.score}/{student.totalMarks}</div>
                        <div className="text-xs text-gray-500">
                          {Math.round((student.score / student.totalMarks) * 100)}%
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(new Date(student.completedAt), 'PPP')}
                        <div className="text-xs text-gray-500">
                          {formatDistanceToNow(new Date(student.completedAt), { addSuffix: true })}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => deleteStudent(student.id)}
                          title="Delete Result"
                          className="hover:bg-red-50 hover:text-red-600"
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
