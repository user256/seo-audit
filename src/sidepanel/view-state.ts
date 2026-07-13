import type { ActiveTabSnapshot } from '../lib/tab-access';

export type SidePanelView = {
  urlLabel: string;
  accessLabel: string;
  status: string;
  statusKind: 'plain' | 'ok' | 'error';
  showAllow: boolean;
  showPing: boolean;
  showCollect: boolean;
};

export function viewFromSnapshot(snapshot: ActiveTabSnapshot): SidePanelView {
  if (snapshot.status === 'missing') {
    return {
      urlLabel: '—',
      accessLabel: 'Unavailable',
      status: snapshot.reason,
      statusKind: 'error',
      showAllow: false,
      showPing: false,
      showCollect: false,
    };
  }

  if (snapshot.status === 'unsupported') {
    return {
      urlLabel: snapshot.url ?? '—',
      accessLabel: 'Not available for this URL',
      status: snapshot.reason,
      statusKind: 'error',
      showAllow: false,
      showPing: false,
      showCollect: false,
    };
  }

  return {
    urlLabel: snapshot.url,
    accessLabel: `HTTP(S) access ready for ${snapshot.origin}`,
    status: 'Ready to audit this tab. Start an audit or refresh the page glance.',
    statusKind: 'ok',
    showAllow: false,
    showPing: true,
    showCollect: true,
  };
}
