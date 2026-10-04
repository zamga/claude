import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { useAppNavigation } from '@/app/navigation';
import { AppLink } from '@/components/AppLink';
import { Button } from '@/components/Button';
import { LargeTitle, SectionHeader, TopBar } from '@/components/Header';
import { IconButton } from '@/components/IconButton';
import { RefreshCw, Trash2, TriangleAlert } from '@/components/icons';
import { ActionBar, Content, ScreenBody } from '@/components/Layout';
import { List, Row } from '@/components/List';
import { Ticker } from '@/components/Market';
import { useConfirm } from '@/components/Sheet';
import { EmptyState, Notice } from '@/components/Status';
import { TextField } from '@/components/Form';
import { useToast } from '@/components/Toast';
import { pluralize } from '@/domain/format';
import { validateWatchlistName, WATCHLIST_NAME_MAX } from '@/domain/validation';
import { api } from '@/data/api';
import { errorMessage, isApiError } from '@/data/errors';
import { qk, useInstrument, useWatchlists } from '@/data/queries';
import type { Watchlist } from '@/data/types';
import { newIdempotencyKey } from '@/data/transport';
import { useUnsavedChangesGuard } from '@/features/guard';
import { useOffline } from '@/features/status';
import { useDocumentTitle } from '@/features/title';
import { useWatchlistMembership } from '@/features/watchlist';
import { haptics } from '@/lib/haptics';
import { draftKey, readJson, writeJson } from '@/lib/storage';
import shared from '../shared.module.css';

const NEW_DRAFT = draftKey('watchlist.new');

/** Create a collection; optionally adds the company the person came from (spec page 26). */
export function NewWatchlistScreen() {
  const [params] = useSearchParams();
  const addSymbol = params.get('add');
  const addInstrument = useInstrument(addSymbol ?? undefined);
  const lists = useWatchlists();
  const queryClient = useQueryClient();
  const toast = useToast();
  const offline = useOffline();
  const { push, back } = useAppNavigation();
  const [name, setName] = useState(() => readJson<string>('session', NEW_DRAFT) ?? '');
  const [error, setError] = useState<string | undefined>();
  const [duplicateOf, setDuplicateOf] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const key = useRef(newIdempotencyKey());
  const input = useRef<HTMLInputElement>(null);
  useDocumentTitle('New watchlist');

  useEffect(() => writeJson('session', NEW_DRAFT, name || null), [name]);
  const guard = useUnsavedChangesGuard(
    name.trim().length > 0 && !done,
    'The list has not been created.',
  );

  const mutation = useMutation({
    mutationFn: async (value: string) => {
      const list = await api.watchlists.create(value, key.current);
      if (addInstrument.data) return api.watchlists.addMember(list.id, addInstrument.data.id);
      return list;
    },
  });

  const validate = (value: string) => {
    const check = validateWatchlistName(value, lists.data ?? []);
    if (check.ok) {
      setError(undefined);
      setDuplicateOf(null);
      return check.value;
    }
    setError(check.message);
    setDuplicateOf(check.duplicateOf ?? null);
    return null;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const value = validate(name);
    if (!value) {
      input.current?.focus();
      return;
    }
    try {
      const list = await mutation.mutateAsync(value);
      haptics.success();
      setDone(true);
      writeJson('session', NEW_DRAFT, null);
      queryClient.setQueryData<Watchlist[]>(qk.watchlists, (current) => [
        ...(current ?? []).filter((item) => item.id !== list.id),
        list,
      ]);
      void queryClient.invalidateQueries({ queryKey: qk.watchlists });
      toast({
        message: addInstrument.data
          ? `Created “${list.name}” with ${addInstrument.data.symbol}`
          : `Created “${list.name}”`,
      });
      // Return to where the person was when adding a company; otherwise open the new list.
      if (addInstrument.data) back();
      else push(`/watchlist?list=${list.id}`, { replace: true });
    } catch (failure) {
      haptics.error();
      if (isApiError(failure) && (failure.code === 'duplicate' || failure.code === 'validation')) {
        setError(failure.fieldErrors.name ?? failure.message);
        setDuplicateOf((failure.details.existingId as string | undefined) ?? null);
        input.current?.focus();
      } else {
        // The key stays the same so a retry cannot create a second list.
        setFormError(errorMessage(failure));
      }
    }
  };

  return (
    <ScreenBody>
      <TopBar title="New watchlist" ruled />
      <Content>
        <LargeTitle
          title="Name your list."
          size="title"
          subtitle="Group companies by idea, event or horizon."
        />
        <form
          id="new-list"
          className={`${shared.form} ${shared.formNarrow}`}
          onSubmit={submit}
          noValidate
        >
          {formError && (
            <Notice tone="error" icon={TriangleAlert} role="alert" title={formError}>
              Your list name is still here. Try again when you are ready.
            </Notice>
          )}
          <TextField
            ref={input}
            label="List name"
            hint={`Up to ${WATCHLIST_NAME_MAX} characters.`}
            value={name}
            maxLength={WATCHLIST_NAME_MAX * 2}
            autoComplete="off"
            enterKeyHint="done"
            error={error}
            onChange={(event) => {
              setName(event.target.value);
              if (error) setError(undefined);
            }}
            onBlur={() => name.trim() && validate(name)}
          />
          {duplicateOf && (
            <AppLink to={`/watchlist?list=${duplicateOf}`} className="link t-label">
              Open the existing list
            </AppLink>
          )}
          {addSymbol && (
            <p className="t-label t-muted">
              {addInstrument.data
                ? `${addInstrument.data.symbol} will be added to this list.`
                : `${addSymbol.toUpperCase()} will be added once the list exists.`}
            </p>
          )}
        </form>
      </Content>
      <ActionBar note={offline ? 'Reconnect to create the list. Your draft is kept.' : undefined}>
        <Button
          type="submit"
          form="new-list"
          full
          pending={mutation.isPending}
          disabledReason={offline ? 'Creating a list needs a connection.' : undefined}
        >
          Create list
        </Button>
      </ActionBar>
      {guard}
    </ScreenBody>
  );
}

function MemberEditRow({
  list,
  member,
}: {
  list: Watchlist;
  member: Watchlist['members'][number];
}) {
  const membership = useWatchlistMembership(member.instrumentId, member.symbol);
  const instrument = useInstrument(member.instrumentId);
  return (
    <Row
      title={<Ticker symbol={member.symbol} />}
      detail={instrument.data?.shortName}
      action={
        <IconButton
          icon={Trash2}
          label={`Remove ${member.symbol} from ${list.name}`}
          busy={membership.pendingList === list.id}
          onClick={() => void membership.remove(list.id)}
        />
      }
      chevron={false}
      dense
    />
  );
}

/** Rename, prune or delete a collection. Deleting a list never touches notes or alerts. */
export function EditWatchlistScreen() {
  const { listId } = useParams();
  const lists = useWatchlists();
  const list = lists.data?.find((candidate) => candidate.id === listId);
  const queryClient = useQueryClient();
  const toast = useToast();
  const offline = useOffline();
  const { push } = useAppNavigation();
  const { confirm, element: confirmElement } = useConfirm();
  const [name, setName] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [conflict, setConflict] = useState<Watchlist | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  useDocumentTitle(list ? `Edit ${list.name}` : 'Edit watchlist');

  const value = name ?? list?.name ?? '';
  const dirty = list != null && name != null && name.trim() !== list.name;
  const guard = useUnsavedChangesGuard(dirty && !deleting, 'The new name has not been saved.');

  const rename = useMutation({
    mutationFn: ({ next, version }: { next: string; version: number }) =>
      api.watchlists.rename(list!.id, next, version),
  });

  if (lists.isPending)
    return (
      <ScreenBody>
        <TopBar title="Edit watchlist" ruled />
      </ScreenBody>
    );
  if (!list) {
    return (
      <ScreenBody>
        <TopBar title="Edit watchlist" ruled />
        <Content>
          <EmptyState
            title="This list no longer exists."
            actions={
              <Button full onClick={() => push('/watchlist', { replace: true })}>
                Open your watchlist
              </Button>
            }
          >
            It may have been deleted on another device.
          </EmptyState>
        </Content>
      </ScreenBody>
    );
  }

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const check = validateWatchlistName(value, lists.data ?? [], list.id);
    if (!check.ok) {
      setError(check.message);
      return;
    }
    try {
      const saved = await rename.mutateAsync({
        next: check.value,
        version: conflict?.version ?? list.version,
      });
      queryClient.setQueryData<Watchlist[]>(qk.watchlists, (current) =>
        current?.map((item) => (item.id === saved.id ? saved : item)),
      );
      setName(null);
      setConflict(null);
      haptics.success();
      toast({ message: `Renamed to “${saved.name}”` });
    } catch (failure) {
      haptics.error();
      if (isApiError(failure) && failure.code === 'version_conflict') {
        setConflict((failure.details.latest as Watchlist | undefined) ?? null);
      } else if (
        isApiError(failure) &&
        (failure.code === 'validation' || failure.code === 'duplicate')
      ) {
        setError(failure.fieldErrors.name ?? failure.message);
      } else {
        setFormError(errorMessage(failure));
      }
    } finally {
      void queryClient.invalidateQueries({ queryKey: qk.watchlists });
    }
  };

  const remove = async () => {
    const ok = await confirm({
      title: `Delete “${list.name}”?`,
      body: `${pluralize(list.members.length, 'company', 'companies')} will be removed from this list only. Your other lists, alerts, notes and paper positions stay as they are.`,
      confirmLabel: 'Delete list',
      destructive: true,
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await api.watchlists.remove(list.id);
      queryClient.setQueryData<Watchlist[]>(qk.watchlists, (current) =>
        current?.filter((item) => item.id !== list.id),
      );
      haptics.success();
      toast({ message: `Deleted “${list.name}”` });
      push('/watchlist', { replace: true });
    } catch (failure) {
      setDeleting(false);
      haptics.error();
      toast({ message: `${errorMessage(failure)} The list was not deleted.`, tone: 'error' });
    } finally {
      void queryClient.invalidateQueries({ queryKey: qk.watchlists });
    }
  };

  return (
    <ScreenBody>
      <TopBar title="Edit watchlist" ruled />
      <Content>
        <LargeTitle
          title={list.name}
          size="title"
          subtitle={pluralize(list.members.length, 'company', 'companies')}
        />
        <form
          id="edit-list"
          className={`${shared.form} ${shared.formNarrow}`}
          onSubmit={save}
          noValidate
        >
          {conflict && (
            <Notice
              tone="warning"
              icon={RefreshCw}
              role="alert"
              title="This list changed on another device."
              actions={
                <Button
                  size="small"
                  variant="quiet"
                  onClick={() => {
                    setName(null);
                    setConflict(null);
                  }}
                >
                  Use the latest name
                </Button>
              }
            >
              Latest name: “{conflict.name}”. Save again to keep yours instead.
            </Notice>
          )}
          {formError && <Notice tone="error" icon={TriangleAlert} role="alert" title={formError} />}
          <TextField
            label="List name"
            hint={`Up to ${WATCHLIST_NAME_MAX} characters.`}
            value={value}
            maxLength={WATCHLIST_NAME_MAX * 2}
            autoComplete="off"
            error={error}
            onChange={(event) => {
              setName(event.target.value);
              if (error) setError(undefined);
            }}
          />
          <div>
            <Button
              type="submit"
              variant="secondary"
              pending={rename.isPending}
              disabledReason={
                !dirty && !conflict
                  ? 'Change the name to save it.'
                  : offline
                    ? 'Saving needs a connection.'
                    : undefined
              }
            >
              Save name
            </Button>
          </div>
        </form>
        <SectionHeader title="Companies" size="small" />
        {list.members.length === 0 ? (
          <p className={shared.footnote}>
            No companies yet. Use the bookmark on any company to add it.
          </p>
        ) : (
          <List label={`Companies in ${list.name}`}>
            {list.members.map((member) => (
              <MemberEditRow key={member.instrumentId} list={list} member={member} />
            ))}
          </List>
        )}
        <p className={shared.footnote}>
          Removing a company from this list keeps your notes, alerts and other lists. Undo is
          offered after each removal.
        </p>
        <div className={shared.block} style={{ marginTop: 32 }}>
          <Button
            variant="danger"
            full
            icon={Trash2}
            iconPosition="start"
            pending={deleting}
            onClick={() => void remove()}
            disabledReason={offline ? 'Deleting needs a connection.' : undefined}
          >
            Delete this list
          </Button>
        </div>
      </Content>
      {guard}
      {confirmElement}
    </ScreenBody>
  );
}
