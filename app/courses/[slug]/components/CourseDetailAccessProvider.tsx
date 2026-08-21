'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

type QaThreadItem = {
  id: string;
  lessonId: string | null;
  lessonTitle: string | null;
  title: string;
  question: string;
  createdAtLabel: string;
  authorName: string;
  replyCount: number;
  lastReplyAtLabel: string | null;
};

type CurriculumLesson = {
  id: string;
  title: string;
  type: 'VIDEO' | 'QUIZ' | 'TEXT' | string;
  duration: number;
  isPreview: boolean;
  isLocked: boolean;
  lockLabel: string;
  unlockDateLabel: string | null;
};

type CurriculumModule = {
  id: string;
  title: string;
  order: number;
  lessons: CurriculumLesson[];
};

type CourseDetailAccessState = {
  isReady: boolean;
  isLoggedIn: boolean;
  isEnrolled: boolean;
  enrollmentExpired: boolean;
  canRate: boolean;
  canViewQa: boolean;
  qaThreads: QaThreadItem[];
  viewer: {
    id: string | null;
    role: string | null;
  };
  modules: CurriculumModule[] | null;
};

const DEFAULT_ACCESS_STATE: CourseDetailAccessState = {
  isReady: false,
  isLoggedIn: false,
  isEnrolled: false,
  enrollmentExpired: false,
  canRate: false,
  canViewQa: false,
  qaThreads: [],
  viewer: {
    id: null,
    role: null,
  },
  modules: null,
};

const CourseDetailAccessContext = createContext<CourseDetailAccessState>(DEFAULT_ACCESS_STATE);

export function CourseDetailAccessProvider({
  slug,
  previewMode = false,
  initialModules = null,
  children,
}: {
  slug: string;
  previewMode?: boolean;
  initialModules?: CurriculumModule[] | null;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<CourseDetailAccessState>({
    ...DEFAULT_ACCESS_STATE,
    modules: Array.isArray(initialModules) ? initialModules : null,
  });

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const query = previewMode ? '?preview=student' : '';
        const res = await fetch(`/api/courses/slug/${encodeURIComponent(slug)}/access${query}`, {
          cache: 'no-store',
          credentials: 'include',
        });
        if (!res.ok) {
          if (!isMounted) return;
          setState((prev) => ({ ...prev, isReady: true }));
          return;
        }

        const data = (await res.json().catch(() => null)) as Partial<CourseDetailAccessState> | null;
        if (!isMounted || !data) return;

        setState((prev) => ({
          isReady: true,
          isLoggedIn: data.isLoggedIn === true,
          isEnrolled: data.isEnrolled === true,
          enrollmentExpired: data.enrollmentExpired === true,
          canRate: data.canRate === true,
          canViewQa: data.canViewQa === true,
          qaThreads: Array.isArray(data.qaThreads) ? data.qaThreads : [],
          viewer: {
            id: typeof data.viewer?.id === 'string' ? data.viewer.id : null,
            role: typeof data.viewer?.role === 'string' ? data.viewer.role : null,
          },
          modules: Array.isArray(data.modules) ? data.modules : prev.modules,
        }));
      } catch {
        if (!isMounted) return;
        setState((prev) => ({ ...prev, isReady: true }));
      }
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [initialModules, previewMode, slug]);

  const value = useMemo(() => state, [state]);

  return <CourseDetailAccessContext.Provider value={value}>{children}</CourseDetailAccessContext.Provider>;
}

export function useCourseDetailAccess() {
  return useContext(CourseDetailAccessContext);
}
