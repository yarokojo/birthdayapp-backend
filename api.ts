
// ============================================================
// STORIES API
// ============================================================
export const storiesApi = {
  // Get all stories
  getAll: async () => {
    const response = await api.get('/stories');
    return response.data;
  },
  // Create a story
  create: async (formData: FormData) => {
    const response = await api.post('/stories', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  // Like a story
  like: async (storyId: string) => {
    await api.post(`/stories/${storyId}/like`);
  },
  // Unlike a story
  unlike: async (storyId: string) => {
    await api.delete(`/stories/${storyId}/like`);
  },
  // Mark story as viewed
  view: async (storyId: string) => {
    await api.post(`/stories/${storyId}/view`);
  },
};
