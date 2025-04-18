
import React, { useState, useEffect } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  Pagination, 
  PaginationContent, 
  PaginationItem, 
  PaginationLink, 
  PaginationNext, 
  PaginationPrevious 
} from '@/components/ui/pagination';
import { useToast } from '@/hooks/use-toast';
import { Flag } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDate } from '@/lib/utils';
import { Result } from '@/types/database';

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  auth_ID: string;
  year?: string;
  department?: string;
  division?: string;
  batch?: string;
}

interface Student {
  id: string;
  name: string;
  email: string;
  assessmentId: string;
  assessmentName: string;
  assessmentCode?: string;
  score: number;
  totalMarks: number;
  percentage: number;
  completedAt: string;
  isTerminated: boolean;
  division: string;
  batch: string;
  year: string;
  department: string;
}

interface ResultsTableProps {
  filters: {
    year: string;
    division: string;
    batch: string;
    assessment: string;
    searchQuery: string;
    department: string;
  };
  flagged: boolean;
  topPerformers: boolean;
}

const ResultsTable: React.FC<ResultsTableProps> = ({ filters, flagged, topPerformers }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const { toast } = useToast();
  
  const pageSize = 10;
  const totalPages = Math.ceil(students.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const visibleStudents = students.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    const fetchResults = async () => {
      setIsLoading(true);
      try {
        // First, let's query the results but modify our join approach to properly link users
        const { data: resultsData, error: resultsError } = await supabase
          .from('results')
          .select(`
            *,
            assessments (
              id,
              name,
              code
            ),
            users (
              id,
              name,
              email,
              year,
              department,
              division,
              batch
            )
          `)
          .order('completed_at', { ascending: false });
        
        if (resultsError) throw resultsError;

        if (!resultsData || resultsData.length === 0) {
          setStudents([]);
          setIsLoading(false);
          return;
        }

        let transformedData: Student[] = resultsData.map((result) => {
          // Type assertion to provide better type safety
          const userDetails = result.users as unknown as UserData;
          const assessment = result.assessments as {id: string, name: string, code: string};
          
          return {
            id: result.user_id,
            name: userDetails?.name || 'Unknown User',
            email: userDetails?.email || 'unknown@example.com',
            assessmentId: result.assessment_id,
            assessmentName: assessment?.name || 'Unknown Assessment',
            assessmentCode: assessment?.code || '',
            score: result.total_score,
            totalMarks: result.total_marks,
            percentage: result.percentage,
            completedAt: result.completed_at,
            isTerminated: result.isTerminated || false,
            division: userDetails?.division || 'N/A',
            batch: userDetails?.batch || 'N/A',
            year: userDetails?.year || 'N/A',
            department: userDetails?.department || 'N/A'
          };
        });

        // Apply filters
        if (filters.year) {
          transformedData = transformedData.filter(s => s.year === filters.year);
        }
        
        if (filters.division) {
          transformedData = transformedData.filter(s => s.division === filters.division);
        }
        
        if (filters.batch) {
          transformedData = transformedData.filter(s => s.batch === filters.batch);
        }

        if (filters.department) {
          transformedData = transformedData.filter(s => s.department === filters.department);
        }
        
        if (filters.assessment && filters.assessment !== 'all') {
          transformedData = transformedData.filter(s => s.assessmentCode === filters.assessment);
        }
        
        if (filters.searchQuery) {
          const query = filters.searchQuery.toLowerCase();
          transformedData = transformedData.filter(s => 
            s.name.toLowerCase().includes(query) || 
            s.email.toLowerCase().includes(query) ||
            s.assessmentName.toLowerCase().includes(query)
          );
        }
        
        if (flagged) {
          transformedData = transformedData.filter(s => s.isTerminated);
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
                  <TableHead>Name</TableHead>
                  <TableHead>Assessment</TableHead>
                  <TableHead className="text-center">Score</TableHead>
                  <TableHead>Date Completed</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleStudents.map((student, index) => (
                  <TableRow 
                    key={`${student.id}-${student.assessmentId}-${index}`} 
                    className={student.isTerminated ? "bg-red-50" : ""}
                  >
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
                      {student.isTerminated ? (
                        <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">
                          <Flag className="h-3 w-3 mr-1" />
                          Flagged
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
                          No Issues
                        </Badge>
                      )}
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
    </div>
  );
};

export default ResultsTable;
