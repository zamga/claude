import { describe, expect, it } from 'vitest';
import { normaliseWebsite, researchPlan, validate, type InitiationRequest } from './request';

const base: InitiationRequest = {
  company: 'Hidria d.o.o.',
  country: 'Slovenia',
  listing: 'private',
  ticker: '',
  registration: '',
  website: '',
  files: [],
  purpose: 'Investment',
  focus: '',
};

describe('initiation requests', () => {
  it('asks for a company name and checks addresses and files', () => {
    expect(validate({ ...base, company: ' ' }).company).toBeDefined();
    expect(validate({ ...base, website: 'not a site' }).website).toBeDefined();
    expect(validate({ ...base, website: 'hidria.com' }).website).toBeUndefined();
    expect(validate({ ...base, files: [{ name: 'notes.docx', size: 10 }] }).files).toMatch(/not a PDF/);
    expect(validate({ ...base, files: [{ name: 'ar.pdf', size: 30 * 1024 * 1024 }] }).files).toMatch(/25 MB/);
    expect(validate(base)).toEqual({});
  });

  it('reads a bare domain as an https address', () => {
    expect(normaliseWebsite('www.krka.biz')?.href).toBe('https://www.krka.biz/');
    expect(normaliseWebsite('ftp://example.com')).toBeUndefined();
  });

  it('asks a private Slovenian company for its AJPES filings until they are attached', () => {
    const before = researchPlan(base);
    expect(before.find((s) => s.title === 'Read the filings')?.status).toBe('needs-you');
    const after = researchPlan({ ...base, files: [{ name: 'letno-porocilo-2025.pdf', size: 1000 }] });
    expect(after.find((s) => s.title === 'Read the filings')?.status).toBe('ready');
    expect(after.some((s) => s.title === 'Read your documents')).toBe(true);
  });

  it('values listed companies against the price and private ones on their own', () => {
    const listed = researchPlan({ ...base, listing: 'listed' });
    expect(listed.find((s) => s.title === 'Value it')?.detail).toMatch(/market price/);
    expect(researchPlan(base).find((s) => s.title === 'Value it')?.detail).toMatch(/no market price/i);
  });

  it('adds the angle the request is for', () => {
    const credit = researchPlan({ ...base, purpose: 'Credit', focus: 'Can it refinance in 2027?' });
    const write = credit.find((s) => s.title === 'Write the initiation')!;
    expect(write.detail).toMatch(/answer to your question/);
    expect(write.detail).toMatch(/credit view/);
  });
});
