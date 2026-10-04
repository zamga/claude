import { useRef, useState } from 'react';
import { useAppNavigation } from '@/app/navigation';
import { useSession, useSignOut } from '@/app/session';
import { Button } from '@/components/Button';
import { LargeTitle, TopBar, TopBarLabel } from '@/components/Header';
import {
  Bell,
  ChevronRight,
  CircleHelp,
  FileText,
  ICON_STROKE,
  Lock,
  Settings,
  Shield,
  SlidersHorizontal,
  Sparkles,
  User,
} from '@/components/icons';
import { Content, Disclaimer, ScreenBody } from '@/components/Layout';
import { List, Row } from '@/components/List';
import { Sheet, useConfirm } from '@/components/Sheet';
import { DemoTag, Notice } from '@/components/Status';
import { useToast } from '@/components/Toast';
import { formatMonthYear } from '@/domain/format';
import { usePreferences } from '@/data/queries';
import { DATA_MODE } from '@/data/transport';
import { useInstallRow } from '@/features/install';
import { useUserTimeZone } from '@/features/time';
import { useDocumentTitle } from '@/features/title';
import styles from './Profile.module.css';

const INTEREST_SHORT = { earnings: 'Earnings', ipo: 'IPOs', quality: 'Quality' } as const;

/** S21: identity, actual access entitlement and every account destination; sign-out is separate from deletion. */
export default function ProfileScreen() {
  const { me, signedIn, loading } = useSession();
  const preferences = usePreferences(signedIn);
  const signOut = useSignOut();
  const toast = useToast();
  const zone = useUserTimeZone();
  const { push } = useAppNavigation();
  const { confirm, element } = useConfirm();
  const sentinel = useRef<HTMLDivElement>(null);
  const [accessOpen, setAccessOpen] = useState(false);
  const installRow = useInstallRow();
  const [signingOut, setSigningOut] = useState(false);
  useDocumentTitle('Your space');

  const research = preferences.data?.research;
  const researchSummary = research
    ? `${research.markets.map((market) => (market === 'US' ? 'US' : 'Europe')).join(' + ')}${research.interests.length ? ` · ${research.interests.map((item) => INTEREST_SHORT[item]).join(', ')}` : ''}`
    : undefined;

  const doSignOut = async () => {
    const ok = await confirm({
      title: 'Sign out on this device?',
      body: 'Drafts, offline copies and push on this device are removed. Your saved lists, alerts and research stay in your account.',
      confirmLabel: 'Sign out',
    });
    if (!ok) return;
    setSigningOut(true);
    try {
      await signOut();
      toast({ message: 'Signed out' });
      push('/', { replace: true });
    } catch {
      toast({
        message: 'Sign-out needs a connection to end the session. Try again.',
        tone: 'error',
      });
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <ScreenBody tabBar>
      <TopBar
        leading={<TopBarLabel>Account</TopBarLabel>}
        compactTitle="Your space"
        sentinel={sentinel}
        trailing={<DemoTag />}
      />
      <Content>
        <LargeTitle title="Your space." sentinelRef={sentinel} />
        {signedIn && me ? (
          <>
            <div className={styles.identity}>
              <span className={styles.avatar} aria-hidden>
                {me.displayName.trim().charAt(0).toUpperCase() || 'A'}
              </span>
              <span className={styles.identityText}>
                <span className={styles.name}>{me.displayName}</span>
                <span className={styles.email}>{me.email}</span>
              </span>
            </div>
            {!me.verified && (
              <Notice
                tone="warning"
                title="Verify your email to save research, alerts and positions."
                actions={
                  <Button size="small" variant="quiet" onClick={() => push('/auth/verify')}>
                    Verify email
                  </Button>
                }
              />
            )}
            {me.pendingEmail && (
              <Notice tone="neutral" title={`Confirming ${me.pendingEmail}.`}>
                Your current address stays active until you open the link sent to the new one.
              </Notice>
            )}
            <button
              type="button"
              className={styles.access}
              onClick={() => setAccessOpen(true)}
              aria-haspopup="dialog"
            >
              <span>
                <span className={styles.accessLabel}>Research access</span>
                <span className={styles.accessPlan}>{me.access.label}</span>
                <span className={styles.accessDetail}>View access details</span>
              </span>
              <ChevronRight size={20} strokeWidth={ICON_STROKE} aria-hidden />
            </button>
            <List label="Account settings">
              <Row
                to="/settings/research"
                icon={SlidersHorizontal}
                title="Research preferences"
                detail={researchSummary}
              />
              <Row to="/settings/notifications" icon={Bell} title="Notification settings" />
              <Row to="/settings" icon={Settings} title="App settings" />
              {installRow.row}
              <Row to="/account/edit" icon={User} title="Account details" />
              <Row to="/account/security" icon={Lock} title="Account security" />
              <Row to="/account/data" icon={Shield} title="Privacy & data" />
              <Row to="/help" icon={CircleHelp} title="Help & support" />
              {DATA_MODE === 'demo' && (
                <Row
                  to="/demo"
                  icon={Sparkles}
                  title="Demo tools"
                  detail="Clock, data feed and network conditions"
                />
              )}
            </List>
            <div className={styles.foot}>
              <span className={styles.member}>
                Member since {formatMonthYear(Date.parse(me.memberSince), zone)}
              </span>
              <Button
                variant="text"
                className={styles.signOut}
                pending={signingOut}
                onClick={() => void doSignOut()}
              >
                Sign out
              </Button>
            </div>
          </>
        ) : (
          <>
            {!loading && (
              <div className={styles.guest}>
                <p className="t-body">
                  Sign in to keep watchlists, alerts, saved research and a paper portfolio in sync
                  across devices.
                </p>
                <Button full onClick={() => push('/auth/sign-in?returnTo=%2Fprofile')}>
                  Sign in
                </Button>
                <Button
                  full
                  variant="secondary"
                  onClick={() => push('/auth/register?returnTo=%2Fprofile')}
                >
                  Create an account
                </Button>
              </div>
            )}
            <List label="Settings and help">
              <Row
                to="/settings"
                icon={Settings}
                title="App settings"
                detail="Saved on this device until you sign in"
              />
              {installRow.row}
              <Row to="/help" icon={CircleHelp} title="Help & support" />
              <Row to="/legal/terms" icon={FileText} title="Terms and privacy" />
              {DATA_MODE === 'demo' && (
                <Row
                  to="/demo"
                  icon={Sparkles}
                  title="Demo tools"
                  detail="Clock, data feed and network conditions"
                />
              )}
            </List>
          </>
        )}
        <Disclaimer>
          Stock Picks provides research and tools, not personal investment advice. Demo build with
          sample data.
        </Disclaimer>
      </Content>
      <Sheet
        open={accessOpen}
        onClose={() => setAccessOpen(false)}
        title={`${me?.access.label ?? 'Core'} access`}
        size="auto"
      >
        <div className={styles.sheetBody}>
          <p className="t-body">{me?.access.detail}</p>
          <p className="t-label t-muted">
            Core includes daily picks, research, the full pick archive, watchlists, alerts and the
            paper portfolio. Paid plans are not offered in this release, so there is nothing to buy
            or cancel.
          </p>
        </div>
      </Sheet>
      {installRow.sheet}
      {element}
    </ScreenBody>
  );
}
