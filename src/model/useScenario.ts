import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ValuationInputs } from '../engine/types';
import type { CompanySnapshot } from '../data/types';
import { readStored, writeStored } from '../lib/storage';
import { baseInputs, survey } from './survey';
import { findNarrative } from './narratives';
import { DEFAULT_MARGIN_OF_SAFETY, decodeScenario, encodeScenario, type Scenario } from './scenario';

export function defaultScenario(company: CompanySnapshot): Scenario {
  return {
    inputs: baseInputs(company),
    price: company.price.value,
    marginOfSafety: DEFAULT_MARGIN_OF_SAFETY,
    uncertainty: 1,
    storyId: 'status-quo',
  };
}

const storageKey = (company: CompanySnapshot) => `chart:${company.ticker.toLowerCase()}`;

/**
 * The visitor's chart for one company. Starts from a shared link if there
 * is one, then from the visitor's last session, then from the survey.
 * Mount it under a `key` of the ticker so a new company starts fresh.
 */
export function useScenario(company: CompanySnapshot, sharedToken: string | null, restore = true) {
  const base = useMemo(() => baseInputs(company), [company]);
  const [scenario, setScenario] = useState<Scenario>(() => {
    if (!restore) return defaultScenario(company);
    const fromLink = sharedToken ? decodeScenario(sharedToken, base) : null;
    if (fromLink) return fromLink;
    const saved = readStored<string>(storageKey(company));
    const fromStore = saved ? decodeScenario(saved, base) : null;
    return fromStore ? { ...fromStore, storyId: null } : defaultScenario(company);
  });

  useEffect(() => {
    if (!restore) return;
    const t = window.setTimeout(() => writeStored(storageKey(company), encodeScenario(scenario)), 350);
    return () => window.clearTimeout(t);
  }, [company, scenario, restore]);

  const setInput = useCallback(<K extends keyof ValuationInputs>(key: K, value: ValuationInputs[K]) => {
    setScenario((s) => ({ ...s, storyId: null, inputs: { ...s.inputs, [key]: value } }));
  }, []);

  const setBearing = useCallback((growth: number, targetMargin: number) => {
    setScenario((s) => ({ ...s, storyId: null, inputs: { ...s.inputs, growth, targetMargin } }));
  }, []);

  const setPrice = useCallback((price: number) => {
    if (price > 0 && Number.isFinite(price)) setScenario((s) => ({ ...s, price }));
  }, []);

  const setMarginOfSafety = useCallback((marginOfSafety: number) => {
    setScenario((s) => ({ ...s, marginOfSafety }));
  }, []);

  const setUncertainty = useCallback((uncertainty: number) => {
    setScenario((s) => ({ ...s, uncertainty }));
  }, []);

  /** Moat as a spread over the mature cost of capital. */
  const setMoat = useCallback((spread: number) => {
    setScenario((s) => ({
      ...s,
      storyId: null,
      inputs: { ...s.inputs, terminalRoic: s.inputs.terminalCostOfCapital + spread },
    }));
  }, []);

  /** Moving the cost of capital carries the mature rate and the moat with it. */
  const setCostOfCapital = useCallback((wacc: number) => {
    setScenario((s) => {
      const moat = s.inputs.terminalRoic - s.inputs.terminalCostOfCapital;
      const mature = Math.min(wacc, base.terminalCostOfCapital + Math.max(0, wacc - base.costOfCapital));
      return {
        ...s,
        storyId: null,
        inputs: { ...s.inputs, costOfCapital: wacc, terminalCostOfCapital: mature, terminalRoic: mature + moat },
      };
    });
  }, [base]);

  const applyStory = useCallback(
    (id: string) => {
      const story = findNarrative(id);
      if (!story) return;
      setScenario((s) => {
        const patch = story.apply(survey(company, s.price), s.inputs);
        return { ...s, storyId: id, inputs: { ...s.inputs, ...patch } };
      });
    },
    [company],
  );

  const reset = useCallback(() => setScenario(defaultScenario(company)), [company]);

  return {
    scenario,
    base,
    setInput,
    setBearing,
    setPrice,
    setMarginOfSafety,
    setUncertainty,
    setMoat,
    setCostOfCapital,
    applyStory,
    reset,
  };
}

export type ScenarioControls = ReturnType<typeof useScenario>;
