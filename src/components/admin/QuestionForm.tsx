
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Save, FileUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface QuestionFormProps {
  assessmentId?: string;
  questionId?: string;
}

const QuestionForm: React.FC<QuestionFormProps> = (props) => {
  const { assessmentId: urlAssessmentId, questionId: urlQuestionId } = useParams();
  
  // Use props if provided, otherwise use URL params
  const assessmentId = props.assessmentId || urlAssessmentId;
  const questionId = props.questionId || urlQuestionId;
  
  // State for form
  const [questionType, setQuestionType] = useState<'mcq' | 'code'>('mcq');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mcqOptions, setMcqOptions] = useState([
    { id: '1', text: '', isCorrect: false },
    { id: '2', text: '', isCorrect: false },
    { id: '3', text: '', isCorrect: false },
    { id: '4', text: '', isCorrect: false }
  ]);
  const [codingLanguages, setCodingLanguages] = useState<{
    id: string;
    language: string;
    template: string;
  }[]>([
    { id: '1', language: 'python', template: '# Write your Python code here\n' },
    { id: '2', language: 'javascript', template: '// Write your JavaScript code here\n' }
  ]);
  const [examples, setExamples] = useState([
    { id: '1', input: '', output: '', explanation: '' }
  ]);
  const [testCases, setTestCases] = useState([
    { id: '1', input: '', output: '', marks: 1, isHidden: false }
  ]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  const { toast } = useToast();

  // Define form schema for MCQ
  const mcqFormSchema = z.object({
    title: z.string().min(1, "Title is required"),
    description: z.string().min(1, "Description is required"),
    marks: z.coerce.number().positive("Marks must be positive"),
    orderIndex: z.coerce.number().int().nonnegative("Order must be a non-negative integer")
  });

  // Define form schema for coding questions
  const codeFormSchema = z.object({
    title: z.string().min(1, "Title is required"),
    description: z.string().min(1, "Description is required"),
    marks: z.coerce.number().positive("Marks must be positive"),
    orderIndex: z.coerce.number().int().nonnegative("Order must be a non-negative integer"),
    constraints: z.string().optional() // Fixed: Changed from string[] to string
  });

  // Choose schema based on question type
  const formSchema = questionType === 'mcq' ? mcqFormSchema : codeFormSchema;

  // Set up form
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      marks: 1,
      orderIndex: 0,
      constraints: "" // Initialize as string for code questions
    }
  });

  // Handle file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle MCQ option changes
  const handleOptionChange = (id: string, field: 'text' | 'isCorrect', value: string | boolean) => {
    setMcqOptions(prev => 
      prev.map(option => 
        option.id === id ? { ...option, [field]: value } : option
      )
    );
  };

  // Add new MCQ option
  const addMcqOption = () => {
    const newId = (mcqOptions.length + 1).toString();
    setMcqOptions([...mcqOptions, { id: newId, text: '', isCorrect: false }]);
  };

  // Remove MCQ option
  const removeMcqOption = (id: string) => {
    if (mcqOptions.length <= 2) {
      toast({
        title: "Cannot remove",
        description: "MCQ questions must have at least 2 options",
        variant: "destructive"
      });
      return;
    }
    setMcqOptions(prev => prev.filter(option => option.id !== id));
  };

  // Handle language template changes
  const handleLanguageChange = (id: string, field: 'language' | 'template', value: string) => {
    setCodingLanguages(prev => 
      prev.map(lang => 
        lang.id === id ? { ...id, [field]: value } : lang
      )
    );
  };

  // Add new language
  const addLanguage = () => {
    const newId = (codingLanguages.length + 1).toString();
    setCodingLanguages([...codingLanguages, { 
      id: newId, 
      language: 'java', 
      template: '// Write your Java code here\n' 
    }]);
  };

  // Remove language
  const removeLanguage = (id: string) => {
    if (codingLanguages.length <= 1) {
      toast({
        title: "Cannot remove",
        description: "Coding questions must support at least one language",
        variant: "destructive"
      });
      return;
    }
    setCodingLanguages(prev => prev.filter(lang => lang.id !== id));
  };

  // Handle example changes
  const handleExampleChange = (id: string, field: 'input' | 'output' | 'explanation', value: string) => {
    setExamples(prev => 
      prev.map(example => 
        example.id === id ? { ...example, [field]: value } : example
      )
    );
  };

  // Add new example
  const addExample = () => {
    const newId = (examples.length + 1).toString();
    setExamples([...examples, { id: newId, input: '', output: '', explanation: '' }]);
  };

  // Remove example
  const removeExample = (id: string) => {
    setExamples(prev => prev.filter(example => example.id !== id));
  };

  // Handle test case changes
  const handleTestCaseChange = (
    id: string, 
    field: 'input' | 'output' | 'marks' | 'isHidden', 
    value: string | number | boolean
  ) => {
    setTestCases(prev => 
      prev.map(testCase => 
        testCase.id === id ? { ...testCase, [field]: value } : testCase
      )
    );
  };

  // Add new test case
  const addTestCase = () => {
    const newId = (testCases.length + 1).toString();
    setTestCases([...testCases, { 
      id: newId, 
      input: '', 
      output: '', 
      marks: 1, 
      isHidden: false 
    }]);
  };

  // Remove test case
  const removeTestCase = (id: string) => {
    if (testCases.length <= 1) {
      toast({
        title: "Cannot remove",
        description: "Coding questions must have at least one test case",
        variant: "destructive"
      });
      return;
    }
    setTestCases(prev => prev.filter(testCase => testCase.id !== id));
  };

  // Submit form
  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    try {
      setIsSubmitting(true);
      
      if (!assessmentId) {
        toast({
          title: "Error",
          description: "Assessment ID is required",
          variant: "destructive"
        });
        return;
      }
      
      // Handle constraints for code questions
      let constraints: string[] = [];
      if (questionType === 'code' && typeof data.constraints === 'string') {
        constraints = data.constraints.split('\n').filter(line => line.trim() !== '');
      }
      
      // Upload image if provided
      let imageUrl = null;
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.floor(Math.random() * 1000)}.${fileExt}`;
        const filePath = `question-images/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('assessments')
          .upload(filePath, imageFile);
          
        if (uploadError) {
          throw uploadError;
        }
        
        const { data: urlData } = supabase.storage
          .from('assessments')
          .getPublicUrl(filePath);
          
        imageUrl = urlData.publicUrl;
      }
      
      // Create question based on type
      if (questionType === 'mcq') {
        // Check if at least one option is marked as correct
        const hasCorrectOption = mcqOptions.some(option => option.isCorrect);
        if (!hasCorrectOption) {
          toast({
            title: "Error",
            description: "At least one option must be marked as correct",
            variant: "destructive"
          });
          return;
        }
        
        // Insert MCQ question
        const { data: questionData, error: questionError } = await supabase
          .from('mcq_questions')
          .insert({
            assessment_id: assessmentId,
            title: data.title,
            description: data.description,
            marks: data.marks,
            order_index: data.orderIndex,
            image_url: imageUrl
          })
          .select()
          .single();
          
        if (questionError || !questionData) {
          throw questionError || new Error("Failed to create MCQ question");
        }
        
        // Insert options
        const optionsToInsert = mcqOptions.map((option, index) => ({
          mcq_question_id: questionData.id,
          text: option.text,
          is_correct: option.isCorrect,
          order_index: index
        }));
        
        const { error: optionsError } = await supabase
          .from('mcq_options')
          .insert(optionsToInsert);
          
        if (optionsError) {
          throw optionsError;
        }
        
        toast({
          title: "Success",
          description: "MCQ question created successfully"
        });
      } else {
        // Insert coding question
        const { data: questionData, error: questionError } = await supabase
          .from('coding_questions')
          .insert({
            assessment_id: assessmentId,
            title: data.title,
            description: data.description,
            marks: 0, // Will be calculated from test cases
            order_index: data.orderIndex,
            image_url: imageUrl
          })
          .select()
          .single();
          
        if (questionError || !questionData) {
          throw questionError || new Error("Failed to create coding question");
        }
        
        // Insert languages
        const languagesToInsert = codingLanguages.map(lang => ({
          coding_question_id: questionData.id,
          coding_lang: lang.language,
          solution_template: lang.template,
          constraints: constraints
        }));
        
        const { error: languagesError } = await supabase
          .from('coding_languages')
          .insert(languagesToInsert);
          
        if (languagesError) {
          throw languagesError;
        }
        
        // Insert examples
        const examplesToInsert = examples.filter(ex => ex.input.trim() !== '' || ex.output.trim() !== '')
          .map((example, index) => ({
            coding_question_id: questionData.id,
            input: example.input,
            output: example.output,
            explanation: example.explanation,
            order_index: index
          }));
          
        if (examplesToInsert.length > 0) {
          const { error: examplesError } = await supabase
            .from('coding_examples')
            .insert(examplesToInsert);
            
          if (examplesError) {
            throw examplesError;
          }
        }
        
        // Insert test cases
        const testCasesToInsert = testCases.filter(tc => tc.input.trim() !== '' || tc.output.trim() !== '')
          .map((testCase, index) => ({
            coding_question_id: questionData.id,
            input: testCase.input,
            output: testCase.output,
            marks: testCase.marks,
            is_hidden: testCase.isHidden,
            order_index: index
          }));
          
        if (testCasesToInsert.length > 0) {
          const { error: testCasesError } = await supabase
            .from('test_cases')
            .insert(testCasesToInsert);
            
          if (testCasesError) {
            throw testCasesError;
          }
        }
        
        toast({
          title: "Success",
          description: "Coding question created successfully"
        });
      }
      
      // Reset form
      form.reset();
      setImageFile(null);
      setImagePreview(null);
      setMcqOptions([
        { id: '1', text: '', isCorrect: false },
        { id: '2', text: '', isCorrect: false },
        { id: '3', text: '', isCorrect: false },
        { id: '4', text: '', isCorrect: false }
      ]);
      setCodingLanguages([
        { id: '1', language: 'python', template: '# Write your Python code here\n' },
        { id: '2', language: 'javascript', template: '// Write your JavaScript code here\n' }
      ]);
      setExamples([{ id: '1', input: '', output: '', explanation: '' }]);
      setTestCases([{ id: '1', input: '', output: '', marks: 1, isHidden: false }]);
      
    } catch (error: any) {
      console.error('Error creating question:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create question",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>{questionId ? 'Edit Question' : 'Add New Question'}</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs 
          defaultValue="mcq" 
          value={questionType} 
          onValueChange={(value) => setQuestionType(value as 'mcq' | 'code')}
        >
          <TabsList className="mb-4">
            <TabsTrigger value="mcq">Multiple Choice</TabsTrigger>
            <TabsTrigger value="code">Coding</TabsTrigger>
          </TabsList>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Question Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter question title" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-2 gap-2">
                  <FormField
                    control={form.control}
                    name="marks"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Marks</FormLabel>
                        <FormControl>
                          <Input type="number" min="1" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="orderIndex"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Display Order</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Question Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Describe your question here" 
                        className="min-h-[100px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div>
                <Label>Question Image (Optional)</Label>
                <div className="flex items-center gap-4 mt-2">
                  <Button type="button" variant="outline" onClick={() => document.getElementById('image-upload')?.click()}>
                    <FileUp className="mr-2 h-4 w-4" />
                    Upload Image
                  </Button>
                  <Input 
                    id="image-upload" 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleFileChange}
                  />
                  {imageFile && (
                    <span className="text-sm text-gray-500">{imageFile.name}</span>
                  )}
                </div>
                
                {imagePreview && (
                  <div className="mt-4 border rounded-md p-2">
                    <img 
                      src={imagePreview} 
                      alt="Preview" 
                      className="max-h-[200px] object-contain mx-auto" 
                    />
                  </div>
                )}
              </div>
              
              <TabsContent value="mcq" className="space-y-6 pt-4">
                <div className="space-y-4">
                  <Label>Answer Options</Label>
                  {mcqOptions.map((option) => (
                    <div key={option.id} className="flex items-start gap-2">
                      <Checkbox 
                        id={`correct-${option.id}`}
                        checked={option.isCorrect}
                        onCheckedChange={(checked) => 
                          handleOptionChange(option.id, 'isCorrect', !!checked)
                        }
                      />
                      <div className="flex-1">
                        <Input 
                          placeholder={`Option ${option.id}`}
                          value={option.text}
                          onChange={(e) => handleOptionChange(option.id, 'text', e.target.value)}
                        />
                      </div>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon"
                        onClick={() => removeMcqOption(option.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={addMcqOption}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Option
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="code" className="space-y-6 pt-4">
                {questionType === 'code' && (
                  <>
                    <div className="space-y-4">
                      <Label>Supported Languages</Label>
                      {codingLanguages.map((lang) => (
                        <div key={lang.id} className="grid grid-cols-1 gap-2">
                          <div className="flex items-center gap-2">
                            <Select 
                              value={lang.language} 
                              onValueChange={(value) => handleLanguageChange(lang.id, 'language', value)}
                            >
                              <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Select language" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="python">Python</SelectItem>
                                <SelectItem value="javascript">JavaScript</SelectItem>
                                <SelectItem value="java">Java</SelectItem>
                                <SelectItem value="c">C</SelectItem>
                                <SelectItem value="cpp">C++</SelectItem>
                              </SelectContent>
                            </Select>
                            
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="icon"
                              onClick={() => removeLanguage(lang.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          
                          <Textarea 
                            placeholder="Template code for this language" 
                            className="font-mono text-sm"
                            value={lang.template}
                            onChange={(e) => handleLanguageChange(lang.id, 'template', e.target.value)}
                          />
                        </div>
                      ))}
                      
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={addLanguage}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Language
                      </Button>
                    </div>
                    
                    <FormField
                      control={form.control}
                      name="constraints"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Constraints</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Enter constraints (one per line)" 
                              className="min-h-[100px]"
                              {...field} 
                            />
                          </FormControl>
                          <FormDescription>
                            Enter each constraint on a new line (e.g. "Time limit: 1s", "Memory limit: 256MB")
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="space-y-4">
                      <Label>Examples</Label>
                      {examples.map((example) => (
                        <div key={example.id} className="border rounded-md p-4 space-y-4">
                          <div className="flex justify-between items-center">
                            <h4 className="text-sm font-semibold">Example {example.id}</h4>
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="icon"
                              onClick={() => removeExample(example.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          
                          <div className="space-y-2">
                            <Label className="text-xs">Input</Label>
                            <Textarea 
                              placeholder="Example input" 
                              className="font-mono text-sm"
                              value={example.input}
                              onChange={(e) => handleExampleChange(example.id, 'input', e.target.value)}
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label className="text-xs">Output</Label>
                            <Textarea 
                              placeholder="Expected output" 
                              className="font-mono text-sm"
                              value={example.output}
                              onChange={(e) => handleExampleChange(example.id, 'output', e.target.value)}
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label className="text-xs">Explanation (Optional)</Label>
                            <Textarea 
                              placeholder="Explain the example" 
                              className="text-sm"
                              value={example.explanation}
                              onChange={(e) => handleExampleChange(example.id, 'explanation', e.target.value)}
                            />
                          </div>
                        </div>
                      ))}
                      
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={addExample}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Example
                      </Button>
                    </div>
                    
                    <div className="space-y-4">
                      <Label>Test Cases</Label>
                      {testCases.map((testCase) => (
                        <div key={testCase.id} className="border rounded-md p-4 space-y-4">
                          <div className="flex justify-between items-center">
                            <h4 className="text-sm font-semibold">Test Case {testCase.id}</h4>
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="icon"
                              onClick={() => removeTestCase(testCase.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          
                          <div className="space-y-2">
                            <Label className="text-xs">Input</Label>
                            <Textarea 
                              placeholder="Test input" 
                              className="font-mono text-sm"
                              value={testCase.input}
                              onChange={(e) => handleTestCaseChange(testCase.id, 'input', e.target.value)}
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label className="text-xs">Expected Output</Label>
                            <Textarea 
                              placeholder="Expected output" 
                              className="font-mono text-sm"
                              value={testCase.output}
                              onChange={(e) => handleTestCaseChange(testCase.id, 'output', e.target.value)}
                            />
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-xs">Marks</Label>
                              <Input 
                                type="number" 
                                min="1" 
                                value={testCase.marks}
                                onChange={(e) => handleTestCaseChange(
                                  testCase.id, 
                                  'marks', 
                                  parseInt(e.target.value) || 1
                                )}
                              />
                            </div>
                            
                            <div className="flex items-center gap-2 pt-6">
                              <Checkbox 
                                id={`hidden-${testCase.id}`}
                                checked={testCase.isHidden}
                                onCheckedChange={(checked) => 
                                  handleTestCaseChange(testCase.id, 'isHidden', !!checked)
                                }
                              />
                              <Label htmlFor={`hidden-${testCase.id}`}>Hidden test case</Label>
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={addTestCase}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Test Case
                      </Button>
                    </div>
                  </>
                )}
              </TabsContent>
              
              <Button 
                type="submit" 
                className="w-full bg-astra-red hover:bg-red-600"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Question
                  </>
                )}
              </Button>
            </form>
          </Form>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default QuestionForm;
