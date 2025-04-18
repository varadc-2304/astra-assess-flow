
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
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { formatDate } from '@/lib/utils';

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
  const [students, setStudents] = useState<any[]>([]);
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
        // Get all results
        const { data: resultsData, error: resultsError } = await supabase
          .from('results')
          .select(`
            *,
            assessments:assessment_id (
              name,
              code
            ),
            submissions:assessment_id (
              is_terminated
            )
          `)
          .order('completed_at', { ascending: false });
        
        if (resultsError) throw resultsError;
        
        if (!resultsData || resultsData.length === 0) {
          setStudents([]);
          setIsLoading(false);
          return;
        }

        // Fetch user details
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, name, email, auth_ID');
        
        if (usersError) {
          console.error('Error fetching user details:', usersError);
          return;
        }
        
        // Create user map for lookup
        const userMap = usersData?.reduce((acc: any, user) => {
          acc[user.auth_ID] = user;
          return acc;
        }, {});

        // Get submission status for each result
        const submissionPromises = resultsData.map(result => 
          supabase
            .from('submissions')
            .select('is_terminated')
            .eq('user_id', result.user_id)
            .eq('assessment_id', result.assessment_id)
            .maybeSingle()
        );
        
        const submissionsResults = await Promise.all(submissionPromises);
        
        // Transform the data
        let transformedData = resultsData.map((result, index) => {
          const userDetails = userMap[result.user_id] || { name: 'Unknown User', email: 'unknown@example.com' };
          const assessment = result.assessments;
          const submissionData = submissionsResults[index].data;
          
          return {
            name: userDetails.name,
            email: userDetails.email,
            assessmentName: assessment?.name || 'Unknown Assessment',
            score: result.total_score,
            totalMarks: result.total_marks,
            percentage: result.percentage,
            completedAt: result.completed_at,
            isTerminated: submissionData?.is_terminated || false,
          };
        });
        
        // Apply filters
        if (filters.searchQuery) {
          const query = filters.searchQuery.toLowerCase();
          transformedData = transformedData.filter(s => 
            s.name.toLowerCase().includes(query) || 
            s.email.toLowerCase().includes(query)
          );
        }
        
        if (filters.assessment && filters.assessment !== 'all') {
          transformedData = transformedData.filter(s => 
            s.assessmentName.toLowerCase().includes(filters.assessment.toLowerCase())
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
                    key={`${student.name}-${index}`}
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
