/**
 * AI Code Management Dashboard - Main Application Component
 * 
 * Modern React dashboard providing:
 * - Real-time code analysis visualization
 * - Interactive dependency graphs
 * - Security and performance monitoring
 * - AI-powered insights and recommendations
 * - Repository management interface
 */

import React, { useState, useEffect, useContext } from 'react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Navigate,
  useNavigate 
} from 'react-router-dom';
import { 
  Box, 
  CssBaseline, 
  ThemeProvider, 
  createTheme,
  AppBar,
  Toolbar,
  Typography,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Badge,
  Alert,
  Snackbar
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Code as CodeIcon,
  Security as SecurityIcon,
  Speed as PerformanceIcon,
  Psychology as AIIcon,
  AccountTree as GraphIcon,
  Settings as SettingsIcon,
  Menu as MenuIcon,
  Notifications as NotificationsIcon,
  Search as SearchIcon
} from '@mui/icons-material';

// Context
import { AppProvider, useAppContext } from './contexts/AppContext';
import { WebSocketProvider } from './contexts/WebSocketContext';

// Components
import DashboardOverview from './components/DashboardOverview';
import RepositoryManager from './components/RepositoryManager';
import CodeAnalysis from './components/CodeAnalysis';
import SecurityDashboard from './components/SecurityDashboard';
import PerformanceDashboard from './components/PerformanceDashboard';
import AIInsightsDashboard from './components/AIInsightsDashboard';
import DependencyGraph from './components/DependencyGraph';
import SearchInterface from './components/SearchInterface';
import SettingsPanel from './components/SettingsPanel';

// Hooks
import { useWebSocket } from './hooks/useWebSocket';
import { useNotifications } from './hooks/useNotifications';

// Utils
import { apiClient } from './utils/apiClient';

// Theme configuration
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#00d4aa',
      light: '#4df5c6',
      dark: '#00a685'
    },
    secondary: {
      main: '#6c5ce7',
      light: '#a29bfe',
      dark: '#5f3dc4'
    },
    background: {
      default: '#0f0f0f',
      paper: '#1a1a1a'
    },
    text: {
      primary: '#ffffff',
      secondary: '#b0b0b0'
    },
    success: {
      main: '#00b894'
    },
    warning: {
      main: '#fdcb6e'
    },
    error: {
      main: '#e17055'
    }
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 700
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600
    },
    h3: {
      fontSize: '1.5rem',
      fontWeight: 600
    }
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#1a1a1a',
          borderBottom: '1px solid #333'
        }
      }
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#1a1a1a',
          borderRight: '1px solid #333'
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#1a1a1a',
          border: '1px solid #333'
        }
      }
    }
  }
});

const DRAWER_WIDTH = 280;

// Navigation items
const navigationItems = [
  { label: 'Dashboard', icon: DashboardIcon, path: '/dashboard' },
  { label: 'Repositories', icon: CodeIcon, path: '/repositories' },
  { label: 'Code Analysis', icon: CodeIcon, path: '/analysis' },
  { label: 'Security', icon: SecurityIcon, path: '/security' },
  { label: 'Performance', icon: PerformanceIcon, path: '/performance' },
  { label: 'AI Insights', icon: AIIcon, path: '/ai-insights' },
  { label: 'Dependency Graph', icon: GraphIcon, path: '/graph' },
  { label: 'Search', icon: SearchIcon, path: '/search' },
  { label: 'Settings', icon: SettingsIcon, path: '/settings' }
];

function AppLayout() {
  const navigate = useNavigate();
  const { 
    currentRepository, 
    repositories, 
    isLoading, 
    error,
    setError 
  } = useAppContext();
  
  const { notifications, clearNotification } = useNotifications();
  const { isConnected, connectionError } = useWebSocket();
  
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [selectedPath, setSelectedPath] = useState('/dashboard');

  useEffect(() => {
    // Set initial path
    const currentPath = window.location.pathname;
    setSelectedPath(currentPath);
  }, []);

  const handleNavigate = (path) => {
    setSelectedPath(path);
    navigate(path);
  };

  const handleCloseError = () => {
    setError(null);
  };

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      {/* App Bar */}
      <AppBar 
        position="fixed" 
        sx={{ 
          zIndex: (theme) => theme.zIndex.drawer + 1,
          boxShadow: 'none'
        }}
      >
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={() => setDrawerOpen(!drawerOpen)}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            AI Software Development Platform
          </Typography>
          
          {currentRepository && (
            <Typography variant="body2" sx={{ mr: 2, opacity: 0.8 }}>
              {currentRepository.name}
            </Typography>
          )}
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {/* Connection Status */}
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: isConnected ? 'success.main' : 'error.main',
                mr: 1
              }}
            />
            
            {/* Notifications */}
            <IconButton color="inherit">
              <Badge badgeContent={notifications.length} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Sidebar */}
      <Drawer
        variant="persistent"
        open={drawerOpen}
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
          },
        }}
      >
        <Toolbar /> {/* Spacer for AppBar */}
        
        <List sx={{ pt: 2 }}>
          {navigationItems.map((item) => (
            <ListItem
              key={item.path}
              button
              selected={selectedPath === item.path}
              onClick={() => handleNavigate(item.path)}
              sx={{
                mx: 1,
                mb: 0.5,
                borderRadius: 1,
                '&.Mui-selected': {
                  backgroundColor: 'primary.main',
                  color: 'primary.contrastText',
                  '&:hover': {
                    backgroundColor: 'primary.dark',
                  }
                }
              }}
            >
              <ListItemIcon 
                sx={{ 
                  color: selectedPath === item.path ? 'inherit' : 'text.secondary',
                  minWidth: 40
                }}
              >
                <item.icon />
              </ListItemIcon>
              <ListItemText 
                primary={item.label}
                sx={{
                  '& .MuiListItemText-primary': {
                    fontSize: '0.9rem',
                    fontWeight: selectedPath === item.path ? 600 : 400
                  }
                }}
              />
            </ListItem>
          ))}
        </List>
      </Drawer>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          bgcolor: 'background.default',
          overflow: 'auto',
          transition: theme.transitions.create('margin', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
          marginLeft: drawerOpen ? 0 : `-${DRAWER_WIDTH}px`,
        }}
      >
        <Toolbar /> {/* Spacer for AppBar */}
        
        <Box sx={{ p: 3 }}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardOverview />} />
            <Route path="/repositories" element={<RepositoryManager />} />
            <Route path="/analysis" element={<CodeAnalysis />} />
            <Route path="/security" element={<SecurityDashboard />} />
            <Route path="/performance" element={<PerformanceDashboard />} />
            <Route path="/ai-insights" element={<AIInsightsDashboard />} />
            <Route path="/graph" element={<DependencyGraph />} />
            <Route path="/search" element={<SearchInterface />} />
            <Route path="/settings" element={<SettingsPanel />} />
          </Routes>
        </Box>
      </Box>

      {/* Error Snackbar */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={handleCloseError}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseError} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>

      {/* Connection Error */}
      <Snackbar
        open={!!connectionError}
        autoHideDuration={6000}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert severity="warning" sx={{ width: '100%' }}>
          WebSocket connection lost. Retrying...
        </Alert>
      </Snackbar>

      {/* Notifications */}
      {notifications.map((notification) => (
        <Snackbar
          key={notification.id}
          open={true}
          autoHideDuration={notification.duration || 5000}
          onClose={() => clearNotification(notification.id)}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <Alert 
            onClose={() => clearNotification(notification.id)} 
            severity={notification.type} 
            sx={{ width: '100%' }}
          >
            {notification.message}
          </Alert>
        </Snackbar>
      ))}
    </Box>
  );
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppProvider>
        <WebSocketProvider>
          <Router>
            <AppLayout />
          </Router>
        </WebSocketProvider>
      </AppProvider>
    </ThemeProvider>
  );
}

export default App;
