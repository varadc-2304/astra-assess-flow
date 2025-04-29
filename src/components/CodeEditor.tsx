import React, { useState } from 'react';
import Editor from '@monaco-editor/react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play } from 'lucide-react';

const languageMap: Record<string, string> = {
  python: 'python',
  javascript: 'javascript',
  cpp: 'cpp',
  java: 'java',
  c: 'c',
};

const CodeEditor = () => {
  const [selectedLanguage, setSelectedLanguage] = useState('python');
  const [code, setCode] = useState({
    python: '',
    javascript: '',
    cpp: '',
    java: '',
    c: '',
  });

  const handleLanguageChange = (lang: string) => setSelectedLanguage(lang);
  const handleCodeChange = (value: string | undefined) => {
    if (value === undefined) return;
    setCode((prev) => ({ ...prev, [selectedLanguage]: value }));
  };

  const currentCode = code[selectedLanguage];

  return (
    <div className="flex flex-col md:flex-row bg-[#1e1e1e] text-white rounded-xl shadow-lg overflow-hidden w-full min-h-[500px]">
      {/* Sidebar */}
      <div className="w-full md:w-48 bg-[#252526] border-r border-gray-700 p-3 space-y-2">
        {Object.keys(languageMap).map((lang) => (
          <button
            key={lang}
            onClick={() => handleLanguageChange(lang)}
            className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium hover:bg-[#3c3c3c] transition ${
              selectedLanguage === lang ? 'bg-[#007acc] text-white' : 'text-gray-300'
            }`}
          >
            {lang.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Editor + Output */}
      <div className="flex-1 flex flex-col">
        <Tabs defaultValue="editor" className="flex-1 flex flex-col">
          <TabsList className="bg-[#2d2d2d] border-b border-gray-700 px-4 pt-2">
            <TabsTrigger value="editor" className="text-white">Editor</TabsTrigger>
            <TabsTrigger value="output" className="text-white">Output</TabsTrigger>
          </TabsList>

          <TabsContent value="editor" className="flex-1">
            <div className="p-4 h-full">
              <Editor
                height="400px"
                language={languageMap[selectedLanguage] || 'plaintext'}
                value={currentCode}
                onChange={handleCodeChange}
                theme="vs-dark"
                options={{
                  fontSize: 14,
                  fontFamily: 'Fira Code, monospace',
                  minimap: { enabled: false },
                  lineNumbers: 'on',
                  tabSize: 2,
                  wordWrap: 'on',
                  formatOnType: true,
                  formatOnPaste: true,
                  automaticLayout: true,
                  scrollbar: {
                    vertical: 'auto',
                    horizontal: 'auto',
                  },
                  scrollBeyondLastLine: false,
                  renderWhitespace: 'boundary',
                  cursorBlinking: 'phase',
                  smoothScrolling: true,
                  overviewRulerBorder: false,
                }}
                className="rounded-lg border border-gray-700"
              />
            </div>
          </TabsContent>

          <TabsContent value="output" className="p-4 text-white">
            <Card className="bg-[#1e1e1e] border border-gray-700">
              <CardContent className="p-4">
                <pre>// Output will appear here</pre>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Run Button */}
        <div className="flex justify-end p-4 bg-[#252526] border-t border-gray-700">
          <Button className="bg-green-600 hover:bg-green-700 text-white">
            <Play className="w-4 h-4 mr-2" /> Run Code
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CodeEditor;
