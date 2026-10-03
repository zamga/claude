import { createContext, useContext } from 'react';

/**
 * Where a screen is rendered. On phones every screen is 'single'. On wide screens a collection
 * sits in the left pane and its selected detail fills the rest (spec page 30).
 */
export interface PaneInfo {
  role: 'single' | 'collection' | 'detail';
  /** Show a Back control in the top bar. */
  showBack: boolean;
  /** Detail shown by default beside a collection (not reached by navigation). */
  isDefaultDetail: boolean;
  /** Pathname currently open in the detail pane, for highlighting the selected row. */
  detailPath: string | null;
}

export const PaneContext = createContext<PaneInfo>({
  role: 'single',
  showBack: false,
  isDefaultDetail: false,
  detailPath: null,
});

export function usePane(): PaneInfo {
  return useContext(PaneContext);
}
