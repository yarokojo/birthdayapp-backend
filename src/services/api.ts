// ... keep everything, just update the postsApi section

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
  // ✅ FIXED: Edit comment
  editComment: async (postId: string, commentId: string, text: string) => {
    const response = await api.put(`/posts/${postId}/comments/${commentId}`, { text });
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
