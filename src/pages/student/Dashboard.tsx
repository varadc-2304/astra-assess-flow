
import React from 'react';
import AssessmentCodeInput from '@/components/AssessmentCodeInput';

const StudentDashboard = () => {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4">Student Dashboard</h1>
      <div className="mb-8">
        <AssessmentCodeInput />
      </div>
    </div>
  );
};

export default StudentDashboard;
