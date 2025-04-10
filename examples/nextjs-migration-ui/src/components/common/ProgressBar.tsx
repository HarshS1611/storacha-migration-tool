import React from 'react';

export interface ProgressBarProps {
  percentage: number;
  color?: 'storacha' | 'green' | 'red';
  height?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  percentage,
  color = 'storacha',
  height = 'md',
  showLabel = true
}) => {
  const normalizedProgress = Math.min(100, Math.max(0, percentage));

  const heightClass = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-4'
  }[height];

  const colorClass = {
    storacha: 'bg-storacha',
    green: 'bg-green-500',
    red: 'bg-red-500'
  }[color];

  return (
    <div className="w-full">
      <div className={`w-full ${heightClass} bg-gray-200 rounded-full overflow-hidden`}>
        <div
          className={`${heightClass} ${colorClass} rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${normalizedProgress}%` }}
        />
      </div>
      {showLabel && (
        <div className="mt-1 text-right">
          <span className="text-sm text-gray-600">{Math.round(normalizedProgress)}%</span>
        </div>
      )}
    </div>
  );
}; 