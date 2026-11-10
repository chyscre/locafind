import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.neust.locafind',
  appName: 'LocaFind',
  webDir: 'www',
  server: {
    // The XAMPP API on the laptop is plain HTTP (no certificate). With the default
    // "https" scheme, Android would block those calls as mixed content.
    androidScheme: 'http',
    cleartext: true,
  },
};

export default config;
