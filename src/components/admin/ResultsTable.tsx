
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
import { useToast } from '@/hooks/use-toast';
import { Flag } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDate } from '@/lib/utils';
import { Auth, Result } from '@/types/database';

interface ResultsTableProps {
  filters: {
    assessment: string;
    searchQuery: string;
  };
  flagged: boolean;
  topPerformers: boolean;
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

const ResultsTable: React.FC<ResultsTableProps> = ({ filters, flagged, topPerformers }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchResults = async () => {
      setIsLoading(true);
      try {
        const { data: resultsData, error: resultsError } = await supabase
          .from('results')
          .select(`
            id,
            user_id,
            assessment_id,
            total_score,
            total_marks,
            percentage,
            completed_at,
            is_cheated,
            contest_name,
            assessments:assessment_id (
              id,
              name,
              code
            )
          `);
        
        if (resultsError) throw resultsError;
        
        if (!resultsData || resultsData.length === 0) {
          setStudents([]);
          setIsLoading(false);
          return;
        }
        
        const userIds = [...new Set(resultsData.map(result => result.user_id))];
        
        const { data: usersData, error: usersError } = await supabase
          .from('auth')
          .select('id, name, email, role, year, department, division, batch');
        
        if (usersError) {
          console.error('Error fetching user details:', usersError);
        }
        
        const userMap: Record<string, Partial<Auth>> = {};
        if (usersData) {
          usersData.forEach(user => {
            if (user.id) {
              userMap[user.id] = user;
            }
          });
        }
        
        let transformedData: Student[] = [];
        
        if (resultsData) {
          transformedData = resultsData.map((result: any) => {
            const userDetails = userMap[result.user_id] || {};
            const assessment = result.assessments;
            const assessmentName = result.contest_name || (assessment?.name || 'Unknown Assessment');
            
            const userName = userDetails?.name || 'Unknown User';
            const userEmail = userDetails?.email || 'unknown@example.com';
            
            let division = userDetails?.division || 'Unknown';
            let batch = userDetails?.batch || 'Unknown';
            let year = userDetails?.year || 'Unknown';
            
            return {
              id: result.user_id,
              name: userName,
              email: userEmail,
              assessmentId: result.assessment_id,
              assessmentName,
              score: result.total_score,
              totalMarks: result.total_marks,
              percentage: result.percentage,
              completedAt: result.completed_at,
              isTerminated: result.is_cheated || false,
              division,
              batch,
              year
            };
          });
        }
        
        if (filters.assessment && filters.assessment !== 'all') {
          transformedData = transformedData.filter(s => s.assessmentName === filters.assessment);
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
              {students.map((student, index) => (
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
      )}
    </div>
  );
};

export default ResultsTable;
