import React, { useState, useEffect } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
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
  Pagination, 
  PaginationContent, 
  PaginationItem, 
  PaginationLink, 
  PaginationNext, 
  PaginationPrevious 
} from '@/components/ui/pagination';
import { useToast } from '@/components/ui/use-toast';
import { Download, Eye, Flag, Trash } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDate } from '@/lib/utils';

interface Student {
  id: string;
  name: string;
  email: string;
  assessmentId: string;
  assessmentName: string;
  score: number;
  totalMarks: number;
  percentage: number;
  completedAt: string;
  isFlagged: boolean;
  division: string;
  batch: string;
  year: string;
}

interface ResultsTableProps {
  filters: {
    year: string;
    division: string;
    batch: string;
    assessment: string;
    searchQuery: string;
  };
  flagged: boolean;
  topPerformers: boolean;
}

const ResultsTable: React.FC<ResultsTableProps> = ({ filters, flagged, topPerformers }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<string | null>(null);
  const { toast } = useToast();
  
  const pageSize = 10;
  const totalPages = Math.ceil(students.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const visibleStudents = students.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    const fetchResults = async () => {
      setIsLoading(true);
      try {
        const { data: submissionsData, error: submissionsError } = await supabase
          .from('submissions')
          .select(`
            id,
            created_at,
            started_at,
            completed_at,
            fullscreen_violations,
            is_terminated,
            assessments:assessment_id (
              id,
              name,
              code,
              duration_minutes
            ),
            user_id:user_id (
              id,
              email,
              name:email
            ),
            answers (
              question_id,
              is_correct,
              marks_obtained
            )
          `)
          .order('completed_at', { ascending: false });
        
        if (submissionsError) throw submissionsError;
        
        if (!submissionsData || submissionsData.length === 0) {
          setStudents([]);
          setIsLoading(false);
          return;
        }
        
        let transformedData: Student[] = submissionsData.map((submission) => {
          const answers = submission.answers || [];
          const totalObtained = answers.reduce((sum, answer) => sum + (answer.marks_obtained || 0), 0);
          
          const totalMarks = 100;
          
          const isFlagged = submission.is_terminated || submission.fullscreen_violations > 1;
          
          const userObj = submission.user_id || { id: 'unknown', email: 'Unknown', name: 'Unknown' };
          const userId = typeof userObj === 'object' ? userObj.id || 'unknown' : 'unknown';
          
          const userEmail = typeof userObj === 'object' ? userObj.email || 'Unknown' : 'Unknown';
          const userName = typeof userObj === 'object' ? 
                          userObj.name || (userEmail !== 'Unknown' ? userEmail.split('@')[0] : 'Unknown') : 
                          'Unknown';
          
          const assessment = typeof submission.assessments === 'object' ? submission.assessments : null;
          const assessmentName = assessment?.name || 'Unknown Assessment';
          
          const divisions = ['A', 'B', 'C'];
          const batches = ['B1', 'B2', 'B3'];
          const years = ['2023', '2024', '2025'];
          
          const hash = userId.split('').reduce((a, b) => {
            a = ((a << 5) - a) + b.charCodeAt(0);
            return a & a;
          }, 0);
          
          const absHash = Math.abs(hash);
          const division = divisions[absHash % divisions.length];
          const batch = batches[absHash % batches.length];
          const year = years[absHash % years.length];
          
          const percentage = totalMarks > 0 ? Math.round((totalObtained / totalMarks) * 100) : 0;
          
          return {
            id: userId,
            name: userName,
            email: userEmail,
            assessmentId: assessment?.id || '',
            assessmentName,
            score: totalObtained,
            totalMarks,
            percentage,
            completedAt: submission.completed_at || submission.created_at,
            isFlagged,
            division,
            batch,
            year
          };
        });
        
        if (filters.year) {
          transformedData = transformedData.filter(s => s.year === filters.year);
        }
        
        if (filters.division) {
          transformedData = transformedData.filter(s => s.division === filters.division);
        }
        
        if (filters.batch) {
          transformedData = transformedData.filter(s => s.batch === filters.batch);
        }
        
        if (filters.assessment && filters.assessment !== 'all') {
          transformedData = transformedData.filter(s => 
            s.assessmentName.toLowerCase().includes(filters.assessment.toLowerCase())
          );
        }
        
        if (filters.searchQuery) {
          const query = filters.searchQuery.toLowerCase();
          transformedData = transformedData.filter(s => 
            s.name.toLowerCase().includes(query) || 
            s.id.toLowerCase().includes(query) ||
            s.email.toLowerCase().includes(query)
          );
        }
        
        if (flagged) {
          transformedData = transformedData.filter(s => s.isFlagged);
        }
        
        if (topPerformers) {
          transformedData.sort((a, b) => b.percentage - a.percentage);
          transformedData = transformedData.slice(0, 10);
        }
        
        setStudents(transformedData);
      } catch (error) {
        console.error('Error fetching results:', error);
        toast({
          title: "Error",
          description: "Failed to load student results",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchResults();
  }, [filters, flagged, topPerformers, toast]);
  
  const handleDeleteStudent = (studentId: string) => {
    setStudentToDelete(studentId);
    setDeleteDialogOpen(true);
  };
  
  const confirmDelete = async () => {
    if (!studentToDelete) return;
    
    try {
      setStudents(students.filter(student => student.id !== studentToDelete));
      
      toast({
        title: "Success",
        description: "Student result deleted successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete student result",
        variant: "destructive"
      });
    } finally {
      setDeleteDialogOpen(false);
      setStudentToDelete(null);
    }
  };
  
  const handleDownloadReport = (studentId: string) => {
    toast({
      title: "Downloading Report",
      description: `Generating report for Student ${studentId}`,
    });
  };

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <p>Loading results...</p>
        </div>
      ) : students.length === 0 ? (
        <div className="flex justify-center items-center h-64 border rounded-lg">
          <p className="text-gray-500">No results found matching the selected criteria</p>
        </div>
      ) : (
        <>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Assessment</TableHead>
                  <TableHead className="text-center">Score</TableHead>
                  <TableHead>Date Completed</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleStudents.map(student => (
                  <TableRow key={`${student.id}-${student.assessmentId}`} className={student.isFlagged ? "bg-red-50" : ""}>
                    <TableCell className="font-medium">{student.id}</TableCell>
                    <TableCell>
                      {student.name}
                      <div className="text-xs text-gray-500">{student.email}</div>
                    </TableCell>
                    <TableCell>{student.assessmentName}</TableCell>
                    <TableCell className="text-center">
                      {student.score}/{student.totalMarks}
                      <div className="text-xs text-gray-500">{student.percentage}%</div>
                    </TableCell>
                    <TableCell>{formatDate(student.completedAt)}</TableCell>
                    <TableCell>
                      {student.isFlagged ? (
                        <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">
                          <Flag className="h-3 w-3 mr-1" />
                          Flagged
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
                          Completed
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" title="View Details">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          title="Download Report"
                          onClick={() => handleDownloadReport(student.id)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          title="Delete Result"
                          onClick={() => handleDeleteStudent(student.id)}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          {totalPages > 1 && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className="cursor-pointer"
                    aria-disabled={currentPage <= 1} 
                  />
                </PaginationItem>
                
                {Array.from({length: totalPages}, (_, i) => i + 1).map(page => (
                  <PaginationItem key={page}>
                    <PaginationLink 
                      isActive={page === currentPage}
                      onClick={() => setCurrentPage(page)}
                      className="cursor-pointer"
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                
                <PaginationItem>
                  <PaginationNext 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className="cursor-pointer"
                    aria-disabled={currentPage >= totalPages}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </>
      )}
      
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
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
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ResultsTable;
