import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useAppNavigation } from '@/app/navigation';
import { useSession } from '@/app/session';
import { Button } from '@/components/Button';
import { LargeTitle, SectionHeader, TopBar } from '@/components/Header';
import {
  Bell,
  Calendar,
  FileText,
  ICON_STROKE,
  Mail,
  Megaphone,
  Moon,
  RefreshCw,
  Smartphone,
  TriangleAlert,
} from '@/components/icons';
import { ActionBar, Content, ScreenBody } from '@/components/Layout';
import { DemoTag, Notice } from '@/components/Status';
import { SelectField, SwitchRow, TextField } from '@/components/Form';
import { useToast } from '@/components/Toast';
import { validateClock } from '@/domain/validation';
import { api, deviceLabel } from '@/data/api';
import { errorMessage } from '@/data/errors';
import type { Preferences } from '@/data/types';
import { useUnsavedChangesGuard } from '@/features/guard';
import { PERMISSION_TEXT, usePushPermission } from '@/features/notifications';
import { timeZoneOptions, usePreferencesForm } from '@/features/preferences';
import { useOffline } from '@/features/status';
import { deviceTimeZone } from '@/features/time';
import { useDocumentTitle } from '@/features/title';
import styles from './Profile.module.css';

interface Draft {
  notifications: Preferences['notifications'];
  timeZone: string;
}

const CATEGORIES: {
  key: keyof Preferences['notifications']['categories'];
  label: string;
  detail: string;
  icon: typeof Bell;
}[] = [
  {
    key: 'price',
    label: 'Price thresholds',
    detail: 'When a price alert you set crosses its level.',
    icon: Bell,
  },
  {
    key: 'earnings',
    label: 'Earnings reminders',
    detail: 'Before releases you asked to be reminded about.',
    icon: Calendar,
  },
  {
    key: 'research',
    label: 'Research changes',
    detail: 'When a thesis you follow is revised or withdrawn.',
    icon: FileText,
  },
  {
    key: 'product',
    label: 'Product news',
    detail: 'Occasional notes about new features. Off by default.',
    icon: Megaphone,
  },
];

/**
 * S20: the complete delivery preference saves as one draft. The device's notification
 * permission is shown separately from the person's desired channel (spec page 34).
 */
export default function AlertSettingsScreen() {
  const { me } = useSession();
  const queryClient = useQueryClient();
  const toast = useToast();
  const offline = useOffline();
  const { push } = useAppNavigation();
  const [permission, requestPermission] = usePushPermission();
  const [deviceBusy, setDeviceBusy] = useState(false);
  const [timeErrors, setTimeErrors] = useState<
    Partial<Record<'briefing' | 'start' | 'end', string>>
  >({});
  const form = usePreferencesForm<Draft>(
    (preferences) => ({
      notifications: preferences.notifications,
      timeZone: preferences.regional.timeZone,
    }),
    (draft) => ({
      notifications: draft.notifications,
      regional: { timeZone: draft.timeZone } as Preferences['regional'],
    }),
    'Alert settings saved',
  );
  const guard = useUnsavedChangesGuard(form.dirty, 'Your alert settings have not been saved.');
  useDocumentTitle('Alert settings');
  const draft = form.value;

  const setNotifications = (patch: Partial<Preferences['notifications']>) => {
    if (!draft) return;
    form.setDraft({ notifications: { ...draft.notifications, ...patch } });
  };

  const allowDevice = async () => {
    setDeviceBusy(true);
    try {
      const result = permission === 'granted' ? 'granted' : await requestPermission();
      if (result === 'granted') {
        await api.notifications.registerDevice(deviceLabel());
        toast({ message: 'This device can show alert notifications' });
      }
    } catch (failure) {
      toast({ message: errorMessage(failure), tone: 'error' });
    } finally {
      setDeviceBusy(false);
      void queryClient.invalidateQueries({ queryKey: ['private', 'inbox'] });
    }
  };

  const removeDevices = async () => {
    setDeviceBusy(true);
    try {
      const result = await api.notifications.unregisterDevices();
      toast({
        message: result.removed
          ? 'Push removed from your devices'
          : 'No devices were registered for push',
      });
    } catch (failure) {
      toast({ message: errorMessage(failure), tone: 'error' });
    } finally {
      setDeviceBusy(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    const errors = {
      briefing: draft.notifications.briefing.enabled
        ? validateClock(draft.notifications.briefing.time)
        : undefined,
      start: draft.notifications.quietHours.enabled
        ? validateClock(draft.notifications.quietHours.start)
        : undefined,
      end: draft.notifications.quietHours.enabled
        ? validateClock(draft.notifications.quietHours.end)
        : undefined,
    };
    setTimeErrors(errors);
    if (Object.values(errors).some(Boolean)) return;
    await form.save();
  };

  return (
    <ScreenBody>
      <TopBar title="Alert settings" ruled trailing={<DemoTag />} />
      <Content>
        <LargeTitle
          title={
            <>
              On your
              <br />
              terms.
            </>
          }
          size="title"
        />
        {draft && (
          <form id="alert-settings" onSubmit={submit} noValidate>
            {form.conflict && (
              <Notice
                tone="warning"
                icon={RefreshCw}
                role="alert"
                title="These settings changed on another device."
                actions={
                  <>
                    <Button size="small" variant="quiet" onClick={form.takeLatest}>
                      Use the latest
                    </Button>
                    <Button size="small" variant="quiet" onClick={form.keepMine}>
                      Keep mine
                    </Button>
                  </>
                }
              >
                Nothing has been overwritten.
              </Notice>
            )}
            {form.error && (
              <Notice tone="error" icon={TriangleAlert} role="alert" title={form.error} />
            )}

            <section className={styles.group} aria-labelledby="notify-heading">
              <SectionHeader title="Notify me about" id="notify-heading" size="small" />
              <div className={styles.rows}>
                {CATEGORIES.map((category) => {
                  const Icon = category.icon;
                  return (
                    <SwitchRow
                      key={category.key}
                      icon={<Icon size={18} strokeWidth={ICON_STROKE} aria-hidden />}
                      label={category.label}
                      detail={category.detail}
                      checked={draft.notifications.categories[category.key]}
                      onChange={(next) =>
                        setNotifications({
                          categories: { ...draft.notifications.categories, [category.key]: next },
                        })
                      }
                    />
                  );
                })}
              </div>
              <p className="t-note t-muted" style={{ padding: '8px var(--gutter) 0' }}>
                Turning a category off stops push and email for it. Alerts still arrive in your
                inbox so nothing is lost.
              </p>
            </section>

            <section className={styles.group} aria-labelledby="briefing-heading">
              <SectionHeader title="Daily briefing" id="briefing-heading" size="small" />
              <div className={styles.rows}>
                <SwitchRow
                  icon={<Mail size={18} strokeWidth={ICON_STROKE} aria-hidden />}
                  label="Morning digest"
                  detail="Today’s picks and the catalysts on your watchlist."
                  checked={draft.notifications.briefing.enabled}
                  onChange={(next) =>
                    setNotifications({
                      briefing: { ...draft.notifications.briefing, enabled: next },
                    })
                  }
                />
                {draft.notifications.briefing.enabled && (
                  <div className={styles.field}>
                    <TextField
                      label="Delivery time"
                      type="time"
                      value={draft.notifications.briefing.time}
                      error={timeErrors.briefing}
                      hint={`In ${draft.timeZone.replace(/_/g, ' ')}.`}
                      onChange={(event) =>
                        setNotifications({
                          briefing: { ...draft.notifications.briefing, time: event.target.value },
                        })
                      }
                    />
                  </div>
                )}
                <div className={styles.field}>
                  <SelectField
                    label="Time zone"
                    value={draft.timeZone}
                    hint="Also used for quiet hours and alert times."
                    onChange={(event) => form.setDraft({ timeZone: event.target.value })}
                    options={timeZoneOptions(draft.timeZone, deviceTimeZone())}
                  />
                </div>
              </div>
            </section>

            <section className={styles.group} aria-labelledby="quiet-heading">
              <SectionHeader title="Quiet hours" id="quiet-heading" size="small" />
              <div className={styles.rows}>
                <SwitchRow
                  icon={<Moon size={18} strokeWidth={ICON_STROKE} aria-hidden />}
                  label={`${draft.notifications.quietHours.start}–${draft.notifications.quietHours.end}`}
                  labelStyle="figure"
                  detail="Push and email wait until quiet hours end; the inbox records the alert straight away."
                  checked={draft.notifications.quietHours.enabled}
                  onChange={(next) =>
                    setNotifications({
                      quietHours: { ...draft.notifications.quietHours, enabled: next },
                    })
                  }
                />
                {draft.notifications.quietHours.enabled && (
                  <div className={styles.inlineTimes}>
                    <TextField
                      label="From"
                      type="time"
                      value={draft.notifications.quietHours.start}
                      error={timeErrors.start}
                      onChange={(event) =>
                        setNotifications({
                          quietHours: {
                            ...draft.notifications.quietHours,
                            start: event.target.value,
                          },
                        })
                      }
                    />
                    <TextField
                      label="Until"
                      type="time"
                      value={draft.notifications.quietHours.end}
                      error={timeErrors.end}
                      onChange={(event) =>
                        setNotifications({
                          quietHours: {
                            ...draft.notifications.quietHours,
                            end: event.target.value,
                          },
                        })
                      }
                    />
                  </div>
                )}
              </div>
            </section>

            <section className={styles.group} aria-labelledby="delivery-heading">
              <SectionHeader title="Delivery" id="delivery-heading" size="small" />
              <div className={styles.rows}>
                <SwitchRow
                  icon={<Smartphone size={18} strokeWidth={ICON_STROKE} aria-hidden />}
                  label="Push notifications"
                  detail="Your preference for every device you allow."
                  checked={draft.notifications.channels.push}
                  onChange={(next) =>
                    setNotifications({ channels: { ...draft.notifications.channels, push: next } })
                  }
                />
                <div className={styles.permission}>
                  <span className={styles.permissionText} data-state={permission}>
                    This device: {PERMISSION_TEXT[permission]}
                  </span>
                  {permission !== 'unsupported' && permission !== 'denied' && (
                    <Button
                      size="small"
                      variant="secondary"
                      pending={deviceBusy}
                      disabledReason={offline ? 'Needs a connection.' : undefined}
                      onClick={() => void allowDevice()}
                    >
                      {permission === 'granted' ? 'Register device' : 'Allow on this device'}
                    </Button>
                  )}
                </div>
                <SwitchRow
                  icon={<Mail size={18} strokeWidth={ICON_STROKE} aria-hidden />}
                  label="Email"
                  detail={
                    me?.verified
                      ? `To ${me.email}.`
                      : 'Verify your email address first; until then email cannot be delivered.'
                  }
                  checked={draft.notifications.channels.email}
                  onChange={(next) =>
                    setNotifications({ channels: { ...draft.notifications.channels, email: next } })
                  }
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  padding: '12px var(--gutter) 0',
                }}
              >
                <Button
                  size="small"
                  variant="quiet"
                  pending={deviceBusy}
                  onClick={() => void removeDevices()}
                >
                  Remove push from all devices
                </Button>
                <Button size="small" variant="quiet" onClick={() => push('/alerts')}>
                  Manage alert rules
                </Button>
              </div>
            </section>
          </form>
        )}
      </Content>
      <ActionBar>
        <Button
          type="submit"
          form="alert-settings"
          full
          pending={form.saving}
          disabledReason={
            !form.dirty
              ? 'Change a setting to save it.'
              : offline
                ? 'Saving needs a connection.'
                : undefined
          }
        >
          Save preferences
        </Button>
      </ActionBar>
      {guard}
    </ScreenBody>
  );
}
