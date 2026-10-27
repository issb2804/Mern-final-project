import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get } from './api';

export const useTasks = (filters) => {
  const params = new URLSearchParams(Object.entries(filters).filter(([, v]) => v));
  return useQuery({
    queryKey: ['tasks', filters],
    queryFn: () => get(`/tasks?${params}`),
    placeholderData: (prev) => prev,
  });
};

export const useTask = (id) =>
  useQuery({ queryKey: ['task', id], queryFn: async () => (await get(`/tasks/${id}`)).task, enabled: !!id });

export const useSchedule = () => useQuery({ queryKey: ['schedule'], queryFn: () => get('/schedule') });

export const useStats = () => useQuery({ queryKey: ['stats'], queryFn: () => get('/stats') });

export const useNotifications = () =>
  useQuery({ queryKey: ['notifications'], queryFn: () => get('/notifications'), refetchInterval: 60_000 });

/** Anything that changes a task changes priorities and the plan, so refresh them all. */
export function useRefreshPlan() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(
      ['tasks', 'task', 'schedule', 'stats', 'notifications'].map((key) =>
        queryClient.invalidateQueries({ queryKey: [key] }),
      ),
    );
}
