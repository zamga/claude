import { useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { useAppNavigation } from '@/app/navigation';
import { safeReturnTo } from '@/app/routeTable';
import { useSession, useSignOut } from '@/app/session';
import { AppLink } from '@/components/AppLink';
import { Button } from '@/components/Button';
import { TextField } from '@/components/Form';
import { ArrowRight, Info, TriangleAlert } from '@/components/icons';
import { Notice } from '@/components/Status';
import { validateEmail, validateExistingPassword } from '@/domain/validation';
import { api } from '@/data/api';
import { DEMO_EMAIL, DEMO_PASSWORD } from '@/data/demo/crypto';
import { errorMessage, isApiError } from '@/data/errors';
import { DATA_MODE } from '@/data/transport';
import { configuredProviders, useCompleteSignIn } from '@/features/auth';
import { AuthLayout } from '@/features/AuthLayout';
import { PasswordField } from '@/features/PasswordField';
import { useOffline } from '@/features/status';
import { useDocumentTitle } from '@/features/title';
import { appUrl } from '@/lib/base';
import { haptics } from '@/lib/haptics';
import styles from './Auth.module.css';

/** S03: email and password sign-in that resumes the requested destination. */
export default function SignInScreen() {
  const [params] = useSearchParams();
  const returnTo = params.get('returnTo');
  const { signedIn, me } = useSession();
  const signOut = useSignOut();
  const complete = useCompleteSignIn();
  const offline = useOffline();
  const { push } = useAppNavigation();
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const providers = configuredProviders();
  const registerHref = `/auth/register${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`;
  useDocumentTitle('Sign in');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const next = { email: validateEmail(email), password: validateExistingPassword(password) };
    setErrors(next);
    if (next.email) return emailRef.current?.focus();
    if (next.password) return passwordRef.current?.focus();
    setPending(true);
    try {
      const account = await api.me.signIn(email.trim(), password);
      haptics.success();
      setPassword('');
      await complete(account, returnTo);
    } catch (failure) {
      haptics.error();
      // Keep the email; never keep the password after a failed attempt.
      setPassword('');
      if (isApiError(failure) && failure.code === 'validation') {
        setFormError(failure.message);
        setErrors({ password: failure.fieldErrors.password });
        passwordRef.current?.focus();
      } else {
        setFormError(errorMessage(failure));
      }
    } finally {
      setPending(false);
    }
  };

  if (signedIn && me) {
    return (
      <AuthLayout
        title={
          <>
            Welcome
            <br />
            back.
          </>
        }
        subtitle={`You’re signed in as ${me.email}.`}
      >
        <Button
          full
          icon={ArrowRight}
          between
          onClick={() => push(safeReturnTo(returnTo), { replace: true })}
        >
          Continue
        </Button>
        <Button full variant="quiet" onClick={() => void signOut()}>
          Sign in with a different account
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={
        <>
          Welcome
          <br />
          back.
        </>
      }
      subtitle="Your research, in one place."
      footer={
        <>
          <p>
            New here?{' '}
            <AppLink to={registerHref} className="link">
              Create account
            </AppLink>
          </p>
        </>
      }
    >
      {DATA_MODE === 'demo' && (
        <Notice
          tone="neutral"
          icon={Info}
          title="Demo account"
          actions={
            <Button
              size="small"
              variant="quiet"
              onClick={() => {
                setEmail(DEMO_EMAIL);
                setPassword(DEMO_PASSWORD);
                setErrors({});
              }}
            >
              Fill in the demo account
            </Button>
          }
        >
          {DEMO_EMAIL} · {DEMO_PASSWORD}. Accounts live only in this browser.
        </Notice>
      )}
      {formError && <Notice tone="error" icon={TriangleAlert} role="alert" title={formError} />}
      <form className={styles.form} onSubmit={submit} noValidate>
        <TextField
          ref={emailRef}
          label="Email address"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          error={errors.email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <PasswordField
          ref={passwordRef}
          label="Password"
          autoComplete="current-password"
          value={password}
          error={errors.password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <AppLink
          to={`/auth/forgot${email ? `?email=${encodeURIComponent(email.trim())}` : ''}`}
          className={`link ${styles.forgot}`}
        >
          Forgot password?
        </AppLink>
        <Button
          type="submit"
          full
          between
          icon={ArrowRight}
          pending={pending}
          disabledReason={offline ? 'Signing in needs a connection.' : undefined}
        >
          Sign in
        </Button>
      </form>
      {providers.length > 0 ? (
        <div className={styles.providers}>
          <span className={styles.or}>or</span>
          {providers.map((provider) => (
            <Button
              key={provider}
              full
              variant="secondary"
              onClick={() =>
                window.location.assign(
                  appUrl(
                    `/auth/callback?provider=${provider}&returnTo=${encodeURIComponent(safeReturnTo(returnTo))}`,
                  ),
                )
              }
            >
              Continue with {provider === 'google' ? 'Google' : 'Apple'}
            </Button>
          ))}
        </div>
      ) : (
        <p className={styles.muted}>
          Apple and Google sign-in appear once their callback flows are configured for this build.
        </p>
      )}
    </AuthLayout>
  );
}
