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
      
      // ✅ DEBUG: Log token status
      console.log('🔑 Token exists:', !!token);
      console.log('🔑 Token length:', token?.length || 0);
      console.log('🔑 Token prefix:', token?.substring(0, 20) + '...');
      
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

// ============================================================
// WALLET API
// ============================================================
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
  addGift: async (data: any) => {
    const response = await api.post('/wallet/add-gift', data);
    return response.data;
  },
};

// ============================================================
// POSTS API
// ============================================================
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

// ============================================================
// UPLOAD VIDEO
// ============================================================
export const uploadVideo = async (videoUri: string): Promise<string> => {
  console.log('🎬 uploadVideo called with URI:', videoUri);
  
  try {
    let uploadUri = videoUri;
    let fileSize = 0;
    
    try {
      const fileInfo = await FileSystem.getInfoAsync(videoUri);
      fileSize = fileInfo.size || 0;
      console.log(`📊 Original file size: ${formatFileSize(fileSize)}`);
    } catch (e) {
      console.log('⚠️ Could not get file size');
    }
    
    if (fileSize > 10 * 1024 * 1024) {
      console.log('🔄 Video is large, compressing...');
      try {
        const result = await ImageManipulator.manipulateAsync(
          videoUri,
          [],
          {
            compress: 0.5,
            format: ImageManipulator.SaveFormat.MP4,
          }
        );
        uploadUri = result.uri;
        const newInfo = await FileSystem.getInfoAsync(uploadUri);
        console.log(`✅ Compressed to: ${formatFileSize(newInfo.size || 0)}`);
      } catch (e) {
        console.log('⚠️ Could not compress video, using original');
        uploadUri = videoUri;
      }
    }
    
    const formData = new FormData();
    const fileName = uploadUri.split('/').pop() || 'video.mp4';
    const fileType = fileName.split('.').pop() || 'mp4';
    
    const fileObject = {
      uri: uploadUri,
      type: `video/${fileType}`,
      name: fileName,
    } as any;
    
    formData.append('video', fileObject);
    
    console.log('📤 Uploading video...');
    
    const response = await api.post('/upload/video', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 60000,
    });
    
    console.log('✅ Video uploaded successfully');
    return response.data.videoUrl;
  } catch (error: any) {
    console.error('❌ Video upload error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error || 'Failed to upload video');
  }
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

export default api;
