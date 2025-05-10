import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import ResultsTable from '@/components/admin/ResultsTable';

const ResultsPage = () => {
  const [assessmentsData, setAssessmentsData] = useState<any[] | null>(null);
  const [filters, setFilters] = useState({
    assessment: 'all',
    searchQuery: '',
    year: 'all',
    department: 'all',
    division: 'all',
    batch: 'all',
  });
  const [flagged, setFlagged] = useState(false);
  const [topPerformers, setTopPerformers] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchAssessments = async () => {
      try {
        const { data, error } = await supabase
          .from('assessments')
          .select('id, name');

        if (error) {
          console.error('Error fetching assessments:', error);
          toast({
            title: "Error",
            description: "Failed to load assessments",
            variant: "destructive"
          });
        } else {
          setAssessmentsData(data);
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

  const assessmentOptions = [
    { id: 'all', name: 'All Assessments' },
    ...(assessmentsData?.map((assessment: any) => ({
      id: assessment.id,
      name: assessment.name || 'Unnamed Assessment'
    })) || [])
  ];

  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-semibold mb-6">Assessment Results</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div>
          <Label htmlFor="assessment">Assessment</Label>
          <Select onValueChange={(value) => handleFilterChange('assessment', value)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select an assessment" />
            </SelectTrigger>
            <SelectContent>
              {assessmentOptions.map(option => (
                <SelectItem key={option.id} value={option.name}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="search">Search</Label>
          <Input
            type="text"
            id="search"
            placeholder="Search by name or ID..."
            value={filters.searchQuery}
            onChange={(e) => handleFilterChange('searchQuery', e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="year">Year</Label>
          <Select onValueChange={(value) => handleFilterChange('year', value)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select Year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              <SelectItem value="2021">2021</SelectItem>
              <SelectItem value="2022">2022</SelectItem>
              <SelectItem value="2023">2023</SelectItem>
              <SelectItem value="2024">2024</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="department">Department</Label>
          <Select onValueChange={(value) => handleFilterChange('department', value)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              <SelectItem value="Computer">Computer</SelectItem>
              <SelectItem value="IT">IT</SelectItem>
              <SelectItem value="ENTC">ENTC</SelectItem>
              <SelectItem value="Mechanical">Mechanical</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="division">Division</Label>
          <Select onValueChange={(value) => handleFilterChange('division', value)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select Division" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Divisions</SelectItem>
              <SelectItem value="A">A</SelectItem>
              <SelectItem value="B">B</SelectItem>
              <SelectItem value="C">C</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="batch">Batch</Label>
          <Select onValueChange={(value) => handleFilterChange('batch', value)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select Batch" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Batches</SelectItem>
              <SelectItem value="B1">B1</SelectItem>
              <SelectItem value="B2">B2</SelectItem>
              <SelectItem value="B3">B3</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center space-x-2">
          <Label htmlFor="flagged">Flagged</Label>
          <Input
            type="checkbox"
            id="flagged"
            checked={flagged}
            onCheckedChange={(checked) => setFlagged(!!checked)}
          />
        </div>

        <div className="flex items-center space-x-2">
          <Label htmlFor="topPerformers">Top Performers</Label>
          <Input
            type="checkbox"
            id="topPerformers"
            checked={topPerformers}
            onCheckedChange={(checked) => setTopPerformers(!!checked)}
          />
        </div>
      </div>

      <ResultsTable filters={filters} flagged={flagged} topPerformers={topPerformers} />
    </div>
  );
};

export default ResultsPage;
