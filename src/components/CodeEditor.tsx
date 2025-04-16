"use client";

import { useEffect, useState } from "react";
import Editor from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createSubmission, getSubmission } from "@/lib/api";
import { languages } from "@/lib/data";
import { Question, TestResult } from "@/lib/types";

type Props = {
  question: Question;
};

export default function CodeEditor({ question }: Props) {
  const [code, setCode] = useState<string>(question.starterCode || "");
  const [language, setLanguage] = useState("cpp");
  const [output, setOutput] = useState<string>("");
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [submissionToken, setSubmissionToken] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testIndex, setTestIndex] = useState<number>(0);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setOutput("");
    setTestResults([]);
    setTestIndex(0);

    const testCase = question.testCases[0];
    const token = await createSubmission(code, language, testCase.input);
    setSubmissionToken(token);
  };

  useEffect(() => {
    if (!submissionToken) return;

    const interval = setInterval(async () => {
      const result = await getSubmission(submissionToken);

      if (result.status.description === "Processing") return;

      clearInterval(interval);

      const expectedOutput = question.testCases[testIndex].output.trim();
      const actualOutput = result.stdout?.trim() || "";
      const passed = expectedOutput === actualOutput;

      setTestResults((prev) => [...prev, { passed, actualOutput }]);

      const nextIndex = testIndex + 1;
      if (nextIndex < question.testCases.length) {
        const nextTestCase = question.testCases[nextIndex];
        const token = await createSubmission(code, language, nextTestCase.input);
        setSubmissionToken(token);
        setTestIndex(nextIndex);
      } else {
        setIsSubmitting(false);
        setSubmissionToken(null);
      }

    }, 1000);

    return () => clearInterval(interval);
  }, [submissionToken]);

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="flex flex-col gap-4">
        <Editor
          height="400px"
          defaultLanguage={language}
          defaultValue={code}
          onChange={(value) => setCode(value || "")}
          theme="vs-dark"
        />

        <div className="flex gap-2">
          <select
            className="border rounded p-2"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            {languages.map((lang) => (
              <option key={lang.value} value={lang.value}>
                {lang.label}
              </option>
            ))}
          </select>

          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Run Code"}
          </Button>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-2">Test Case Results</h3>
          <ul className="space-y-2">
            {testResults.map((result, idx) => (
              <li
                key={idx}
                className={`p-2 rounded ${
                  result.passed ? "bg-green-100" : "bg-red-100"
                }`}
              >
                Test Case {idx + 1}: {result.passed ? "Passed" : "Failed"} —{" "}
                Output: {result.actualOutput}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <h3 className="text-lg font-semibold mb-2">Question</h3>
          <p className="whitespace-pre-wrap">{question.description}</p>
        </CardContent>
      </Card>
    </div>
  );
}
