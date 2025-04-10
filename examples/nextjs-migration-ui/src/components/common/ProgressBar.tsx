import React from 'react';

interface ProgressBarProps {
  progress: number;
  label?: string;
  showPercentage?: boolean;
  color?: 'storacha' | 'green' | 'yellow' | 'red';
  height?: 'sm' | 'md' | 'lg';
  animate?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  label,
  showPercentage = true,
  color = 'storacha',
  height = 'md',
  animate = true,
}) => {
  // Ensure progress is between 0 and 100
  const normalizedProgress = Math.min(Math.max(progress, 0), 100);
  
  // Get the appropriate color class
  const getColorClass = () => {
    switch (color) {
      case 'green':
        return 'bg-success';
      case 'yellow':
        return 'bg-warning';
      case 'red':
        return 'bg-error';
      case 'storacha':
      default:
        return 'bg-storacha';
    }
  };
  
  // Get the appropriate height class
  const getHeightClass = () => {
    switch (height) {
      case 'sm':
        return 'h-2';
      case 'lg':
        return 'h-6';
      case 'md':
      default:
        return 'h-4';
    }
  };
  
  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm font-medium text-gray-700">{label}</span>
          {showPercentage && (
            <span className="text-sm font-medium text-gray-700">
              {normalizedProgress.toFixed(1)}%
            </span>
          )}
        </div>
      )}
      
      <div className={`w-full bg-gray-200 rounded-full ${getHeightClass()}`}>
        <div
          className={`${getColorClass()} rounded-full ${getHeightClass()} ${
            animate ? 'transition-all duration-500' : ''
          }`}
          style={{ width: `${normalizedProgress}%` }}
        >
          {height === 'lg' && showPercentage && (
            <div className="flex items-center justify-center h-full text-xs font-medium text-white">
              {normalizedProgress.toFixed(1)}%
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 