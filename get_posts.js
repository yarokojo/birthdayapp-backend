app.get('/api/posts', (req, res) => {
  const allPosts = data.posts || [];
  const enrichedPosts = allPosts.map(post => {
    const author = data.users.find(u => u.id === post.userId);
    return { 
      ...post, 
      phone: author?.phone || '', 
      network: author?.network || 'MTN',
      // ✅ Ensure song data is preserved
      birthdaySongId: post.birthdaySongId || null,
      birthdaySongUrl: post.birthdaySongUrl || null,
      birthdaySongName: post.birthdaySongName || null,
    };
  });
  
  // ✅ Log posts with songs for debugging
  const songs = enrichedPosts.filter(p => p.birthdaySongUrl && p.birthdaySongUrl !== '');
  if (songs.length > 0) {
    console.log(`🎵 Returning ${songs.length} posts with birthday songs`);
    songs.forEach(p => {
      console.log(`  🎵 ${p.id}: ${p.birthdaySongName} -> ${p.birthdaySongUrl?.substring(0, 50)}...`);
    });
  }
  
  res.json(enrichedPosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});
