// ResultsPage.tsx
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Auth, Result, Assessment } from '@/types/database';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from '@/components/ui/button';
import { CSVLink } from 'react-csv';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from '@/hooks/use-toast';
import { Copy, FileDown, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface AssessmentOption {
  id: string;
  name: string;
}

const ResultsPage = () => {
  const [results, setResults] = useState<Result[]>([]);
  const [users, setUsers] = useState<Auth[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [selectedAssessment, setSelectedAssessment] = useState<string | null>(null);
  const [filteredResults, setFilteredResults] = useState<Result[]>([]);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [nameFilter, setNameFilter] = useState('');
  const [prnFilter, setPrnFilter] = useState('');
  const [assessmentOptions, setAssessmentOptions] = useState<AssessmentOption[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const { data, error } = await supabase
          .from('auth')
          .select('*');

        if (error) {
          console.error('Error fetching users:', error);
        } else {
          setUsers(data || []);
        }
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };

    const fetchAssessments = async () => {
      try {
        const { data, error } = await supabase
          .from('assessments')
          .select('id, name');

        if (error) {
          console.error('Error fetching assessments:', error);
        } else {
          setAssessments(data || []);
          setAssessmentOptions(data ? data.map(assessment => ({ id: assessment.id, name: assessment.name })) : []);
        }
      } catch (error) {
        console.error('Error fetching assessments:', error);
      }
    };

    const fetchResults = async () => {
      try {
        const { data, error } = await supabase
          .from('results')
          .select('*');

        if (error) {
          console.error('Error fetching results:', error);
        } else {
          setResults(data || []);
          setFilteredResults(data || []);
        }
      } catch (error) {
        console.error('Error fetching results:', error);
      }
    };

    fetchUsers();
    fetchAssessments();
    fetchResults();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [selectedAssessment, nameFilter, prnFilter, results]);

  const applyFilters = () => {
    let filtered = [...results];

    if (selectedAssessment) {
      filtered = filtered.filter(result => result.assessment_id === selectedAssessment);
    }

    if (nameFilter) {
      filtered = filtered.filter(result => {
        const user = users.find(user => user.id === result.user_id);
        return user && user.name && user.name.toLowerCase().includes(nameFilter.toLowerCase());
      });
    }

    if (prnFilter) {
      filtered = filtered.filter(result => {
        const user = users.find(user => user.id === result.user_id);
        return user && user.prn && user.prn.toLowerCase().includes(prnFilter.toLowerCase());
      });
    }

    setFilteredResults(filtered);
  };

  const assessmentName = (assessmentId: string) => {
    const assessment = assessments.find(a => a.id === assessmentId);
    return assessment ? assessment.name : 'Unknown Assessment';
  };

  const userName = (userId: string) => {
    const user = users.find(u => u.id === userId);
    return user ? user.name : 'Unknown User';
  };

  const userPRN = (userId: string) => {
    const user = users.find(u => u.id === userId);
    return user ? user.prn : 'Unknown PRN';
  };

  const handleCopyToClipboard = (text: string, message: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: message,
    })
  };

  const csvData = [
    [
      'Assessment Name',
      'User Name',
      'PRN',
      'Total Score',
      'Total Marks',
      'Percentage',
      'Completed At',
    ],
    ...filteredResults.map(result => {
      const assessment = assessments.find(a => a.id === result.assessment_id);
      const user = users.find(u => u.id === result.user_id);
      return [
        assessment?.name || 'N/A',
        user?.name || 'N/A',
        user?.prn || 'N/A',
        result.total_score,
        result.total_marks,
        result.percentage,
        format(new Date(result.completed_at), 'yyyy-MM-dd HH:mm:ss'),
      ];
    }),
  ];

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4">Results</h1>

      <Dialog open={isFilterModalOpen} onOpenChange={setIsFilterModalOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">Filter Results</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Filter Results</DialogTitle>
            <DialogDescription>
              Filter results based on assessment, name, and PRN.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="assessment" className="text-right">
                Assessment
              </Label>
              <Select onValueChange={setSelectedAssessment} defaultValue={selectedAssessment}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select an assessment" />
                </SelectTrigger>
                <SelectContent>
                  {assessmentOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input id="name" value={nameFilter} onChange={(e) => setNameFilter(e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="prn" className="text-right">
                PRN
              </Label>
              <Input id="prn" value={prnFilter} onChange={(e) => setPrnFilter(e.target.value)} className="col-span-3" />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="mt-4">
        <Table>
          <TableCaption>A list of results from all the assessments.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Assessment</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>PRN</TableHead>
              <TableHead>Total Score</TableHead>
              <TableHead>Total Marks</TableHead>
              <TableHead>Percentage</TableHead>
              <TableHead>Completed At</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredResults.map((result) => {
              const assessment = assessments.find(a => a.id === result.assessment_id);
              const user = users.find(u => u.id === result.user_id);

              return (
                <TableRow key={result.id}>
                  <TableCell className="font-medium">{result.contest_name || assessment?.name || "N/A"}</TableCell>
                  <TableCell>{user?.name || 'N/A'}</TableCell>
                  <TableCell>{user?.prn || 'N/A'}</TableCell>
                  <TableCell>{result.total_score}</TableCell>
                  <TableCell>{result.total_marks}</TableCell>
                  <TableCell>{result.percentage}</TableCell>
                  <TableCell>{format(new Date(result.completed_at), 'yyyy-MM-dd HH:mm:ss')}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleCopyToClipboard(result.id, "Result ID copied")}>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy ID
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4">
        <Button disabled={isDownloading} onClick={() => setIsDownloading(true)}>
          <CSVLink
            data={csvData}
            filename={"results.csv"}
            onClick={() => setTimeout(() => setIsDownloading(false), 1000)}
          >
            {isDownloading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                <span>Downloading...</span>
              </>
            ) : (
              <>
                <FileDown className="h-4 w-4 mr-2" />
                Download CSV
              </>
            )}
          </CSVLink>
        </Button>
      </div>
    </div>
  );
};

export default ResultsPage;
