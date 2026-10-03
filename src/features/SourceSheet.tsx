import { Button } from '@/components/Button';
import { ExternalLink, Info } from '@/components/icons';
import { KeyValue, KeyValueList } from '@/components/List';
import { Sheet } from '@/components/Sheet';
import { Notice } from '@/components/Status';
import { formatDate, keepFilingCodesWhole } from '@/domain/format';
import type { Source } from '@/data/types';

const KIND: Record<Source['kind'], string> = {
  filing: 'Regulatory filing',
  transcript: 'Call transcript',
  release: 'Company release',
  dataset: 'Dataset',
  article: 'Article',
};

/**
 * Source provenance (spec pages 24, 36): title, publisher, period and dates; a document opens only
 * after a deliberate action; a missing document is labelled with an explanation and, where one
 * exists, a real alternate source. No dead links styled as working controls.
 */
export function SourceSheet({
  source,
  onClose,
  timeZone,
}: {
  source: Source | null;
  onClose: () => void;
  timeZone: string;
}) {
  return (
    <Sheet
      open={source != null}
      onClose={onClose}
      title={source ? keepFilingCodesWhole(source.title) : 'Source'}
      size="auto"
    >
      {source && (
        <div style={{ display: 'grid', gap: 16 }}>
          <KeyValueList label="Source details">
            <KeyValue label="Publisher" value={source.publisher} />
            <KeyValue label="Type" value={KIND[source.kind]} />
            {source.period && <KeyValue label="Reporting period" value={source.period} />}
            <KeyValue
              label="Published"
              value={formatDate(Date.parse(source.publishedAt), timeZone)}
            />
            <KeyValue
              label="Retrieved"
              value={formatDate(Date.parse(source.retrievedAt), timeZone)}
            />
          </KeyValueList>
          {source.url ? (
            <Button
              full
              icon={ExternalLink}
              onClick={() => window.open(source.url!, '_blank', 'noopener,noreferrer')}
            >
              Open document
            </Button>
          ) : (
            <Notice
              tone="neutral"
              icon={Info}
              title={
                source.status === 'withdrawn'
                  ? 'This document was withdrawn.'
                  : 'No document attached.'
              }
            >
              {source.note}
            </Notice>
          )}
          {source.alternate && (
            <Button
              full
              variant="quiet"
              icon={ExternalLink}
              onClick={() => window.open(source.alternate!.url, '_blank', 'noopener,noreferrer')}
            >
              {source.alternate.label}
            </Button>
          )}
        </div>
      )}
    </Sheet>
  );
}
