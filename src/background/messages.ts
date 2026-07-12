import { collectDomForActiveTab, type CollectDomResult } from '../lib/collect-dom';
import {
  glanceDomInventoryForActiveTab,
  type GlanceInventoryResult,
} from '../lib/dashboard/glance';
import type { AuditSession } from '../lib/schemas/audit';
import { SessionRepository } from '../lib/storage/session-repository';
import { getActiveTabSnapshot, pingActiveTab, type ActiveTabSnapshot } from '../lib/tab-access';

const repo = new SessionRepository();

export type ExtensionRequest =
  | { type: 'GET_ACTIVE_TAB_SNAPSHOT' }
  | { type: 'PING_ACTIVE_TAB'; tabId: number }
  | { type: 'GLANCE_DOM_INVENTORY' }
  | { type: 'COLLECT_DOM_SNAPSHOT' }
  | { type: 'LOAD_SESSION'; sessionId: string }
  | { type: 'SAVE_REPORT_MARKDOWN'; sessionId: string; markdown: string };

export type ExtensionResponse =
  | { type: 'ACTIVE_TAB_SNAPSHOT'; snapshot: ActiveTabSnapshot }
  | {
      type: 'PING_RESULT';
      result: Awaited<ReturnType<typeof pingActiveTab>>;
    }
  | { type: 'GLANCE_DOM_RESULT'; result: GlanceInventoryResult }
  | { type: 'COLLECT_DOM_RESULT'; result: CollectDomResult }
  | {
      type: 'SESSION_LOADED';
      result:
        | { status: 'ok'; session: AuditSession }
        | { status: 'missing'; id: string }
        | { status: 'quarantined'; reason: string };
    }
  | { type: 'REPORT_SAVED'; sessionId: string }
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
    case 'GLANCE_DOM_INVENTORY':
      return {
        type: 'GLANCE_DOM_RESULT',
        result: await glanceDomInventoryForActiveTab(),
      };
    case 'COLLECT_DOM_SNAPSHOT':
      return {
        type: 'COLLECT_DOM_RESULT',
        result: await collectDomForActiveTab(repo),
      };
    case 'LOAD_SESSION': {
      const loaded = await repo.get(message.sessionId);
      if (loaded.status === 'ok') {
        return { type: 'SESSION_LOADED', result: { status: 'ok', session: loaded.session } };
      }
      if (loaded.status === 'missing') {
        return { type: 'SESSION_LOADED', result: { status: 'missing', id: loaded.id } };
      }
      return {
        type: 'SESSION_LOADED',
        result: { status: 'quarantined', reason: loaded.record.reason },
      };
    }
    case 'SAVE_REPORT_MARKDOWN': {
      const loaded = await repo.get(message.sessionId);
      if (loaded.status !== 'ok') {
        return {
          type: 'ERROR',
          message:
            loaded.status === 'missing'
              ? `Session ${message.sessionId} was not found.`
              : `Session ${message.sessionId} is quarantined and cannot be edited.`,
        };
      }
      loaded.session.reportMarkdown = message.markdown;
      await repo.save(loaded.session);
      return { type: 'REPORT_SAVED', sessionId: message.sessionId };
    }
    default: {
      const _exhaustive: never = message;
      return { type: 'ERROR', message: `Unhandled message: ${JSON.stringify(_exhaustive)}` };
    }
  }
}
