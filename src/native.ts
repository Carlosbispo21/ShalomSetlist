import { Capacitor, registerPlugin } from '@capacitor/core';
export const nativeAndroid = Capacitor.getPlatform() === 'android';
export const readerDisplay = registerPlugin<{
  setReading(options: { reading: boolean }): Promise<void>;
  openApk(options: { url: string }): Promise<void>;
}>('ReaderDisplay');
