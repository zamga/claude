import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useSession } from '@/app/session';
import { Button } from '@/components/Button';
import { LargeTitle, SectionHeader, TopBar } from '@/components/Header';
import { TriangleAlert } from '@/components/icons';
import { Content, ScreenBody } from '@/components/Layout';
import { Notice } from '@/components/Status';
import { TextField } from '@/components/Form';
import { useToast } from '@/components/Toast';
import { validateDisplayName, validateEmail } from '@/domain/validation';
import { api } from '@/data/api';
import { errorMessage, isApiError } from '@/data/errors';
import { qk } from '@/data/queries';
import { DemoMailbox } from '@/features/DemoMailbox';
import { useUnsavedChangesGuard } from '@/features/guard';
import { useReauthentication } from '@/features/reauth';
import { useOffline } from '@/features/status';
import { useDocumentTitle } from '@/features/title';
import { haptics } from '@/lib/haptics';
import shared from '../shared.module.css';

/** Display name and email. A new address only replaces the old one after it is verified. */
export default function AccountEditScreen() {
  const { me } = useSession();
  const queryClient = useQueryClient();
  const toast = useToast();
  const offline = useOffline();
  const reauth = useReauthentication();
  const [name, setName] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | undefined>();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  useDocumentTitle('Account details');

  const nameValue = name ?? me?.displayName ?? '';
  const nameDirty = name != null && name.trim() !== me?.displayName;
  const guard = useUnsavedChangesGuard(
    nameDirty || email.trim() !== '',
    'Your account changes have not been saved.',
  );

  const saveName = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const problem = validateDisplayName(nameValue);
    setNameError(problem);
    if (problem) return;
    setSavingName(true);
    try {
      const updated = await api.me.updateProfile(nameValue.trim());
      queryClient.setQueryData(qk.me, updated);
      setName(null);
      haptics.success();
      toast({ message: 'Name saved' });
    } catch (failure) {
      haptics.error();
      if (isApiError(failure) && failure.fieldErrors.displayName)
        setNameError(failure.fieldErrors.displayName);
      else setFormError(errorMessage(failure));
    } finally {
      setSavingName(false);
    }
  };

  const saveEmail = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const problem = validateEmail(email);
    setEmailError(problem);
    if (problem) return;
    if (email.trim().toLowerCase() === me?.email.toLowerCase()) {
      setEmailError('This is already your email address.');
      return;
    }
    setSavingEmail(true);
    try {
      const updated = await reauth.run(
        () => api.me.changeEmail(email.trim()),
        'Changing your email is a security change.',
      );
      queryClient.setQueryData(qk.me, updated);
      setEmail('');
      haptics.success();
      toast({ message: `Verification sent to ${updated.pendingEmail}` });
    } catch (failure) {
      haptics.error();
      if (isApiError(failure) && failure.code === 'reauthentication_required')
        setFormError('The email was not changed because your password was not confirmed.');
      else if (isApiError(failure) && failure.fieldErrors.email)
        setEmailError(failure.fieldErrors.email);
      else setFormError(errorMessage(failure));
    } finally {
      setSavingEmail(false);
    }
  };

  return (
    <ScreenBody>
      <TopBar title="Account details" ruled />
      <Content>
        <LargeTitle
          title="Account details."
          size="title"
          subtitle="How you appear and where we reach you."
        />
        {formError && <Notice tone="error" icon={TriangleAlert} role="alert" title={formError} />}
        <form className={`${shared.form} ${shared.formNarrow}`} onSubmit={saveName} noValidate>
          <TextField
            label="Display name"
            autoComplete="name"
            value={nameValue}
            error={nameError}
            onChange={(event) => setName(event.target.value)}
          />
          <div>
            <Button
              type="submit"
              variant="secondary"
              pending={savingName}
              disabledReason={
                !nameDirty
                  ? 'Change the name to save it.'
                  : offline
                    ? 'Needs a connection.'
                    : undefined
              }
            >
              Save name
            </Button>
          </div>
        </form>

        <SectionHeader title="Email" size="small" />
        <div className={`${shared.form} ${shared.formNarrow}`} style={{ paddingTop: 0 }}>
          <p className="t-body-sm">
            Current address: <strong>{me?.email}</strong>
            {me?.verified ? ' (verified)' : ' (not verified yet)'}
          </p>
          {me?.pendingEmail && (
            <Notice tone="neutral" title={`Waiting for ${me.pendingEmail} to be verified.`}>
              Open the link we sent to the new address. Until then, {me.email} stays your sign-in
              email.
            </Notice>
          )}
        </div>
        <form className={`${shared.form} ${shared.formNarrow}`} onSubmit={saveEmail} noValidate>
          <TextField
            label="New email address"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            hint="We send a link to the new address. You may be asked for your password."
            value={email}
            error={emailError}
            onChange={(event) => setEmail(event.target.value)}
          />
          <div>
            <Button
              type="submit"
              variant="secondary"
              pending={savingEmail}
              disabledReason={
                email.trim() === ''
                  ? 'Enter a new address first.'
                  : offline
                    ? 'Needs a connection.'
                    : undefined
              }
            >
              Send verification link
            </Button>
          </div>
          {me?.pendingEmail && <DemoMailbox to={me.pendingEmail} kinds={['verify']} />}
        </form>
      </Content>
      {reauth.element}
      {guard}
    </ScreenBody>
  );
}
