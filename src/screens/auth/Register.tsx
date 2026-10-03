import { useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { useAppNavigation } from '@/app/navigation';
import { safeReturnTo } from '@/app/routeTable';
import { AppLink } from '@/components/AppLink';
import { Button } from '@/components/Button';
import { CheckRow, TextField } from '@/components/Form';
import { ArrowRight, TriangleAlert } from '@/components/icons';
import { Notice } from '@/components/Status';
import {
  PASSWORD_MAX,
  PASSWORD_MIN,
  validateDisplayName,
  validateEmail,
  validateNewPassword,
} from '@/domain/validation';
import { api } from '@/data/api';
import { errorMessage, isApiError } from '@/data/errors';
import { qk } from '@/data/queries';
import { rememberReturnTo } from '@/features/auth';
import { AuthLayout } from '@/features/AuthLayout';
import { PasswordField } from '@/features/PasswordField';
import { useOffline } from '@/features/status';
import { useDocumentTitle } from '@/features/title';
import { haptics } from '@/lib/haptics';
import { useQueryClient } from '@tanstack/react-query';
import styles from './Auth.module.css';

type Field = 'displayName' | 'email' | 'password' | 'confirm' | 'acceptedTerms';

/** Create an account: email, password, confirmation and the required terms acknowledgement. */
export default function RegisterScreen() {
  const [params] = useSearchParams();
  const returnTo = safeReturnTo(params.get('returnTo'));
  const queryClient = useQueryClient();
  const offline = useOffline();
  const { push } = useAppNavigation();
  const [values, setValues] = useState({
    displayName: '',
    email: params.get('email') ?? '',
    password: '',
    confirm: '',
  });
  const [accepted, setAccepted] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const displayNameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  useDocumentTitle('Create account');

  const set = (field: keyof typeof values) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setValues((current) => ({ ...current, [field]: event.target.value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const validate = (): Partial<Record<Field, string>> => ({
    displayName: validateDisplayName(values.displayName),
    email: validateEmail(values.email),
    password: validateNewPassword(values.password),
    confirm: values.confirm !== values.password ? 'The passwords do not match.' : undefined,
    acceptedTerms: accepted ? undefined : 'Accept the account terms to continue.',
  });

  const focusFirst = (next: Partial<Record<Field, string>>) => {
    const first = (['displayName', 'email', 'password', 'confirm'] as const).find(
      (field) => next[field],
    );
    const target = {
      displayName: displayNameRef,
      email: emailRef,
      password: passwordRef,
      confirm: confirmRef,
    };
    if (first) target[first].current?.focus();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const next = validate();
    setErrors(next);
    if (Object.values(next).some(Boolean)) return focusFirst(next);
    setPending(true);
    try {
      const me = await api.me.register({
        email: values.email.trim(),
        password: values.password,
        displayName: values.displayName.trim(),
        acceptedTerms: accepted,
      });
      haptics.success();
      queryClient.setQueryData(qk.me, me);
      void queryClient.resetQueries({ queryKey: ['private'] });
      setValues((current) => ({ ...current, password: '', confirm: '' }));
      rememberReturnTo(returnTo);
      push(`/auth/verify?sent=1&returnTo=${encodeURIComponent(returnTo)}`, { replace: true });
    } catch (failure) {
      haptics.error();
      setValues((current) => ({ ...current, password: '', confirm: '' }));
      if (isApiError(failure) && failure.code === 'validation') {
        const fieldErrors = failure.fieldErrors as Partial<Record<Field, string>>;
        setErrors(fieldErrors);
        setFormError(failure.message);
        focusFirst(fieldErrors);
      } else {
        setFormError(errorMessage(failure));
      }
    } finally {
      setPending(false);
    }
  };

  const length = [...values.password].length;
  return (
    <AuthLayout
      back={`/auth/sign-in${params.get('returnTo') ? `?returnTo=${encodeURIComponent(params.get('returnTo')!)}` : ''}`}
      title={
        <>
          Create your
          <br />
          account.
        </>
      }
      subtitle="Free research access. Save companies, alerts and a paper portfolio."
      footer={
        <p>
          Already have an account?{' '}
          <AppLink to={`/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}`} className="link">
            Sign in
          </AppLink>
        </p>
      }
    >
      {formError && <Notice tone="error" icon={TriangleAlert} role="alert" title={formError} />}
      <form className={styles.form} onSubmit={submit} noValidate>
        <TextField
          ref={displayNameRef}
          label="Name"
          autoComplete="name"
          value={values.displayName}
          error={errors.displayName}
          onChange={set('displayName')}
        />
        <TextField
          ref={emailRef}
          label="Email address"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          value={values.email}
          error={errors.email}
          onChange={set('email')}
        />
        <PasswordField
          ref={passwordRef}
          label="Password"
          autoComplete="new-password"
          hint={`${PASSWORD_MIN}–${PASSWORD_MAX} characters. Paste and password managers work.`}
          value={values.password}
          error={errors.password}
          onChange={set('password')}
        />
        <p className={styles.rules} aria-live="polite">
          <span className={styles.rule} data-met={length >= PASSWORD_MIN && length <= PASSWORD_MAX}>
            {length >= PASSWORD_MIN && length <= PASSWORD_MAX
              ? '✓ Length is fine'
              : `${length} of at least ${PASSWORD_MIN} characters`}
          </span>
        </p>
        <PasswordField
          ref={confirmRef}
          label="Confirm password"
          autoComplete="new-password"
          value={values.confirm}
          error={errors.confirm}
          onChange={set('confirm')}
        />
        <div>
          <CheckRow
            label="I accept the account terms and privacy notice"
            checked={accepted}
            onChange={(next) => {
              setAccepted(next);
              if (next) setErrors((current) => ({ ...current, acceptedTerms: undefined }));
            }}
          />
          <p className={styles.muted} style={{ textAlign: 'left' }}>
            Read the{' '}
            <AppLink to="/legal/terms" className="link">
              terms
            </AppLink>{' '}
            and{' '}
            <AppLink to="/legal/privacy" className="link">
              privacy notice
            </AppLink>
            . There is no marketing email.
          </p>
          {errors.acceptedTerms && (
            <p className={styles.rules} style={{ color: 'var(--negative)' }} role="alert">
              {errors.acceptedTerms}
            </p>
          )}
        </div>
        <Button
          type="submit"
          full
          between
          icon={ArrowRight}
          pending={pending}
          disabledReason={offline ? 'Creating an account needs a connection.' : undefined}
        >
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
