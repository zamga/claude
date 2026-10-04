import { useSearchParams } from 'react-router';
import { useAppNavigation } from '@/app/navigation';
import { safeReturnTo } from '@/app/routeTable';
import { Button } from '@/components/Button';
import { configuredProviders } from '@/features/auth';
import { AuthLayout } from '@/features/AuthLayout';
import { useDocumentTitle } from '@/features/title';

/**
 * Provider callback. Only allowlisted in-app destinations are honoured; anything else returns to
 * Picks. The demo build has no provider configured, so it explains that instead of pretending.
 */
export default function CallbackScreen() {
  const [params] = useSearchParams();
  const { push } = useAppNavigation();
  const returnTo = safeReturnTo(params.get('returnTo'));
  const provider = params.get('provider');
  const error = params.get('error');
  useDocumentTitle('Signing in');
  const configured =
    provider != null && configuredProviders().includes(provider as 'google' | 'apple');
  const backToSignIn = () =>
    push(`/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}`, { replace: true });

  if (error) {
    return (
      <AuthLayout
        title={
          <>
            Sign-in was
            <br />
            not completed.
          </>
        }
        subtitle={
          error === 'access_denied'
            ? 'The request was cancelled. Nothing was changed.'
            : 'The provider returned an error. Nothing was changed.'
        }
      >
        <Button full onClick={backToSignIn}>
          Back to sign in
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={
        <>
          This sign-in
          <br />
          isn’t available.
        </>
      }
      subtitle={
        configured
          ? 'The provider session is exchanged on the server in a live build. This demo build has no server session endpoint.'
          : 'This sign-in method is not configured for this build. Use your email and password instead.'
      }
    >
      <Button full onClick={backToSignIn}>
        Sign in with email
      </Button>
    </AuthLayout>
  );
}
