import { usePageMeta } from '../app/routes';
import { Hero } from '../home/Hero';
import { Closer } from '../home/closer/Closer';
import { Gap } from '../home/Gap';
import { Acts } from '../home/Acts';
import { Anatomy } from '../home/Anatomy';
import { Provenance } from '../home/Provenance';
import { ValuationSection } from '../home/ValuationSection';
import { Coverage, Pricing, Principles } from '../home/Closing';
import { Register } from '../home/Register';

export function Home() {
  usePageMeta('/');
  return (
    <>
      <Hero />
      <Closer />
      <Gap />
      <Acts />
      <Anatomy />
      <Provenance />
      <ValuationSection />
      <Register />
      <Coverage />
      <Pricing />
      <Principles />
    </>
  );
}
