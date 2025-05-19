import React from 'react';

export interface ProcessStep {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  timestamp?: Date;
}

interface ProcessStepsProps {
  steps: ProcessStep[];
  currentStep?: string;
}

export const ProcessSteps: React.FC<ProcessStepsProps> = ({ steps, currentStep }) => {
  return (
    <div className="flow-root">
      <ul role="list" className="-mb-8">
        {steps.map((step, stepIdx) => (
          <li key={step.id}>
            <div className="relative pb-8">
              {stepIdx !== steps.length - 1 ? (
                <span
                  className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-gray-200"
                  aria-hidden="true"
                />
              ) : null}
              <div className="relative flex space-x-3">
                <div>
                  <span
                    className={`
                      h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white
                      ${step.status === 'completed' ? 'bg-green-500' :
                        step.status === 'in-progress' ? 'bg-storacha animate-pulse' :
                        step.status === 'error' ? 'bg-red-500' :
                        'bg-gray-200'
                      }
                    `}
                  >
                    {step.status === 'completed' && (
                      <svg className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                    {step.status === 'in-progress' && (
                      <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    )}
                    {step.status === 'error' && (
                      <svg className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    )}
                    {step.status === 'pending' && (
                      <span className="h-2.5 w-2.5 rounded-full bg-gray-600" />
                    )}
                  </span>
                </div>
                <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                  <div>
                    <p className={`text-sm font-medium ${
                      step.status === 'completed' ? 'text-gray-900' :
                      step.status === 'in-progress' ? 'text-storacha' :
                      step.status === 'error' ? 'text-red-900' :
                      'text-gray-500'
                    }`}>
                      {step.title}
                    </p>
                    {step.description && (
                      <p className="mt-0.5 text-sm text-gray-500">
                        {step.description}
                      </p>
                    )}
                  </div>
                  {step.timestamp && (
                    <div className="whitespace-nowrap text-right text-sm text-gray-500">
                      {new Intl.DateTimeFormat('en-US', {
                        hour: 'numeric',
                        minute: 'numeric',
                        second: 'numeric'
                      }).format(step.timestamp)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}; 