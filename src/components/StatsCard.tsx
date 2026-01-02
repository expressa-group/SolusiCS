import React from 'react';
import { DivideIcon as LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string;
  change: string;
  icon: LucideIcon;
  color: 'blue' | 'green' | 'purple' | 'orange';
}

const StatsCard: React.FC<StatsCardProps> = ({ title, value, change, icon: Icon, color }) => {
  const colorClasses = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    purple: 'text-purple-600',
    orange: 'text-orange-600'
  };

  const bgColorClasses = {
    blue: 'bg-blue-50',
    green: 'bg-green-50',
    purple: 'bg-purple-50',
    orange: 'bg-orange-50'
  };

  const changeColor = change.startsWith('+') ? 'text-green-600' : 'text-red-600';

  return (
    <div className="stats-card">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-12 h-12 ${bgColorClasses[color]} rounded-lg flex items-center justify-center`}>
          <Icon className={`h-6 w-6 ${colorClasses[color]}`} />
        </div>
        <span className={`text-sm font-medium ${changeColor}`}>
          {change}
        </span>
      </div>
      
      <div>
        <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
};

export default StatsCard;