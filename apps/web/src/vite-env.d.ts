/// <reference types="vite/client" />

interface TelegramWebApp {
  ready: () => void;
  expand: () => void;
  colorScheme: 'light' | 'dark';
  initData: string;
}

interface Window {
  Telegram?: {
    WebApp: TelegramWebApp;
  };
}
