import React from 'react';

interface ProgressBarProps {
  progress: number;
  color?: 'storacha' | 'green' | 'yellow' | 'red';
  showPercentage?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  color = 'storacha',
  showPercentage = false,
}) => {
  const normalizedProgress = Math.min(100, Math.max(0, progress));
  
  const getColorClass = () => {
    switch (color) {
      case 'green':
        return 'bg-green-500';
      case 'yellow':
        return 'bg-yellow-500';
      case 'red':
        return 'bg-red-500';
      default:
        return 'bg-storacha';
    }
  };

  return (
    <div className="relative w-full h-4 bg-gray-100 rounded-full overflow-hidden">
      <div
        className={`absolute left-0 top-0 h-full transition-all duration-300 ${getColorClass()}`}
        style={{ width: `${normalizedProgress}%` }}
      />
      {showPercentage && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-medium text-gray-700">
            {Math.round(normalizedProgress)}%
          </span>
        </div>
      )}
    </div>
  );
}; 