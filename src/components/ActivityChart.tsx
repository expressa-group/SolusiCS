import React from 'react';

const ActivityChart: React.FC = () => {
  const data = [
    { day: 'Sen', conversations: 45, responses: 42 },
    { day: 'Sel', conversations: 52, responses: 48 },
    { day: 'Rab', conversations: 38, responses: 36 },
    { day: 'Kam', conversations: 61, responses: 58 },
    { day: 'Jum', conversations: 55, responses: 52 },
    { day: 'Sab', conversations: 42, responses: 40 },
    { day: 'Min', conversations: 35, responses: 33 }
  ];

  const maxValue = Math.max(...data.map(d => Math.max(d.conversations, d.responses)));

  return (
    <div className="h-64">
      <div className="flex items-end justify-between h-full space-x-2">
        {data.map((item, index) => (
          <div key={index} className="flex-1 flex flex-col items-center">
            <div className="w-full flex items-end justify-center space-x-1 mb-2 h-48">
              <div 
                className="bg-blue-500 rounded-t w-full max-w-6 transition-all duration-300 hover:bg-blue-600"
                style={{ height: `${(item.conversations / maxValue) * 100}%` }}
                title={`Percakapan: ${item.conversations}`}
              />
              <div 
                className="bg-green-500 rounded-t w-full max-w-6 transition-all duration-300 hover:bg-green-600"
                style={{ height: `${(item.responses / maxValue) * 100}%` }}
                title={`Respons: ${item.responses}`}
              />
            </div>
            <span className="text-xs text-gray-600 font-medium">{item.day}</span>
          </div>
        ))}
      </div>
      
      <div className="flex items-center justify-center space-x-6 mt-4">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-blue-500 rounded"></div>
          <span className="text-sm text-gray-600">Percakapan</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-green-500 rounded"></div>
          <span className="text-sm text-gray-600">Respons AI</span>
        </div>
      </div>
    </div>
  );
};

export default ActivityChart;