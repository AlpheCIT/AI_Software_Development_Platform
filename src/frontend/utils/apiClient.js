/**
 * API Client Utility
 * 
 * Axios-based HTTP client with:
 * - Request/response interceptors
 * - Error handling
 * - Authentication
 * - Request timeout
 * - Retry logic
 */

import axios from 'axios';

// Create axios instance
const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3001/api/v1',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add request timestamp
    config.metadata = { startTime: new Date() };

    console.log(`🚀 ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('❌ Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    const duration = new Date() - response.config.metadata.startTime;
    console.log(`✅ ${response.config.method?.toUpperCase()} ${response.config.url} (${duration}ms)`);
    return response;
  },
  async (error) => {
    const duration = error.config?.metadata 
      ? new Date() - error.config.metadata.startTime 
      : 0;
    
    console.error(`❌ ${error.config?.method?.toUpperCase()} ${error.config?.url} (${duration}ms)`, error.response?.status, error.message);

    // Handle specific error cases
    if (error.response) {
      const { status, data } = error.response;
      
      switch (status) {
        case 401:
          // Unauthorized - clear auth and redirect to login
          localStorage.removeItem('authToken');
          window.location.href = '/login';
          break;
          
        case 403:
          // Forbidden
          throw new Error('Access denied. You do not have permission for this action.');
          
        case 404:
          // Not found
          throw new Error('Resource not found.');
          
        case 429:
          // Rate limited
          throw new Error('Too many requests. Please wait before trying again.');
          
        case 500:
          // Server error
          throw new Error('Internal server error. Please try again later.');
          
        default:
          // Other errors
          throw new Error(data?.message || `Request failed with status ${status}`);
      }
    } else if (error.request) {
      // Network error
      throw new Error('Network error. Please check your connection and try again.');
    } else {
      // Other error
      throw new Error(error.message || 'An unexpected error occurred.');
    }
  }
);

// Retry logic for failed requests
const retryRequest = async (config, maxRetries = 3, delay = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiClient(config);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      // Only retry on network errors or 5xx status codes
      if (error.response && error.response.status < 500) {
        throw error;
      }
      
      console.warn(`Retry attempt ${i + 1}/${maxRetries} for ${config.method} ${config.url}`);
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
    }
  }
};

// Utility functions
export const api = {
  // Standard HTTP methods
  get: (url, config = {}) => apiClient.get(url, config),
  post: (url, data, config = {}) => apiClient.post(url, data, config),
  put: (url, data, config = {}) => apiClient.put(url, data, config),
  patch: (url, data, config = {}) => apiClient.patch(url, data, config),
  delete: (url, config = {}) => apiClient.delete(url, config),
  
  // Retry-enabled methods
  getWithRetry: (url, config = {}) => retryRequest({ method: 'GET', url, ...config }),
  postWithRetry: (url, data, config = {}) => retryRequest({ method: 'POST', url, data, ...config }),
  
  // Upload with progress
  upload: (url, file, onProgress) => {
    const formData = new FormData();
    formData.append('file', file);
    
    return apiClient.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      }
    });
  },
  
  // Download with progress
  download: (url, filename, onProgress) => {
    return apiClient.get(url, {
      responseType: 'blob',
      onDownloadProgress: (progressEvent) => {
        if (onProgress && progressEvent.lengthComputable) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      }
    }).then(response => {
      // Create download link
      const blob = new Blob([response.data]);
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(link.href);
    });
  }
};

// Set auth token
export const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem('authToken', token);
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    localStorage.removeItem('authToken');
    delete apiClient.defaults.headers.common['Authorization'];
  }
};

// Get auth token
export const getAuthToken = () => {
  return localStorage.getItem('authToken');
};

// Check if user is authenticated
export const isAuthenticated = () => {
  return !!getAuthToken();
};

export { apiClient };
export default apiClient;
