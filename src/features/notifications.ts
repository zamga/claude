import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { useSession } from '@/app/session';
import { api } from '@/data/api';
import type { AlertRule, DeliveryStatus, InboxItem } from '@/data/types';
import { formatMoney } from '@/domain/format';

/** The exact in-app context behind a notification (spec page 34). */
export function inboxTargetPath(item: InboxItem): string {
  switch (item.target.kind) {
    case 'instrument':
      return `/stocks/${item.target.symbol ?? item.target.id}`;
    case 'earnings':
      return `/earnings/${item.target.id}`;
    case 'report':
      return `/research/${item.target.id}?v=${item.target.version}`;
    case 'ipo':
      return `/ipos/${item.target.id}`;
  }
}

export const DELIVERY_LABEL: Record<DeliveryStatus, string> = {
  delivered_inbox: 'In your inbox',
  queued: 'Queued',
  deferred: 'Held for quiet hours',
  shown_on_device: 'Shown on this device',
  accepted: 'Accepted by mail service',
  failed: 'Not delivered',
  not_configured: 'Off in settings',
  permission_denied: 'Off for this device',
};

export const CHANNEL_LABEL = { inbox: 'Inbox', push: 'Push', email: 'Email' } as const;

/** One sentence describing a rule exactly as it is stored. */
export function describeRule(
  rule: Pick<AlertRule, 'type' | 'comparator' | 'threshold' | 'currency' | 'repeat' | 'symbol'>,
): string {
  if (rule.type === 'price') {
    const verb = rule.comparator === 'cross_below' ? 'falls below' : 'rises above';
    const money = rule.threshold ? formatMoney(rule.threshold, rule.currency) : '—';
    return `${rule.symbol} ${verb} ${money}${rule.repeat === 'repeating' ? ', every time' : ', once'}`;
  }
  if (rule.type === 'earnings') return `${rule.symbol} earnings reminder`;
  return `${rule.symbol} research changes`;
}

export const RULE_STATE_LABEL: Record<AlertRule['state'], string> = {
  armed: 'Active',
  paused: 'Paused',
  fired: 'Completed',
  expired: 'Expired',
};

// ---------- Device push permission (separate from the account preference, spec page 34) ----------

export type PushPermission = 'unsupported' | 'default' | 'granted' | 'denied';

export function pushPermission(): PushPermission {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission as PushPermission;
}

export async function requestPushPermission(): Promise<PushPermission> {
  if (pushPermission() === 'unsupported') return 'unsupported';
  try {
    return (await Notification.requestPermission()) as PushPermission;
  } catch {
    return pushPermission();
  }
}

/** Current browser permission, refreshed when the page regains focus. */
export function usePushPermission(): [PushPermission, () => Promise<PushPermission>] {
  const [permission, setPermission] = useState<PushPermission>(() => pushPermission());
  useEffect(() => {
    const refresh = () => setPermission(pushPermission());
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  const request = async () => {
    const next = await requestPushPermission();
    setPermission(next);
    return next;
  };
  return [permission, request];
}

export const PERMISSION_TEXT: Record<PushPermission, string> = {
  unsupported: 'Notifications are not supported in this browser. Alerts still reach your inbox.',
  default: 'Not asked yet. Turning push on asks your browser for permission.',
  granted: 'Allowed in this browser.',
  denied:
    'Blocked in this browser’s settings. Alerts still reach your inbox; allow notifications for this site to receive push.',
};

/**
 * Opening a notification marks only that item read (spec page 34). Device notifications carry
 * `?from=notification&item=<id>` on their target URL.
 */
export function useNotificationOpen(): void {
  const location = useLocation();
  const { signedIn } = useSession();
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!signedIn) return;
    const params = new URLSearchParams(location.search);
    const item = params.get('item');
    if (params.get('from') !== 'notification' || !item) return;
    void api.notifications
      .markRead([item])
      .then(() => queryClient.invalidateQueries({ queryKey: ['private', 'inbox'] }))
      .catch(() => undefined);
  }, [location.search, signedIn, queryClient]);
}
