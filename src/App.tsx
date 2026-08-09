import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';

// Context Providers
import { ThemeProvider } from './context/ThemeContext';
import { UserProvider, useUser } from './context/UserContext';
import { NotificationProvider } from './context/NotificationContext';
import { PostProvider } from './context/PostContext';
import { GiftProvider } from './context/GiftContext';
import { WalletProvider } from './context/WalletContext';
import { AudioProvider } from './context/AudioContext';
import { VideoProvider } from './context/VideoContext';
import { KeyboardProvider } from './context/KeyboardContext';
import { NavigationProvider } from './context/NavigationContext';
import { GamificationProvider } from './context/GamificationContext';
import { ProfileImageProvider } from './context/ProfileImageContext';

// Components
import NotificationListener from './components/NotificationListener';

// Screens
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';
import MainApp from './MainApp';

// i18n
import { isI18nReady } from './i18n';

// Utils
import { configureAudio } from './utils/audioConfig';

configureAudio().catch(console.error);

function AppLoading() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#6366f1" />
      <Text style={styles.loadingText}>Loading...</Text>
    </View>
  );
}

function AppWithProviders({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  
  return (
    <NotificationProvider userId={user?.id}>
      <NotificationListener>
        <PostProvider currentUser={user}>
          <WalletProvider>
            <GiftProvider>
              <AudioProvider>
                <VideoProvider>
                  <KeyboardProvider>
                    <NavigationProvider>
                      <GamificationProvider>
                        {children}
                      </GamificationProvider>
                    </NavigationProvider>
                  </KeyboardProvider>
                </VideoProvider>
              </AudioProvider>
            </GiftProvider>
          </WalletProvider>
        </PostProvider>
      </NotificationListener>
    </NotificationProvider>
  );
}

export default function App() {
  const [i18nReady, setI18nReady] = useState(false);
  const [appReady, setAppReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(true); // true=Login, false=Signup

  console.log('🚀 App: STARTING');

  // Force app ready
  useEffect(() => {
    setAppReady(true);
    console.log('✅ App: appReady set to true');
  }, []);

  // Check i18n
  useEffect(() => {
    if (isI18nReady()) {
      setI18nReady(true);
      console.log('✅ App: i18n ready');
    } else {
      setTimeout(() => {
        setI18nReady(true);
        console.log('✅ App: i18n force ready');
      }, 1000);
    }
  }, []);

  // Check auth
  useEffect(() => {
    const checkAuth = async () => {
      console.log('🔍 Checking auth...');
      try {
        const token = await SecureStore.getItemAsync('auth_token');
        const userData = await SecureStore.getItemAsync('user_data');

        if (token && userData) {
          const parsedUser = JSON.parse(userData);
          console.log('✅ User found:', parsedUser.name);
          setUser(parsedUser);
          setIsAuthenticated(true);
        } else {
          console.log('⚠️ No auth data found');
          setUser(null);
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('❌ Auth error:', error);
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
        console.log('✅ Auth check complete');
      }
    };

    checkAuth();
  }, []);

  // Show loading
  if (!i18nReady || !appReady || isLoading) {
    console.log('⏳ App: Showing loading screen');
    return <AppLoading />;
  }

  // Show MainApp if authenticated
  if (isAuthenticated && user) {
    console.log('✅ App: Showing MainApp for', user.name);
    return (
      <SafeAreaProvider>
        <UserProvider>
          <ProfileImageProvider>
            <ThemeProvider>
              <AppWithProviders>
                <MainApp />
              </AppWithProviders>
            </ThemeProvider>
          </ProfileImageProvider>
        </UserProvider>
      </SafeAreaProvider>
    );
  }

  // ✅ Show Login or Signup
  console.log('✅ App: Showing', showLogin ? 'LoginScreen' : 'SignupScreen');
  
  if (showLogin) {
    return (
      <SafeAreaProvider>
        <UserProvider>
          <ProfileImageProvider>
            <ThemeProvider>
              <LoginScreen
                onLogin={() => {
                  console.log('🔐 Login successful');
                  setIsLoading(true);
                  setTimeout(() => {
                    setIsLoading(false);
                  }, 500);
                }}
                onSwitchToSignup={() => {
                  console.log('🔄 Switching to Signup');
                  setShowLogin(false);
                }}
              />
            </ThemeProvider>
          </ProfileImageProvider>
        </UserProvider>
      </SafeAreaProvider>
    );
  } else {
    return (
      <SafeAreaProvider>
        <UserProvider>
          <ProfileImageProvider>
            <ThemeProvider>
              <SignupScreen
                onSignup={() => {
                  console.log('📝 Signup successful');
                  setIsLoading(true);
                  setTimeout(() => {
                    setIsLoading(false);
                  }, 500);
                }}
                onSwitchToLogin={() => {
                  console.log('🔄 Switching to Login');
                  setShowLogin(true);
                }}
              />
            </ThemeProvider>
          </ProfileImageProvider>
        </UserProvider>
      </SafeAreaProvider>
    );
  }
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  loadingText: {
    fontSize: 16,
    marginTop: 12,
    fontWeight: '500',
    color: '#6366f1',
  },
});
