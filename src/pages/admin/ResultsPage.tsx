
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Download, FileDown, Filter } from 'lucide-react';
import ResultsTable from '@/components/admin/ResultsTable';
import { useToast } from '@/components/ui/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';

const ResultsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('all');
  const [filters, setFilters] = useState({
    year: '',
    division: '',
    batch: '',
    assessment: '',
    searchQuery: '',
  });
  const [isExporting, setIsExporting] = useState(false);
  const [assessmentCodes, setAssessmentCodes] = useState<{code: string, name: string}[]>([]);
  
  // Fetch assessment codes on component mount
  useEffect(() => {
    const fetchAssessmentCodes = async () => {
      try {
        const { data, error } = await supabase
          .from('assessments')
          .select('code, name')
          .order('name');
        
        if (error) throw error;
        
        if (data) {
          setAssessmentCodes(data);
        }
      } catch (error) {
        console.error('Error fetching assessment codes:', error);
      }
    };
    
    fetchAssessmentCodes();
  }, []);

  const handleFilterChange = (key: string, value: string) => {
    setFilters({
      ...filters,
      [key]: value
    });
  };

  const handleDownloadPDF = () => {
    toast({
      title: "PDF Download",
      description: "The PDF report is being generated and will download shortly.",
    });
  };

  const exportToCSV = async () => {
    try {
      setIsExporting(true);

      // Fetch results data based on current filters
      const { data: submissions, error } = await supabase
        .from('submissions')
        .select(`
          id,
          started_at,
          completed_at,
          assessments(name, code),
          answers(
            question_id,
            marks_obtained,
            is_correct
          )
        `)
        .order('completed_at', { ascending: false });

      if (error) throw error;

      if (!submissions || submissions.length === 0) {
        toast({
          title: "No Data",
          description: "There are no results to export.",
          variant: "destructive",
        });
        setIsExporting(false);
        return;
      }

      // Process data for CSV format
      const csvData = submissions.map(submission => {
        const assessment = submission.assessments;
        const totalObtained = submission.answers?.reduce((sum: number, answer: any) => sum + (answer.marks_obtained || 0), 0) || 0;
        
        return {
          "Assessment": assessment?.name || "Unknown",
          "Code": assessment?.code || "N/A",
          "Start Time": new Date(submission.started_at).toLocaleString(),
          "Completion Time": submission.completed_at ? new Date(submission.completed_at).toLocaleString() : "Incomplete",
          "Score": totalObtained,
          "Questions Answered": submission.answers?.length || 0
        };
      });

      // Convert to CSV
      const headers = Object.keys(csvData[0]);
      const csvContent = [
        headers.join(','),
        ...csvData.map(row => headers.map(header => JSON.stringify(row[header as keyof typeof row])).join(','))
      ].join('\n');

      // Generate and download the file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `assessment_results_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Export Successful",
        description: "Assessment results have been exported to CSV.",
      });
    } catch (error) {
      console.error("CSV export error:", error);
      toast({
        title: "Export Failed",
        description: "There was an error exporting the data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 py-4 px-6 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-astra-red">Yudh</h1>
              <p className="text-sm text-gray-600">Results Dashboard</p>
            </div>
          </div>
          <div>
            <span className="text-sm">Admin: {user?.name}</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
            <h2 className="text-xl font-bold">Student Assessment Results</h2>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="bg-astra-red hover:bg-red-600 text-white">
                  <Download className="h-4 w-4 mr-2" /> Export Data
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleDownloadPDF}>
                  <Download className="h-4 w-4 mr-2" /> PDF Report
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToCSV} disabled={isExporting}>
                  <FileDown className="h-4 w-4 mr-2" /> 
                  {isExporting ? 'Exporting CSV...' : 'CSV Export'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <Filter className="h-4 w-4 mr-2" /> Filter Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div>
                  <Select
                    value={filters.year}
                    onValueChange={(value) => handleFilterChange('year', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Academic Year" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2025">2025</SelectItem>
                      <SelectItem value="2024">2024</SelectItem>
                      <SelectItem value="2023">2023</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Select
                    value={filters.division}
                    onValueChange={(value) => handleFilterChange('division', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Division" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">Division A</SelectItem>
                      <SelectItem value="B">Division B</SelectItem>
                      <SelectItem value="C">Division C</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Select
                    value={filters.batch}
                    onValueChange={(value) => handleFilterChange('batch', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Batch" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="B1">Batch 1</SelectItem>
                      <SelectItem value="B2">Batch 2</SelectItem>
                      <SelectItem value="B3">Batch 3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Select
                    value={filters.assessment}
                    onValueChange={(value) => handleFilterChange('assessment', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Assessment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Assessments</SelectItem>
                      {assessmentCodes.map(item => (
                        <SelectItem key={item.code} value={item.code}>
                          {item.name} ({item.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Input
                    type="text"
                    placeholder="Search by student name or ID"
                    value={filters.searchQuery}
                    onChange={(e) => handleFilterChange('searchQuery', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-3 md:w-[400px]">
              <TabsTrigger value="all">All Results</TabsTrigger>
              <TabsTrigger value="flagged">Flagged</TabsTrigger>
              <TabsTrigger value="top">Top Performers</TabsTrigger>
            </TabsList>
            
            <TabsContent value="all" className="mt-4">
              <ResultsTable 
                filters={filters}
                flagged={false}
                topPerformers={false}
              />
            </TabsContent>
            
            <TabsContent value="flagged" className="mt-4">
              <ResultsTable 
                filters={filters}
                flagged={true}
                topPerformers={false}
              />
            </TabsContent>
            
            <TabsContent value="top" className="mt-4">
              <ResultsTable 
                filters={filters}
                flagged={false}
                topPerformers={true}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default ResultsPage;
