import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api';

console.log('🌐 API_URL:', API_URL);

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 30000,
});

// ============================================================
// INTERCEPTORS
// ============================================================
api.interceptors.request.use(
  async (config) => {
    try {
      let token = await SecureStore.getItemAsync('auth_token');
      if (!token) {
        token = await SecureStore.getItemAsync('token');
      }
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        console.log(`✅ Token attached to ${config.url}`);
      } else {
        console.log(`⚠️ No token for ${config.url}`);
      }
      return config;
    } catch (error) {
      console.error('❌ Token error:', error);
      return config;
    }
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => {
    console.log(`📥 ${response.status} ${response.config.url}`);
    return response;
  },
  async (error) => {
    if (error.response) {
      console.error(`❌ API Error: ${error.response.status} ${error.response.config?.url}`);
      if (error.response.status === 401) {
        console.log('🔴 401 - Clearing invalid token');
        await SecureStore.deleteItemAsync('auth_token');
        await SecureStore.deleteItemAsync('token');
      }
    }
    return Promise.reject(error);
  }
);

// ============================================================
// AUTH API
// ============================================================
export const authApi = {
  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },
  register: async (email: string, password: string, name: string, username: string, birthDate?: string) => {
    const response = await api.post('/auth/register', { email, password, name, username, birthDate });
    return response.data;
  },
  getProfile: async () => {
    const response = await api.get('/users/profile');
    return response.data;
  },
  updateProfile: async (data: any) => {
    const response = await api.put('/users/profile', data);
    return response.data;
  },
  changePassword: async (currentPassword: string, newPassword: string) => {
    const response = await api.post('/auth/change-password', { currentPassword, newPassword });
    return response.data;
  },
};

// ============================================================
// FRIENDS API - ALL USE UUIDs (strings)
// ============================================================
export const friendsApi = {
  getList: async (userId?: string) => {  // ✅ Changed to string
    const url = userId ? `/friends/list/${userId}` : '/friends/list';
    const response = await api.get(url);
    return response.data;
  },
  getRequests: async () => {
    const response = await api.get('/friends/requests');
    return response.data;
  },
  sendRequest: async (toUserId: string) => {  // ✅ Changed to string
    const response = await api.post('/friends/request', { toUserId });
    return response.data;
  },
  acceptRequest: async (requestId: string) => {
    const response = await api.post('/friends/accept', { requestId });
    return response.data;
  },
  declineRequest: async (requestId: string) => {
    const response = await api.post('/friends/decline', { requestId });
    return response.data;
  },
  unfriend: async (friendId: string) => {
    const response = await api.delete(`/friends/${friendId}`);
    return response.data;
  },
  getBirthdays: async () => {
    const response = await api.get('/friends/birthdays');
    return response.data;
  },
};

// ... rest of api.ts (keep existing code)
