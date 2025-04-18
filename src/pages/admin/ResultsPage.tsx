
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

// Update UserFilters interface to include department
interface UserFilters {
  year: string;
  division: string;
  batch: string;
  department: string;
  assessment: string;
  searchQuery: string;
}

interface AssessmentOption {
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
    department: '',
    assessment: '',
    searchQuery: ''
  });
  const [isExporting, setIsExporting] = useState(false);
  const [assessmentOptions, setAssessmentOptions] = useState<AssessmentOption[]>([]);
  const [years, setYears] = useState<string[]>([]);
  const [divisions, setDivisions] = useState<string[]>([]);
  const [batches, setBatches] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);

  useEffect(() => {
    const fetchAssessmentOptions = async () => {
      try {
        // Fetch all unique contest names from the results table
        const { data: contestNamesData, error: contestNamesError } = await supabase
          .from('results')
          .select('contest_name')
          .not('contest_name', 'is', null)
          .order('contest_name');
        
        if (contestNamesError) throw contestNamesError;
        
        // Also fetch assessment names and codes as backup
        const { data: assessmentsData, error: assessmentsError } = await supabase
          .from('assessments')
          .select('name, code')
          .order('name');
        
        if (assessmentsError) throw assessmentsError;
        
        // Combine unique contest names from results and assessment names
        const uniqueAssessmentOptions = new Map();
        
        // First add contest names from results
        if (contestNamesData) {
          contestNamesData.forEach(item => {
            if (item.contest_name) {
              uniqueAssessmentOptions.set(item.contest_name.toLowerCase(), { name: item.contest_name });
            }
          });
        }
        
        // Then add assessment names as fallback
        if (assessmentsData) {
          assessmentsData.forEach(assessment => {
            const displayName = `${assessment.name} (${assessment.code})`;
            if (!uniqueAssessmentOptions.has(displayName.toLowerCase())) {
              uniqueAssessmentOptions.set(displayName.toLowerCase(), { name: displayName });
            }
          });
        }
        
        // Convert map to array of unique assessment options
        setAssessmentOptions(Array.from(uniqueAssessmentOptions.values()));
      } catch (error) {
        console.error('Error fetching assessment options:', error);
      }
    };

    const fetchUserFilters = async () => {
      try {
        const { data: users, error } = await supabase
          .from('users')
          .select('year, division, batch, department');

        if (error) throw error;

        if (users) {
          const uniqueYears = [...new Set(users.map(user => user.year).filter(Boolean))].sort();
          const uniqueDivisions = [...new Set(users.map(user => user.division).filter(Boolean))].sort();
          const uniqueBatches = [...new Set(users.map(user => user.batch).filter(Boolean))].sort();
          const uniqueDepartments = [...new Set(users.map(user => user.department).filter(Boolean))].sort();

          setYears(uniqueYears);
          setDivisions(uniqueDivisions);
          setBatches(uniqueBatches);
          setDepartments(uniqueDepartments);
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

    fetchAssessmentOptions();
    fetchUserFilters();
  }, [toast]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters({
      ...filters,
      [key]: value
    });
  };

  const exportToCSV = async () => {
    try {
      setIsExporting(true);

      // Fetch results data
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
          isTerminated,
          assessments:assessment_id (name, code)
        `);

      if (resultsError) throw resultsError;
      
      if (!resultsData || resultsData.length === 0) {
        toast({
          title: "No data to export",
          description: "There are no results matching your filter criteria",
          variant: "destructive"
        });
        return;
      }

      // Fetch user data separately
      const userIds = Array.from(new Set(resultsData.map(r => r.user_id)));
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, auth_ID, name, email, year, department, division, batch')
        .in('auth_ID', userIds);
      
      if (usersError) {
        console.error("Error fetching user data:", usersError);
      }
      
      // Create a map of user data for easier lookup
      const userMap: Record<string, UserData> = {};
      if (usersData) {
        usersData.forEach(user => {
          if (user.auth_ID) {
            userMap[user.auth_ID] = user;
          }
        });
      }

      // Combine results with user data
      let combinedData = resultsData.map(result => {
        const userDetails = userMap[result.user_id] || {};
        return {
          ...result,
          userData: userDetails
        };
      });

      // Apply filters
      let filteredResults = combinedData;
      
      if (filters.year) {
        filteredResults = filteredResults.filter(r => r.userData?.year === filters.year);
      }
      
      if (filters.division) {
        filteredResults = filteredResults.filter(r => r.userData?.division === filters.division);
      }
      
      if (filters.batch) {
        filteredResults = filteredResults.filter(r => r.userData?.batch === filters.batch);
      }
      
      if (filters.department) {
        filteredResults = filteredResults.filter(r => r.userData?.department === filters.department);
      }
      
      if (filters.assessment && filters.assessment !== 'all') {
        filteredResults = filteredResults.filter(r => r.assessments?.code === filters.assessment);
      }
      
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        filteredResults = filteredResults.filter(r => 
          (r.userData?.name?.toLowerCase().includes(query) ?? false) || 
          (r.userData?.email?.toLowerCase().includes(query) ?? false)
        );
      }

      // Format data for CSV
      const csvData = filteredResults.map(result => ({
        "Student Name": result.userData?.name || "Unknown",
        "Email": result.userData?.email || "unknown@example.com",
        "Year": result.userData?.year || "N/A",
        "Department": result.userData?.department || "N/A",
        "Division": result.userData?.division || "N/A",
        "Batch": result.userData?.batch || "N/A",
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
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
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

                {/* Department Filter */}
                <div>
                  <Select
                    value={filters.department}
                    onValueChange={(value) => handleFilterChange('department', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map(department => (
                        <SelectItem key={department} value={department}>
                          {department}
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
                      {assessmentOptions.map((item, index) => (
                        <SelectItem key={`${item.name}-${index}`} value={item.name}>
                          {item.name}
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
