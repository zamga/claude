import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useAppNavigation } from '@/app/navigation';
import { Button } from '@/components/Button';
import { LargeTitle, SectionHeader, TopBar } from '@/components/Header';
import { LogOut, ShieldCheck, Smartphone, TriangleAlert } from '@/components/icons';
import { Content, ScreenBody } from '@/components/Layout';
import { List, Row } from '@/components/List';
import { Tag } from '@/components/Market';
import { useConfirm } from '@/components/Sheet';
import { Notice } from '@/components/Status';
import { useToast } from '@/components/Toast';
import { formatDateTime } from '@/domain/format';
import {
  PASSWORD_MAX,
  PASSWORD_MIN,
  validateExistingPassword,
  validateNewPassword,
} from '@/domain/validation';
import { api } from '@/data/api';
import { clearPrivateClientState } from '@/data/queryClient';
import { errorMessage, isApiError } from '@/data/errors';
import { qk, useSessions } from '@/data/queries';
import type { SessionInfo } from '@/data/types';
import { PasswordField } from '@/features/PasswordField';
import { QueryState, useOffline } from '@/features/status';
import { useUserTimeZone } from '@/features/time';
import { useDocumentTitle } from '@/features/title';
import { haptics } from '@/lib/haptics';
import shared from '../shared.module.css';

/** Password change, active sessions with revocation, and an honest two-step verification status. */
export default function AccountSecurityScreen() {
  const sessions = useSessions();
  const zone = useUserTimeZone();
  const queryClient = useQueryClient();
  const toast = useToast();
  const offline = useOffline();
  const { push } = useAppNavigation();
  const { confirm, element } = useConfirm();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [errors, setErrors] = useState<{ current?: string; next?: string; repeat?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useDocumentTitle('Account security');

  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const problems = {
      current: validateExistingPassword(current),
      next: validateNewPassword(next),
      repeat: repeat !== next ? 'The new passwords do not match.' : undefined,
    };
    setErrors(problems);
    if (Object.values(problems).some(Boolean)) return;
    setSaving(true);
    try {
      await api.me.changePassword(current, next);
      haptics.success();
      toast({ message: 'Password changed' });
    } catch (failure) {
      haptics.error();
      if (isApiError(failure) && Object.keys(failure.fieldErrors).length)
        setErrors(failure.fieldErrors);
      else setFormError(errorMessage(failure));
    } finally {
      // Passwords are never kept in the form after a submission.
      setCurrent('');
      setNext('');
      setRepeat('');
      setSaving(false);
    }
  };

  const revoke = async (session: SessionInfo) => {
    const ok = await confirm({
      title: session.current ? 'Sign out this device?' : `Sign out ${session.device}?`,
      body: session.current
        ? 'You will need to sign in again here. Drafts and offline copies on this device are removed.'
        : 'That device is signed out on its next request. Your account data is unaffected.',
      confirmLabel: 'Sign out',
    });
    if (!ok) return;
    try {
      const remaining = await api.me.revokeSession(session.id);
      haptics.success();
      if (session.current) {
        // This account's drafts and offline copy go with the session (as the dialog says).
        const me = queryClient.getQueryData(qk.me) as { id: string } | null | undefined;
        clearPrivateClientState(me?.id ?? null);
        push('/auth/sign-in', { replace: true });
        return;
      }
      queryClient.setQueryData(qk.sessions, remaining);
      toast({ message: `${session.device} signed out` });
    } catch (failure) {
      toast({ message: errorMessage(failure), tone: 'error' });
    }
  };

  return (
    <ScreenBody>
      <TopBar title="Account security" ruled />
      <Content>
        <LargeTitle
          title="Security."
          size="title"
          subtitle="Your password, signed-in devices and sign-in protection."
        />

        <SectionHeader title="Change password" size="small" />
        <form
          className={`${shared.form} ${shared.formNarrow}`}
          style={{ paddingTop: 0 }}
          onSubmit={changePassword}
          noValidate
        >
          {formError && <Notice tone="error" icon={TriangleAlert} role="alert" title={formError} />}
          <PasswordField
            label="Current password"
            autoComplete="current-password"
            value={current}
            error={errors.current}
            onChange={(event) => setCurrent(event.target.value)}
          />
          <PasswordField
            label="New password"
            autoComplete="new-password"
            hint={`${PASSWORD_MIN}–${PASSWORD_MAX} characters.`}
            value={next}
            error={errors.next}
            onChange={(event) => setNext(event.target.value)}
          />
          <PasswordField
            label="Repeat new password"
            autoComplete="new-password"
            value={repeat}
            error={errors.repeat}
            onChange={(event) => setRepeat(event.target.value)}
          />
          <div>
            <Button
              type="submit"
              variant="secondary"
              pending={saving}
              disabledReason={offline ? 'Needs a connection.' : undefined}
            >
              Change password
            </Button>
          </div>
        </form>

        <SectionHeader title="Signed-in devices" size="small" />
        <QueryState query={sessions} errorTitle="Sessions could not be loaded.">
          {(items) => (
            <List label="Signed-in devices">
              {items.map((session) => (
                <Row
                  key={session.id}
                  icon={Smartphone}
                  title={
                    <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                      {session.device}
                      {session.current && <Tag tone="positive">This device</Tag>}
                    </span>
                  }
                  detail={`Last active ${formatDateTime(Date.parse(session.lastSeenAt), zone)} · signed in ${formatDateTime(Date.parse(session.createdAt), zone)}`}
                  action={
                    <Button
                      size="small"
                      variant="quiet"
                      icon={LogOut}
                      iconPosition="start"
                      onClick={() => void revoke(session)}
                    >
                      Sign out
                    </Button>
                  }
                  chevron={false}
                />
              ))}
            </List>
          )}
        </QueryState>

        <SectionHeader title="Two-step verification" size="small" />
        <div className={shared.block}>
          <Notice tone="neutral" icon={ShieldCheck} title="Not available in this demo build.">
            A live build enrols, verifies and removes an authenticator through the managed sign-in
            provider. The demo cannot check codes from your authenticator app, so it does not offer
            a setting that would not protect you.
          </Notice>
        </div>
      </Content>
      {element}
    </ScreenBody>
  );
}
