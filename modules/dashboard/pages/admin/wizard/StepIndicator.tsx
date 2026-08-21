"use client";

import { Check } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface Step {
  id: number;
  label: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
}

export default function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  const currentStepInfo = steps.find(s => s.id === currentStep);
  const progressPercentage = Math.round(((currentStep - 1) / (steps.length - 1)) * 100);

  return (
    <div className="w-full">
      {/* Mobile View: Compact Progress Bar */}
      <div className="md:hidden mb-6 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
         <div className="flex justify-between items-end mb-2">
            <div>
               <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Langkah {currentStep} dari {steps.length}</span>
               <h2 className="text-lg font-bold text-slate-900 mt-1">{currentStepInfo?.label}</h2>
            </div>
            <span className="text-sm font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">{progressPercentage}%</span>
         </div>
         <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
            <div 
              className="bg-indigo-600 h-full transition-all duration-500 ease-out rounded-full" 
              style={{ width: `${(currentStep / steps.length) * 100}%` }} 
            />
         </div>
      </div>

      {/* Desktop View: Modern Card Steps */}
      <div className="hidden md:grid grid-cols-5 gap-0 w-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden divide-x divide-slate-100">
        {steps.map((step, index) => {
          const isCompleted = currentStep > step.id;
          const isActive = currentStep === step.id;
          void index;

          return (
            <div 
              key={step.id} 
              className={twMerge(
                "relative flex items-center gap-3 p-4 transition-all duration-300",
                isActive ? "bg-indigo-50/50" : "bg-white"
              )}
            >
              {/* Status Indicator */}
              <div 
                className={clsx(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors shadow-sm ring-2",
                  isActive ? "bg-indigo-600 text-white ring-indigo-100" :
                  isCompleted ? "bg-emerald-500 text-white ring-emerald-100" :
                  "bg-white text-slate-400 border border-slate-200 ring-transparent"
                )}
              >
                {isCompleted ? <Check className="w-4 h-4" strokeWidth={3} /> : step.id}
              </div>

              {/* Label */}
              <div className="flex flex-col min-w-0 flex-1">
                <span className={clsx(
                  "text-[10px] font-bold uppercase tracking-wider mb-0.5 truncate",
                  isActive ? "text-indigo-600" :
                  isCompleted ? "text-emerald-600" :
                  "text-slate-400"
                )}>
                  Langkah {step.id}
                </span>
                <span className={clsx(
                  "text-sm font-bold truncate block w-full leading-tight",
                  isActive ? "text-slate-900" :
                  isCompleted ? "text-slate-700" :
                  "text-slate-500"
                )}>
                  {step.label}
                </span>
              </div>
              
              {/* Active Bottom Bar */}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
