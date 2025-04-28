
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ResultsTable from '@/components/admin/ResultsTable';
import { supabase } from '@/integrations/supabase/client';
import { Assessment, Result } from '@/types/database';

type UserExportData = {
  name: string;
  email: string;
  prn: string;
  year: string;
  department: string;
  division: string;
  batch: string;
  assessment: string;
  score: number;
  totalMarks: number;
  percentage: number;
  completedAt: string;
  wasCheating: boolean;
};

const ResultsPage = () => {
  const [assessments, setAssessments] = useState<{id: string, name: string}[]>([]);
  const [selectedAssessment, setSelectedAssessment] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFlagged, setShowFlagged] = useState(false);
  const [exportData, setExportData] = useState<UserExportData[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const fetchAssessments = async () => {
      try {
        const { data, error } = await supabase
          .from('assessments')
          .select('id, name, code');
        
        if (error) throw error;
        
        if (data) {
          setAssessments(data.map(assessment => ({
            id: assessment.id,
            name: assessment.name
          })));
        }
      } catch (error) {
        console.error('Error fetching assessments:', error);
      }
    };
    
    fetchAssessments();
  }, []);

  const handleExportCSV = async () => {
    setIsExporting(true);
    
    try {
      // Fetch results
      const { data: resultsData, error: resultsError } = await supabase
        .from('results')
        .select(`
          user_id,
          assessment_id,
          total_score,
          total_marks,
          percentage,
          completed_at,
          is_cheated,
          contest_name,
          assessments:assessment_id (
            name
          )
        `);
      
      if (resultsError) throw resultsError;
      
      if (!resultsData || resultsData.length === 0) {
        console.log('No results found');
        setIsExporting(false);
        return;
      }
      
      // Fetch user details
      const userIds = [...new Set(resultsData.map(r => r.user_id))];
      
      const { data: usersData, error: usersError } = await supabase
        .from('auth')
        .select('id, name, email, prn, year, department, division, batch');
      
      if (usersError) throw usersError;
      
      const userMap: Record<string, any> = {};
      if (usersData) {
        usersData.forEach(user => {
          if (user.id) {
            userMap[user.id] = user;
          }
        });
      }
      
      // Process data for export
      const exportItems = resultsData.map((result: any) => {
        const user = userMap[result.user_id] || {};
        const assessmentName = result.contest_name || 
                              (result.assessments ? result.assessments.name : 'Unknown Assessment');
        
        return {
          name: user.name || 'Unknown',
          email: user.email || 'unknown@example.com',
          prn: user.prn || 'Unknown',
          year: user.year || 'Unknown',
          department: user.department || 'Unknown',
          division: user.division || 'Unknown',
          batch: user.batch || 'Unknown',
          assessment: assessmentName,
          score: result.total_score || 0,
          totalMarks: result.total_marks || 0,
          percentage: result.percentage || 0,
          completedAt: result.completed_at || '',
          wasCheating: result.is_cheated || false
        };
      });
      
      setExportData(exportItems);
      
      // Generate & download CSV
      const headers = [
        'Name', 'Email', 'PRN', 'Year', 'Department', 'Division', 'Batch',
        'Assessment', 'Score', 'Total Marks', 'Percentage', 'Completed At', 'Flagged'
      ];
      
      let csvContent = headers.join(',') + '\n';
      
      exportItems.forEach(item => {
        const row = [
          `"${item.name}"`,
          `"${item.email}"`,
          `"${item.prn}"`,
          `"${item.year}"`,
          `"${item.department}"`,
          `"${item.division}"`,
          `"${item.batch}"`,
          `"${item.assessment}"`,
          item.score,
          item.totalMarks,
          item.percentage,
          `"${item.completedAt}"`,
          item.wasCheating ? 'Yes' : 'No'
        ];
        
        csvContent += row.join(',') + '\n';
      });
      
      // Create download link
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `assessment-results-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error exporting results:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Assessment Results</h1>
        <p className="text-gray-500">View and export student assessment results</p>
      </div>

      <Tabs defaultValue="results">
        <TabsList className="mb-6">
          <TabsTrigger value="results">Results Dashboard</TabsTrigger>
          <TabsTrigger value="export">Export Data</TabsTrigger>
        </TabsList>
        
        <TabsContent value="results">
          <Card>
            <CardHeader>
              <CardTitle>Results</CardTitle>
              <CardDescription>
                View student performance across all assessments
              </CardDescription>
              <div className="flex flex-col lg:flex-row gap-4 mt-4">
                <div className="flex-1">
                  <Select 
                    value={selectedAssessment} 
                    onValueChange={setSelectedAssessment}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select assessment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Assessments</SelectItem>
                      {assessments.map(assessment => (
                        <SelectItem key={assessment.id} value={assessment.name}>
                          {assessment.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex-1">
                  <Input 
                    placeholder="Search by name or email" 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch 
                    id="flagged" 
                    checked={showFlagged} 
                    onCheckedChange={setShowFlagged} 
                  />
                  <Label htmlFor="flagged">Show only flagged</Label>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ResultsTable 
                filters={{ assessment: selectedAssessment, searchQuery }} 
                flagged={showFlagged}
                topPerformers={false}
              />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="export">
          <Card>
            <CardHeader>
              <CardTitle>Export Results</CardTitle>
              <CardDescription>
                Download results data in CSV format
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-500">
                  Export includes student details, assessment scores, and timestamps
                </p>
                <Button 
                  onClick={handleExportCSV}
                  disabled={isExporting}
                >
                  {isExporting ? 'Exporting...' : 'Export to CSV'}
                </Button>
              </div>
            </CardContent>
          </Card>
          
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Top Performers</CardTitle>
              <CardDescription>
                View the highest scoring students across all assessments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResultsTable 
                filters={{ assessment: 'all', searchQuery: '' }} 
                flagged={false}
                topPerformers={true}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ResultsPage;
