import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.embersurvivors.game',
  appName: 'Ember Survivors',
  webDir: 'dist',
  android: {
    // Keeps the canvas from being resized by the soft keyboard / system bars.
    adjustMarginsForEdgeToEdge: 'force',
    backgroundColor: '#0b0f1a',
  },
  ios: {
    backgroundColor: '#0b0f1a',
    contentInset: 'never',
  },
  plugins: {
    StatusBar: {
      overlaysWebView: true,
      style: 'DARK',
      backgroundColor: '#00000000',
    },
  },
};

export default config;
