const axios = require('axios');

const EXPO_ACCESS_TOKEN = process.env.EXPO_ACCESS_TOKEN;

const sendPushNotification = async (expoPushToken, title, body, data = {}) => {
  if (!expoPushToken || !EXPO_ACCESS_TOKEN) {
    console.log('⚠️ Push notification skipped: missing token or config');
    return { success: false, error: 'Missing configuration' };
  }

  try {
    const response = await axios.post(
      'https://exp.host/--/api/v2/push/send',
      {
        to: expoPushToken,
        title,
        body,
        data,
        sound: 'default',
        priority: 'high'
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${EXPO_ACCESS_TOKEN}`
        }
      }
    );

    return { success: true, data: response.data };
  } catch (error) {
    console.error('Push notification error:', error.response?.data || error.message);
    return { success: false, error: error.message };
  }
};

const sendBatchPushNotifications = async (tokens, title, body, data = {}) => {
  if (!tokens || tokens.length === 0) {
    return { success: false, error: 'No tokens' };
  }

  try {
    const messages = tokens.map(token => ({
      to: token,
      title,
      body,
      data,
      sound: 'default',
      priority: 'high'
    }));

    const response = await axios.post(
      'https://exp.host/--/api/v2/push/send',
      messages,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${EXPO_ACCESS_TOKEN}`
        }
      }
    );

    return { success: true, data: response.data };
  } catch (error) {
    console.error('Batch push error:', error.response?.data || error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendPushNotification,
  sendBatchPushNotifications
};
