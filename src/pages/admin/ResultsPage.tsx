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

// Add an interface for assessment options
interface AssessmentOption {
  name: string;
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
  const [assessmentOptions, setAssessmentOptions] = useState<AssessmentOption[]>([]);
  const [yearOptions, setYearOptions] = useState<string[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<string[]>([]);
  const [divisionOptions, setDivisionOptions] = useState<string[]>([]);
  const [batchOptions, setBatchOptions] = useState<string[]>([]);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        // Fetch unique assessment names from assessments table
        const { data: assessmentsData, error: assessmentsError } = await supabase
          .from('assessments')
          .select('name')
          .order('name');
        
        if (assessmentsError) {
          console.error('Error fetching assessments:', assessmentsError);
          return;
        }

        // Extract unique assessment names
        const uniqueAssessmentNames = new Set<string>();
        if (assessmentsData) {
          assessmentsData.forEach(item => {
            if (item.name) {
              uniqueAssessmentNames.add(item.name);
            }
          });
        }
        
        // Convert to array of objects with name property
        const assessmentNamesArray = Array.from(uniqueAssessmentNames).map(name => ({ name }));
        setAssessmentOptions(assessmentNamesArray);
        
        // Fetch unique values for other filters from auth table
        const { data: authData, error: authError } = await supabase
          .from('auth')
          .select('year, department, division, batch');

        if (authError) {
          console.error('Error fetching user details:', authError);
          return;
        }

        const uniqueYears = new Set<string>();
        const uniqueDepartments = new Set<string>();
        const uniqueDivisions = new Set<string>();
        const uniqueBatches = new Set<string>();

        authData?.forEach(user => {
          if (user.year) uniqueYears.add(user.year);
          if (user.department) uniqueDepartments.add(user.department);
          if (user.division) uniqueDivisions.add(user.division);
          if (user.batch) uniqueBatches.add(user.batch);
        });

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
      
      // First, fetch all results and apply filters in JS
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
          assessments:assessment_id (
            id,
            name,
            code
          )
        `)
        .order('completed_at', { ascending: false });
        
      if (resultsError) throw resultsError;
      
      if (!resultsData || resultsData.length === 0) {
        toast({
          title: "No data to export",
          description: "There are no results to export",
          variant: "destructive"
        });
        setIsExporting(false);
        return;
      }
        
      // Fetch all users
      const { data: usersData, error: usersError } = await supabase
        .from('auth')
        .select('id, name, email, department, year, division, batch');
        
      if (usersError) throw usersError;
      
      // Create a map of users for quick lookup
      const userMap: Record<string, any> = {};
      if (usersData) {
        usersData.forEach(user => {
          if (user.id) {
            userMap[user.id] = user;
          }
        });
      }
      
      // Process and apply filters to results
      let filteredResults = resultsData.map(result => {
        const user = userMap[result.user_id] || {};
        const assessment = result.assessments || {};
        
        return {
          userId: result.user_id,
          studentName: user.name || 'Unknown',
          email: user.email || 'unknown@example.com',
          year: user.year || 'N/A',
          department: user.department || 'N/A',
          division: user.division || 'N/A',
          batch: user.batch || 'N/A',
          assessmentId: result.assessment_id,
          assessmentName: assessment.name || 'Unnamed Assessment', // Fix TypeScript error here
          score: result.total_score,
          totalMarks: result.total_marks,
          percentage: result.percentage,
          isCheated: result.is_cheated,
          completedAt: result.completed_at
        };
      });
      
      // Apply assessment filter
      if (filters.assessment !== 'all') {
        filteredResults = filteredResults.filter(r => r.assessmentName === filters.assessment);
      }
      
      // Apply year filter
      if (filters.year !== 'all') {
        filteredResults = filteredResults.filter(r => r.year === filters.year);
      }
      
      // Apply department filter
      if (filters.department !== 'all') {
        filteredResults = filteredResults.filter(r => r.department === filters.department);
      }
      
      // Apply division filter
      if (filters.division !== 'all') {
        filteredResults = filteredResults.filter(r => r.division === filters.division);
      }
      
      // Apply batch filter
      if (filters.batch !== 'all') {
        filteredResults = filteredResults.filter(r => r.batch === filters.batch);
      }
      
      // Apply search query filter
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        filteredResults = filteredResults.filter(r => 
          (r.studentName && r.studentName.toLowerCase().includes(query)) || 
          (r.email && r.email.toLowerCase().includes(query)) ||
          (r.userId && r.userId.toLowerCase().includes(query))
        );
      }
      
      // Apply tab filter (flagged or top performers)
      if (activeTab === 'flagged') {
        filteredResults = filteredResults.filter(r => r.isCheated);
      } else if (activeTab === 'top') {
        filteredResults.sort((a, b) => b.percentage - a.percentage);
        filteredResults = filteredResults.slice(0, 10);
      }
      
      if (filteredResults.length === 0) {
        toast({
          title: "No data to export",
          description: "There are no results matching your filter criteria",
          variant: "destructive"
        });
        setIsExporting(false);
        return;
      }
      
      // Format for CSV
      const csvData = filteredResults.map(result => ({
        "Student Name": result.studentName,
        "Email": result.email,
        "Year": result.year,
        "Department": result.department,
        "Division": result.division,
        "Batch": result.batch,
        "Assessment": result.assessmentName,
        "Score": result.score,
        "Total Marks": result.totalMarks,
        "Percentage": result.percentage,
        "Status": result.isCheated ? "Terminated" : "Completed",
        "Completion Time": new Date(result.completedAt).toLocaleString()
      }));

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
              <h1 className="text-2xl font-bold text-astra-red">Yudha</h1>
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
