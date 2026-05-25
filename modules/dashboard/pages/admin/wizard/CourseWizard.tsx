"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import StepIndicator from './StepIndicator';
import CourseStepBasic from './steps/CourseStepBasic';
import CourseStepMedia from './steps/CourseStepMedia';
import CourseStepCurriculum from './steps/CourseStepCurriculum';
import CourseStepPricing from './steps/CourseStepPricing';
import CourseStepReview from './steps/CourseStepReview';
import { toast } from 'sonner';

export default function CourseWizard({ initialCourseId }: { initialCourseId?: string }) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [courseId, setCourseId] = useState<string | null>(initialCourseId || null);
  const [courseData, setCourseData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [dashboardBase, setDashboardBase] = useState('/dashboard/admin');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/me', { cache: 'no-store' });
        const data = await res.json().catch(() => ({ user: null }));
        if (!active) return;
        const role = typeof data?.user?.role === 'string' ? String(data.user.role) : '';
        setDashboardBase(role === 'MENTOR' ? '/dashboard/mentor' : '/dashboard/admin');
      } catch {
        if (!active) return;
        setDashboardBase('/dashboard/admin');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const steps = [
    { id: 1, label: 'Informasi Dasar' },
    { id: 2, label: 'Media & Preview' },
    { id: 3, label: 'Struktur & Kurikulum' },
    { id: 4, label: 'Harga & Monetisasi' },
    { id: 5, label: 'Review & Publish' },
  ];

  useEffect(() => {
    if (courseId) {
      // Force refresh data on initial load if courseId provided
      const fetchData = async () => {
          setIsLoading(true);
          try {
              const res = await fetch(`/api/courses/${courseId}`);
              if (res.ok) {
                  const data = await res.json();
                  setCourseData(data);
              } else {
                  console.error("Failed to fetch existing course data");
                  toast.error("Gagal memuat data kursus");
              }
          } catch (error) {
              console.error(error);
              toast.error("Terjadi kesalahan saat memuat data");
          } finally {
              setIsLoading(false);
          }
      };
      fetchData();
    } else {
      // If no courseId (new course), stop loading immediately
      setIsLoading(false);
    }
  }, [courseId]); // Remove currentStep dependency to prevent refetching on every step change, only when ID changes

  // Also refetch when coming back to a step? 
  // Ideally we keep local state updated via handleNext returns.
  // But if we want to ensure "edit mode" has data, the initial fetch is key.


  const handleNext = async (stepData: any = {}) => {
    setIsLoading(true);
    try {
      if (currentStep === 1) {
        // ... (Step 1 logic remains same)
        const method = courseId ? 'PATCH' : 'POST';
        const url = courseId ? `/api/courses/${courseId}` : '/api/courses';
        
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(stepData),
        });
        
        if (!res.ok) {
             const errData = await res.json();
             throw new Error(errData.message || errData.error || 'Gagal menyimpan data');
        }

        const data = await res.json();
        if (!courseId) setCourseId(data.id);
        setCourseData(data);
      } 
      else if (currentStep === 2 || currentStep === 4) {
        // ... (Step 2 & 4 logic)
        if (!courseId) throw new Error('ID Kursus tidak ditemukan');
        
        // Sanitize data for Step 4 (Pricing)
        let payload = stepData;
        if (currentStep === 4) {
            // Remove 'type' field as it's not in the database schema
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { type, ...rest } = stepData;
            payload = rest;
        }

        const res = await fetch(`/api/courses/${courseId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        
        if (!res.ok) {
             const errData = await res.json();
             throw new Error(errData.message || errData.error || 'Gagal menyimpan perubahan');
        }
        
        const data = await res.json();
        setCourseData(data);
      }
      else if (currentStep === 3) {
          // Step 3 (Curriculum) usually handles its own saving via modal/reorder API.
          // BUT, we must refresh courseData here to ensure Step 5 (Review) has the latest modules!
          if (courseId) {
              const res = await fetch(`/api/courses/${courseId}`);
              if (res.ok) {
                  const data = await res.json();
                  console.log("Refreshed course data after Curriculum step:", data);
                  setCourseData(data);
              }
          }
      }
      
      setCurrentStep(prev => prev + 1);
      window.scrollTo(0, 0);
    } catch (error: any) {
      toast.error(error.message || 'Terjadi kesalahan saat menyimpan data');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!courseId) return;
    setIsLoading(true);
    try {
        const res = await fetch(`/api/courses/${courseId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              published: true // Changed from status: 'PUBLISHED' to match API expectation
            }),
        });
        
        // Parse response safely
        const text = await res.text();
        let data = {};
        try {
            if (text) data = JSON.parse(text);
        } catch (e) {
            console.error("Invalid JSON response:", text);
        }

        if (res.ok) {
            toast.success('Kursus berhasil dipublikasikan!');
            router.push(`${dashboardBase}/courses`);
        } else {
            const errorMessage = (data as any).error || (data as any).message || 'Gagal mempublikasikan';
            throw new Error(errorMessage);
        }
    } catch (error: any) {
        console.error("Publish Error:", error);
        toast.error(error.message || 'Gagal mempublikasikan kursus');
    } finally {
        setIsLoading(false);
    }
  };

  const renderStep = () => {
    // Only render steps if courseData is loaded (for Edit Mode) OR it's a new course (courseId null)
    // But for Step 1, we might need to wait for courseData if courseId is present
    if (courseId && !courseData) {
        return <div className="flex justify-center p-12"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>;
    }

    switch (currentStep) {
        case 1: return <CourseStepBasic initialData={courseData} onNext={handleNext} courseId={courseId || undefined} />;
        case 2: return <CourseStepMedia initialData={courseData} onNext={handleNext} onBack={() => setCurrentStep(1)} />;
        case 3: return <CourseStepCurriculum courseId={courseId!} onNext={() => setCurrentStep(4)} onBack={() => setCurrentStep(2)} />;
        case 4: return <CourseStepPricing initialData={courseData} courseId={courseId || undefined} onNext={handleNext} onBack={() => setCurrentStep(3)} />;
        case 5: return <CourseStepReview courseData={courseData} onPublish={handlePublish} onBack={() => setCurrentStep(4)} isPublishing={isLoading} />;
        default: return null;
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-blue-900 to-blue-600 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-blue-500/30 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none" />
        
        <div className="relative z-10">
          <h1 className="text-2xl font-bold tracking-tight mb-1">Buat Kursus Baru</h1>
          <p className="text-blue-100 text-sm max-w-2xl">
             Ikuti langkah-langkah berikut untuk membuat kursus profesional dengan materi terstruktur.
          </p>
        </div>
      </div>

      {/* Step Indicator */}
      <StepIndicator steps={steps} currentStep={currentStep} />

      {/* Main Form Container */}
      <div className="mt-6">
         {renderStep()}
      </div>
    </div>
  );
}
