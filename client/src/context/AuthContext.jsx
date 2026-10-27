import { createContext, useContext } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();

  const me = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        return (await get('/auth/me')).user;
      } catch (err) {
        if (err.status === 401) return null;
        throw err;
      }
    },
    staleTime: Infinity,
    retry: (count, err) => err.status !== 401 && count < 2,
  });

  const onSession = (data) => {
    queryClient.clear();
    queryClient.setQueryData(['me'], data.user);
  };

  const login = useMutation({ mutationFn: (body) => post('/auth/login', body), onSuccess: onSession });
  const register = useMutation({ mutationFn: (body) => post('/auth/register', body), onSuccess: onSession });
  const logout = useMutation({
    mutationFn: () => post('/auth/logout'),
    onSettled: () => {
      queryClient.clear();
      queryClient.setQueryData(['me'], null);
    },
  });

  const value = {
    user: me.data ?? null,
    loading: me.isPending,
    error: me.error,
    retry: me.refetch,
    login,
    register,
    logout,
    setUser: (user) => queryClient.setQueryData(['me'], user),
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
