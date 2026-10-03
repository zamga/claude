import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useAppNavigation } from '@/app/navigation';
import { safeReturnTo } from '@/app/routeTable';
import { useSession } from '@/app/session';
import { Button } from '@/components/Button';
import { LargeTitle, SectionHeader, TopBar } from '@/components/Header';
import { ArrowRight, Bell, RefreshCw, TriangleAlert } from '@/components/icons';
import { ActionBar, Content, ScreenBody } from '@/components/Layout';
import { DemoTag, Notice } from '@/components/Status';
import { CheckRow } from '@/components/Form';
import { Segmented } from '@/components/Tabs';
import { useToast } from '@/components/Toast';
import { api, deviceLabel } from '@/data/api';
import { errorMessage, isApiError } from '@/data/errors';
import { qk, usePreferences } from '@/data/queries';
import type { Horizon, Interest, Preferences, Region } from '@/data/types';
import { AuthLayout } from '@/features/AuthLayout';
import { useUnsavedChangesGuard } from '@/features/guard';
import { PERMISSION_TEXT, usePushPermission } from '@/features/notifications';
import { DEFAULT_RESEARCH, INTEREST_OPTIONS, MARKET_OPTIONS } from '@/features/preferences';
import { useOffline } from '@/features/status';
import { useDocumentTitle } from '@/features/title';
import { haptics } from '@/lib/haptics';
import { draftKey, readJson, writeJson } from '@/lib/storage';
import shared from '../shared.module.css';
import styles from './Personalization.module.css';

type Research = Pick<Preferences['research'], 'interests' | 'horizon' | 'markets'>;

const DRAFT = draftKey('onboarding.research');

function ResearchFields({
  value,
  onChange,
}: {
  value: Research;
  onChange: (next: Research) => void;
}) {
  const toggle = <T,>(list: T[], item: T, on: boolean) =>
    on ? [...new Set([...list, item])] : list.filter((entry) => entry !== item);
  return (
    <>
      <section aria-labelledby="interests-heading">
        <SectionHeader
          title="What interests you?"
          id="interests-heading"
          size="small"
          aside={<DemoTag />}
        />
        <div className={styles.options} role="group" aria-labelledby="interests-heading">
          {INTEREST_OPTIONS.map((option) => (
            <CheckRow
              key={option.value}
              label={option.label}
              detail={option.detail}
              checked={value.interests.includes(option.value)}
              onChange={(on) =>
                onChange({
                  ...value,
                  interests: toggle<Interest>(value.interests, option.value, on),
                })
              }
            />
          ))}
        </div>
      </section>
      <section aria-labelledby="horizon-heading">
        <SectionHeader title="Your time horizon" id="horizon-heading" size="small" />
        <div className={styles.segment}>
          <Segmented<Horizon>
            label="Research horizon"
            variant="accent"
            value={value.horizon}
            onChange={(horizon) => onChange({ ...value, horizon })}
            items={[
              { value: 'days', label: 'Days' },
              { value: 'weeks', label: 'Weeks' },
              { value: 'months', label: 'Months' },
            ]}
          />
        </div>
      </section>
      <section aria-labelledby="markets-heading">
        <SectionHeader title="Markets" id="markets-heading" size="small" />
        <div className={styles.options} role="group" aria-labelledby="markets-heading">
          {MARKET_OPTIONS.map((option) => (
            <CheckRow
              key={option.value}
              label={option.label}
              detail={option.detail}
              checked={value.markets.includes(option.value)}
              onChange={(on) =>
                onChange({ ...value, markets: toggle<Region>(value.markets, option.value, on) })
              }
            />
          ))}
        </div>
        <p className={styles.note}>You can change this anytime in Profile.</p>
      </section>
    </>
  );
}

function useSaveResearch() {
  const queryClient = useQueryClient();
  const preferences = usePreferences();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async (research: Research, version?: number): Promise<boolean> => {
    const current = preferences.data ?? (await api.me.preferences());
    setPending(true);
    setError(null);
    try {
      const saved = await api.me.updatePreferences(
        {
          research: {
            ...research,
            completedAt: current.research.completedAt ?? new Date().toISOString(),
          },
        },
        version ?? current.version,
      );
      queryClient.setQueryData(qk.preferences, saved);
      haptics.success();
      return true;
    } catch (failure) {
      haptics.error();
      if (isApiError(failure) && failure.code === 'version_conflict') {
        // Preferences changed elsewhere: retry once on the latest version, keeping these choices.
        const latest = failure.details.latest as Preferences | undefined;
        if (latest && version == null) return save(research, latest.version);
      }
      setError(errorMessage(failure));
      return false;
    } finally {
      setPending(false);
    }
  };
  return { save, pending, error, preferences };
}

/** S04 onboarding: preferences (step 2 of 3), then an optional notification step (3 of 3). */
export function OnboardingScreen() {
  const [params] = useSearchParams();
  const returnTo = safeReturnTo(params.get('returnTo'));
  const { signedIn, loading } = useSession();
  const { push } = useAppNavigation();
  const offline = useOffline();
  const toast = useToast();
  const [step, setStep] = useState<2 | 3>(2);
  const [value, setValue] = useState<Research>(
    () => readJson<Research>('session', DRAFT) ?? DEFAULT_RESEARCH,
  );
  const { save, pending, error } = useSaveResearch();
  const [permission, requestPermission] = usePushPermission();
  const [pushBusy, setPushBusy] = useState(false);
  useDocumentTitle('Your preferences');

  useEffect(() => writeJson('session', DRAFT, value), [value]);

  if (!loading && !signedIn) {
    return (
      <AuthLayout
        title="Your preferences."
        subtitle="Sign in to choose what Stock Picks shows you first."
      >
        <Button
          full
          onClick={() =>
            push(`/auth/sign-in?returnTo=${encodeURIComponent('/onboarding')}`, { replace: true })
          }
        >
          Sign in
        </Button>
      </AuthLayout>
    );
  }

  const finish = () => {
    writeJson('session', DRAFT, null);
    push(returnTo, { replace: true });
  };

  const next = async (research: Research) => {
    if (await save(research)) setStep(3);
  };

  if (step === 3) {
    return (
      <AuthLayout
        step={{ index: 3, total: 3, label: 'Your preferences' }}
        title={
          <>
            Stay in
            <br />
            the loop.
          </>
        }
        subtitle="Alerts always reach your inbox. Push shows them on this device when you allow it."
      >
        <div className={styles.permission}>
          <Bell size={28} aria-hidden />
          <p className="t-body-sm">{PERMISSION_TEXT[permission]}</p>
        </div>
        {permission === 'default' && (
          <Button
            full
            variant="secondary"
            pending={pushBusy}
            onClick={async () => {
              setPushBusy(true);
              const result = await requestPermission();
              if (result === 'granted') {
                try {
                  await api.notifications.registerDevice(deviceLabel());
                  toast({ message: 'Notifications allowed on this device' });
                } catch (failure) {
                  toast({ message: errorMessage(failure), tone: 'error' });
                }
              }
              setPushBusy(false);
            }}
          >
            Allow notifications on this device
          </Button>
        )}
        <Button full between icon={ArrowRight} onClick={finish}>
          {permission === 'default' ? 'Not now, start reading' : 'Start reading'}
        </Button>
      </AuthLayout>
    );
  }

  return (
    <ScreenBody>
      <TopBar title="Your preferences" trailing={<span className={styles.step}>2 of 3</span>} />
      <div
        className={styles.progress}
        role="progressbar"
        aria-label="Onboarding progress"
        aria-valuemin={1}
        aria-valuemax={3}
        aria-valuenow={2}
      >
        <span style={{ width: '66.7%' }} />
      </div>
      <Content>
        <div className={styles.column}>
          <LargeTitle
            title={
              <>
                Shape your
                <br />
                shortlist.
              </>
            }
          />
          {error && (
            <Notice
              tone="error"
              icon={TriangleAlert}
              role="alert"
              title={error}
              actions={
                <Button
                  size="small"
                  variant="quiet"
                  icon={RefreshCw}
                  iconPosition="start"
                  onClick={() => void next(value)}
                >
                  Retry
                </Button>
              }
            >
              Your choices are kept.
            </Notice>
          )}
          <ResearchFields value={value} onChange={setValue} />
        </div>
      </Content>
      <ActionBar note={offline ? 'Reconnect to save your preferences.' : undefined}>
        <Button
          full
          between
          icon={ArrowRight}
          pending={pending}
          disabledReason={
            value.markets.length === 0
              ? 'Choose at least one market.'
              : offline
                ? 'Needs a connection.'
                : undefined
          }
          onClick={() => void next(value)}
        >
          Continue
        </Button>
        <Button
          variant="text"
          onClick={() => void save(DEFAULT_RESEARCH).then((ok) => ok && setStep(3))}
        >
          Skip for now
        </Button>
      </ActionBar>
    </ScreenBody>
  );
}

/** The same preferences, reopened from Profile; saved as one change with unsaved-work protection. */
export function ProfilePreferencesScreen() {
  const { save, pending, error, preferences } = useSaveResearch();
  const toast = useToast();
  const offline = useOffline();
  const [draft, setDraft] = useState<Research | null>(null);
  const base: Research | null = preferences.data
    ? {
        interests: preferences.data.research.interests,
        horizon: preferences.data.research.horizon,
        markets: preferences.data.research.markets,
      }
    : null;
  const value = draft ?? base;
  const dirty = draft != null && JSON.stringify(draft) !== JSON.stringify(base);
  const guard = useUnsavedChangesGuard(dirty, 'Your research preferences have not been saved.');
  useDocumentTitle('Research preferences');

  return (
    <ScreenBody>
      <TopBar title="Research preferences" ruled />
      <Content>
        <LargeTitle
          title={
            <>
              Shape your
              <br />
              shortlist.
            </>
          }
          size="title"
          subtitle="Picks and research are ordered by these choices. Nothing is hidden from you."
        />
        {error && <Notice tone="error" icon={TriangleAlert} role="alert" title={error} />}
        {value && <ResearchFields value={value} onChange={setDraft} />}
        <p className={shared.footnote}>
          Defaults: all interests, a weeks horizon and both markets.
        </p>
      </Content>
      <ActionBar>
        <Button
          full
          pending={pending}
          disabledReason={
            !dirty
              ? 'Change a preference to save it.'
              : value && value.markets.length === 0
                ? 'Choose at least one market.'
                : offline
                  ? 'Needs a connection.'
                  : undefined
          }
          onClick={async () => {
            if (!value) return;
            if (await save(value)) {
              setDraft(null);
              toast({ message: 'Research preferences saved' });
            }
          }}
        >
          Save preferences
        </Button>
      </ActionBar>
      {guard}
    </ScreenBody>
  );
}
