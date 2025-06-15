import React, { Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, CssBaseline, GlobalStyles } from '@mui/material';
import { HelmetProvider } from 'react-helmet-async';
import { ErrorBoundary } from 'react-error-boundary';
import { Toaster } from 'react-hot-toast';

// Store
import { store, persistor } from '@store/index';

// Theme
import { theme } from '@styles/theme';
import { globalStyles } from '@styles/globalStyles';

// Components
import LoadingSpinner from '@components/ui/LoadingSpinner';
import ErrorFallback from '@components/ui/ErrorFallback';
import Layout from '@components/layout/Layout';

// Pages - Lazy loading para mejor performance
const HomePage = React.lazy(() => import('@pages/HomePage'));
const LoginPage = React.lazy(() => import('@pages/auth/LoginPage'));
const RegisterPage = React.lazy(() => import('@pages/auth/RegisterPage'));
const DashboardPage = React.lazy(() => import('@pages/DashboardPage'));
const MeetingPage = React.lazy(() => import('@pages/meeting/MeetingPage'));
const MeetingLobbyPage = React.lazy(() => import('@pages/meeting/MeetingLobbyPage'));
const ProfilePage = React.lazy(() => import('@pages/ProfilePage'));
const SettingsPage = React.lazy(() => import('@pages/SettingsPage'));
const AnalyticsPage = React.lazy(() => import('@pages/AnalyticsPage'));
const NotFoundPage = React.lazy(() => import('@pages/NotFoundPage'));

// Hooks
import { useAuth } from '@hooks/useAuth';
import { useTheme } from '@hooks/useTheme';
import { useNotifications } from '@hooks/useNotifications';

// Services
import { initializeServices } from '@services/index';

// Types
import type { User } from '@types/auth';

// React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
    mutations: {
      retry: 1,
    },
  },
});

// Protected Route component
interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requiredRole 
}) => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

// Public Route component (redirect if authenticated)
interface PublicRouteProps {
  children: React.ReactNode;
}

const PublicRoute: React.FC<PublicRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

// App initialization component
const AppInitializer: React.FC<{ children: React.ReactNode }> = ({ 
  children 
}) => {
  useEffect(() => {
    // Initialize services
    initializeServices();

    // Set up global error handlers
    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
      // Here you could send to error tracking service
    });

    window.addEventListener('error', (event) => {
      console.error('Global error:', event.error);
      // Here you could send to error tracking service
    });

    return () => {
      window.removeEventListener('unhandledrejection', () => {});
      window.removeEventListener('error', () => {});
    };
  }, []);

  return <>{children}</>;
};

// Main App component
const App: React.FC = () => {
  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error, errorInfo) => {
        console.error('App Error Boundary:', error, errorInfo);
        // Send to error tracking service
      }}
    >
      <HelmetProvider>
        <Provider store={store}>
          <PersistGate loading={<LoadingSpinner />} persistor={persistor}>
            <QueryClientProvider client={queryClient}>
              <ThemeProvider theme={theme}>
                <CssBaseline />
                <GlobalStyles styles={globalStyles} />
                
                <AppInitializer>
                  <Router>
                    <Routes>
                      {/* Public Routes */}
                      <Route 
                        path="/" 
                        element={
                          <Suspense fallback={<LoadingSpinner />}>
                            <HomePage />
                          </Suspense>
                        } 
                      />
                      
                      <Route 
                        path="/login" 
                        element={
                          <PublicRoute>
                            <Suspense fallback={<LoadingSpinner />}>
                              <LoginPage />
                            </Suspense>
                          </PublicRoute>
                        } 
                      />
                      
                      <Route 
                        path="/register" 
                        element={
                          <PublicRoute>
                            <Suspense fallback={<LoadingSpinner />}>
                              <RegisterPage />
                            </Suspense>
                          </PublicRoute>
                        } 
                      />

                      {/* Protected Routes with Layout */}
                      <Route 
                        path="/dashboard" 
                        element={
                          <ProtectedRoute>
                            <Layout>
                              <Suspense fallback={<LoadingSpinner />}>
                                <DashboardPage />
                              </Suspense>
                            </Layout>
                          </ProtectedRoute>
                        } 
                      />

                      <Route 
                        path="/profile" 
                        element={
                          <ProtectedRoute>
                            <Layout>
                              <Suspense fallback={<LoadingSpinner />}>
                                <ProfilePage />
                              </Suspense>
                            </Layout>
                          </ProtectedRoute>
                        } 
                      />

                      <Route 
                        path="/settings" 
                        element={
                          <ProtectedRoute>
                            <Layout>
                              <Suspense fallback={<LoadingSpinner />}>
                                <SettingsPage />
                              </Suspense>
                            </Layout>
                          </ProtectedRoute>
                        } 
                      />

                      <Route 
                        path="/analytics" 
                        element={
                          <ProtectedRoute>
                            <Layout>
                              <Suspense fallback={<LoadingSpinner />}>
                                <AnalyticsPage />
                              </Suspense>
                            </Layout>
                          </ProtectedRoute>
                        } 
                      />

                      {/* Meeting Routes - No Layout (fullscreen) */}
                      <Route 
                        path="/meeting/:meetingId/lobby" 
                        element={
                          <ProtectedRoute>
                            <Suspense fallback={<LoadingSpinner />}>
                              <MeetingLobbyPage />
                            </Suspense>
                          </ProtectedRoute>
                        } 
                      />

                      <Route 
                        path="/meeting/:meetingId" 
                        element={
                          <ProtectedRoute>
                            <Suspense fallback={<LoadingSpinner />}>
                              <MeetingPage />
                            </Suspense>
                          </ProtectedRoute>
                        } 
                      />

                      {/* 404 Route */}
                      <Route 
                        path="*" 
                        element={
                          <Suspense fallback={<LoadingSpinner />}>
                            <NotFoundPage />
                          </Suspense>
                        } 
                      />
                    </Routes>
                  </Router>
                </AppInitializer>

                {/* Global Components */}
                <Toaster
                  position="top-right"
                  toastOptions={{
                    duration: 4000,
                    style: {
                      background: theme.palette.background.paper,
                      color: theme.palette.text.primary,
                      border: `1px solid ${theme.palette.divider}`,
                    },
                  }}
                />
              </ThemeProvider>
            </QueryClientProvider>
          </PersistGate>
        </Provider>
      </HelmetProvider>
    </ErrorBoundary>
  );
};

export default App;