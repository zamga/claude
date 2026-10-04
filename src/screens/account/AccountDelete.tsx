import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useAppNavigation } from '@/app/navigation';
import { useSession } from '@/app/session';
import { Button } from '@/components/Button';
import { LargeTitle, TopBar } from '@/components/Header';
import { TriangleAlert } from '@/components/icons';
import { Content, ScreenBody } from '@/components/Layout';
import { Notice } from '@/components/Status';
import { TextField } from '@/components/Form';
import { useToast } from '@/components/Toast';
import { api } from '@/data/api';
import { clearPrivateClientState } from '@/data/queryClient';
import { errorMessage, isApiError } from '@/data/errors';
import { qk } from '@/data/queries';
import { useReauthentication } from '@/features/reauth';
import { useOffline } from '@/features/status';
import { useDocumentTitle } from '@/features/title';
import shared from '../shared.module.css';

/** Deliberate deletion: consequences first, typed confirmation and fresh authentication. */
export default function AccountDeleteScreen() {
  const { me } = useSession();
  const queryClient = useQueryClient();
  const toast = useToast();
  const offline = useOffline();
  const reauth = useReauthentication();
  const { push, back } = useAppNavigation();
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  useDocumentTitle('Delete account');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (confirmation.trim().toUpperCase() !== 'DELETE') {
      setError('Type DELETE to confirm.');
      return;
    }
    setPending(true);
    try {
      await reauth.run(
        () => api.me.deleteAccount(confirmation),
        'Deleting your account cannot be undone.',
      );
      clearPrivateClientState(me?.id ?? null);
      queryClient.setQueryData(qk.me, null);
      toast({
        message: 'Your account was deleted. Sessions on every device have ended.',
        durationMs: 6000,
      });
      push('/', { replace: true });
    } catch (failure) {
      if (isApiError(failure) && failure.code === 'reauthentication_required')
        setFormError('Nothing was deleted: your password was not confirmed.');
      else if (isApiError(failure) && failure.fieldErrors.confirmation)
        setError(failure.fieldErrors.confirmation);
      else setFormError(`${errorMessage(failure)} Nothing was deleted.`);
    } finally {
      setPending(false);
    }
  };

  return (
    <ScreenBody>
      <TopBar title="Delete account" ruled />
      <Content>
        <LargeTitle title="Delete your account." size="title" />
        <form className={`${shared.form} ${shared.formNarrow}`} onSubmit={submit} noValidate>
          <Notice tone="warning" icon={TriangleAlert} title="This cannot be undone.">
            Signing in stops immediately. Your watchlists, alert rules and history, saved research,
            scenarios, paper portfolio, journal and preferences are removed, and push and email
            stop. Published research and the pick archive are not personal data and stay public.
          </Notice>
          <p className="t-body-sm">
            Want a copy first?{' '}
            <button type="button" className="link" onClick={() => push('/account/data')}>
              Export your data
            </button>
            .
          </p>
          {formError && <Notice tone="error" icon={TriangleAlert} role="alert" title={formError} />}
          <TextField
            label="Type DELETE to confirm"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            value={confirmation}
            error={error}
            onChange={(event) => {
              setConfirmation(event.target.value);
              setError(undefined);
            }}
          />
          <Button
            type="submit"
            variant="danger"
            full
            pending={pending}
            disabledReason={offline ? 'Needs a connection.' : undefined}
          >
            Delete account {me ? `for ${me.email}` : ''}
          </Button>
          <Button variant="quiet" full onClick={() => back('/account/data')}>
            Keep my account
          </Button>
        </form>
      </Content>
      {reauth.element}
    </ScreenBody>
  );
}
