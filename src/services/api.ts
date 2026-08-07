import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

// ✅ Use environment variable with fallbacks for different environments
const getApiUrl = () => {
  // 1. Check environment variable first
  if (process.env.EXPO_PUBLIC_API_URL) {
    console.log('🌐 Using API_URL from env:', process.env.EXPO_PUBLIC_API_URL);
    return process.env.EXPO_PUBLIC_API_URL;
  }
  
  // 2. Detect platform for development fallbacks
  // @ts-ignore - Constants available in Expo
  if (Constants?.manifest?.debuggerHost) {
    // @ts-ignore - Using Expo Constants
    const host = Constants.manifest.debuggerHost.split(':')[0];
    return `http://${host}:5000/api`;
  }
  
  // 3. Android emulator fallback
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:5000/api';
  }
  
  // 4. iOS simulator / local fallback
  return 'http://localhost:5000/api';
};

const API_URL = getApiUrl();

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
      const token = await SecureStore.getItemAsync('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    } catch (error) {
      return config;
    }
  },
  (error) => Promise.reject(error)
);

// ✅ Add response interceptor for better error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED') {
      console.error('❌ Request timeout - server not responding');
    } else if (!error.response) {
      console.error('❌ Network error - cannot reach server:', error.message);
      console.error('   Check: Is backend running? Is URL correct?');
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
// FRIENDS API
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
// UPLOAD IMAGE
// ============================================================
export const uploadImage = async (imageUri: string): Promise<string> => {
  console.log('📸 Uploading image:', imageUri);
  
  try {
    const fileInfo = await FileSystem.getInfoAsync(imageUri);
    console.log('📊 File size:', fileInfo.size);
    
    const formData = new FormData();
    const filename = imageUri.split('/').pop() || 'profile.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';
    
    formData.append('image', {
      uri: imageUri,
      name: filename,
      type: type,
    } as any);
    
    const response = await api.post('/upload/image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 30000,
    });
    
    console.log('✅ Upload response:', response.data);
    return response.data.imageUrl;
  } catch (error: any) {
    console.error('❌ Upload error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error || 'Failed to upload image');
  }
};

// ============================================================
// UPLOAD VIDEO
// ============================================================
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
      timeout: 60000,
    });
    
    return response.data.videoUrl;
  } catch (error: any) {
    console.error('❌ Video upload error:', error);
    throw new Error(error.response?.data?.error || 'Failed to upload video');
  }
};

export default api;
