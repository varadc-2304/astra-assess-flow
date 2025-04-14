
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { formatDistanceToNow, format } from 'date-fns';
import { Edit, Eye, Trash2 } from 'lucide-react';
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

const AssessmentList = () => {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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
    if (!confirm("Are you sure you want to delete this assessment? This action cannot be undone.")) {
      return;
    }

    try {
      const { error } = await supabase
        .from('assessments')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setAssessments(assessments.filter(assessment => assessment.id !== id));
      
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
    }
  };

  const editAssessment = (id: string) => {
    navigate(`/admin/assessments/${id}/edit`);
  };

  const viewAssessment = (id: string) => {
    navigate(`/admin/assessments/${id}`);
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
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => viewAssessment(assessment.id)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => editAssessment(assessment.id)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteAssessment(assessment.id)}>
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
    </Card>
  );
};

export default AssessmentList;
