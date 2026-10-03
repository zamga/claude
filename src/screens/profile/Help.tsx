import { useMemo, useRef, useState, type FormEvent } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { useAppNavigation } from '@/app/navigation';
import { useSession } from '@/app/session';
import { Button } from '@/components/Button';
import {
  Eyebrow,
  LargeTitle,
  SectionHeader,
  ScreenHeading,
  TopBar,
  TopBarLabel,
} from '@/components/Header';
import { CircleHelp, FileText, Flag, Search, TriangleAlert } from '@/components/icons';
import { Content, Disclaimer, ScreenBody } from '@/components/Layout';
import { List, Row } from '@/components/List';
import { EmptyState, Notice } from '@/components/Status';
import { CheckRow, SelectField, TextArea, TextField } from '@/components/Form';
import { useToast } from '@/components/Toast';
import { formatDate } from '@/domain/format';
import { validateEmail } from '@/domain/validation';
import { api } from '@/data/api';
import { errorMessage, isApiError } from '@/data/errors';
import { newIdempotencyKey, recentDiagnostics } from '@/data/transport';
import { useUnsavedChangesGuard } from '@/features/guard';
import { HELP_ARTICLES, LEGAL_DOCUMENTS } from '@/features/helpContent';
import { useOffline } from '@/features/status';
import { useDocumentTitle } from '@/features/title';
import { haptics } from '@/lib/haptics';
import shared from '../shared.module.css';

const GROUPS = [...new Set(HELP_ARTICLES.map((article) => article.group))];

export function HelpScreen() {
  const [q, setQ] = useState('');
  const sentinel = useRef<HTMLDivElement>(null);
  useDocumentTitle('Help & support');
  const query = q.trim().toLowerCase();
  const matches = useMemo(
    () =>
      query
        ? HELP_ARTICLES.filter((article) =>
            [
              article.title,
              article.summary,
              ...article.sections.flatMap((section) => [section.heading, ...section.paragraphs]),
            ]
              .join(' ')
              .toLowerCase()
              .includes(query),
          )
        : HELP_ARTICLES,
    [query],
  );

  return (
    <ScreenBody tabBar>
      <TopBar
        back="/profile"
        leading={<TopBarLabel>Help</TopBarLabel>}
        compactTitle="Help & support"
        sentinel={sentinel}
      />
      <Content>
        <LargeTitle title="How can we help?" size="title" sentinelRef={sentinel} />
        <div className={shared.block}>
          <TextField
            label="Search help"
            type="search"
            value={q}
            placeholder="Alerts, chart, export…"
            onChange={(event) => setQ(event.target.value)}
            trailing={<Search size={18} aria-hidden />}
          />
        </div>
        {matches.length === 0 ? (
          <EmptyState
            icon={CircleHelp}
            size="section"
            title={`No articles mention “${q.trim()}”.`}
            actions={
              <Button full variant="secondary" onClick={() => setQ('')}>
                Show all articles
              </Button>
            }
          >
            Report the question below and a person will answer it.
          </EmptyState>
        ) : (
          GROUPS.map((group) => {
            const items = matches.filter((article) => article.group === group);
            if (items.length === 0) return null;
            return (
              <section key={group} aria-label={group}>
                <SectionHeader title={group} size="small" />
                <List label={group}>
                  {items.map((article) => (
                    <Row
                      key={article.id}
                      to={`/help/${article.id}`}
                      title={article.title}
                      detail={article.summary}
                    />
                  ))}
                </List>
              </section>
            );
          })
        )}
        <SectionHeader title="Still stuck?" size="small" />
        <List label="Support">
          <Row
            to="/support"
            icon={Flag}
            title="Report an issue"
            detail="A person reads every report"
          />
          {LEGAL_DOCUMENTS.map((document) => (
            <Row
              key={document.id}
              to={`/legal/${document.id}`}
              icon={FileText}
              title={document.title}
              dense
            />
          ))}
        </List>
      </Content>
    </ScreenBody>
  );
}

function Article({
  title,
  eyebrow,
  sections,
  footer,
}: {
  title: string;
  eyebrow: string;
  sections: { heading: string; paragraphs: string[] }[];
  footer?: React.ReactNode;
}) {
  return (
    <Content>
      <div className={shared.eyebrowRow}>
        <Eyebrow tone="muted">{eyebrow}</Eyebrow>
      </div>
      <div className={shared.headline}>
        <ScreenHeading size="title">{title}</ScreenHeading>
      </div>
      <div className={shared.prose} style={{ marginTop: 16 }}>
        {sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            {section.paragraphs.map((paragraph, index) => (
              <p key={index} style={{ marginTop: 12 }}>
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>
      {footer}
    </Content>
  );
}

export function HelpArticleScreen() {
  const { article: id } = useParams();
  const { push } = useAppNavigation();
  const article = HELP_ARTICLES.find((candidate) => candidate.id === id);
  useDocumentTitle(article ? article.title : 'Help');
  if (!article) {
    return (
      <ScreenBody>
        <TopBar title="Help" ruled />
        <Content>
          <EmptyState
            icon={CircleHelp}
            title="This article does not exist."
            actions={
              <Button full onClick={() => push('/help', { replace: true })}>
                Browse help
              </Button>
            }
          />
        </Content>
      </ScreenBody>
    );
  }
  const related = HELP_ARTICLES.filter(
    (candidate) => candidate.group === article.group && candidate.id !== article.id,
  );
  return (
    <ScreenBody>
      <TopBar title="Help" ruled />
      <Article
        title={article.title}
        eyebrow={article.group}
        sections={article.sections}
        footer={
          <>
            {related.length > 0 && (
              <>
                <SectionHeader title="Related" size="small" />
                <List label="Related articles">
                  {related.map((item) => (
                    <Row key={item.id} to={`/help/${item.id}`} title={item.title} dense />
                  ))}
                </List>
              </>
            )}
            <div className={shared.block} style={{ marginTop: 24 }}>
              <Button
                variant="secondary"
                full
                icon={Flag}
                iconPosition="start"
                onClick={() => push(`/support?topic=${encodeURIComponent(article.group)}`)}
              >
                This didn’t answer my question
              </Button>
            </div>
          </>
        }
      />
    </ScreenBody>
  );
}

const TOPICS = [
  'Getting started',
  'Data and prices',
  'Alerts',
  'Paper portfolio',
  'Research and record',
  'Account and privacy',
  'Accessibility',
  'Something else',
];

export function SupportScreen() {
  const { me } = useSession();
  const toast = useToast();
  const offline = useOffline();
  const { back } = useAppNavigation();
  const [params] = useSearchParams();
  const initialTopic = params.get('topic');
  const [topic, setTopic] = useState(TOPICS.includes(initialTopic ?? '') ? initialTopic! : '');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState(me?.email ?? '');
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const [errors, setErrors] = useState<Partial<Record<'topic' | 'message' | 'email', string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const key = useRef(newIdempotencyKey());
  const diagnostics = recentDiagnostics()
    .slice(-10)
    .map((entry) => ({ requestId: entry.requestId, name: entry.name, outcome: entry.outcome }));
  const guard = useUnsavedChangesGuard(
    message.trim().length > 0 && !sent,
    'Your report has not been sent.',
  );
  useDocumentTitle('Report an issue');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const problems = {
      topic: topic ? undefined : 'Choose a topic.',
      message:
        message.trim().length < 10 ? 'Describe what happened in a sentence or two.' : undefined,
      email: validateEmail(email),
    };
    setErrors(problems);
    if (Object.values(problems).some(Boolean)) return;
    setPending(true);
    try {
      const result = await api.support.submit(
        { topic, message, email, diagnostics: includeDiagnostics ? diagnostics : null },
        key.current,
      );
      haptics.success();
      setSent(result.ref);
      toast({ message: `Report sent (${result.ref})` });
    } catch (failure) {
      haptics.error();
      if (isApiError(failure) && Object.keys(failure.fieldErrors).length)
        setErrors(failure.fieldErrors);
      else setFormError(`${errorMessage(failure)} Your report is still here.`);
    } finally {
      setPending(false);
    }
  };

  if (sent) {
    return (
      <ScreenBody>
        <TopBar title="Report an issue" ruled />
        <Content>
          <EmptyState
            icon={Flag}
            title="Thanks. We have your report."
            actions={
              <Button full onClick={() => back('/help')}>
                Back to help
              </Button>
            }
          >
            Reference {sent}. A confirmation went to {email}; replies usually arrive within two
            working days.
          </EmptyState>
        </Content>
      </ScreenBody>
    );
  }

  return (
    <ScreenBody>
      <TopBar title="Report an issue" ruled />
      <Content>
        <LargeTitle
          title="Tell us what happened."
          size="title"
          subtitle="A person reads every report. Please don’t include passwords or account numbers."
        />
        <form className={`${shared.form} ${shared.formNarrow}`} onSubmit={submit} noValidate>
          {formError && <Notice tone="error" icon={TriangleAlert} role="alert" title={formError} />}
          <SelectField
            label="Topic"
            value={topic}
            error={errors.topic}
            onChange={(event) => setTopic(event.target.value)}
            options={[
              { value: '', label: 'Choose a topic', disabled: true },
              ...TOPICS.map((value) => ({ value, label: value })),
            ]}
          />
          <TextArea
            label="What happened?"
            rows={6}
            maxLength={4000}
            value={message}
            error={errors.message}
            hint="What you expected, what you saw, and the screen you were on."
            onChange={(event) => setMessage(event.target.value)}
          />
          <TextField
            label="Reply to"
            type="email"
            autoComplete="email"
            value={email}
            error={errors.email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <div>
            <CheckRow
              label="Include diagnostic references"
              detail={`${diagnostics.length} recent request ids and outcomes from this device, without any content.`}
              checked={includeDiagnostics}
              onChange={setIncludeDiagnostics}
            />
            {includeDiagnostics && diagnostics.length > 0 && (
              <p className="t-note t-muted" style={{ marginTop: 4 }}>
                Latest: {diagnostics[diagnostics.length - 1]!.requestId} (
                {diagnostics[diagnostics.length - 1]!.outcome})
              </p>
            )}
          </div>
          <Button
            type="submit"
            full
            pending={pending}
            disabledReason={
              offline ? 'Sending needs a connection. Your report stays here.' : undefined
            }
          >
            Send report
          </Button>
        </form>
      </Content>
      {guard}
    </ScreenBody>
  );
}

export function LegalScreen() {
  const { document: id } = useParams();
  const { push } = useAppNavigation();
  const document = LEGAL_DOCUMENTS.find((candidate) => candidate.id === id);
  useDocumentTitle(document ? document.title : 'Legal');
  if (!document) {
    return (
      <ScreenBody>
        <TopBar title="Legal" ruled />
        <Content>
          <EmptyState
            icon={FileText}
            title="This document does not exist."
            actions={
              <Button full onClick={() => push('/legal/terms', { replace: true })}>
                Read the terms
              </Button>
            }
          />
        </Content>
      </ScreenBody>
    );
  }
  return (
    <ScreenBody>
      <TopBar title="Legal" ruled />
      <Article
        title={document.title}
        eyebrow={`Updated ${formatDate(Date.parse(`${document.updated}T12:00:00Z`), 'UTC')}`}
        sections={document.sections}
        footer={
          <>
            <SectionHeader title="Other documents" size="small" />
            <List label="Other documents">
              {LEGAL_DOCUMENTS.filter((item) => item.id !== document.id).map((item) => (
                <Row
                  key={item.id}
                  to={`/legal/${item.id}`}
                  icon={FileText}
                  title={item.title}
                  dense
                />
              ))}
            </List>
            <Disclaimer>
              These documents describe the demo build. A live deployment publishes reviewed policies
              that match its actual service.
            </Disclaimer>
          </>
        }
      />
    </ScreenBody>
  );
}
