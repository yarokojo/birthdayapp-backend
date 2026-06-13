const axios = require('axios');

// Paystack configuration - PRODUCTION KEYS
const PAYSTACK_SECRET_KEY = 'sk_test_de04df2faa307d3208d835b6cec51f89ae57c9db';
const PAYSTACK_PUBLIC_KEY = 'pk_test_3ccfca7f0030c760b18315a84bece771b4033986';

// Initialize mobile money payment
const initializeMobileMoneyPayment = async (amount, email, phone, name, giftName) => {
  try {
    console.log(`[PAYMENT] Initializing: ₵${amount} for ${giftName} to ${phone}`);
    
    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        amount: amount * 100,
        email: email,
        currency: 'GHS',
        channels: ['mobile_money'],
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
    
    console.log(`[PAYMENT] Success: ${response.data.data.reference}`);
    
    return {
      success: true,
      authorization_url: response.data.data.authorization_url,
      reference: response.data.data.reference,
      message: 'Check your phone for payment prompt'
    };
  } catch (error) {
    console.error('Paystack error:', error.response?.data || error.message);
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
      console.log(`[PAYMENT] Verified: ${reference}`);
      return {
        success: true,
        amount: response.data.data.amount / 100,
        gift_name: response.data.data.metadata?.gift_name,
        customer_name: response.data.data.metadata?.customer_name,
        transaction_id: response.data.data.id,
        reference: reference
      };
    } else {
      return {
        success: false,
        error: 'Payment not successful',
      };
    }
  } catch (error) {
    console.error('Verification error:', error.response?.data || error.message);
    return {
      success: false,
      error: 'Verification failed',
    };
  }
};

// Send money to user's mobile money (for withdrawals)
const sendMoneyToMobileMoney = async (amount, phoneNumber, provider) => {
  try {
    // Create transfer recipient
    const recipientResponse = await axios.post(
      'https://api.paystack.co/transferrecipient',
      {
        type: 'mobile_money',
        name: 'Customer',
        currency: 'GHS',
        mobile_money: {
          phone: phoneNumber,
          provider: provider.toLowerCase(),
        },
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    const recipientCode = recipientResponse.data.data.recipient_code;
    
    // Initiate transfer
    const transferResponse = await axios.post(
      'https://api.paystack.co/transfer',
      {
        source: 'balance',
        amount: amount * 100,
        currency: 'GHS',
        recipient: recipientCode,
        reason: 'Birthday gift withdrawal',
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
      reference: transferResponse.data.data.reference,
      message: 'Transfer initiated successfully'
    };
  } catch (error) {
    console.error('Transfer error:', error.response?.data || error.message);
    return {
      success: false,
      error: 'Transfer failed',
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
  sendMoneyToMobileMoney,
  detectMobileMoneyProvider,
};
