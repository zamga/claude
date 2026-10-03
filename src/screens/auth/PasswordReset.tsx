import { useQuery } from '@tanstack/react-query';
import { useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { useAppNavigation } from '@/app/navigation';
import { AppLink } from '@/components/AppLink';
import { Button } from '@/components/Button';
import { TextField } from '@/components/Form';
import { ArrowRight, CircleCheck, Mail, RefreshCw, TriangleAlert } from '@/components/icons';
import { Notice, Skeleton } from '@/components/Status';
import {
  PASSWORD_MAX,
  PASSWORD_MIN,
  validateEmail,
  validateNewPassword,
} from '@/domain/validation';
import { api } from '@/data/api';
import { errorMessage, isApiError } from '@/data/errors';
import { AuthLayout } from '@/features/AuthLayout';
import { DemoMailbox } from '@/features/DemoMailbox';
import { PasswordField } from '@/features/PasswordField';
import { useOffline } from '@/features/status';
import { useDocumentTitle } from '@/features/title';
import { haptics } from '@/lib/haptics';
import { useNow } from '@/lib/hooks';
import styles from './Auth.module.css';

const RESEND_MS = 60_000;

/** Reset request with a neutral confirmation that never reveals whether an account exists. */
export function ForgotPasswordScreen() {
  const [params] = useSearchParams();
  const offline = useOffline();
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [error, setError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const now = useNow(1000);
  const wait = sentAt ? Math.max(0, Math.ceil((sentAt + RESEND_MS - now) / 1000)) : 0;
  useDocumentTitle('Reset your password');

  const send = async (event?: FormEvent) => {
    event?.preventDefault();
    setFormError(null);
    const target = sentTo ?? email.trim();
    const problem = validateEmail(target);
    setError(problem);
    if (problem) return input.current?.focus();
    setPending(true);
    try {
      await api.me.forgot(target);
      haptics.success();
      setSentTo(target);
      setSentAt(Date.now());
    } catch (failure) {
      haptics.error();
      setFormError(errorMessage(failure));
    } finally {
      setPending(false);
    }
  };

  if (sentTo) {
    return (
      <AuthLayout
        back="/auth/sign-in"
        title={
          <>
            Check your
            <br />
            inbox.
          </>
        }
        subtitle={`If an account uses ${sentTo}, a reset link is on its way. It works once and expires in one hour.`}
      >
        <div className={styles.state}>
          <Mail size={32} aria-hidden />
          <p className="t-body-sm">Nothing arrived? Check spam, or request another link.</p>
        </div>
        {formError && <Notice tone="error" icon={TriangleAlert} role="alert" title={formError} />}
        <Button
          full
          variant="secondary"
          icon={RefreshCw}
          iconPosition="start"
          pending={pending}
          disabledReason={wait > 0 ? `You can request another link in ${wait} seconds.` : undefined}
          onClick={() => void send()}
        >
          {wait > 0 ? `Send again in ${wait} s` : 'Send another link'}
        </Button>
        <Button
          full
          variant="quiet"
          onClick={() => {
            setSentTo(null);
            setSentAt(null);
          }}
        >
          Use a different email
        </Button>
        <DemoMailbox to={sentTo} kinds={['reset']} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      back="/auth/sign-in"
      title={
        <>
          Reset your
          <br />
          password.
        </>
      }
      subtitle="Enter the email you use for Stock Picks. We’ll send a single-use link."
    >
      {formError && <Notice tone="error" icon={TriangleAlert} role="alert" title={formError} />}
      <form className={styles.form} onSubmit={send} noValidate>
        <TextField
          ref={input}
          label="Email address"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          error={error}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Button
          type="submit"
          full
          between
          icon={ArrowRight}
          pending={pending}
          disabledReason={offline ? 'Needs a connection.' : undefined}
        >
          Send reset link
        </Button>
      </form>
    </AuthLayout>
  );
}

/** New password from a single-use link; expired and used links offer a new request. */
export function ResetPasswordScreen() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const { push } = useAppNavigation();
  const offline = useOffline();
  const check = useQuery({
    queryKey: ['auth', 'reset', token],
    queryFn: () => api.me.checkReset(token),
    enabled: token !== '',
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  useDocumentTitle('Choose a new password');

  if (done) {
    return (
      <AuthLayout
        title={
          <>
            Password
            <br />
            changed.
          </>
        }
        subtitle="Every device was signed out. Sign in with your new password."
      >
        <div className={styles.state}>
          <CircleCheck size={36} aria-hidden style={{ color: 'var(--positive)' }} />
        </div>
        <Button
          full
          between
          icon={ArrowRight}
          onClick={() => push('/auth/sign-in', { replace: true })}
        >
          Sign in
        </Button>
      </AuthLayout>
    );
  }

  if (!token || check.data?.valid === false || check.isError) {
    const reason = check.data?.reason;
    return (
      <AuthLayout
        back="/auth/sign-in"
        title={
          <>
            This link
            <br />
            can’t be used.
          </>
        }
        subtitle={
          reason === 'expired'
            ? 'Reset links expire after one hour.'
            : reason === 'used'
              ? 'This link was already used. Each link works once.'
              : check.isError
                ? errorMessage(check.error)
                : 'The link is incomplete or not valid.'
        }
      >
        <Button full onClick={() => push('/auth/forgot', { replace: true })}>
          Request a new link
        </Button>
        <Button full variant="quiet" onClick={() => push('/auth/sign-in', { replace: true })}>
          Back to sign in
        </Button>
      </AuthLayout>
    );
  }

  if (check.isPending) {
    return (
      <AuthLayout title="Checking your link…">
        <Skeleton height={48} />
      </AuthLayout>
    );
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const next = {
      password: validateNewPassword(password),
      confirm: confirm !== password ? 'The passwords do not match.' : undefined,
    };
    setErrors(next);
    if (next.password || next.confirm) return passwordRef.current?.focus();
    setPending(true);
    try {
      await api.me.reset(token, password);
      haptics.success();
      setPassword('');
      setConfirm('');
      setDone(true);
    } catch (failure) {
      haptics.error();
      setPassword('');
      setConfirm('');
      if (isApiError(failure) && failure.fieldErrors.password)
        setErrors({ password: failure.fieldErrors.password });
      else setFormError(errorMessage(failure));
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthLayout
      title={
        <>
          Choose a new
          <br />
          password.
        </>
      }
      subtitle={`${PASSWORD_MIN}–${PASSWORD_MAX} characters. Every device is signed out afterwards.`}
    >
      {formError && (
        <Notice tone="error" icon={TriangleAlert} role="alert" title={formError}>
          <AppLink to="/auth/forgot" className="link">
            Request a new link
          </AppLink>
        </Notice>
      )}
      <form className={styles.form} onSubmit={submit} noValidate>
        <PasswordField
          ref={passwordRef}
          label="New password"
          autoComplete="new-password"
          value={password}
          error={errors.password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <PasswordField
          label="Confirm new password"
          autoComplete="new-password"
          value={confirm}
          error={errors.confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />
        <Button
          type="submit"
          full
          pending={pending}
          disabledReason={offline ? 'Needs a connection.' : undefined}
        >
          Save new password
        </Button>
      </form>
    </AuthLayout>
  );
}
