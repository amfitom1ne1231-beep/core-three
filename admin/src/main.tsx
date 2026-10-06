import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ApiError } from './api';
import { App } from './App';
import './fonts.css';
import './styles.css';
import { boot } from './tg';

boot();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // отказ во входе и «нет такой заявки» повтором не лечатся
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
      staleTime: 10_000
    }
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
);
