import { useEffect, useState, type FormEvent } from 'react';
import { useAppNavigation } from '@/app/navigation';
import { TEXT_SCALES, useDisplay, type DisplaySettings } from '@/app/display';
import { useSession } from '@/app/session';
import { Button } from '@/components/Button';
import { LargeTitle, SectionHeader, TopBar } from '@/components/Header';
import { Download, RefreshCw, Shield, TriangleAlert } from '@/components/icons';
import { ActionBar, Content, ScreenBody } from '@/components/Layout';
import { List, Row } from '@/components/List';
import { DemoTag, Notice } from '@/components/Status';
import { SelectField, Slider, SwitchRow } from '@/components/Form';
import { useToast } from '@/components/Toast';
import type { CurrencyCode, Preferences } from '@/data/types';
import { useUnsavedChangesGuard } from '@/features/guard';
import { timeZoneOptions, usePreferencesForm } from '@/features/preferences';
import { useOffline } from '@/features/status';
import { deviceTimeZone } from '@/features/time';
import { useDocumentTitle } from '@/features/title';
import { haptics } from '@/lib/haptics';
import shared from '../shared.module.css';
import styles from './Profile.module.css';

interface Draft {
  display: DisplaySettings;
  regional: Preferences['regional'];
}

const APPEARANCES = [
  { value: 'editorial', label: 'Editorial', detail: 'Ivory discovery, charcoal analysis.' },
  { value: 'night', label: 'Night', detail: 'Charcoal throughout, for low light.' },
  {
    value: 'system',
    label: 'Follow the system',
    detail: 'Night when your device is in dark mode.',
  },
] as const;

/**
 * S22: display changes preview immediately and reversibly; Save persists them (to the account
 * when signed in, to this device otherwise). Currency only affects converted totals.
 */
export default function AppSettingsScreen() {
  const { signedIn } = useSession();
  const display = useDisplay();
  const toast = useToast();
  const offline = useOffline();
  const { push } = useAppNavigation();
  const device = deviceTimeZone();
  const form = usePreferencesForm<Draft>(
    (preferences) => ({ display: preferences.display, regional: preferences.regional }),
    (draft) => ({ display: draft.display, regional: draft.regional }),
    'Settings saved to your account',
  );
  const [guestDraft, setGuestDraft] = useState<DisplaySettings | null>(null);
  useDocumentTitle('App settings');

  const draft: Draft | null = signedIn
    ? form.value
    : {
        display: guestDraft ?? display.committed,
        regional: { currency: 'USD', timeZone: 'Europe/Ljubljana', language: 'en' },
      };
  const dirty = signedIn
    ? form.dirty
    : guestDraft != null && JSON.stringify(guestDraft) !== JSON.stringify(display.committed);
  const guard = useUnsavedChangesGuard(
    dirty,
    'Your display and regional changes have not been saved. Leaving restores the previous settings.',
  );

  // Preview the draft display settings live; leaving without saving restores the committed ones.
  const previewKey = draft ? JSON.stringify(draft.display) : '';
  useEffect(() => {
    if (!draft) return;
    display.setPreview(dirty ? draft.display : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewKey, dirty]);
  const { setPreview } = display;
  useEffect(() => () => setPreview(null), [setPreview]);

  const setDisplay = (patch: Partial<DisplaySettings>) => {
    if (!draft) return;
    if (signedIn) form.setDraft({ display: { ...draft.display, ...patch } });
    else setGuestDraft({ ...draft.display, ...patch });
  };
  const setRegional = (patch: Partial<Preferences['regional']>) => {
    if (!draft || !signedIn) return;
    form.setDraft({ regional: { ...draft.regional, ...patch } });
  };

  const foundScale = TEXT_SCALES.findIndex((scale) => scale.value === draft?.display.textScale);
  const scaleIndex = foundScale < 0 ? 1 : foundScale;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    if (signedIn) {
      const ok = await form.save();
      if (ok) display.setPreview(null);
    } else {
      display.saveDevice(draft.display);
      setGuestDraft(null);
      display.setPreview(null);
      haptics.success();
      toast({ message: 'Settings saved on this device' });
    }
  };

  const appearance =
    APPEARANCES.find((item) => item.value === draft?.display.appearance) ?? APPEARANCES[0];

  return (
    <ScreenBody>
      <TopBar title="App settings" ruled trailing={<DemoTag />} />
      <Content>
        <LargeTitle
          title={
            <>
              Make it
              <br />
              yours.
            </>
          }
          size="title"
        />
        {draft && (
          <form id="app-settings" onSubmit={submit} noValidate>
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
                Choose which version to keep. Nothing has been overwritten.
              </Notice>
            )}
            {form.error && (
              <Notice tone="error" icon={TriangleAlert} role="alert" title={form.error} />
            )}

            <section className={styles.group} aria-labelledby="display-heading">
              <SectionHeader title="Display" id="display-heading" />
              <div className={styles.rows}>
                <div className={styles.field}>
                  <SelectField
                    label="Appearance"
                    hint={appearance.detail}
                    value={draft.display.appearance}
                    onChange={(event) =>
                      setDisplay({
                        appearance: event.target.value as DisplaySettings['appearance'],
                      })
                    }
                    options={APPEARANCES.map((item) => ({ value: item.value, label: item.label }))}
                  />
                </div>
                <div className={styles.field}>
                  <Slider
                    label="Text size"
                    min={0}
                    max={TEXT_SCALES.length - 1}
                    step={1}
                    value={scaleIndex}
                    format={(index) => TEXT_SCALES[index]?.label ?? 'Default'}
                    scale={['A', 'A']}
                    hint="Applies to every screen, on top of your browser’s text size."
                    onChange={(index) => setDisplay({ textScale: TEXT_SCALES[index]?.value ?? 1 })}
                  />
                </div>
              </div>
            </section>

            <section className={styles.group} aria-labelledby="regional-heading">
              <SectionHeader title="Regional" id="regional-heading" />
              {!signedIn && (
                <p className={shared.footnote}>
                  Regional settings belong to your account. Sign in to change them.
                </p>
              )}
              <div className={styles.rows}>
                <div className={styles.field}>
                  <SelectField
                    label="Currency for totals"
                    hint="Used for converted portfolio totals. Quotes always stay in each company’s own currency."
                    value={draft.regional.currency}
                    disabled={!signedIn}
                    onChange={(event) =>
                      setRegional({ currency: event.target.value as CurrencyCode })
                    }
                    options={[
                      { value: 'USD', label: 'USD — US dollar' },
                      { value: 'EUR', label: 'EUR — euro' },
                    ]}
                  />
                </div>
                <div className={styles.field}>
                  <SelectField
                    label="Time zone"
                    hint="Alert times, briefings and quiet hours use this zone. Market times also show the exchange’s zone."
                    value={draft.regional.timeZone}
                    disabled={!signedIn}
                    onChange={(event) => setRegional({ timeZone: event.target.value })}
                    options={timeZoneOptions(draft.regional.timeZone, device)}
                  />
                </div>
                <div className={styles.field}>
                  <SelectField
                    label="Language"
                    hint="English is the only language in this release."
                    value="en"
                    disabled
                    onChange={() => undefined}
                    options={[{ value: 'en', label: 'English' }]}
                  />
                </div>
              </div>
            </section>

            <section className={styles.group} aria-labelledby="access-heading">
              <SectionHeader title="Accessibility" id="access-heading" />
              <div className={styles.rows}>
                <div className={styles.field}>
                  <SelectField
                    label="Motion"
                    value={draft.display.reduceMotion}
                    hint="Reduced motion replaces movement with fades and instant changes; nothing is lost."
                    onChange={(event) =>
                      setDisplay({
                        reduceMotion: event.target.value as DisplaySettings['reduceMotion'],
                      })
                    }
                    options={[
                      { value: 'system', label: 'Follow the system setting' },
                      { value: 'reduce', label: 'Reduce motion' },
                      { value: 'full', label: 'Full motion' },
                    ]}
                  />
                </div>
                <SwitchRow
                  label="Increase contrast"
                  detail="Stronger text, rules and focus outlines."
                  checked={draft.display.increaseContrast}
                  onChange={(next) => setDisplay({ increaseContrast: next })}
                />
                {signedIn && (
                  <SwitchRow
                    label="Keep private data offline"
                    detail="Saves your lists, alerts and positions on this device for offline reading. Removed when you sign out."
                    checked={draft.display.keepPrivateOffline}
                    onChange={(next) => setDisplay({ keepPrivateOffline: next })}
                  />
                )}
              </div>
            </section>
          </form>
        )}

        <section className={styles.group} aria-labelledby="data-heading">
          <SectionHeader title="Data controls" id="data-heading" />
          <List label="Data controls">
            <Row
              icon={Download}
              title="Export my data"
              onPress={() =>
                push(signedIn ? '/account/data' : '/auth/sign-in?returnTo=%2Faccount%2Fdata')
              }
            />
            <Row
              icon={Shield}
              title="Manage privacy"
              onPress={() => push(signedIn ? '/account/data' : '/legal/privacy')}
            />
          </List>
        </section>
      </Content>
      <ActionBar note={dirty ? 'Previewing your changes. Save to keep them.' : undefined}>
        <Button
          type="submit"
          form="app-settings"
          full
          pending={form.saving}
          disabledReason={
            !dirty
              ? 'Change a setting to save it.'
              : signedIn && offline
                ? 'Saving to your account needs a connection.'
                : undefined
          }
        >
          Save changes
        </Button>
      </ActionBar>
      {guard}
    </ScreenBody>
  );
}
