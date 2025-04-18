import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, FileDown, Filter } from 'lucide-react';
import ResultsTable from '@/components/admin/ResultsTable';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UserFilters {
  year: string;
  division: string;
  batch: string;
  assessment: string;
  searchQuery: string;
}

interface AssessmentCode {
  code: string;
  name: string;
}

interface UserData {
  id?: string;
  auth_ID?: string;
  name?: string;
  email?: string;
  year?: string;
  department?: string;
  division?: string;
  batch?: string;
}

interface AssessmentData {
  name?: string;
  code?: string;
}

interface ResultData {
  id: string;
  user_id: string;
  assessment_id: string;
  total_score: number;
  total_marks: number;
  percentage: number;
  completed_at: string;
  isTerminated?: boolean;
  users?: UserData;
  assessments?: AssessmentData;
}

const ResultsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('all');
  const [filters, setFilters] = useState<UserFilters>({
    year: '',
    division: '',
    batch: '',
    assessment: '',
    searchQuery: ''
  });
  const [isExporting, setIsExporting] = useState(false);
  const [assessmentCodes, setAssessmentCodes] = useState<AssessmentCode[]>([]);
  const [years, setYears] = useState<string[]>([]);
  const [divisions, setDivisions] = useState<string[]>([]);
  const [batches, setBatches] = useState<string[]>([]);

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

    const fetchUserFilters = async () => {
      try {
        const { data: users, error } = await supabase
          .from('users')
          .select('year, division, batch');

        if (error) throw error;

        if (users) {
          const uniqueYears = [...new Set(users.map(user => user.year).filter(Boolean))].sort();
          const uniqueDivisions = [...new Set(users.map(user => user.division).filter(Boolean))].sort();
          const uniqueBatches = [...new Set(users.map(user => user.batch).filter(Boolean))].sort();

          setYears(uniqueYears);
          setDivisions(uniqueDivisions);
          setBatches(uniqueBatches);
        }
      } catch (error) {
        console.error('Error fetching user filters:', error);
        toast({
          title: "Error",
          description: "Failed to load filter options",
          variant: "destructive"
        });
      }
    };

    fetchAssessmentCodes();
    fetchUserFilters();
  }, []);

  const handleFilterChange = (key: string, value: string) => {
    setFilters({
      ...filters,
      [key]: value
    });
  };

  const exportToCSV = async () => {
    try {
      setIsExporting(true);

      const { data: resultsData, error } = await supabase
        .from('results')
        .select(`
          *,
          assessments:assessment_id (name, code),
          users:user_id (id, name, email, year, department, division, batch)
        `);

      if (error) throw error;
      
      if (!resultsData || resultsData.length === 0) {
        toast({
          title: "No data to export",
          description: "There are no results matching your filter criteria",
          variant: "destructive"
        });
        return;
      }

      let filteredResults = resultsData as unknown as ResultData[];
      
      if (filters.year) {
        filteredResults = filteredResults.filter(r => r.users?.year === filters.year);
      }
      
      if (filters.division) {
        filteredResults = filteredResults.filter(r => r.users?.division === filters.division);
      }
      
      if (filters.batch) {
        filteredResults = filteredResults.filter(r => r.users?.batch === filters.batch);
      }
      
      if (filters.assessment && filters.assessment !== 'all') {
        filteredResults = filteredResults.filter(r => r.assessments?.code === filters.assessment);
      }
      
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        filteredResults = filteredResults.filter(r => 
          (r.users?.name?.toLowerCase().includes(query) ?? false) || 
          (r.users?.email?.toLowerCase().includes(query) ?? false)
        );
      }

      const csvData = filteredResults.map(result => ({
        "Student Name": result.users?.name || "Unknown",
        "Email": result.users?.email || "unknown@example.com",
        "Year": result.users?.year || "N/A",
        "Department": result.users?.department || "N/A",
        "Division": result.users?.division || "N/A",
        "Batch": result.users?.batch || "N/A",
        "Assessment": result.assessments?.name || "Unknown",
        "Assessment Code": result.assessments?.code || "N/A",
        "Score": result.total_score,
        "Total Marks": result.total_marks,
        "Percentage": result.percentage,
        "Status": result.isTerminated ? "Terminated" : "Completed",
        "Completion Time": new Date(result.completed_at).toLocaleString()
      }));

      if (csvData.length === 0) {
        toast({
          title: "No data to export",
          description: "There are no results matching your filter criteria",
          variant: "destructive"
        });
        return;
      }

      const headers = Object.keys(csvData[0]);
      const csvContent = [
        headers.join(','),
        ...csvData.map(row => headers.map(header => 
          JSON.stringify(row[header as keyof typeof row])
        ).join(','))
      ].join('\n');

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
        title: "Success",
        description: "Results exported successfully",
      });

    } catch (error) {
      console.error("CSV export error:", error);
      toast({
        title: "Error",
        description: "Failed to export results",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
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
          <div className="flex items-center gap-4">
            <span className="text-sm">Admin: {user?.name}</span>
            <Button 
              onClick={exportToCSV} 
              disabled={isExporting}
              className="bg-astra-red hover:bg-red-600 text-white"
            >
              <FileDown className="h-4 w-4 mr-2" />
              {isExporting ? 'Exporting...' : 'Export to CSV'}
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
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
                      {years.map(year => (
                        <SelectItem key={year} value={year}>
                          {year}
                        </SelectItem>
                      ))}
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
                      {divisions.map(division => (
                        <SelectItem key={division} value={division}>
                          Division {division}
                        </SelectItem>
                      ))}
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
                      {batches.map(batch => (
                        <SelectItem key={batch} value={batch}>
                          {batch}
                        </SelectItem>
                      ))}
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
