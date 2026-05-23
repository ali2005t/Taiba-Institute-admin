import React from 'react';
import { Check } from 'lucide-react';

export default function VerifiedBadge() {
  return (
    <span className="inline-flex items-center justify-center bg-sky-500 text-white rounded-full p-0.5 mr-1.5 w-4 h-4 shadow-sm" title="طالب موثق بالبوابة">
      <Check size={10} className="stroke-[4]" />
    </span>
  );
}
