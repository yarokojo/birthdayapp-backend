import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';

// ✅ YOUR COMPUTER'S IP
const YOUR_IP = '10.133.251.210';

const getApiUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  if (Platform.OS === 'android') {
    return `http://${YOUR_IP}:5000/api`;
  }

  if (Platform.OS === 'ios') {
    return 'http://localhost:5000/api';
  }

  return `http://${YOUR_IP}:5000/api`;
};

const API_URL = getApiUrl();
console.log('🌐 API_URL:', API_URL);

// ✅ Create and export api
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 60000,
});

api.interceptors.request.use(
  async (config) => {
    try {
      const token = await SecureStore.getItemAsync('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      console.log(`📤 ${config.method?.toUpperCase()} ${config.url}`);
      return config;
    } catch (error) {
      return config;
    }
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.log('⚠️ 401 Unauthorized');
    }
    if (error.response?.status === 404) {
      console.log('⚠️ 404 Not Found:', error.config?.url);
    }
    if (!error.response) {
      console.error('❌ Network error:', error.message);
    }
    return Promise.reject(error);
  }
);

// ✅ UPLOAD VIDEO FUNCTION
export const uploadVideo = async (videoUri: string): Promise<string> => {
  console.log('🎬 Uploading video:', videoUri);
  
  try {
    const formData = new FormData();
    const filename = videoUri.split('/').pop() || 'video.mp4';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `video/${match[1]}` : 'video/mp4';
    
    formData.append('video', {
      uri: videoUri,
      name: filename,
      type: type,
    } as any);
    
    const response = await api.post('/upload/video', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 180000, // 3 minutes
    });
    
    if (response.data && response.data.videoUrl) {
      console.log('✅ Video uploaded:', response.data.videoUrl);
      return response.data.videoUrl;
    }
    
    throw new Error('No videoUrl in response');
  } catch (error: any) {
    console.error('❌ Video upload error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error || 'Video upload failed');
  }
};

// ✅ AUTH API
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

// ✅ POSTS API
export const postsApi = {
  getAll: async () => {
    const response = await api.get('/posts');
    return response.data;
  },
  create: async (data: any) => {
    const response = await api.post('/posts', data);
    return response.data;
  },
  delete: async (postId: string) => {
    await api.delete(`/posts/${postId}`);
  },
  like: async (postId: string) => {
    await api.post(`/posts/${postId}/like`);
  },
  unlike: async (postId: string) => {
    await api.delete(`/posts/${postId}/like`);
  },
  addComment: async (postId: string, text: string) => {
    const response = await api.post(`/posts/${postId}/comments`, { text });
    return response.data;
  },
  // ✅ EDIT COMMENT - NEW
  editComment: async (postId: string, commentId: string, text: string) => {
    const response = await api.put(`/posts/${postId}/comments/${commentId}`, { text });
    return response.data;
  },
  // ✅ DELETE COMMENT - NEW
  deleteComment: async (postId: string, commentId: string) => {
    await api.delete(`/posts/${postId}/comments/${commentId}`);
  },
  bookmark: async (postId: string) => {
    await api.post(`/posts/${postId}/bookmark`);
  },
  unbookmark: async (postId: string) => {
    await api.delete(`/posts/${postId}/bookmark`);
  },
};

// ✅ FRIENDS API
export const friendsApi = {
  getList: async (userId?: string) => {
    const url = userId ? `/friends/list/${userId}` : '/friends/list';
    const response = await api.get(url);
    return response.data;
  },
  getRequests: async () => {
    const response = await api.get('/friends/requests');
    return response.data;
  },
  sendRequest: async (toUserId: string) => {
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

// ✅ WALLET API
export const walletApi = {
  getBalance: async () => {
    const response = await api.get('/wallet/balance');
    return response.data;
  },
  getTransactions: async () => {
    const response = await api.get('/wallet/transactions');
    return response.data;
  },
  withdraw: async (amount: number, network: string, phoneNumber: string) => {
    const response = await api.post('/wallet/withdraw', { amount, network, phoneNumber });
    return response.data;
  },
};

export default api;

// ============================================================
// STORIES API
// ============================================================
export const storiesApi = {
  getAll: async () => {
    const response = await api.get('/stories');
    return response.data;
  },
  create: async (formData: any) => {
    const response = await api.post('/stories', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  like: async (storyId: string) => {
    await api.post(`/stories/${storyId}/like`);
  },
  unlike: async (storyId: string) => {
    await api.delete(`/stories/${storyId}/like`);
  },
  view: async (storyId: string) => {
    await api.post(`/stories/${storyId}/view`);
  },
  delete: async (storyId: string) => {
    await api.delete(`/stories/${storyId}`);
  },
};
