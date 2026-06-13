const axios = require('axios');

// Paystack configuration
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || 'your_secret_key_here';
const PAYSTACK_PUBLIC_KEY = process.env.PAYSTACK_PUBLIC_KEY || 'your_public_key_here';

// Initialize mobile money payment
const initializeMobileMoneyPayment = async (amount, email, phone, name, giftName) => {
  try {
    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        amount: amount * 100,
        email: email,
        currency: 'GHS',
        mobile_money: {
          phone: phone,
          provider: detectMobileMoneyProvider(phone),
        },
        metadata: {
          gift_name: giftName,
          customer_name: name,
        },
        callback_url: 'https://birthdayapp-backend-6v2v.onrender.com/api/payment/verify',
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    return {
      success: true,
      authorization_url: response.data.data.authorization_url,
      reference: response.data.data.reference,
    };
  } catch (error) {
    console.error('Paystack initialization error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || 'Payment initialization failed',
    };
  }
};

// Verify payment
const verifyPayment = async (reference) => {
  try {
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        },
      }
    );
    
    if (response.data.data.status === 'success') {
      return {
        success: true,
        amount: response.data.data.amount / 100,
        gift_name: response.data.data.metadata?.gift_name,
        customer_name: response.data.data.metadata?.customer_name,
        transaction_id: response.data.data.id,
      };
    } else {
      return {
        success: false,
        error: 'Payment not successful',
      };
    }
  } catch (error) {
    console.error('Payment verification error:', error.response?.data || error.message);
    return {
      success: false,
      error: 'Verification failed',
    };
  }
};

// Detect mobile money provider from phone number
const detectMobileMoneyProvider = (phone) => {
  const cleanPhone = phone.replace(/\D/g, '');
  
  if (/^(024|054|055|059)/.test(cleanPhone)) {
    return 'mtn';
  }
  if (/^(020|050)/.test(cleanPhone)) {
    return 'vodafone';
  }
  if (/^(026|056|057)/.test(cleanPhone)) {
    return 'airteltigo';
  }
  return 'mtn';
};

module.exports = {
  initializeMobileMoneyPayment,
  verifyPayment,
  detectMobileMoneyProvider,
};
