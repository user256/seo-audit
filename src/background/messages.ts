import { getActiveTabSnapshot, pingActiveTab, type ActiveTabSnapshot } from '../lib/tab-access';

export type ExtensionRequest =
  | { type: 'GET_ACTIVE_TAB_SNAPSHOT' }
  | { type: 'PING_ACTIVE_TAB'; tabId: number };

export type ExtensionResponse =
  | { type: 'ACTIVE_TAB_SNAPSHOT'; snapshot: ActiveTabSnapshot }
  | {
      type: 'PING_RESULT';
      result: Awaited<ReturnType<typeof pingActiveTab>>;
    }
  | { type: 'ERROR'; message: string };

export async function handleExtensionRequest(
  message: ExtensionRequest,
): Promise<ExtensionResponse> {
  switch (message.type) {
    case 'GET_ACTIVE_TAB_SNAPSHOT':
      return {
        type: 'ACTIVE_TAB_SNAPSHOT',
        snapshot: await getActiveTabSnapshot(),
      };
    case 'PING_ACTIVE_TAB':
      return {
        type: 'PING_RESULT',
        result: await pingActiveTab(message.tabId),
      };
    default: {
      const _exhaustive: never = message;
      return { type: 'ERROR', message: `Unknown message: ${JSON.stringify(_exhaustive)}` };
    }
  }
}
