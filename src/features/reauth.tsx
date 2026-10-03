import { useCallback, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/Button';
import { TextField } from '@/components/Form';
import { Sheet } from '@/components/Sheet';
import { api } from '@/data/api';
import { errorMessage, isApiError } from '@/data/errors';

/**
 * Fresh authentication for sensitive actions (spec page 55): when the service answers
 * "reauthentication required", ask for the password, then repeat the original request once.
 */
export function useReauthentication() {
  const [request, setRequest] = useState<{ resolve: (ok: boolean) => void; reason: string } | null>(
    null,
  );
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const ask = useCallback(
    (reason: string) =>
      new Promise<boolean>((resolve) => {
        setPassword('');
        setError(undefined);
        setRequest({ resolve, reason });
      }),
    [],
  );

  const run = useCallback(
    async <T,>(action: () => Promise<T>, reason: string): Promise<T> => {
      try {
        return await action();
      } catch (failure) {
        if (!isApiError(failure) || failure.code !== 'reauthentication_required') throw failure;
        const ok = await ask(reason);
        if (!ok) throw failure;
        return action();
      }
    },
    [ask],
  );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!password) {
      setError('Enter your password.');
      input.current?.focus();
      return;
    }
    setPending(true);
    try {
      await api.me.reauthenticate(password);
      setPassword('');
      request?.resolve(true);
      setRequest(null);
    } catch (failure) {
      setPassword('');
      setError(
        isApiError(failure)
          ? (failure.fieldErrors.password ?? failure.message)
          : errorMessage(failure),
      );
      input.current?.focus();
    } finally {
      setPending(false);
    }
  };

  const element = (
    <Sheet
      open={request != null}
      onClose={() => {
        request?.resolve(false);
        setRequest(null);
        setPassword('');
      }}
      title="Confirm it’s you"
      size="auto"
      footer={
        <Button type="submit" form="reauth-form" full pending={pending}>
          Confirm
        </Button>
      }
    >
      <form id="reauth-form" onSubmit={submit} noValidate style={{ display: 'grid', gap: 16 }}>
        <p className="t-body-sm">
          {request?.reason} For your security, enter your password again. It is valid for five
          minutes.
        </p>
        <TextField
          ref={input}
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          error={error}
          autoFocus
          onChange={(event) => setPassword(event.target.value)}
        />
      </form>
    </Sheet>
  );

  return { run, element };
}
