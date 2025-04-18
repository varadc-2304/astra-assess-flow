
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
  assessment: string;
  year: string;
  department: string;
  division: string;
  batch: string;
  searchQuery: string;
}

const ResultsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('all');
  const [filters, setFilters] = useState<UserFilters>({
    assessment: 'all',
    year: 'all',
    department: 'all',
    division: 'all',
    batch: 'all',
    searchQuery: ''
  });
  const [isExporting, setIsExporting] = useState(false);
  const [assessmentOptions, setAssessmentOptions] = useState<{ name: string }[]>([]);
  const [yearOptions, setYearOptions] = useState<string[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<string[]>([]);
  const [divisionOptions, setDivisionOptions] = useState<string[]>([]);
  const [batchOptions, setBatchOptions] = useState<string[]>([]);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        // Fetch unique contest names from results table
        const { data: contestNamesData, error: contestNamesError } = await supabase
          .from('results')
          .select('contest_name')
          .not('contest_name', 'is', null)
          .order('contest_name');
        
        if (contestNamesError) {
          console.error('Error fetching contest names:', contestNamesError);
          return;
        }

        // Extract unique assessment names
        const uniqueAssessmentNames = new Set<string>();
        if (contestNamesData) {
          contestNamesData.forEach(item => {
            if (item.contest_name) {
              uniqueAssessmentNames.add(item.contest_name);
            }
          });
        }
        
        // Fetch unique values for other filters from users table
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('year, department, division, batch');

        if (usersError) {
          console.error('Error fetching user details:', usersError);
          return;
        }

        const uniqueYears = new Set<string>();
        const uniqueDepartments = new Set<string>();
        const uniqueDivisions = new Set<string>();
        const uniqueBatches = new Set<string>();

        usersData?.forEach(user => {
          if (user.year) uniqueYears.add(user.year);
          if (user.department) uniqueDepartments.add(user.department);
          if (user.division) uniqueDivisions.add(user.division);
          if (user.batch) uniqueBatches.add(user.batch);
        });

        setAssessmentOptions(Array.from(uniqueAssessmentNames).map(name => ({ name })));
        setYearOptions(Array.from(uniqueYears));
        setDepartmentOptions(Array.from(uniqueDepartments));
        setDivisionOptions(Array.from(uniqueDivisions));
        setBatchOptions(Array.from(uniqueBatches));

      } catch (error) {
        console.error('Error fetching options:', error);
      }
    };

    fetchOptions();
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

      // Fetch results based on filters
      let query = supabase.from('results').select(`
        id,
        user_id,
        assessment_id,
        total_score,
        total_marks,
        percentage,
        completed_at,
        isTerminated,
        contest_name
      `);

      // Apply assessment filter if not set to 'all'
      if (filters.assessment && filters.assessment !== 'all') {
        query = query.eq('contest_name', filters.assessment);
      }

      const { data: resultsData, error: resultsError } = await query;

      if (resultsError) throw resultsError;
      
      if (!resultsData || resultsData.length === 0) {
        toast({
          title: "No data to export",
          description: "There are no results matching your filter criteria",
          variant: "destructive"
        });
        return;
      }

      // Fetch user data for each result
      const csvData = [];
      
      for (const result of resultsData) {
        const { data: userData } = await supabase
          .from('users')
          .select('name, email, department, year, division, batch')
          .eq('auth_ID', result.user_id)
          .single();

        csvData.push({
          "Student Name": userData?.name || "Unknown",
          "Email": userData?.email || "unknown@example.com",
          "Year": userData?.year || "N/A",
          "Department": userData?.department || "N/A",
          "Division": userData?.division || "N/A",
          "Batch": userData?.batch || "N/A",
          "Assessment": result.contest_name || "Unknown",
          "Score": result.total_score,
          "Total Marks": result.total_marks,
          "Percentage": result.percentage,
          "Status": result.isTerminated ? "Terminated" : "Completed",
          "Completion Time": new Date(result.completed_at).toLocaleString()
        });
      }

      // Create and download CSV
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Select
                  value={filters.assessment}
                  onValueChange={(value) => handleFilterChange('assessment', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Assessment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Assessments</SelectItem>
                    {assessmentOptions.map((item, index) => (
                      <SelectItem key={`${item.name}-${index}`} value={item.name}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={filters.year}
                  onValueChange={(value) => handleFilterChange('year', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Years</SelectItem>
                    {yearOptions.map((year) => (
                      <SelectItem key={year} value={year}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={filters.department}
                  onValueChange={(value) => handleFilterChange('department', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departmentOptions.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={filters.division}
                  onValueChange={(value) => handleFilterChange('division', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Division" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Divisions</SelectItem>
                    {divisionOptions.map((div) => (
                      <SelectItem key={div} value={div}>
                        {div}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={filters.batch}
                  onValueChange={(value) => handleFilterChange('batch', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Batch" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Batches</SelectItem>
                    {batchOptions.map((batch) => (
                      <SelectItem key={batch} value={batch}>
                        {batch}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  type="text"
                  placeholder="Search by student name or ID"
                  value={filters.searchQuery}
                  onChange={(e) => handleFilterChange('searchQuery', e.target.value)}
                />
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
