import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useAppNavigation } from '@/app/navigation';
import { safeReturnTo } from '@/app/routeTable';
import { useSession } from '@/app/session';
import { Button } from '@/components/Button';
import { ArrowRight, CircleCheck, Mail, RefreshCw, TriangleAlert } from '@/components/icons';
import { Notice, Skeleton } from '@/components/Status';
import { api } from '@/data/api';
import { errorMessage, isApiError } from '@/data/errors';
import { qk } from '@/data/queries';
import { pendingReturnTo, rememberReturnTo } from '@/features/auth';
import { AuthLayout } from '@/features/AuthLayout';
import { DemoMailbox } from '@/features/DemoMailbox';
import { useDocumentTitle } from '@/features/title';
import { haptics } from '@/lib/haptics';
import { useNow } from '@/lib/hooks';
import styles from './Auth.module.css';

const RESEND_MS = 60_000;

function useResend(initialSent: boolean) {
  const [nextAllowedAt, setNextAllowedAt] = useState<number | null>(() =>
    initialSent ? Date.now() + RESEND_MS : null,
  );
  const [message, setMessage] = useState<{ tone: 'neutral' | 'error'; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  const now = useNow(1000);
  const wait = nextAllowedAt ? Math.max(0, Math.ceil((nextAllowedAt - now) / 1000)) : 0;
  const resend = async () => {
    setPending(true);
    setMessage(null);
    try {
      const result = await api.me.resendVerification();
      setNextAllowedAt(Date.parse(result.nextAllowedAt));
      setMessage({
        tone: 'neutral',
        text: 'A new link is on its way. Earlier links no longer work.',
      });
      haptics.success();
    } catch (failure) {
      haptics.error();
      if (
        isApiError(failure) &&
        failure.code === 'throttled' &&
        typeof failure.details.nextAllowedAt === 'string'
      ) {
        setNextAllowedAt(Date.parse(failure.details.nextAllowedAt));
      }
      setMessage({ tone: 'error', text: errorMessage(failure) });
    } finally {
      setPending(false);
    }
  };
  return { wait, resend, pending, message };
}

/** Verification: token links verify once; otherwise explain, resend with a cooldown, or fix the email. */
export default function VerifyScreen() {
  const [params] = useSearchParams();
  const token = params.get('token');
  // Email links carry no app state; resume the destination remembered when the flow started.
  const returnTo = safeReturnTo(params.get('returnTo') ?? pendingReturnTo());
  const { me, signedIn, loading } = useSession();
  const queryClient = useQueryClient();
  const { push } = useAppNavigation();
  const attempted = useRef(false);
  const [result, setResult] = useState<
    { ok: true; email: string } | { ok: false; message: string } | null
  >(null);
  const resend = useResend(params.get('sent') === '1');
  useDocumentTitle('Verify your email');

  useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;
    api.me
      .verify(token)
      .then((response) => {
        haptics.success();
        setResult({ ok: true, email: response.email });
        void queryClient.invalidateQueries({ queryKey: qk.me });
      })
      .catch((failure: unknown) => setResult({ ok: false, message: errorMessage(failure) }));
  }, [token, queryClient]);

  const proceed = async () => {
    rememberReturnTo(null);
    try {
      const preferences = await api.me.preferences();
      if (!preferences.research.completedAt)
        return push(`/onboarding?returnTo=${encodeURIComponent(returnTo)}`, { replace: true });
    } catch {
      // Preferences can be completed later.
    }
    push(returnTo, { replace: true });
  };

  if (token) {
    if (!result) {
      return (
        <AuthLayout title="Verifying…" subtitle="Checking your link.">
          <Skeleton height={48} />
        </AuthLayout>
      );
    }
    if (result.ok) {
      return (
        <AuthLayout
          title={
            <>
              Email
              <br />
              verified.
            </>
          }
          subtitle={`${result.email} is confirmed.`}
        >
          <div className={styles.state}>
            <CircleCheck size={36} aria-hidden style={{ color: 'var(--positive)' }} />
            <p className="t-body">
              You can now save companies, research, alerts and paper positions.
            </p>
          </div>
          {signedIn ? (
            <Button full between icon={ArrowRight} onClick={() => void proceed()}>
              Continue
            </Button>
          ) : (
            <Button
              full
              between
              icon={ArrowRight}
              onClick={() =>
                push(
                  `/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}&email=${encodeURIComponent(result.email)}`,
                  { replace: true },
                )
              }
            >
              Sign in to continue
            </Button>
          )}
        </AuthLayout>
      );
    }
    return (
      <AuthLayout
        title={
          <>
            This link
            <br />
            didn’t work.
          </>
        }
        subtitle={result.message}
      >
        {signedIn && !me?.verified ? (
          <>
            <Button
              full
              icon={RefreshCw}
              iconPosition="start"
              pending={resend.pending}
              disabledReason={
                resend.wait > 0 ? `You can request another link in ${resend.wait} s.` : undefined
              }
              onClick={() => void resend.resend()}
            >
              Send a new link
            </Button>
            {resend.wait > 0 && (
              <p className={styles.cooldown}>Next link available in {resend.wait} s</p>
            )}
            {resend.message && (
              <Notice
                tone={resend.message.tone === 'error' ? 'error' : 'neutral'}
                role="status"
                title={resend.message.text}
              />
            )}
            <DemoMailbox to={me?.pendingEmail ?? me?.email} kinds={['verify']} />
          </>
        ) : (
          <Button
            full
            onClick={() =>
              push(`/auth/sign-in?returnTo=${encodeURIComponent('/auth/verify')}`, {
                replace: true,
              })
            }
          >
            Sign in to request a new link
          </Button>
        )}
      </AuthLayout>
    );
  }

  if (loading) {
    return (
      <AuthLayout title="Verify your email." subtitle="Loading your account…">
        <Skeleton height={48} />
      </AuthLayout>
    );
  }

  if (!signedIn || !me) {
    return (
      <AuthLayout
        title="Verify your email."
        subtitle="Sign in to see your verification status or request a new link."
      >
        <Button
          full
          onClick={() => push(`/auth/sign-in?returnTo=${encodeURIComponent('/auth/verify')}`)}
        >
          Sign in
        </Button>
      </AuthLayout>
    );
  }

  if (me.verified && !me.pendingEmail) {
    return (
      <AuthLayout
        title={
          <>
            You’re
            <br />
            verified.
          </>
        }
        subtitle={`${me.email} is confirmed.`}
      >
        <Button full between icon={ArrowRight} onClick={() => void proceed()}>
          Continue
        </Button>
      </AuthLayout>
    );
  }

  const address = me.pendingEmail ?? me.email;
  return (
    <AuthLayout
      title={
        <>
          Check your
          <br />
          inbox.
        </>
      }
      subtitle={`We sent a verification link to ${address}. It expires in 24 hours.`}
    >
      <div className={styles.state}>
        <Mail size={32} aria-hidden />
        <p className="t-body-sm">
          Open the link on this device to confirm the address. Until then you can read everything,
          but saving needs a verified email.
        </p>
      </div>
      {resend.message && (
        <Notice
          tone={resend.message.tone === 'error' ? 'error' : 'neutral'}
          icon={resend.message.tone === 'error' ? TriangleAlert : undefined}
          role="status"
          title={resend.message.text}
        />
      )}
      <Button
        full
        variant="secondary"
        icon={RefreshCw}
        iconPosition="start"
        pending={resend.pending}
        disabledReason={
          resend.wait > 0 ? `You can request another link in ${resend.wait} seconds.` : undefined
        }
        onClick={() => void resend.resend()}
      >
        {resend.wait > 0 ? `Resend in ${resend.wait} s` : 'Resend the email'}
      </Button>
      <Button full variant="quiet" onClick={() => push('/account/edit')}>
        Wrong address? Change your email
      </Button>
      <Button full variant="quiet" onClick={() => push(returnTo, { replace: true })}>
        Continue without verifying
      </Button>
      <DemoMailbox to={address} kinds={['verify']} />
    </AuthLayout>
  );
}
