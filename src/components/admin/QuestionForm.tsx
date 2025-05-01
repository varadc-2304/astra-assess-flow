
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, Trash2, Plus, Image } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

// Form schema for question
const questionFormSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().min(5, 'Description must be at least 5 characters'),
  marks: z.number().min(1, 'Marks must be at least 1'),
  type: z.enum(['mcq', 'code']),
});

type QuestionFormValues = z.infer<typeof questionFormSchema>;

interface MCQOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

interface CodingLanguage {
  language: string;
  template: string;
  constraints: string[];
}

interface CodingExample {
  input: string;
  output: string;
  explanation: string;
}

interface TestCase {
  input: string;
  output: string;
  marks: number;
  isHidden: boolean;
}

interface QuestionFormProps {
  assessmentId?: string;
  questionId?: string;
}

const QuestionForm: React.FC<QuestionFormProps> = (props) => {
  // Get the assessment ID and question ID from URL parameters
  const { assessmentId: urlAssessmentId, questionId: urlQuestionId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Use props if provided, otherwise use URL params
  const assessmentId = props.assessmentId || urlAssessmentId;
  const questionId = props.questionId || urlQuestionId;
  
  // State for MCQ options
  const [options, setOptions] = useState<MCQOption[]>([
    { id: '1', text: '', isCorrect: false },
    { id: '2', text: '', isCorrect: false },
  ]);

  // State for coding languages
  const [languages, setLanguages] = useState<CodingLanguage[]>([
    { language: 'python', template: '# Write your solution here', constraints: [] },
  ]);

  // State for coding examples
  const [examples, setExamples] = useState<CodingExample[]>([
    { input: '', output: '', explanation: '' },
  ]);

  // State for test cases
  const [testCases, setTestCases] = useState<TestCase[]>([
    { input: '', output: '', marks: 1, isHidden: false },
  ]);

  // Image upload state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form
  const form = useForm<QuestionFormValues>({
    resolver: zodResolver(questionFormSchema),
    defaultValues: {
      title: '',
      description: '',
      marks: 1,
      type: 'mcq',
    },
  });

  // Function to add an MCQ option
  const addOption = () => {
    setOptions([
      ...options, 
      { 
        id: `${options.length + 1}`, 
        text: '', 
        isCorrect: false 
      },
    ]);
  };

  // Function to remove an MCQ option
  const removeOption = (index: number) => {
    if (options.length <= 2) {
      toast({
        title: "Cannot remove option",
        description: "MCQ questions require at least 2 options",
        variant: "destructive",
      });
      return;
    }
    const newOptions = [...options];
    newOptions.splice(index, 1);
    setOptions(newOptions);
  };

  // Function to handle option text change
  const handleOptionTextChange = (index: number, text: string) => {
    const newOptions = [...options];
    newOptions[index].text = text;
    setOptions(newOptions);
  };

  // Function to handle option correct selection
  const handleOptionCorrectChange = (index: number) => {
    const newOptions = options.map((option, idx) => ({
      ...option,
      isCorrect: idx === index,
    }));
    setOptions(newOptions);
  };

  // Function to add a coding language
  const addLanguage = () => {
    setLanguages([
      ...languages,
      { language: '', template: '', constraints: [] },
    ]);
  };

  // Function to remove a coding language
  const removeLanguage = (index: number) => {
    if (languages.length <= 1) {
      toast({
        title: "Cannot remove language",
        description: "Coding questions require at least one language",
        variant: "destructive",
      });
      return;
    }
    const newLanguages = [...languages];
    newLanguages.splice(index, 1);
    setLanguages(newLanguages);
  };

  // Function to handle language change
  const handleLanguageChange = (index: number, field: keyof CodingLanguage, value: string) => {
    const newLanguages = [...languages];
    newLanguages[index][field] = value;
    setLanguages(newLanguages);
  };

  // Function to add a coding example
  const addExample = () => {
    setExamples([
      ...examples,
      { input: '', output: '', explanation: '' },
    ]);
  };

  // Function to remove a coding example
  const removeExample = (index: number) => {
    if (examples.length <= 1) {
      toast({
        title: "Cannot remove example",
        description: "Coding questions require at least one example",
        variant: "destructive",
      });
      return;
    }
    const newExamples = [...examples];
    newExamples.splice(index, 1);
    setExamples(newExamples);
  };

  // Function to handle example change
  const handleExampleChange = (index: number, field: keyof CodingExample, value: string) => {
    const newExamples = [...examples];
    newExamples[index][field] = value;
    setExamples(newExamples);
  };

  // Function to add a test case
  const addTestCase = () => {
    setTestCases([
      ...testCases,
      { input: '', output: '', marks: 1, isHidden: false },
    ]);
  };

  // Function to remove a test case
  const removeTestCase = (index: number) => {
    if (testCases.length <= 1) {
      toast({
        title: "Cannot remove test case",
        description: "Coding questions require at least one test case",
        variant: "destructive",
      });
      return;
    }
    const newTestCases = [...testCases];
    newTestCases.splice(index, 1);
    setTestCases(newTestCases);
  };

  // Function to handle test case change
  const handleTestCaseChange = (index: number, field: keyof TestCase, value: any) => {
    const newTestCases = [...testCases];
    newTestCases[index][field] = value;
    setTestCases(newTestCases);
  };

  // Function to handle image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      
      const reader = new FileReader();
      reader.onload = (event) => {
        setImagePreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Function to remove image
  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  // Function to handle form submission
  const onSubmit = async (data: QuestionFormValues) => {
    if (!assessmentId) {
      toast({
        title: "Error",
        description: "Assessment ID is required",
        variant: "destructive",
      });
      return;
    }

    if (data.type === 'mcq') {
      // Validate MCQ options
      if (!options.some(option => option.isCorrect)) {
        toast({
          title: "Error",
          description: "Please select a correct answer",
          variant: "destructive",
        });
        return;
      }

      if (options.some(option => option.text.trim() === '')) {
        toast({
          title: "Error",
          description: "All options must have text",
          variant: "destructive",
        });
        return;
      }
    } else {
      // Validate coding question
      if (languages.some(lang => lang.language.trim() === '' || lang.template.trim() === '')) {
        toast({
          title: "Error",
          description: "All languages must have a name and template",
          variant: "destructive",
        });
        return;
      }

      if (examples.some(ex => ex.input.trim() === '' || ex.output.trim() === '')) {
        toast({
          title: "Error",
          description: "All examples must have input and output",
          variant: "destructive",
        });
        return;
      }

      if (testCases.some(tc => tc.input.trim() === '' || tc.output.trim() === '')) {
        toast({
          title: "Error",
          description: "All test cases must have input and output",
          variant: "destructive",
        });
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // Upload image if present
      let imageUrl = null;
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
        const filePath = `questions/${assessmentId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('questions')
          .upload(filePath, imageFile);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('questions')
          .getPublicUrl(filePath);

        imageUrl = publicUrlData.publicUrl;
      }

      // Find the next available order_index
      const { data: existingQuestions, error: countError } = await supabase
        .from(data.type === 'mcq' ? 'mcq_questions' : 'coding_questions')
        .select('order_index')
        .eq('assessment_id', assessmentId)
        .order('order_index', { ascending: false })
        .limit(1);

      if (countError) throw countError;

      const nextOrderIndex = existingQuestions && existingQuestions.length > 0
        ? (existingQuestions[0].order_index + 1)
        : 1;

      if (data.type === 'mcq') {
        // Insert MCQ question
        const { data: mcqQuestion, error: mcqError } = await supabase
          .from('mcq_questions')
          .insert({
            assessment_id: assessmentId,
            title: data.title,
            description: data.description,
            marks: data.marks,
            image_url: imageUrl,
            order_index: nextOrderIndex,
          })
          .select('id')
          .single();

        if (mcqError) throw mcqError;

        // Insert MCQ options
        const mcqOptions = options.map((option, index) => ({
          mcq_question_id: mcqQuestion.id,
          text: option.text,
          is_correct: option.isCorrect,
          order_index: index + 1,
        }));

        const { error: optionsError } = await supabase
          .from('mcq_options')
          .insert(mcqOptions);

        if (optionsError) throw optionsError;

      } else {
        // Insert coding question
        const { data: codingQuestion, error: codingError } = await supabase
          .from('coding_questions')
          .insert({
            assessment_id: assessmentId,
            title: data.title,
            description: data.description,
            marks: data.marks,
            image_url: imageUrl,
            order_index: nextOrderIndex,
          })
          .select('id')
          .single();

        if (codingError) throw codingError;

        // Insert coding languages
        const codingLangs = languages.map(lang => ({
          coding_question_id: codingQuestion.id,
          coding_lang: lang.language,
          solution_template: lang.template,
          constraints: lang.constraints,
        }));

        const { error: langsError } = await supabase
          .from('coding_languages')
          .insert(codingLangs);

        if (langsError) throw langsError;

        // Insert coding examples
        const codingExamples = examples.map((example, index) => ({
          coding_question_id: codingQuestion.id,
          input: example.input,
          output: example.output,
          explanation: example.explanation,
          order_index: index + 1,
        }));

        const { error: examplesError } = await supabase
          .from('coding_examples')
          .insert(codingExamples);

        if (examplesError) throw examplesError;

        // Insert test cases
        const testCasesData = testCases.map((testCase, index) => ({
          coding_question_id: codingQuestion.id,
          input: testCase.input,
          output: testCase.output,
          marks: testCase.marks,
          is_hidden: testCase.isHidden,
          order_index: index + 1,
        }));

        const { error: testCasesError } = await supabase
          .from('test_cases')
          .insert(testCasesData);

        if (testCasesError) throw testCasesError;
      }

      toast({
        title: "Success",
        description: `${data.type.toUpperCase()} question created successfully`,
      });

      // Navigate back to the assessment details page
      navigate(`/admin/assessments/${assessmentId}`);

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create question",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Determine if this is an editing or creation mode
  const isEditMode = !!questionId;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditMode ? 'Edit Question' : 'Add New Question'}</CardTitle>
        <CardDescription>
          {isEditMode 
            ? 'Update the question details below' 
            : 'Create a new question for this assessment'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Question Type</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex flex-col space-y-1"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="mcq" id="mcq" />
                        <Label htmlFor="mcq">Multiple Choice Question</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="code" id="code" />
                        <Label htmlFor="code">Coding Question</Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Question Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Enter detailed question description" 
                      className="min-h-32"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="marks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Marks</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      min={1}
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div>
              <FormLabel>Question Image (Optional)</FormLabel>
              <div className="mt-2 flex flex-col space-y-2">
                {!imagePreview ? (
                  <div className="flex items-center">
                    <label 
                      htmlFor="image-upload"
                      className="flex cursor-pointer items-center rounded-md bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/20"
                    >
                      <Image className="mr-2 h-4 w-4" />
                      Upload Image
                    </label>
                    <input
                      id="image-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative max-w-md overflow-hidden rounded-md border">
                      <img 
                        src={imagePreview} 
                        alt="Question image preview" 
                        className="w-full object-cover"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute right-2 top-2"
                        type="button"
                        onClick={removeImage}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Question type specific fields */}
            {form.watch('type') === 'mcq' ? (
              <div className="space-y-4 border rounded-md p-4 bg-slate-50">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">Options</h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addOption}
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    Add Option
                  </Button>
                </div>

                <div className="space-y-3">
                  {options.map((option, index) => (
                    <div key={option.id} className="flex items-start space-x-2">
                      <div className="pt-3">
                        <RadioGroup
                          value={option.isCorrect ? option.id : ''}
                          onValueChange={() => handleOptionCorrectChange(index)}
                        >
                          <RadioGroupItem value={option.id} />
                        </RadioGroup>
                      </div>
                      <div className="flex-1">
                        <Input
                          placeholder={`Option ${index + 1}`}
                          value={option.text}
                          onChange={(e) => handleOptionTextChange(index, e.target.value)}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeOption(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <Tabs defaultValue="languages" className="w-full">
                <TabsList>
                  <TabsTrigger value="languages">Languages</TabsTrigger>
                  <TabsTrigger value="examples">Examples</TabsTrigger>
                  <TabsTrigger value="testcases">Test Cases</TabsTrigger>
                </TabsList>

                {/* Languages Tab */}
                <TabsContent value="languages" className="space-y-4 border rounded-md p-4 bg-slate-50">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium">Supported Languages</h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addLanguage}
                    >
                      <Plus className="mr-1 h-4 w-4" />
                      Add Language
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {languages.map((language, index) => (
                      <div key={index} className="space-y-3 border rounded-md p-3">
                        <div className="flex justify-between">
                          <h4 className="font-medium">Language {index + 1}</h4>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeLanguage(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="space-y-2">
                          <div>
                            <Label>Language Name</Label>
                            <Input
                              placeholder="e.g., python, javascript, java"
                              value={language.language}
                              onChange={(e) => handleLanguageChange(index, 'language', e.target.value)}
                            />
                          </div>
                          <div>
                            <Label>Solution Template</Label>
                            <Textarea
                              placeholder="# Default code template for the chosen language"
                              className="font-mono h-32"
                              value={language.template}
                              onChange={(e) => handleLanguageChange(index, 'template', e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                {/* Examples Tab */}
                <TabsContent value="examples" className="space-y-4 border rounded-md p-4 bg-slate-50">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium">Examples</h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addExample}
                    >
                      <Plus className="mr-1 h-4 w-4" />
                      Add Example
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {examples.map((example, index) => (
                      <div key={index} className="space-y-3 border rounded-md p-3">
                        <div className="flex justify-between">
                          <h4 className="font-medium">Example {index + 1}</h4>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeExample(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="space-y-2">
                          <div>
                            <Label>Input</Label>
                            <Textarea
                              placeholder="Example input"
                              className="font-mono"
                              value={example.input}
                              onChange={(e) => handleExampleChange(index, 'input', e.target.value)}
                            />
                          </div>
                          <div>
                            <Label>Expected Output</Label>
                            <Textarea
                              placeholder="Example output"
                              className="font-mono"
                              value={example.output}
                              onChange={(e) => handleExampleChange(index, 'output', e.target.value)}
                            />
                          </div>
                          <div>
                            <Label>Explanation (Optional)</Label>
                            <Textarea
                              placeholder="Explain this example"
                              value={example.explanation}
                              onChange={(e) => handleExampleChange(index, 'explanation', e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                {/* Test Cases Tab */}
                <TabsContent value="testcases" className="space-y-4 border rounded-md p-4 bg-slate-50">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium">Test Cases</h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addTestCase}
                    >
                      <Plus className="mr-1 h-4 w-4" />
                      Add Test Case
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {testCases.map((testCase, index) => (
                      <div key={index} className="space-y-3 border rounded-md p-3">
                        <div className="flex justify-between">
                          <h4 className="font-medium">Test Case {index + 1}</h4>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeTestCase(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="space-y-2">
                          <div>
                            <Label>Input</Label>
                            <Textarea
                              placeholder="Test case input"
                              className="font-mono"
                              value={testCase.input}
                              onChange={(e) => handleTestCaseChange(index, 'input', e.target.value)}
                            />
                          </div>
                          <div>
                            <Label>Expected Output</Label>
                            <Textarea
                              placeholder="Test case expected output"
                              className="font-mono"
                              value={testCase.output}
                              onChange={(e) => handleTestCaseChange(index, 'output', e.target.value)}
                            />
                          </div>
                          <div className="flex space-x-4">
                            <div className="w-1/2">
                              <Label>Marks</Label>
                              <Input
                                type="number"
                                min={1}
                                value={testCase.marks}
                                onChange={(e) => handleTestCaseChange(index, 'marks', parseInt(e.target.value) || 1)}
                              />
                            </div>
                            <div className="w-1/2 flex items-center pt-6">
                              <input
                                type="checkbox"
                                id={`hidden-${index}`}
                                checked={testCase.isHidden}
                                onChange={(e) => handleTestCaseChange(index, 'isHidden', e.target.checked)}
                                className="mr-2 h-4 w-4"
                              />
                              <Label htmlFor={`hidden-${index}`}>Hide from students</Label>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            )}

            <div className="flex justify-end space-x-2">
              <Button 
                type="button" 
                variant="outline"
                onClick={() => navigate(`/admin/assessments/${assessmentId}`)}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="bg-astra-red hover:bg-red-600 text-white"
                disabled={isSubmitting}
              >
                {isSubmitting 
                  ? 'Saving...' 
                  : isEditMode 
                    ? 'Update Question' 
                    : 'Create Question'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default QuestionForm;
