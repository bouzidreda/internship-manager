import axios from "axios";

export const AUTH_STORAGE_EVENT = "stageflow:auth-storage-change";

const hasWindow = typeof window !== "undefined";

//set up a flexible baseURl config for axios switching from env var to local server to current browser host
const resolveApiBaseUrl = () => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  if (!hasWindow) {
    return "http://localhost:5000/api";
  }

  return `${window.location.protocol}//${window.location.hostname}:5000/api`;
};

// it dispatches an event to the window object to notify other components that the auth storage has changed
const dispatchAuthStorageChange = () => {
  if (!hasWindow) {
    return;
  }

  window.dispatchEvent(new Event(AUTH_STORAGE_EVENT));
};

// config some authorization headers for axios, axios it allows to set a default headers for all request
const setAuthorizationHeader = (token) => {
  if (token) {
    apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
    return;
  }

  delete apiClient.defaults.headers.common.Authorization;
};

export const getStoredToken = () => {
  if (!hasWindow) {
    return null;
  }

  return window.localStorage.getItem("token");
};

export const getStoredUser = () => {
  if (!hasWindow) {
    return null;
  }

  const rawUser = window.localStorage.getItem("user");
  if (!rawUser) {
    return null;
  }

  try {
    return JSON.parse(rawUser);
  } catch {
    window.localStorage.removeItem("user");
    return null;
  }
};

export const persistSession = ({ token, user }) => {
  if (!hasWindow) {
    return;
  }

  if (token) {
    window.localStorage.setItem("token", token);
  } else {
    window.localStorage.removeItem("token");
  }

  if (user) {
    window.localStorage.setItem("user", JSON.stringify(user));
  } else {
    window.localStorage.removeItem("user");
  }

  setAuthorizationHeader(token);
  dispatchAuthStorageChange();
};

export const clearStoredSession = () => {
  if (!hasWindow) {
    return;
  }

  window.localStorage.removeItem("token");
  window.localStorage.removeItem("user");
  setAuthorizationHeader(null);
  dispatchAuthStorageChange();
};

const apiClient = axios.create({
  baseURL: resolveApiBaseUrl()
});

setAuthorizationHeader(getStoredToken());

// do something before request is sent
apiClient.interceptors.request.use((config) => {
  const token = getStoredToken();
  config.headers = config.headers || {};

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    delete config.headers.Authorization;
  }

  return config;
});

// MEDIUM FIX #8: Handle JWT expiry with proper redirect to login
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearStoredSession(); //suprimer user and token since its expired
      
      // Only redirect if we're in a browser environment
      if (typeof window !== 'undefined') {
        // Avoid redirect loops - only redirect if not already on login/auth pages
        const currentPath = window.location.pathname;
        const isAuthPage = currentPath.includes('/login') || 
                          currentPath.includes('/register') || 
                          currentPath.includes('/forgot-password') || 
                          currentPath.includes('/reset-password') ||
                          currentPath.includes('/verify-email');
        
        if (!isAuthPage) {
          // Store the intended destination for post-login redirect
          const returnUrl = currentPath + window.location.search;
          window.location.href = `/login?returnUrl=${encodeURIComponent(returnUrl)}`;
        }
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;

