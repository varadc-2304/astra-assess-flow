
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import ResultsTable from '@/components/admin/ResultsTable';
import { Loader2 } from 'lucide-react';

const ResultsPage = () => {
  const [assessments, setAssessments] = useState<{ id: string; name: string }[]>([]);
  const [years, setYears] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [divisions, setDivisions] = useState<string[]>([]);
  const [batches, setBatches] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [filters, setFilters] = useState({
    assessment: '',
    searchQuery: '',
    year: '',
    department: '',
    division: '',
    batch: ''
  });
  
  const [flagged, setFlagged] = useState(false);
  const [topPerformers, setTopPerformers] = useState(false);
  
  useEffect(() => {
    const fetchFilters = async () => {
      setIsLoading(true);
      try {
        // Fetch assessment names
        const { data: assessmentsData, error: assessmentsError } = await supabase
          .from('assessments')
          .select('id, name')
          .order('created_at', { ascending: false });
          
        if (assessmentsError) throw assessmentsError;
        setAssessments(assessmentsData || []);
        
        // Fetch user metadata for filters
        const { data: usersData, error: usersError } = await supabase
          .from('auth')
          .select('year, department, division, batch');
          
        if (usersError) throw usersError;
        
        // Extract unique values for each filter
        const uniqueYears = new Set<string>();
        const uniqueDepartments = new Set<string>();
        const uniqueDivisions = new Set<string>();
        const uniqueBatches = new Set<string>();
        
        (usersData || []).forEach(user => {
          if (user && user.year) uniqueYears.add(user.year);
          if (user && user.department) uniqueDepartments.add(user.department);
          if (user && user.division) uniqueDivisions.add(user.division);
          if (user && user.batch) uniqueBatches.add(user.batch);
        });
        
        setYears(Array.from(uniqueYears).sort());
        setDepartments(Array.from(uniqueDepartments).sort());
        setDivisions(Array.from(uniqueDivisions).sort());
        setBatches(Array.from(uniqueBatches).sort());
        
      } catch (error) {
        console.error('Error fetching filter data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchFilters();
  }, []);
  
  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };
  
  const clearFilters = () => {
    setFilters({
      assessment: '',
      searchQuery: '',
      year: '',
      department: '',
      division: '',
      batch: ''
    });
    setFlagged(false);
    setTopPerformers(false);
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-2">Assessment Results</h1>
        <p className="text-gray-600 dark:text-gray-400">View and analyze student performance</p>
      </div>
      
      <Tabs defaultValue="all">
        <TabsList className="mb-6">
          <TabsTrigger value="all">All Results</TabsTrigger>
          <TabsTrigger value="flagged">Flagged Students</TabsTrigger>
          <TabsTrigger value="top">Top Performers</TabsTrigger>
        </TabsList>
        
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="assessment">Assessment</Label>
                <Select 
                  value={filters.assessment} 
                  onValueChange={(value) => handleFilterChange('assessment', value)}
                >
                  <SelectTrigger id="assessment">
                    <SelectValue placeholder="All Assessments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Assessments</SelectItem>
                    {assessments.map((assessment) => (
                      <SelectItem key={assessment.id} value={assessment.name || ''}>
                        {assessment.name || 'Unnamed Assessment'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="search">Search</Label>
                <Input 
                  id="search" 
                  placeholder="Search by name or email" 
                  value={filters.searchQuery}
                  onChange={(e) => handleFilterChange('searchQuery', e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="year">Year</Label>
                <Select 
                  value={filters.year} 
                  onValueChange={(value) => handleFilterChange('year', value)}
                >
                  <SelectTrigger id="year">
                    <SelectValue placeholder="All Years" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Years</SelectItem>
                    {years.map((year) => (
                      <SelectItem key={year} value={year}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Select 
                  value={filters.department} 
                  onValueChange={(value) => handleFilterChange('department', value)}
                >
                  <SelectTrigger id="department">
                    <SelectValue placeholder="All Departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Departments</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="division">Division</Label>
                <Select 
                  value={filters.division} 
                  onValueChange={(value) => handleFilterChange('division', value)}
                >
                  <SelectTrigger id="division">
                    <SelectValue placeholder="All Divisions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Divisions</SelectItem>
                    {divisions.map((div) => (
                      <SelectItem key={div} value={div}>{div}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="batch">Batch</Label>
                <Select 
                  value={filters.batch} 
                  onValueChange={(value) => handleFilterChange('batch', value)}
                >
                  <SelectTrigger id="batch">
                    <SelectValue placeholder="All Batches" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Batches</SelectItem>
                    {batches.map((batch) => (
                      <SelectItem key={batch} value={batch}>{batch}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <TabsContent value="all">
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-astra-red" />
            </div>
          ) : (
            <ResultsTable filters={filters} flagged={false} topPerformers={false} />
          )}
        </TabsContent>
        
        <TabsContent value="flagged">
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-astra-red" />
            </div>
          ) : (
            <ResultsTable filters={filters} flagged={true} topPerformers={false} />
          )}
        </TabsContent>
        
        <TabsContent value="top">
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-astra-red" />
            </div>
          ) : (
            <ResultsTable filters={filters} flagged={false} topPerformers={true} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ResultsPage;
