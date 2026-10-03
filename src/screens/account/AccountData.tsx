import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useAppNavigation } from '@/app/navigation';
import { Button } from '@/components/Button';
import { LargeTitle, SectionHeader, TopBar } from '@/components/Header';
import { Download, Trash2, TriangleAlert } from '@/components/icons';
import { Content, ScreenBody } from '@/components/Layout';
import { KeyValue, KeyValueList, List, Row } from '@/components/List';
import { Tag } from '@/components/Market';
import { Notice } from '@/components/Status';
import { useToast } from '@/components/Toast';
import { formatDateTime } from '@/domain/format';
import { api } from '@/data/api';
import { errorMessage, isApiError } from '@/data/errors';
import { qk, useDataRequests } from '@/data/queries';
import type { DataRequest } from '@/data/types';
import { DATA_MODE, newIdempotencyKey } from '@/data/transport';
import { useReauthentication } from '@/features/reauth';
import { QueryState, useOffline } from '@/features/status';
import { deviceTimeZone } from '@/features/time';
import { useDocumentTitle } from '@/features/title';
import { haptics } from '@/lib/haptics';
import shared from '../shared.module.css';

const STATUS: Record<
  DataRequest['status'],
  { label: string; tone: 'positive' | 'neutral' | 'warning' | 'negative' }
> = {
  preparing: { label: 'Preparing', tone: 'neutral' },
  ready: { label: 'Ready', tone: 'positive' },
  failed: { label: 'Failed', tone: 'negative' },
  expired: { label: 'Expired', tone: 'warning' },
  processing: { label: 'Processing', tone: 'neutral' },
  completed: { label: 'Completed', tone: 'positive' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
};

/** Export, privacy information and the path to deletion (spec pages 55, 57). */
export default function AccountDataScreen() {
  const requests = useDataRequests();
  const queryClient = useQueryClient();
  const toast = useToast();
  const offline = useOffline();
  const reauth = useReauthentication();
  const { push } = useAppNavigation();
  const [requesting, setRequesting] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = useRef(newIdempotencyKey());
  useDocumentTitle('Privacy & data');

  const requestExport = async () => {
    setRequesting(true);
    setError(null);
    try {
      await api.me.requestExport(key.current);
      key.current = newIdempotencyKey();
      haptics.success();
      void queryClient.invalidateQueries({ queryKey: qk.dataRequests });
      toast({ message: 'Export requested. It is being prepared.' });
    } catch (failure) {
      haptics.error();
      setError(errorMessage(failure));
    } finally {
      setRequesting(false);
    }
  };

  const download = async (request: DataRequest) => {
    setDownloading(request.id);
    setError(null);
    try {
      const file = await reauth.run(
        () => api.me.downloadExport(request.id),
        'Downloading your data is a sensitive action.',
      );
      const url = URL.createObjectURL(new Blob([file.json], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = file.filename;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      haptics.success();
      toast({ message: `Downloaded ${file.filename}` });
    } catch (failure) {
      haptics.error();
      setError(
        isApiError(failure) && failure.code === 'reauthentication_required'
          ? 'Download cancelled: your password was not confirmed.'
          : errorMessage(failure),
      );
    } finally {
      setDownloading(null);
    }
  };

  return (
    <ScreenBody>
      <TopBar title="Privacy & data" ruled />
      <Content>
        <LargeTitle
          title="Your data."
          size="title"
          subtitle="What is stored, how to take it with you and how to delete it."
        />
        {error && <Notice tone="error" icon={TriangleAlert} role="alert" title={error} />}

        <SectionHeader title="Export" size="small" />
        <div className={`${shared.form} ${shared.formNarrow}`} style={{ paddingTop: 0 }}>
          <p className="t-body-sm">
            A JSON file with your profile, preferences, watchlists, alert rules and history, saved
            research, scenarios, paper ledger and journal. Downloads stay available for 24 hours.
          </p>
          <div>
            <Button
              variant="secondary"
              icon={Download}
              iconPosition="start"
              pending={requesting}
              disabledReason={offline ? 'Needs a connection.' : undefined}
              onClick={() => void requestExport()}
            >
              Request an export
            </Button>
          </div>
        </div>
        <QueryState query={requests} errorTitle="Export requests could not be loaded.">
          {(items) =>
            items.length === 0 ? null : (
              <List label="Export requests">
                {items.map((request) => (
                  <Row
                    key={request.id}
                    title={
                      <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                        Export{' '}
                        <Tag tone={STATUS[request.status].tone}>{STATUS[request.status].label}</Tag>
                      </span>
                    }
                    detail={`Requested ${formatDateTime(Date.parse(request.requestedAt), deviceTimeZone())}${
                      request.expiresAt && request.status === 'ready'
                        ? ` · available until ${formatDateTime(Date.parse(request.expiresAt), deviceTimeZone())}`
                        : ''
                    }`}
                    action={
                      request.status === 'ready' ? (
                        <Button
                          size="small"
                          variant="secondary"
                          pending={downloading === request.id}
                          onClick={() => void download(request)}
                        >
                          Download
                        </Button>
                      ) : request.status === 'expired' ? (
                        <Button size="small" variant="quiet" onClick={() => void requestExport()}>
                          Request again
                        </Button>
                      ) : undefined
                    }
                    chevron={false}
                  />
                ))}
              </List>
            )
          }
        </QueryState>

        <SectionHeader title="What we store" size="small" />
        <KeyValueList label="Stored data">
          <KeyValue label="Account" value="Email, display name, password hash" />
          <KeyValue label="Preferences" value="Research, display, regional, notifications" />
          <KeyValue
            label="Your work"
            value="Lists, alerts, saved research, paper ledger, journal"
          />
          <KeyValue label="Diagnostics" value="Request ids and error classes, no content" />
          <KeyValue
            label="Where"
            value={
              DATA_MODE === 'demo' ? 'This browser only (demo build)' : 'Account database in the EU'
            }
          />
        </KeyValueList>
        <p className={shared.footnote}>
          There are no advertising trackers. Private data is kept until you delete it; deleting your
          account removes it under the published retention schedule. Read the{' '}
          <button type="button" className="link" onClick={() => push('/legal/privacy')}>
            privacy notice
          </button>
          .
        </p>

        <SectionHeader title="Delete account" size="small" />
        <div className={shared.block}>
          <Button
            variant="danger"
            full
            icon={Trash2}
            iconPosition="start"
            onClick={() => push('/account/delete')}
          >
            Delete my account…
          </Button>
          <p className={shared.footnote} style={{ padding: '8px 0 0' }}>
            Signing out keeps your data; deletion removes it. You will be asked to confirm.
          </p>
        </div>
      </Content>
      {reauth.element}
    </ScreenBody>
  );
}
