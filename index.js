    token: 'test-token-' + Date.now(),
    user: { id: 1, email, name: 'Test User', username: '@testuser' }
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ message: 'BirthdayApp API is running!' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});


# (Paste the complete code from above here)
