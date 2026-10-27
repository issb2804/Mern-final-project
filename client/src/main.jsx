import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import './index.css';

// An expired session on any request sends the user back to the login screen.
const handleUnauthorized = (err) => {
  if (err?.status === 401) queryClient.setQueryData(['me'], null);
};

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handleUnauthorized }),
  mutationCache: new MutationCache({ onError: handleUnauthorized }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      retry: (count, err) => (err?.status === 0 || err?.status >= 500) && count < 2,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
          <Toaster position="bottom-right" toastOptions={{
              duration: 4000,
              style: {
                fontSize: '14px',
                borderRadius: '14px',
                background: 'rgb(var(--surface))',
                color: 'rgb(var(--ink-900))',
                border: '1px solid rgb(var(--ink-200))',
                boxShadow: '0 12px 28px -12px rgba(36,32,28,0.25)',
              },
              success: { iconTheme: { primary: '#3f7748', secondary: '#ffffff' } },
              error: { iconTheme: { primary: '#c2673f', secondary: '#ffffff' } },
            }} />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
