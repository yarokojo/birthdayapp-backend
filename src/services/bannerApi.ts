import { api } from './api';

export interface Banner {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  colors: string[];
  type: string;
  link?: string;
  active: boolean;
  priority: number;
  views: number;
  clicks: number;
  createdAt: string;
}

// Get all active banners
export const getBanners = async (): Promise<Banner[]> => {
  try {
    const response = await api.get('/banners');
    if (response.data.success) {
      return response.data.banners || [];
    }
    return [];
  } catch (error) {
    console.error('Failed to load banners:', error);
    // Return fallback banners if API fails
    return getFallbackBanners();
  }
};

// Track banner click - SILENT FAIL (no error logs)
export const trackBannerClick = async (bannerId: string): Promise<boolean> => {
  try {
    await api.post(`/banners/${bannerId}/click`);
    return true;
  } catch (error) {
    // Silent fail - don't log errors for tracking
    return false;
  }
};

// Track banner view - SILENT FAIL (no error logs)
export const trackBannerView = async (bannerId: string): Promise<boolean> => {
  try {
    await api.post(`/banners/${bannerId}/view`);
    return true;
  } catch (error) {
    // Silent fail - don't log errors for tracking
    return false;
  }
};

// Fallback banners if API fails
export const getFallbackBanners = (): Banner[] => {
  return [
    {
      id: 'banner_fallback_1',
      title: '🎉 Today\'s Celebrations',
      subtitle: 'Check out today\'s events!',
      icon: '🎂',
      colors: ['#6366f1', '#8b5cf6', '#a855f7'],
      type: 'celebrations',
      link: 'today',
      active: true,
      priority: 1,
      views: 0,
      clicks: 0,
      createdAt: new Date().toISOString()
    },
    {
      id: 'banner_fallback_2',
      title: '🎁 Gift Shop',
      subtitle: 'Send a gift to someone special',
      icon: '🎁',
      colors: ['#ec4899', '#f472b6', '#f9a8d4'],
      type: 'gifts',
      link: 'gift_shop',
      active: true,
      priority: 2,
      views: 0,
      clicks: 0,
      createdAt: new Date().toISOString()
    }
  ];
};
