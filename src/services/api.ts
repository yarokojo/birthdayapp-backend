import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';

// ✅ Use the correct backend URL
const API_URL = 'http://10.178.118.214:5000/api';

console.log('🌐 API_URL:', API_URL);

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 30000,
});

// ... rest of the file (keep the same)
