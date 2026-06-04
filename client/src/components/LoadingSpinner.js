import React from 'react';

export default function LoadingSpinner({ message = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="w-10 h-10 border-4 border-red-200 border-t-jts-red rounded-full animate-spin" />
      <p className="text-sm text-gray-500 font-medium">{message}</p>
    </div>
  );
}
