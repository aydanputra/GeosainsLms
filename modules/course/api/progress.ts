import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export const useCourseProgress = (courseId: string) => {
  return useQuery({
    queryKey: ['courseProgress', courseId],
    queryFn: async () => {
      const res = await fetch(`/api/courses/${courseId}/progress`);
      if (!res.ok) throw new Error('Failed to fetch progress');
      return res.json();
    },
    enabled: !!courseId,
  });
};

export const useUpdateLessonProgress = (courseId: string) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ lessonId, completed }: { lessonId: string; completed: boolean }) => {
      const res = await fetch(`/api/courses/${courseId}/lessons/${lessonId}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const message = data?.error || 'Failed to update progress';
        throw new Error(message);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseProgress', courseId] });
    },
  });
};
