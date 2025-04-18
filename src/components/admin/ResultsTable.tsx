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
  score: number;
  totalMarks: number;
  percentage: number;
  completedAt: string;
  isTerminated: boolean;
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
  const { toast } = useToast();
  
  const pageSize = 10;
  const totalPages = Math.ceil(students.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const visibleStudents = students.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    const fetchResults = async () => {
      setIsLoading(true);
      try {
        console.log('Fetching results with filters:', filters);
        
        let query = supabase
          .from('results')
          .select(`
            id,
            user_id,
            assessment_id,
            total_score,
            total_marks,
            percentage,
            completed_at,
            isTerminated,
            assessments:assessment_id (
              id,
              name,
              code
            ),
            users:user_id (
              id,
              name,
              email,
              role,
              auth_ID,
              year,
              department,
              division,
              batch
            )
          `)
          .order('completed_at', { ascending: false });
        
        // Filter by assessment if specified
        if (filters.assessment && filters.assessment !== 'all') {
          query = query.eq('assessment_id', filters.assessment);
        }

        const { data: resultsData, error: resultsError } = await query;

        if (resultsError) throw resultsError;

        if (!resultsData || resultsData.length === 0) {
          setStudents([]);
          setIsLoading(false);
          return;
        }

        let transformedData: Student[] = resultsData
          .filter(result => result.users) // Filter out results without user data
          .map(result => {
            const user = result.users;
            const assessment = result.assessments;
            
            return {
              id: result.user_id,
              name: user?.name || 'Unknown User',
              email: user?.email || 'unknown@example.com',
              assessmentId: result.assessment_id,
              assessmentName: assessment?.name || 'Unknown Assessment',
              score: result.total_score,
              totalMarks: result.total_marks,
              percentage: result.percentage,
              completedAt: result.completed_at,
              isTerminated: result.isTerminated || false,
              division: user?.division || 'N/A',
              batch: user?.batch || 'N/A',
              year: user?.year || 'N/A'
            };
          });

        // Apply filters
        if (filters.year) {
          transformedData = transformedData.filter(s => s.year && s.year.toLowerCase() === filters.year.toLowerCase());
        }
        
        if (filters.division) {
          transformedData = transformedData.filter(s => s.division && s.division.toLowerCase() === filters.division.toLowerCase());
        }
        
        if (filters.batch) {
          transformedData = transformedData.filter(s => s.batch && s.batch.toLowerCase() === filters.batch.toLowerCase());
        }
        
        if (filters.searchQuery) {
          const query = filters.searchQuery.toLowerCase();
          transformedData = transformedData.filter(s => 
            s.name.toLowerCase().includes(query) || 
            s.email.toLowerCase().includes(query)
          );
        }
        
        if (flagged) {
          transformedData = transformedData.filter(s => s.isTerminated);
        }
        
        if (topPerformers) {
          transformedData.sort((a, b) => b.percentage - a.percentage);
          transformedData = transformedData.slice(0, 10);
        }

        console.log('Filtered data:', transformedData);
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
