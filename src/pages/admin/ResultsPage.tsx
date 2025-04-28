
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Download, Flag, Trophy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import ResultsTable from '@/components/admin/ResultsTable';
import RoleGuard from '@/components/RoleGuard';

interface FilterOptions {
  assessment: string;
  searchQuery: string;
}

const ResultsPage = () => {
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    assessment: 'all',
    searchQuery: '',
  });
  const [assessments, setAssessments] = useState<Array<{id: string, name: string}>>([]);
  const [filters, setFilters] = useState<any>({
    year: 'all',
    department: 'all',
    division: 'all',
    batch: 'all',
  });
  const { toast } = useToast();

  useEffect(() => {
    const fetchAssessments = async () => {
      try {
        const { data: assessmentData, error: assessmentError } = await supabase
          .from('assessments')
          .select('id, name');
        
        if (assessmentError) throw assessmentError;
        
        if (assessmentData) {
          const uniqueAssessments = Array.from(new Set(assessmentData.map(a => a.name || 'Unknown')));
          
          setAssessments(
            uniqueAssessments.map((name) => ({
              id: name as string,
              name: name as string,
            }))
          );
        }
        
        // Fetch filter options (years, departments, etc.)
        const { data: authData, error: authError } = await supabase
          .from('auth')
          .select('year, department, division, batch')
          .eq('role', 'student');
        
        if (authError) {
          console.error('Error fetching student data:', authError);
          return;
        }
        
        if (authData) {
          const years = Array.from(new Set(authData.map(s => s.year || 'Unknown'))).filter(Boolean);
          const departments = Array.from(new Set(authData.map(s => s.department || 'Unknown'))).filter(Boolean);
          const divisions = Array.from(new Set(authData.map(s => s.division || 'Unknown'))).filter(Boolean);
          const batches = Array.from(new Set(authData.map(s => s.batch || 'Unknown'))).filter(Boolean);
          
          setFilters({
            year: 'all',
            department: 'all',
            division: 'all',
            batch: 'all',
            yearOptions: ['all', ...years],
            departmentOptions: ['all', ...departments],
            divisionOptions: ['all', ...divisions],
            batchOptions: ['all', ...batches],
          });
        }
      } catch (error) {
        console.error('Error fetching assessments:', error);
        toast({
          title: "Error",
          description: "Failed to load assessments",
          variant: "destructive"
        });
      }
    };
    
    fetchAssessments();
  }, [toast]);

  const handleFilterChange = (key: string, value: string) => {
    setFilterOptions(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleDownloadCSV = async () => {
    try {
      // Fetch the filtered results
      const { data: results, error: resultsError } = await supabase
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
          assessments:assessment_id (name)
        `);
        
      if (resultsError) throw resultsError;
      
      // Fetch user data
      const { data: users, error: usersError } = await supabase
        .from('auth')
        .select('id, name, email, prn, year, department, division, batch');
        
      if (usersError) throw usersError;
      
      // Map user data to results
      interface CsvRow {
        [key: string]: string | number | boolean | null;
      }
      
      const csvData: CsvRow[] = [];
      
      if (results && users) {
        results.forEach((result: any) => {
          const user = users.find((u: any) => u.id === result.user_id) || {};
          
          csvData.push({
            Name: user.name || 'Unknown',
            Email: user.email || 'Unknown',
            PRN: user.prn || 'Unknown',
            Year: user.year || 'Unknown',
            Department: user.department || 'Unknown',
            Division: user.division || 'Unknown',
            Batch: user.batch || 'Unknown',
            Assessment: (result.assessments?.name) || result.contest_name || 'Unknown',
            Score: `${result.total_score}/${result.total_marks}`,
            Percentage: `${result.percentage}%`,
            CompletedAt: new Date(result.completed_at).toLocaleString(),
            Flagged: result.is_cheated ? 'Yes' : 'No'
          });
        });
      }
      
      // Filter the data based on current filters
      let filteredData = [...csvData];
      
      if (filterOptions.assessment !== 'all') {
        filteredData = filteredData.filter(row => row.Assessment === filterOptions.assessment);
      }
      
      if (filterOptions.searchQuery) {
        const query = filterOptions.searchQuery.toLowerCase();
        filteredData = filteredData.filter(row => {
          return (
            String(row.Name).toLowerCase().includes(query) ||
            String(row.Email).toLowerCase().includes(query) ||
            String(row.PRN).toLowerCase().includes(query)
          );
        });
      }
      
      // Convert to CSV
      if (filteredData.length > 0) {
        const headers = Object.keys(filteredData[0] || {}).join(',');
        const rows = filteredData.map(row => {
          return Object.values(row).map(value => {
            // Wrap strings in quotes and handle special characters
            if (typeof value === 'string') {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          }).join(',');
        });
        
        const csv = [headers, ...rows].join('\n');
        
        // Create download link
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', 'assessment_results.csv');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        toast({
          title: "Success",
          description: "Results downloaded successfully",
        });
      } else {
        toast({
          title: "No Data",
          description: "No results to download with the current filters",
        });
      }
    } catch (error) {
      console.error('Error downloading results:', error);
      toast({
        title: "Error",
        description: "Failed to download results",
        variant: "destructive"
      });
    }
  };

  return (
    <RoleGuard allowedRole="admin">
      <div className="container py-8">
        <h1 className="text-3xl font-bold mb-6">Assessment Results</h1>
        
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Filter Results</CardTitle>
              <CardDescription>
                Filter assessment results by various criteria
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="assessment">Assessment</Label>
                  <Select 
                    value={filterOptions.assessment}
                    onValueChange={(value) => handleFilterChange('assessment', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Assessment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Assessments</SelectItem>
                      {assessments.map((assessment) => (
                        <SelectItem key={assessment.id} value={assessment.name}>
                          {assessment.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="search">Search</Label>
                  <Input 
                    id="search"
                    placeholder="Search by name, email, PRN..."
                    value={filterOptions.searchQuery}
                    onChange={(e) => handleFilterChange('searchQuery', e.target.value)}
                  />
                </div>
                
                <div className="lg:col-span-2 flex items-end justify-end space-x-2">
                  <Button 
                    variant="outline" 
                    className="flex items-center"
                    onClick={handleDownloadCSV}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Tabs defaultValue="all">
            <TabsList className="mb-4">
              <TabsTrigger value="all">All Results</TabsTrigger>
              <TabsTrigger value="flagged" className="flex items-center">
                <Flag className="h-4 w-4 mr-1" />
                Flagged
              </TabsTrigger>
              <TabsTrigger value="top" className="flex items-center">
                <Trophy className="h-4 w-4 mr-1" />
                Top Performers
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="all">
              <ResultsTable 
                filters={filterOptions} 
                flagged={false} 
                topPerformers={false} 
              />
            </TabsContent>
            
            <TabsContent value="flagged">
              <ResultsTable 
                filters={filterOptions} 
                flagged={true}
                topPerformers={false}
              />
            </TabsContent>
            
            <TabsContent value="top">
              <ResultsTable 
                filters={filterOptions} 
                flagged={false}
                topPerformers={true}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </RoleGuard>
  );
};

export default ResultsPage;
