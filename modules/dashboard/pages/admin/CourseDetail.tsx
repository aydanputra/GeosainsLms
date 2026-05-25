"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  GripVertical, 
  Plus, 
  Trash2, 
  Edit2, 
  Video, 
  FileText, 
  ChevronDown, 
  ChevronUp,
  Save,
  X,
  MoreVertical,
  Layout,
  List,
  Settings
} from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import BasicInfoTab from './tabs/BasicInfoTab';
import CurriculumTab from './tabs/CurriculumTab';
import SettingsTab from './tabs/SettingsTab';

interface Lesson {
  id: string;
  title: string;
  type: 'VIDEO' | 'TEXT';
  order: number;
}

interface Module {
  id: string;
  title: string;
  lessons: Lesson[];
  order: number;
}

interface CourseDetailProps {
  course: any; // Using any for now to be flexible with Prisma include structure
  mentors: { id: string; name: string }[];
}

export default function CourseDetail({ course, mentors }: CourseDetailProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'info' | 'curriculum' | 'settings'>('info');

  const tabs = [
    { id: 'info', label: 'Informasi Dasar', icon: Layout },
    { id: 'curriculum', label: 'Kurikulum', icon: List },
    { id: 'settings', label: 'Pengaturan', icon: Settings },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="border-b border-slate-200">
          <div className="px-6 py-4">
            <h1 className="text-xl font-bold text-slate-800">{course.title}</h1>
            <p className="text-sm text-slate-500 mt-1">Kelola konten dan pengaturan kursus Anda.</p>
          </div>
          
          <div className="flex px-6 gap-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={twMerge(
                    "flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors",
                    activeTab === tab.id
                      ? "border-indigo-600 text-indigo-600"
                      : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'info' && <BasicInfoTab course={course} mentors={mentors} />}
          {activeTab === 'curriculum' && <CurriculumTab course={course} />}
          {activeTab === 'settings' && <SettingsTab course={course} />}
        </div>
      </div>
    </div>
  );
}

