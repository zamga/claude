import { Sheet } from '@/components/Sheet';
import type { Assessment } from '@/data/types';

export function MethodologySheet({
  open,
  onClose,
  summary,
  version,
}: {
  open: boolean;
  onClose: () => void;
  summary: string;
  version: string;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="How picks are chosen" size="tall">
      <div className="t-body" style={{ display: 'grid', gap: 16 }}>
        <p>{summary}</p>
        <p>
          Each pick links to a published thesis with dated sources, a horizon, catalysts, risks and
          the conditions that would invalidate it. A second reviewer checks identity, price dates,
          units, sources and wording before publication.
        </p>
        <p>
          Ratings are either computed by a documented rule (for example momentum) or attributed to a
          named analyst. There are no confidence percentages or predicted returns.
        </p>
        <p>
          Every pick stays in the archive, including losses, closed theses and delisted companies.
          Outcomes start at the next regular-session open after publication and are measured over 20
          sessions against a matched benchmark.
        </p>
        <p className="t-label t-muted">
          Methodology {version}. Demo content: names are real, figures and research are
          illustrative. Not personal advice.
        </p>
      </div>
    </Sheet>
  );
}

export function AssessmentSheet({
  assessment,
  onClose,
}: {
  assessment: Assessment | null;
  onClose: () => void;
}) {
  return (
    <Sheet
      open={assessment != null}
      onClose={onClose}
      title={assessment ? `${assessment.label}: ${assessment.value}` : ''}
      size="auto"
    >
      {assessment && (
        <div className="t-body" style={{ display: 'grid', gap: 12 }}>
          <p>{assessment.definition}</p>
          <p className="t-label t-muted">
            {assessment.basis === 'rule'
              ? `Computed by rule ${assessment.attribution} from the demo price series.`
              : `Analyst assessment by ${assessment.attribution}.`}
          </p>
        </div>
      )}
    </Sheet>
  );
}
