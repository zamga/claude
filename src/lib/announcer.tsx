import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

/**
 * Polite and assertive live regions for route changes, saves, errors and chart inspection
 * (announced after a pause, never every drag frame — spec page 27).
 */
interface Announcer {
  polite: (message: string) => void;
  assertive: (message: string) => void;
}

const AnnouncerContext = createContext<Announcer>({
  polite: () => undefined,
  assertive: () => undefined,
});

export function AnnouncerProvider({ children }: { children: ReactNode }) {
  const [polite, setPolite] = useState('');
  const [assertive, setAssertive] = useState('');
  const toggle = useRef(false);

  // Alternating a zero-width suffix forces repeated identical messages to be re-announced.
  const stamp = (message: string) => {
    toggle.current = !toggle.current;
    return toggle.current ? message : `${message}\u200B`;
  };

  const announcePolite = useCallback((message: string) => setPolite(stamp(message)), []);
  const announceAssertive = useCallback((message: string) => setAssertive(stamp(message)), []);
  const value = useMemo(
    () => ({ polite: announcePolite, assertive: announceAssertive }),
    [announcePolite, announceAssertive],
  );

  return (
    <AnnouncerContext.Provider value={value}>
      {children}
      <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
        {polite}
      </div>
      <div className="visually-hidden" role="alert" aria-live="assertive" aria-atomic="true">
        {assertive}
      </div>
    </AnnouncerContext.Provider>
  );
}

export function useAnnouncer(): Announcer {
  return useContext(AnnouncerContext);
}
