import { beforeEach, describe, expect, it } from 'vitest';
import { loadCustomTheme } from './theme-storage';
import {
  flushThemeWriteQueue,
  queueClearCustomTheme,
  queueSaveCustomTheme,
  resetThemeWriteQueue,
} from './theme-write-queue';

describe('theme write queue (Ticket 406)', () => {
  let stored: Record<string, unknown> = {};
  let setDelayMs = 0;

  beforeEach(() => {
    stored = {};
    setDelayMs = 0;
    resetThemeWriteQueue();
    chrome.storage.local.get = (async (key: string) => ({ [key]: stored[key] })) as never;
    chrome.storage.local.set = (async (items: Record<string, unknown>) => {
      if (setDelayMs > 0) {
        await new Promise((resolve) => {
          setTimeout(resolve, setDelayMs);
        });
      }
      stored = { ...stored, ...items };
    }) as never;
    chrome.storage.local.remove = (async (key: string) => {
      if (setDelayMs > 0) {
        await new Promise((resolve) => {
          setTimeout(resolve, setDelayMs);
        });
      }
      delete stored[key as string];
    }) as never;
  });

  it('keeps only the latest rapid edit after delayed storage writes', async () => {
    setDelayMs = 30;
    void queueSaveCustomTheme({ light: { accent: '#111111' } });
    void queueSaveCustomTheme({ light: { accent: '#222222' } });
    void queueSaveCustomTheme({ light: { accent: '#333333' } });
    await flushThemeWriteQueue();
    expect(await loadCustomTheme()).toEqual({ light: { accent: '#333333' } });
  });

  it('lets a later preset save supersede an earlier delayed edit', async () => {
    setDelayMs = 40;
    void queueSaveCustomTheme({ light: { accent: '#aaaaaa' } });
    void queueSaveCustomTheme({
      light: { accent: '#00aabb' },
      dark: { fg: '#ffffff' },
    });
    await flushThemeWriteQueue();
    expect(await loadCustomTheme()).toEqual({
      light: { accent: '#00aabb' },
      dark: { fg: '#ffffff' },
    });
  });

  it('Reset clears storage even when a save was already in flight', async () => {
    setDelayMs = 40;
    void queueSaveCustomTheme({ light: { accent: '#ff0000' } });
    void queueClearCustomTheme();
    await flushThemeWriteQueue();
    expect(await loadCustomTheme()).toEqual({});
  });

  it('a save after Reset persists again (new generation wins)', async () => {
    setDelayMs = 20;
    void queueSaveCustomTheme({ light: { accent: '#111111' } });
    void queueClearCustomTheme();
    void queueSaveCustomTheme({ light: { accent: '#abcdef' } });
    await flushThemeWriteQueue();
    expect(await loadCustomTheme()).toEqual({ light: { accent: '#abcdef' } });
  });

  it('survives a failing storage.set and still applies a later save', async () => {
    let failOnce = true;
    chrome.storage.local.set = (async (items: Record<string, unknown>) => {
      if (failOnce) {
        failOnce = false;
        throw new Error('quota');
      }
      stored = { ...stored, ...items };
    }) as never;
    await queueSaveCustomTheme({ light: { accent: '#111111' } });
    await queueSaveCustomTheme({ light: { accent: '#222222' } });
    await flushThemeWriteQueue();
    expect(await loadCustomTheme()).toEqual({ light: { accent: '#222222' } });
  });
});
