import type { ActiveTabSnapshot } from '../lib/tab-access';

export type SidePanelView = {
  urlLabel: string;
  accessLabel: string;
  status: string;
  statusKind: 'plain' | 'ok' | 'error';
  showAllow: boolean;
  showPing: boolean;
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
    };
  }

  return {
    urlLabel: snapshot.url,
    accessLabel: snapshot.granted ? `Granted for ${snapshot.origin}` : 'Not granted',
    status: snapshot.granted
      ? 'Origin access is granted. You can test page injection or run an audit (Ticket 103+).'
      : 'Click “Allow this site” to grant access for this origin only.',
    statusKind: snapshot.granted ? 'ok' : 'plain',
    showAllow: !snapshot.granted,
    showPing: snapshot.granted,
  };
}
