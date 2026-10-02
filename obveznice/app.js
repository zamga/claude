/* Kontinua — bond site interactions
   Progressive enhancement: the page reads complete without this file. With it the
   certificate is engraved, every figure renders from one set of terms, the bond
   tells its story on scroll, and the strategy, calculator and form come alive. GSAP,
   ScrollTrigger and Lenis are optional; every module checks for them and falls
   back to a still, fully working page. */
(() => {
  'use strict';

  /* ------------------------------------------------------------------------
     Terms: the one place every figure on the page comes from. Values that are
     not final render in [square brackets]; add a key to `confirmed` to drop them.
     Keys: nominal, minimum, rate, years, issue, convPrice, window.
     ------------------------------------------------------------------------ */
  const TERMS = {
    issuer: 'Kontinua Holding d.o.o.',
    issuerDD: 'Kontinua d.d.',
    brand: 'Kontinua',
    series: 'KNT1',
    size: 5000000,
    nominal: 1000,
    minimum: 10000,
    rate: 8,
    perYear: 2,
    issue: { y: 2026, m: 12, d: 1 },
    years: 5,
    transform: 'Q1 2027',
    convFrom: 2027,
    convPrice: 10,
    confirmed: [],
  };
  /* The hero story clips this many coupons before the holder converts. */
  const STORY_CLIPS = 6;

  const T = (() => {
    const { y, m, d } = TERMS.issue;
    const step = 12 / TERMS.perYear;
    const at = k => new Date(y, m - 1 + step * k, d);
    const n = TERMS.years * TERMS.perYear;
    return {
      issueDate: at(0),
      coupons: Array.from({ length: n }, (_, k) => at(k + 1)),
      maturity: at(n),
      coupon: (TERMS.nominal * TERMS.rate) / 100 / TERMS.perYear,
      shares: TERMS.nominal / TERMS.convPrice,
      count: Math.round(TERMS.size / TERMS.nominal),
    };
  })();

  const root = document.documentElement;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const mq = {
    reduce: matchMedia('(prefers-reduced-motion: reduce)'),
    desk: matchMedia('(min-width: 900px)'),
    fine: matchMedia('(hover: hover) and (pointer: fine)'),
  };
  const store = {
    get(area, k) { try { return window[area].getItem(k); } catch { return null; } },
    set(area, k, v) { try { window[area].setItem(k, v); } catch { /* storage blocked: preference is not kept */ } },
  };
  const run = (name, fn) => { try { return fn(); } catch (err) { console.error(`[kontinua] ${name}`, err); return undefined; } };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ent = s => esc(s).replace(/\u00a0/g, '&nbsp;');
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const r1 = v => Math.round(v * 10) / 10;

  /* This file runs before the animation libraries (see the script order), so the
     first frame never waits for them. `motion` is confirmed once they arrive. */
  window.__kontinua = true;
  let hasGsap = false;
  let motion = !mq.reduce.matches;
  root.classList.add('js');
  root.classList.toggle('motion', motion);

  /* ------------------------------------------------------------------------
     Language
     ------------------------------------------------------------------------ */
  const EN = {
    'skip': 'Skip to content',
    'concept': 'Concept design. The working name and values in [square brackets] are illustrative, not an offer.',
    'concept.short': 'Concept: name and [values] are illustrative, not an offer.',
    'logo.aria': 'Kontinua, back to the top',
    'nav.aria': 'Main navigation',
    'nav.opp': 'Opportunity',
    'nav.strategy': 'Strategy',
    'nav.bond': 'The bond',
    'nav.calc': 'Calculator',
    'nav.risks': 'Risks',
    'nav.faq': 'Questions',
    'lang.aria': 'Language',
    'cta.interest': 'Register interest',
    'menu.open': 'Menu',
    'menu.close': 'Close',
    'menu.aria': 'Menu',
    'hero.eyebrow': 'Secured convertible bonds · issue of up to €5m',
    'hero.h1': '<span class="line"><span>Lender today.</span></span> <span class="line"><span><em>Co-owner tomorrow.</em></span></span>',
    'hero.lede': 'We buy successful Slovenian companies whose founders are looking for a successor. The bonds are secured by a pledge over those companies’ shares. Once we become a d.d. in 2027, you can convert them into shares.',
    'hero.cta2': 'Bond terms',
    'facts.size': 'Issue',
    'facts.sizeV': 'up to €5m',
    'facts.rate': 'Interest',
    'facts.security': 'Security',
    'facts.securityV': 'share pledge',
    'facts.conv': 'Conversion',
    'facts.convV': 'from Q1 2027',
    'cap.0': 'This is your bond.',
    'cap.1': 'Q1 2027: the company becomes a d.d. The talon unlocks conversion.',
    'cap.2': 'Every six months you clip a coupon. That’s your interest.',
    'cap.3': 'When you choose, the bond becomes a share. You become a co-owner.',
    'cert.series': 'Series',
    'cert.title': 'Secured convertible bond',
    'cert.nominal': 'Nominal value',
    'cert.rate': 'Interest rate',
    'cert.maturity': 'Maturity',
    'cert.security': 'Security',
    'cert.securityV': 'pledge of shares in acquired companies',
    'cert.sign1': 'Director',
    'cert.sign2': 'Bondholders’ agent',
    'cert.specimen': 'Specimen',
    'cert.backSerial': 'Ordinary registered share',
    'cert.share': 'Share',
    'cert.convFrom': 'Convertible from',
    'cert.ratio': 'Ratio',
    'cert.sign3': 'Management board',
    'cert.sign4': 'Supervisory board',
    'cert.talon': 'Talon',
    'cert.talonD': 'conversion into shares',
    'tally.label': 'Interest per bond',
    'hero.hint': 'See how the bond works',
    'switch.aria': 'Show the certificate as',
    'switch.bond': 'Bond',
    'switch.share': 'Share after conversion',
    'opp.eyebrow': 'The opportunity',
    'opp.h2': 'The generation that built Slovenia’s economy after 1991 is looking for successors.',
    'opp.s1': 'of company owners are over 56.',
    'opp.s2': 'of companies with owners over 65 have no plan for handing over ownership.',
    'opp.s3': 'of heirs want to take over the family business.',
    'opp.s4': 'of companies in Slovenia are family-owned.',
    'opp.ageCap': 'Age of Slovenian company owners',
    'opp.ageAria': '56 or younger: 48.5%. 57 to 65: 32.3%. Over 65: 19.2%.',
    'opp.k1': '56 or younger',
    'opp.k2': '57–65',
    'opp.k3': 'over 65',
    'opp.p1': 'Without a successor, three paths remain: a sale to a foreign trade buyer who may move production, a sale to a fund that sells again a few years later, or a slow decline. We offer a fourth: a buyer who stays.',
    'opp.p2': 'Companies with EBITDA of €1.5–5m are too small for large funds and too large for individual buyers. Fewer buyers leave more room for a fair deal.',
    'opp.source': 'Source: Analysis of ownership structures in the Slovenian economy, Faculty of Social Sciences and School of Economics and Business, University of Ljubljana, 2025.',
    'strat.eyebrow': 'Strategy',
    'strat.h2': 'Ring by ring, for generations.',
    'strat.lede': 'Every company we buy becomes a ring of the group. It keeps its own pattern; together we hold the whole. We don’t buy to sell.',
    'strat.tabsAria': 'Ways we acquire',
    'strat.b1': 'Succession',
    'strat.b2': 'Phased handover',
    'strat.b3': 'Management buyouts',
    'strat.b4': 'Add-ons',
    'strat.b5': 'Carve-outs',
    'strat.t1': 'The founder retires; the company stays. We keep the name, the team and the location.',
    'strat.t2': 'A majority stake today, the rest over a few years. The founder stays on as an adviser for as long as it helps.',
    'strat.t3': 'We provide the capital; the current or a new management team runs the company and becomes a co-owner (MBO or MBI).',
    'strat.t4': 'Once we own a strong company in a sector, we add smaller competitors or suppliers. Together they’re worth more than apart.',
    'strat.t5': 'We buy business units that large groups no longer see as core but that can be the core for us.',
    'strat.critH': 'Who we buy',
    'strat.c1b': 'EBITDA €1.5–5m',
    'strat.c1': 'profitable companies with steady cash flow',
    'strat.c2b': '10+ years',
    'strat.c2': 'a track record through at least one economic cycle',
    'strat.c3b': 'Succession',
    'strat.c3': 'an owner who wants an orderly exit and continuity',
    'strat.c4b': 'Lasting industries',
    'strat.c4': 'businesses that will still exist in 20 years',
    'strat.addH': 'What we add',
    'strat.add': 'Professional finance and reporting, shared services, digitalisation and purchasing at scale. What works, we leave alone.',
    'flow.eyebrow': 'How it works',
    'flow.h2': 'Where your euro goes.',
    'flow.aria': 'Investors pay capital into the bonds. The holding uses it to buy stakes in companies. The companies pay dividends to the holding, and the holding pays interest to investors. The companies’ shares are pledged to bondholders through their agent.',
    'flow.n1': 'Investors',
    'flow.n1s': 'bondholders',
    'flow.n2s': 'holding, d.o.o. → d.d.',
    'flow.n3': 'Company A',
    'flow.n4': 'Company B',
    'flow.n5': 'Company C',
    'flow.n6': 'Agent',
    'flow.n6s': 'for bondholders',
    'flow.ebitda': 'EBITDA €1.5–5m',
    'flow.l1': 'capital',
    'flow.l2': 'interest / 6 mo.',
    'flow.l3': 'stake purchase',
    'flow.l4': 'dividends',
    'flow.l5': 'share pledge',
    'flow.l6': 'security',
    'flow.s1': 'You subscribe for bonds. The capital is collected in a dedicated issue account.',
    'flow.s2': 'We buy a majority stake in a company that meets our criteria.',
    'flow.s3': 'The stake is pledged to bondholders through their agent.',
    'flow.s4': 'The company keeps trading and pays dividends to the holding.',
    'flow.s5': 'Every six months the holding pays interest. At maturity it repays the principal.',
    'flow.s6': 'After the transformation into a d.d., you can convert your bonds into shares.',
    'flow.cap': 'The diagram shows the principle. The ranking of security, any bank co-financing of acquisitions and the timelines are set out in the terms of issue.',
    'terms.eyebrow': 'The bond',
    'terms.h2': 'The terms on one page.',
    'terms.lede': 'Values in [square brackets] are indicative. Only the terms of issue are binding.',
    'terms.issuer': 'Issuer',
    'terms.type': 'Type',
    'terms.typeV': 'Secured convertible bond',
    'terms.size': 'Total issue size',
    'terms.sizeV': 'up to €5,000,000',
    'terms.nominal': 'Nominal value',
    'terms.min': 'Minimum subscription',
    'terms.rate': 'Interest rate',
    'terms.pay': 'Interest payments',
    'terms.payV': 'twice a year',
    'terms.maturity': 'Maturity',
    'terms.security': 'Security',
    'terms.securityV': 'Pledge of shares or ownership stakes in the acquired companies in favour of bondholders',
    'terms.conv': 'Conversion',
    'terms.agent': 'Bondholders’ agent',
    'terms.agentV': '<span class="tbc">[independent agent]</span>',
    'terms.form': 'Form',
    'terms.formV': '<span class="tbc">[book-entry, registered with KDD, the central securities depository]</span>',
    'terms.report': 'Reporting',
    'terms.reportV': 'Quarterly report, annual audited financial statements, annual bondholder meeting',
    'terms.basis': 'Legal basis',
    'terms.basisV': 'Offer without a prospectus under Article 72 of ZTFI-1 (total consideration in the EU below €5m over 12 months)',
    'terms.r1': 'Subscription and issue',
    'terms.r1s': 'Capital for the first acquisitions',
    'terms.r2': 'd.o.o. → d.d.',
    'terms.r2s': 'The company changes its legal form',
    'terms.r3': 'Conversion window',
    'terms.r3s': 'Convert into shares, or keep the interest',
    'terms.r4': 'Maturity',
    'terms.r4s': 'Principal repaid on bonds not converted',
    'calc.eyebrow': 'Calculator',
    'calc.h2': 'What would you receive?',
    'calc.lede': 'Enter an amount. The calculation uses the indicative terms above.',
    'calc.amount': 'Subscription amount',
    'calc.range': 'Subscription amount, slider',
    'calc.k1': 'Every 6 months',
    'calc.k2': 'Per year',
    'calc.altH': 'Or convert into shares',
    'calc.cta': 'Register interest for this amount',
    'calc.note': 'Illustration assuming the issuer meets all its obligations on time. Amounts are gross, before tax. Not a guarantee of return.',
    'risks.eyebrow': 'Risks',
    'risks.h2': 'Read this before you subscribe.',
    'risks.lede': 'Bonds are not bank deposits and are not covered by the deposit guarantee scheme. You can lose part or all of your investment.',
    'risks.t1': 'The issuer',
    'risks.p1': 'The company is building its portfolio. Success depends on completing acquisitions and on how the acquired companies perform.',
    'risks.t2': 'Security',
    'risks.p2': 'The value of pledged shares can fall, and enforcing a pledge takes time. The pledge may rank behind security held by banks that co-finance acquisitions.',
    'risks.t3': 'Liquidity',
    'risks.p3': 'The bonds are not listed on an exchange, so you may not be able to sell them before maturity.',
    'risks.t4': 'Conversion',
    'risks.p4': 'Conversion depends on the transformation into a d.d. and on shareholder resolutions. Shares in an unlisted company are hard to sell, and they may be worth less than the bond.',
    'risks.t5': 'Acquisitions',
    'risks.p5': 'We may not find suitable companies at an acceptable price, and bringing them into the group may be harder than expected.',
    'risks.t6': 'Key people',
    'risks.p6': 'Success depends on a small team. If key people leave, the business may suffer.',
    'risks.t7': 'No prospectus',
    'risks.p7': 'The offer does not require a prospectus approved by the Securities Market Agency, so the regulator has not reviewed the documentation.',
    'risks.t8': 'Interest and inflation',
    'risks.p8': 'A fixed interest rate does not follow inflation or market interest rates.',
    'risks.more': 'The full list of risks is in the terms of issue. If you don’t understand the investment, speak to a financial adviser.',
    'founders.eyebrow': 'For business owners',
    'founders.h2': 'You built the company. We’ll keep it going.',
    'founders.lede': 'We buy a majority or the whole stake and keep the name, the people and the location. You decide how long you stay involved. The conversation is confidential and commits you to nothing.',
    'founders.cta': 'A confidential conversation',
    'faq.eyebrow': 'Questions',
    'faq.h2': 'What investors ask first.',
    'faq.q1': 'How is the bond secured?',
    'faq.a1': 'By a pledge over the shares or ownership stakes of the companies we buy, in favour of bondholders through their agent. The ranking of security and the details are set out in the terms of issue.',
    'faq.q2': 'What happens when the company becomes a d.d.?',
    'faq.a2': 'The company plans to change from a d.o.o. (limited liability company) into a d.d. (joint-stock company) in the first quarter of 2027. You can then convert your bonds into shares on terms set in advance, usually through a conditional capital increase. Conversion is optional: if you don’t choose it, you receive interest until maturity.',
    'faq.q3': 'What if the transformation doesn’t happen?',
    'faq.a3': 'The bond stays a bond: interest and repayment of the principal at maturity still apply. Details are in the terms of issue.',
    'faq.q4': 'Why is there no prospectus?',
    'faq.a4': 'An offer worth less than €5m over 12 months is exempt from the obligation to publish a prospectus under Article 72 of ZTFI-1. We notify the Securities Market Agency in advance that we are using the exemption. Instead of a prospectus, you receive the terms of issue.',
    'faq.q5': 'How will I be kept informed?',
    'faq.a5': 'Through a quarterly report on trading and acquisitions, annual audited financial statements and an annual bondholder meeting.',
    'faq.q6': 'How does subscription work?',
    'faq.a6': 'Register your interest and we send you the terms of issue. You sign the subscription form and transfer the amount to a dedicated issue account. The bonds are credited to your securities account.',
    'form.eyebrow': 'Interest',
    'form.h2': 'Register your interest.',
    'form.lede': 'We’ll send you the terms of issue and answer your questions. Registering interest doesn’t commit you to subscribe.',
    'form.role': 'I am',
    'form.roleInv': 'an investor',
    'form.roleOwn': 'a business owner',
    'form.name': 'Full name',
    'form.errName': 'Enter your full name.',
    'form.email': 'Email',
    'form.errEmail': 'Enter a valid email address so we can send you the terms.',
    'form.phone': 'Phone',
    'form.optional': '(optional)',
    'form.range': 'Approximate amount',
    'form.r1': '€10,000–25,000',
    'form.r2': '€25,000–100,000',
    'form.r3': '€100,000–250,000',
    'form.r4': 'more than €250,000',
    'form.risk': 'I have read the risks and understand that I could lose part or all of my investment.',
    'form.errRisk': 'Please confirm you have read the risks.',
    'form.consent': 'I agree to my details being used to send information about the issue. We never share them.',
    'form.errConsent': 'We need your consent to send you information.',
    'form.submit': 'Send',
    'form.note': 'We reply within one working day.',
    'form.thanks': 'Received.',
    'form.demo': 'Concept demo: nothing was sent.',
    'form.again': 'Send again',
    'ftr.tag': 'We buy companies so they can stay.',
    'ftr.navAria': 'Footer links',
    'ftr.site': 'Site',
    'ftr.owners': 'For business owners',
    'ftr.lang': 'Language',
    'ftr.legalH': 'Important notice',
    'ftr.legal1': 'This website is an advertisement, not an offer or a recommendation to buy securities. Base any investment decision on the terms of issue. The offer is exempt from the obligation to publish a prospectus under Article 72 of the Financial Instruments Market Act (ZTFI-1). Bonds are not bank deposits and are not covered by the deposit guarantee scheme.',
    'ftr.legal2': 'Concept design: the working name Kontinua, the values in [square brackets] and the specimen bond are illustrative.',
    'ftr.top': 'Back to top',
    'dock.meta': 'Terms of issue by email',
  };

  const DYN = {
    sl: {
      locale: 'sl-SI',
      title: 'Kontinua — Zavarovane zamenljive obveznice. Danes upnik, jutri solastnik.',
      desc: 'Zavarovane zamenljive obveznice za prevzeme slovenskih podjetij z EBITDA od 1,5 do 5 mio €. Izdaja do 5 mio €, zastava deležev prevzetih družb, zamenjava v delnice po preoblikovanju v d.d. v začetku leta 2027.',
      date: d => `${d.getDate()}.\u00a0${d.getMonth() + 1}.\u00a0${d.getFullYear()}`,
      forms: {
        bond: { one: 'obveznica', two: 'obveznici', few: 'obveznice', other: 'obveznic' },
        share: { one: 'delnica', two: 'delnici', few: 'delnice', other: 'delnic' },
        year: { one: 'leto', two: 'leti', few: 'leta', other: 'let' },
      },
      inYears: n => (n === 1 ? 'letu' : 'letih'),
      issuerLine: () => `${esc(TERMS.issuer)}, po preoblikovanju ${esc(TERMS.issuerDD)} <span class="tbc">[delovno ime]</span>`,
      rateYear: p => `${p} letno`,
      rateSemi: p => `${p}, polletno`,
      rateFixed: p => `${p} letno, fiksna`,
      tenor: (n, w, date) => `${n} ${w}, ${date}`,
      convLine: price => `Po preoblikovanju v d.d. (predvidoma ${esc(TERMS.transform)}), po ceni ${price} za delnico`,
      bonds: (n, w, nominal) => `${n} ${w} po ${nominal}`,
      totalLabel: (n, w) => `Obresti v ${n} ${w}`,
      conv: (amount, shares, w, price) => `Po preoblikovanju v d.d. lahko ${amount} zamenjate za ${shares} ${w} po ${price}.`,
      principal: 'glavnica',
      schedAria: 'Razpored izplačil',
      live: (semi, n, w, total) => `Vsakih šest mesecev prejmete ${semi}, v ${n} ${w} skupaj ${total}.`,
      paid: 'Izplačano',
      receiptInv: email => `Pogoje izdaje vam pošljemo na <strong>${email}</strong> v enem delovnem dnevu.`,
      receiptOwn: email => `Oglasimo se vam na <strong>${email}</strong> v enem delovnem dnevu. Pogovor ostane zaupen.`,
    },
    en: {
      locale: 'en-GB',
      title: 'Kontinua — Secured convertible bonds. Lender today, co-owner tomorrow.',
      desc: 'Secured convertible bonds funding the acquisition of Slovenian companies with EBITDA of €1.5–5m. An issue of up to €5m, secured by a pledge over the acquired companies’ shares and convertible into shares once the company becomes a d.d. in early 2027.',
      date: d => `${d.getDate()} ${dfmt(d, { month: 'short' })} ${d.getFullYear()}`,
      forms: {
        bond: { one: 'bond', other: 'bonds' },
        share: { one: 'share', other: 'shares' },
        year: { one: 'year', other: 'years' },
      },
      inYears: n => (n === 1 ? 'year' : 'years'),
      issuerLine: () => `${esc(TERMS.issuer)}; ${esc(TERMS.issuerDD)} after the change of legal form <span class="tbc">[working name]</span>`,
      rateYear: p => `${p} a year`,
      rateSemi: p => `${p}, paid twice a year`,
      rateFixed: p => `${p} a year, fixed`,
      tenor: (n, w, date) => `${n} ${w}, ${date}`,
      convLine: price => `After the transformation into a d.d. (expected ${esc(TERMS.transform)}), at ${price} per share`,
      bonds: (n, w, nominal) => `${n} ${w} of ${nominal} each`,
      totalLabel: (n, w) => `Interest over ${n} ${w}`,
      conv: (amount, shares, w, price) => `After the transformation into a d.d., you could convert ${amount} into ${shares} ${w} at ${price} each.`,
      principal: 'principal',
      schedAria: 'Payment schedule',
      live: (semi, n, w, total) => `${semi} every six months, ${total} in total over ${n} ${w}.`,
      paid: 'Paid',
      receiptInv: email => `We’ll send the terms of issue to <strong>${email}</strong> within one working day.`,
      receiptOwn: email => `We’ll be in touch at <strong>${email}</strong> within one working day. The conversation stays confidential.`,
    },
  };

  let lang = root.dataset.lang === 'en' ? 'en' : 'sl';
  const D = () => DYN[lang];
  const SL = new Map();

  const PLURAL = { sl: new Intl.PluralRules('sl-SI'), en: new Intl.PluralRules('en-GB') };
  const word = (n, kind) => { const f = D().forms[kind]; return f[PLURAL[lang].select(n)] || f.other; };

  const fmtCache = new Map();
  const nf = (key, opts) => {
    const k = `${lang}|${key}`;
    if (!fmtCache.has(k)) fmtCache.set(k, new Intl.NumberFormat(D().locale, opts));
    return fmtCache.get(k);
  };
  const moneyFmt = frac => nf(`m${frac}`, { style: 'currency', currency: 'EUR', minimumFractionDigits: frac, maximumFractionDigits: frac });
  const money = v => moneyFmt(Number.isInteger(Math.round(v * 100) / 100) ? 0 : 2).format(v);
  const pctFmt = frac => nf(`p${frac}`, { style: 'percent', minimumFractionDigits: frac, maximumFractionDigits: frac });
  const intFmt = () => nf('i', { maximumFractionDigits: 0 });
  function dfmt(d, opts) { return new Intl.DateTimeFormat(D().locale, opts).format(d); }

  function captureSL() {
    $$('[data-i18n]').forEach(el => { const k = el.dataset.i18n; if (!SL.has(k)) SL.set(k, el.innerHTML); });
    $$('[data-i18n-attr]').forEach(el => {
      el.dataset.i18nAttr.split(';').forEach(pair => {
        const [attr, key] = pair.split(':');
        const k = `@${key}`;
        if (!SL.has(k)) SL.set(k, el.getAttribute(attr) || '');
      });
    });
  }
  const tr = key => (lang === 'sl' ? SL.get(key) : EN[key]) ?? SL.get(key) ?? '';
  const trAttr = key => (lang === 'sl' ? SL.get(`@${key}`) : EN[key]) ?? SL.get(`@${key}`) ?? '';

  function applyStatic() {
    $$('[data-i18n]').forEach(el => {
      const v = tr(el.dataset.i18n);
      if (el.innerHTML !== v) el.innerHTML = v;
    });
    $$('[data-i18n-attr]').forEach(el => {
      el.dataset.i18nAttr.split(';').forEach(pair => {
        const [attr, key] = pair.split(':');
        el.setAttribute(attr, trAttr(key));
      });
    });
    const desc = $('meta[name="description"]');
    if (desc) {
      document.title = D().title;
      desc.setAttribute('content', D().desc);
    }
  }

  /* ------------------------------------------------------------------------
     Terms rendering: brackets wrap only the figure, the way term sheets do
     ("[1.000] €", "€[1,000]", "[8,00] %").
     ------------------------------------------------------------------------ */
  const OPEN = '<span class="tbc">[</span>';
  const CLOSE = '<span class="tbc">]</span>';
  const isConfirmed = keys => keys.every(k => TERMS.confirmed.includes(k));
  const tbc = (inner, ...keys) => (isConfirmed(keys) ? inner : `${OPEN}${inner}${CLOSE}`);
  const NUM_PARTS = new Set(['integer', 'group', 'decimal', 'fraction', 'minusSign']);
  function tbcParts(parts, keys) {
    if (isConfirmed(keys)) return parts.map(p => ent(p.value)).join('');
    let first = -1;
    let last = -1;
    parts.forEach((p, i) => { if (NUM_PARTS.has(p.type)) { if (first < 0) first = i; last = i; } });
    return parts.map((p, i) => `${i === first ? OPEN : ''}${ent(p.value)}${i === last ? CLOSE : ''}`).join('');
  }
  const tMoney = (v, keys, frac = 0) => tbcParts(moneyFmt(frac).formatToParts(v), keys);
  const tPct = (v, keys, frac) => tbcParts(pctFmt(frac).formatToParts(v / 100), keys);
  const tInt = (v, keys) => tbcParts(intFmt().formatToParts(v), keys);
  const tDate = (d, keys) => tbc(ent(D().date(d)), ...keys);
  const quarter = d => `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
  const KEYS = { maturity: ['issue', 'years'], coupon: ['rate', 'nominal'], shares: ['convPrice', 'nominal'] };

  const TERM_TEXT = {
    issuer: () => TERMS.issuer,
    issuerDD: () => TERMS.issuerDD,
    brand: () => TERMS.brand,
    series: () => TERMS.series,
    count: () => String(T.count).padStart(6, '0').replace(/(\d{3})$/, '\u00a0$1'),
  };
  const TERM_HTML = {
    issuerLine: () => D().issuerLine(),
    nominal: () => tMoney(TERMS.nominal, ['nominal']),
    minimum: () => tMoney(TERMS.minimum, ['minimum']),
    rateYear: () => D().rateYear(tPct(TERMS.rate, ['rate'], 1)),
    rateSemi: () => D().rateSemi(tPct(TERMS.rate, ['rate'], 2)),
    rateFixed: () => D().rateFixed(tPct(TERMS.rate, ['rate'], 2)),
    maturity: () => tDate(T.maturity, KEYS.maturity),
    tenor: () => D().tenor(tInt(TERMS.years, ['years']), word(TERMS.years, 'year'), tDate(T.maturity, KEYS.maturity)),
    convLine: () => D().convLine(tMoney(TERMS.convPrice, ['convPrice'], 2)),
    ratio: () => `1 : ${tInt(T.shares, KEYS.shares)}`,
    issueQ: () => tbc(quarter(T.issueDate), 'issue'),
    window: () => tbc(`${TERMS.convFrom}–${T.maturity.getFullYear()}`, 'window'),
    maturityY: () => tbc(String(T.maturity.getFullYear()), ...KEYS.maturity),
  };

  function renderTerms() {
    $$('[data-term]').forEach(el => {
      const f = TERM_TEXT[el.dataset.term];
      if (!f) return;
      const v = f();
      if (el.textContent !== v) el.textContent = v;
    });
    $$('[data-term-html]').forEach(el => {
      const f = TERM_HTML[el.dataset.termHtml];
      if (!f) return;
      const v = f();
      if (el.innerHTML !== v) el.innerHTML = v;
    });
  }

  /* Figures from the 2025 ownership study, formatted for the active language. */
  function renderStats() {
    $$('[data-pct]').forEach(el => {
      if (el.dataset.counting) return;
      el.innerHTML = statText(el, Number(el.dataset.pct));
    });
  }
  function statText(el, v) {
    const target = Number(el.dataset.pct);
    const frac = Number.isInteger(target) ? 0 : 1;
    return `${'approx' in el.dataset ? '~' : ''}${ent(pctFmt(frac).format(v / 100))}`;
  }

  /* ------------------------------------------------------------------------
     Engraving: guilloche frames, rosettes and the medallion, drawn as SVG
     ------------------------------------------------------------------------ */
  /* A closed polar wave: r(θ) = r0 + amp·sin(kθ + phase). */
  function polar(cx, cy, r0, amp, k, phase, steps) {
    let d = '';
    for (let s = 0; s < steps; s += 1) {
      const th = (s / steps) * Math.PI * 2;
      const r = r0 + amp * Math.sin(k * th + phase);
      d += `${s ? ' ' : 'M'}${r1(cx + Math.cos(th) * r)} ${r1(cy + Math.sin(th) * r)}`;
    }
    return `${d}Z`;
  }

  /* A wave along a straight run, built from parabolic arcs (one Q, then T). */
  function waveRun(x0, y0, x1, y1, amp, half, start) {
    const L = Math.hypot(x1 - x0, y1 - y0);
    const ux = (x1 - x0) / L;
    const uy = (y1 - y0) / L;
    const P = (s, o) => `${r1(x0 + ux * s - uy * o)} ${r1(y0 + uy * s + ux * o)}`;
    let s = start;
    let d = `M${P(s, 0)}Q${P(s + half / 2, 2 * amp)} ${P(s + half, 0)}`;
    for (s += 2 * half; s < L + 2 * half; s += half) d += `T${P(s, 0)}`;
    return d;
  }

  function frameMarkup(W, H, back, uid) {
    const m = Math.min(W, H);
    const pad = clamp(m * 0.034, 6, 22);
    const band = clamp(m * 0.054, 11, 30);
    const o = pad;
    const inner = pad + band;
    const c = pad + band / 2;
    const A = back ? 'g-b' : 'g-a';
    const B = back ? 'g-a' : 'g-b';
    const runs = [
      [inner, c, W - inner, c, inner, o, W - 2 * inner, band],
      [inner, H - c, W - inner, H - c, inner, H - inner, W - 2 * inner, band],
      [c, inner, c, H - inner, o, inner, band, H - 2 * inner],
      [W - c, inner, W - c, H - inner, W - inner, inner, band, H - 2 * inner],
    ];
    let defs = '';
    let body = '';
    runs.forEach(([x0, y0, x1, y1, cx, cy, cw, ch], k) => {
      const id = `${uid}-${k}`;
      const L = Math.hypot(x1 - x0, y1 - y0);
      const lam = L / Math.max(3, Math.round(L / (band * 1.3)));
      defs += `<clipPath id="${id}"><rect x="${r1(cx)}" y="${r1(cy)}" width="${r1(cw)}" height="${r1(ch)}"/></clipPath>`;
      let g = '';
      for (let j = 0; j < 4; j += 1) g += `<path class="${A}" pathLength="1" d="${waveRun(x0, y0, x1, y1, band * 0.4, lam / 2, -lam * (1 + j / 4))}"/>`;
      for (let j = 0; j < 2; j += 1) g += `<path class="${B}" pathLength="1" d="${waveRun(x0, y0, x1, y1, band * 0.17, lam / 4, -lam * (1 + j / 4) - lam / 8)}"/>`;
      body += `<g clip-path="url(#${id})">${g}</g>`;
    });
    [[o, o], [W - inner, o], [o, H - inner], [W - inner, H - inner]].forEach(([x, y]) => {
      const cx = x + band / 2;
      const cy = y + band / 2;
      const R = band * 0.4;
      body += `<rect class="g-rule" x="${r1(x)}" y="${r1(y)}" width="${r1(band)}" height="${r1(band)}"/>`;
      for (let p = 0; p < 3; p += 1) body += `<path class="${p === 1 ? B : A}" d="${polar(cx, cy, R * 0.64, R * 0.3, 5, (p * Math.PI * 2) / 15, 60)}"/>`;
    });
    body += `<rect class="g-rule g-rule--b" pathLength="1" x="${r1(o)}" y="${r1(o)}" width="${r1(W - 2 * o)}" height="${r1(H - 2 * o)}"/>`;
    body += `<rect class="g-rule" pathLength="1" x="${r1(inner)}" y="${r1(inner)}" width="${r1(W - 2 * inner)}" height="${r1(H - 2 * inner)}"/>`;
    body += `<rect class="g-rule g-rule--hair" x="${r1(inner + 4)}" y="${r1(inner + 4)}" width="${r1(W - 2 * inner - 8)}" height="${r1(H - 2 * inner - 8)}"/>`;
    return `<defs>${defs}</defs>${body}`;
  }

  function rosetteMarkup(kind) {
    const back = kind === 'back';
    const A = back ? 'g-b' : 'g-a';
    const B = back ? 'g-a' : 'g-b';
    let s = '';
    const ring = (r0, amp, k, n, cls) => {
      for (let p = 0; p < n; p += 1) s += `<path class="${cls}" d="${polar(0, 0, r0, amp, k, (p * Math.PI * 2) / n, k * 7)}"/>`;
    };
    if (kind === 'seal') {
      ring(91, 5, 30, 2, 'g-b');
      ring(75, 8, 20, 3, 'g-a');
      ring(58, 5, 14, 2, 'g-b');
      s += '<circle class="g-rule" r="46"/><circle class="g-rule g-rule--hair" r="42"/>';
      s += `<text class="g-initial" x="0" y="15" text-anchor="middle">${esc(TERMS.brand.charAt(0).toUpperCase())}</text>`;
    } else {
      ring(95, 3.5, 52, 2, A);
      ring(83, 8, 36, 4, B);
      ring(67, 6, 26, 2, A);
      s += '<circle class="g-rule g-rule--hair" r="56"/>';
    }
    return s;
  }

  /* The medallion: one guilloche ring for every company in the group, oldest
     innermost; a microtext band, as on security print; the monogram at the core. */
  function medalMarkup(svg) {
    const uid = svg.dataset.medal || 'm';
    const rings = Number(svg.dataset.rings) || 4;
    const lit = Number(svg.dataset.lit) || 0;
    const R0 = 42;
    const R1 = 95;
    const step = (R1 - R0) / rings;
    let s = '';
    for (let i = 0; i < rings; i += 1) {
      const r = R0 + step * (i + 0.5);
      const k = 14 + i * 6;
      const n = k * 7;
      s += `<g class="m-ring${i < lit ? ' is-on' : ''}" data-i="${i}">`
        + `<path class="m-wave" pathLength="1" d="${polar(0, 0, r, step * 0.3, k, 0, n)}"/>`
        + `<path class="m-wave" pathLength="1" d="${polar(0, 0, r, step * 0.3, k, Math.PI, n)}"/></g>`;
    }
    for (let i = 0; i <= rings; i += 1) s += `<circle class="m-rule" r="${r1(R0 + step * i)}"/>`;
    if (svg.classList.contains('routes__art')) {
      for (let i = 0; i < rings; i += 1) {
        const r = R0 + step * (i + 0.5);
        s += `<g class="m-num" data-i="${i}"><circle cx="0" cy="${r1(-r)}" r="${r1(Math.min(6.4, step * 0.42))}"/>`
          + `<text x="0" y="${r1(-r + 1.9)}" text-anchor="middle">${String(i + 1).padStart(2, '0')}</text></g>`;
      }
    }
    const tr = 35;
    const C = 2 * Math.PI * tr;
    const unit = `${TERMS.brand.toUpperCase()} · ${TERMS.series} · `;
    const text = unit.repeat(Math.max(1, Math.round(C / (unit.length * 4.4))));
    s += `<path id="${uid}-mt" class="m-path" d="M0 ${-tr}A${tr} ${tr} 0 1 1 0 ${tr}A${tr} ${tr} 0 1 1 0 ${-tr}"/>`;
    s += `<text class="m-micro"><textPath href="#${uid}-mt" textLength="${r1(C - 1.5)}" lengthAdjust="spacing">${esc(text)}</textPath></text>`;
    s += `<circle class="m-core" r="29"/><text class="m-initial" x="0" y="13" text-anchor="middle">${esc(TERMS.brand.charAt(0).toUpperCase())}</text>`;
    return s;
  }
  function drawMedals(svgs) {
    svgs.forEach(svg => {
      svg.setAttribute('viewBox', '-100 -100 200 200');
      svg.innerHTML = medalMarkup(svg);
    });
  }
  /* A ring is engraved in: its lines draw around the medallion. */
  function engraveRing(g) {
    if (!motion) return;
    $$('.m-wave', g).forEach(p => p.animate(
      [{ strokeDasharray: '1 1', strokeDashoffset: 1 }, { strokeDasharray: '1 1', strokeDashoffset: 0 }],
      { duration: 1100, easing: 'cubic-bezier(.45,0,.2,1)' },
    ));
  }

  function drawRosettes(svgs) {
    svgs.forEach(svg => {
      const kind = svg.dataset.rosette || 'front';
      svg.setAttribute('viewBox', '-100 -100 200 200');
      svg.setAttribute('preserveAspectRatio', kind === 'seal' ? 'xMidYMid meet' : 'none');
      svg.innerHTML = rosetteMarkup(kind);
    });
  }

  /* Frames follow the card size; each face is engraved once, then redrawn on resize. */
  const frames = { w: 0, h: 0, faces: new Set() };
  function drawFrames(faces, width) {
    const card = $('[data-card]');
    if (!card) return;
    let W;
    let H;
    if (width) {
      /* Size known from the fit: derive the height from the aspect ratio, no layout read. */
      const [a, b = 1] = getComputedStyle(card).aspectRatio.split('/').map(Number);
      W = Math.round(width);
      H = Math.round(width / ((a || 1.45) / (b || 1)));
    } else {
      W = Math.round(card.offsetWidth);
      H = Math.round(card.offsetHeight);
    }
    if (!W || !H) return;
    const resized = W !== frames.w || H !== frames.h;
    frames.w = W;
    frames.h = H;
    const todo = new Set(faces.filter(f => resized || !frames.faces.has(f)));
    if (resized) frames.faces.forEach(f => todo.add(f));
    todo.forEach(face => {
      const back = face === 'back';
      const svg = $(back ? 'svg[data-frame="back"]' : 'svg[data-frame=""]', card);
      if (!svg) return;
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.innerHTML = frameMarkup(W, H, back, back ? 'gfb' : 'gff');
      frames.faces.add(face);
    });
  }
  function watchFrames() {
    const card = $('[data-card]');
    if (!card || typeof ResizeObserver !== 'function') return;
    let raf = 0;
    new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => drawFrames([]));
    }).observe(card);
  }

  /* ------------------------------------------------------------------------
     Odometer: mechanical digit wheels; leading zeros stay faint
     ------------------------------------------------------------------------ */
  class Odometer {
    constructor(el, digits) {
      this.cols = [];
      this.wraps = [];
      this.value = -1;
      el.textContent = '';
      el.classList.add('odo');
      for (let i = 0; i < digits; i += 1) {
        const col = document.createElement('span');
        col.className = 'odo__col';
        const strip = document.createElement('span');
        strip.className = 'odo__strip';
        strip.innerHTML = '01234567890'.split('').map(n => `<span>${n}</span>`).join('');
        col.appendChild(strip);
        el.appendChild(col);
        this.cols.unshift(strip);
        this.wraps.unshift(col);
      }
    }
    set(v) {
      const value = Math.max(0, v);
      if (Math.abs(value - this.value) < 0.0005) return;
      this.value = value;
      const sig = String(Math.floor(value + 0.0005)).length;
      this.cols.forEach((strip, k) => {
        const place = 10 ** k;
        let pos;
        if (k === 0) pos = value % 10;
        else {
          const lower = value % place;
          pos = (Math.floor(value / place) % 10) + (lower > place - 1 ? lower - (place - 1) : 0);
        }
        strip.style.transform = `translate3d(0, ${(-pos / 11) * 100}%, 0)`;
        this.wraps[k].classList.toggle('is-lead', k >= sig);
      });
    }
  }

  /* ------------------------------------------------------------------------
     The coupon sheet and the tally
     ------------------------------------------------------------------------ */
  const sheet = { lis: [], faces: [], slots: [], talon: null };
  const tally = { odo: null, v: 0 };

  function buildCoupons() {
    const ol = $('[data-coupons]');
    if (!ol) return;
    const talon = $('.coupon--talon', ol);
    const lis = $$('.coupon:not(.coupon--talon)', ol);
    const added = lis.length !== T.coupons.length;
    while (lis.length < T.coupons.length) {
      const li = document.createElement('li');
      li.className = 'coupon';
      li.innerHTML = '<span class="coupon__n"></span><span class="coupon__d"></span><span class="coupon__a"></span>';
      ol.insertBefore(li, talon);
      lis.push(li);
    }
    while (lis.length > T.coupons.length) lis.pop().remove();
    [...lis, talon].filter(Boolean).forEach(li => {
      const face = document.createElement('span');
      face.className = 'coupon__face';
      while (li.firstChild) face.appendChild(li.firstChild);
      li.appendChild(face);
      sheet.faces.push(face);
      if (li !== talon) {
        const slot = document.createElement('span');
        slot.className = 'coupon__slot';
        li.insertBefore(slot, face);
        sheet.slots.push(slot);
      }
    });
    sheet.lis = lis;
    sheet.talon = talon;
    sheet.slots.forEach(s => { s.textContent = D().paid; });
    /* The SL markup already carries these values; other languages render now. */
    if (lang !== 'sl' || added) renderCoupons();
  }

  function renderCoupons() {
    const set = (el, prop, v) => { if (el[prop] !== v) el[prop] = v; };
    const amount = tMoney(T.coupon, KEYS.coupon, 2);
    sheet.lis.forEach((li, k) => {
      set($('.coupon__n', li), 'textContent', String(k + 1).padStart(2, '0'));
      set($('.coupon__d', li), 'innerHTML', ent(D().date(T.coupons[k])));
      set($('.coupon__a', li), 'innerHTML', amount);
    });
    sheet.slots.forEach(s => set(s, 'textContent', D().paid));
  }

  function buildTally() {
    const num = $('[data-tally-num]');
    if (!num) return;
    tally.odo = new Odometer(num, String(Math.round(T.coupon * T.coupons.length)).length);
    renderTally();
    if (lang !== 'sl') renderTallyUnit();
  }
  function renderTally() { tally.odo?.set(tally.v); }
  function renderTallyUnit() {
    const pre = $('[data-cur="pre"]');
    const post = $('[data-cur="post"]');
    if (!pre || !post) return;
    const parts = moneyFmt(0).formatToParts(0);
    const ci = parts.findIndex(p => p.type === 'currency');
    const ni = parts.findIndex(p => p.type === 'integer');
    const before = ci < ni;
    pre.textContent = before ? parts.slice(ci, ni).map(p => p.value).join('') : '';
    post.textContent = before ? '' : parts.slice(ni + 1).map(p => p.value).join('');
  }

  /* ------------------------------------------------------------------------
     Scrolling: Lenis when motion is on, native otherwise
     ------------------------------------------------------------------------ */
  let lenis = null;
  const scrollFns = [];
  const onScroll = fn => scrollFns.push(fn);
  function initScroll() {
    if (motion && typeof window.Lenis === 'function') {
      lenis = new window.Lenis({ lerp: 0.11, smoothWheel: true, syncTouch: false });
      lenis.on('scroll', e => { ScrollTrigger.update(); scrollFns.forEach(f => f(e.scroll)); });
      gsap.ticker.add(t => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      let ticking = false;
      window.addEventListener('scroll', () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => { ticking = false; scrollFns.forEach(f => f(window.scrollY)); });
      }, { passive: true });
    }
    if (hasGsap) ScrollTrigger.config({ ignoreMobileResize: true });
  }
  const headerOffset = () => ($('[data-hdr]')?.offsetHeight || 64) + 8;
  /* Sections render lazily (content-visibility), so a first jump can be computed
     against estimated heights. Land, check, and settle once if needed. */
  const offTarget = target => target.getBoundingClientRect().top - (parseFloat(getComputedStyle(root).scrollPaddingTop) || headerOffset());
  function goTo(target, done) {
    const isTop = target === 0;
    if (lenis) {
      /* Lenis applies the root scroll-padding-top (header height) to element targets. */
      lenis.start();
      lenis.scrollTo(target, {
        duration: 1.15,
        onComplete: () => {
          if (!isTop && Math.abs(offTarget(target)) > 2) lenis.scrollTo(target, { duration: 0.45, onComplete: () => done && done() });
          else if (done) done();
        },
      });
      return;
    }
    const y = isTop ? 0 : target.getBoundingClientRect().top + window.scrollY - headerOffset();
    window.scrollTo({ top: y, behavior: mq.reduce.matches ? 'auto' : 'smooth' });
    setTimeout(() => {
      if (!isTop && Math.abs(offTarget(target)) > 2) window.scrollTo({ top: window.scrollY + offTarget(target), behavior: 'auto' });
      if (done) done();
    }, mq.reduce.matches ? 0 : 700);
  }

  /* Render each lazy section once in idle time, so its real height is remembered
     (contain-intrinsic-size: auto) and later jumps land exactly. */
  function primeSections() {
    const secs = $$('.sec, .ftr');
    const step = () => {
      const el = secs.shift();
      if (!el) return;
      el.style.contentVisibility = 'visible';
      requestAnimationFrame(() => requestAnimationFrame(() => {
        el.style.contentVisibility = '';
        whenIdle(step);
      }));
    };
    whenIdle(step);
  }
  function focusSection(el) {
    if (!el) return;
    const h = el.matches('h1, h2') ? el : (el.querySelector('h1, h2') || el);
    if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1');
    h.focus({ preventScroll: true });
  }

  /* ------------------------------------------------------------------------
     Header, menu, scroll-spy, anchors, dock
     ------------------------------------------------------------------------ */
  let menuOpen = false;
  const dockFlags = { hero: false, form: false, footer: false };
  function updateDock() {
    const dock = $('[data-dock]');
    if (dock) dock.classList.toggle('is-on', dockFlags.hero && !dockFlags.form && !dockFlags.footer && !menuOpen);
  }

  function initHeader() {
    const hdr = $('[data-hdr]');
    let lastY = 0;
    onScroll(y => {
      hdr.classList.toggle('is-solid', y > 24);
      const dy = y - lastY;
      if (Math.abs(dy) > 8) {
        const hide = dy > 0 && y > window.innerHeight * 0.6 && !menuOpen && !hdr.contains(document.activeElement);
        hdr.classList.toggle('is-hidden', hide);
        lastY = y;
      }
    });
    hdr.addEventListener('focusin', () => hdr.classList.remove('is-hidden'));
    requestAnimationFrame(() => { lastY = window.scrollY; hdr.classList.toggle('is-solid', lastY > 24); });
  }

  function initMenu() {
    const dlg = $('[data-menu]');
    const openBtn = $('[data-menu-open]');
    if (!dlg || typeof dlg.showModal !== 'function') return;
    openBtn.addEventListener('click', () => {
      dlg.showModal();
      menuOpen = true;
      lenis?.stop();
      updateDock();
    });
    $('[data-menu-close]').addEventListener('click', () => dlg.close());
    dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('close', () => {
      menuOpen = false;
      lenis?.start();
      updateDock();
      if (!dlg.dataset.navigating) openBtn.focus();
      delete dlg.dataset.navigating;
    });
  }

  function initAnchors() {
    document.addEventListener('click', e => {
      const a = e.target.closest('a[href^="#"]');
      if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey) return;
      const id = a.getAttribute('href').slice(1);
      const target = id === 'top' ? 0 : document.getElementById(id);
      if (target === null) return;
      e.preventDefault();
      const dlg = $('[data-menu]');
      if (dlg?.open) { dlg.dataset.navigating = '1'; dlg.close(); }
      goTo(target, () => focusSection(target === 0 ? $('#hero-title') : target));
      try { history.replaceState(null, '', id === 'top' ? location.pathname + location.search : `#${id}`); } catch { /* sandboxed history */ }
    });
    $('[data-totop]')?.addEventListener('click', () => goTo(0, () => focusSection($('#hero-title'))));
  }

  function initSpy() {
    const links = $$('.nav a[href^="#"]');
    const byId = new Map(links.map(a => [a.getAttribute('href').slice(1), a]));
    const sections = ['top', ...byId.keys()].map(id => document.getElementById(id)).filter(Boolean);
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        links.forEach(a => {
          const on = a === byId.get(en.target.id);
          a.classList.toggle('is-active', on);
          if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(s => io.observe(s));
  }

  function initDock() {
    const form = $('#interes');
    const footer = $('.ftr');
    const ctas = $('.hero__ctas');
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (en.target === form) dockFlags.form = en.isIntersecting;
        if (en.target === footer) dockFlags.footer = en.isIntersecting;
        if (en.target === ctas) dockFlags.hero = !en.isIntersecting && en.boundingClientRect.top < 0;
      });
      updateDock();
    });
    io.observe(form);
    io.observe(footer);
    if (!motion || mq.desk.matches) io.observe(ctas);
  }

  function renderYear() {
    const y = $('[data-year]');
    if (y) y.textContent = `© ${new Date().getFullYear()}`;
  }

  /* ------------------------------------------------------------------------
     Hero: the bond at work. Scroll clips the coupons into the tally, the
     talon unlocks conversion, and the certificate turns into a share.
     ------------------------------------------------------------------------ */
  const hero = { tl: null, st: null, stops: [], applyRings: null };

  /* Shrink the bond until it fits the pinned stage (all sizes inside are cqw).
     Cached per viewport so repeated refreshes don't force extra layouts. */
  const fitted = { key: '', w: 0 };
  function fitBond() {
    const bond = $('[data-bond]');
    const grid = $('.hero__grid');
    if (!bond || !grid) return 0;
    const key = `${window.innerWidth}x${window.innerHeight}|${motion}`;
    if (key === fitted.key) return fitted.w;
    fitted.key = key;
    bond.style.removeProperty('--wfit');
    if (!motion) { fitted.w = 0; return 0; }
    const hint = $('[data-hint]');
    const hintH = hint && hint.offsetParent ? hint.offsetHeight + 8 : 0;
    const avail = grid.clientHeight - hintH - 4;
    const w = bond.offsetWidth;
    const h = bond.offsetHeight;
    if (!h || h <= avail) { fitted.w = w; return w; }
    /* Inner sizes are cqw with small px floors, so leave a little slack. */
    const fit = Math.floor(w * (avail / h) * 0.985);
    bond.style.setProperty('--wfit', `${fit}px`);
    fitted.w = fit;
    return fit;
  }

  function heroMotion() {
    const track = $('[data-hero-track]');
    const stage = $('[data-hero-stage]');
    const copy = $('[data-hero-copy]');
    const bond = $('[data-bond]');
    const card = $('[data-card]');
    const caption = $('[data-bond-caption]');
    const caps = $$('[data-cap]', caption);
    const couponsEl = $('[data-coupons]');
    const tallyEl = $('[data-tally]');
    const hint = $('[data-hint]');
    const backRings = () => $$('.cert--back .m-ring');
    const N = Math.min(STORY_CLIPS, sheet.lis.length);
    const STEP = 0.42;
    const T_TALON = 1;
    const T_COUP = 2;
    const T_FLIP = T_COUP + N * STEP + 0.35;
    const T_DONE = T_FLIP + 1.4;
    hero.stops = [T_TALON + 0.6, T_COUP + N * STEP, T_DONE, T_DONE + 0.5];

    ScrollTrigger.addEventListener('refreshInit', () => fitBond());

    const mm = gsap.matchMedia();
    mm.add({ desk: '(min-width: 900px)', mob: '(max-width: 899.98px)' }, ctx => {
      const { desk } = ctx.conditions;
      let capIdx = 0;
      let lit = false;
      let ringsOn = false;

      const setCap = i => {
        if (i === capIdx) return;
        capIdx = i;
        caps.forEach((c, k) => { c.classList.toggle('is-on', k === i); c.classList.toggle('is-off', k < i); });
      };
      const setLit = on => {
        if (on === lit) return;
        lit = on;
        sheet.talon?.classList.toggle('is-lit', on);
      };
      /* After the turn, the share's rings light up: a stake in the whole group. */
      const applyRings = () => backRings().forEach((g, i) => { g.style.transitionDelay = `${i * 140}ms`; g.classList.toggle('is-on', ringsOn); });
      const setRings = on => {
        if (on === ringsOn) return;
        ringsOn = on;
        applyRings();
      };
      hero.applyRings = applyRings;
      applyRings();
      /* Layout positions, unaffected by the transforms this timeline applies. */
      const flights = [];
      const measure = () => {
        sheet.lis.slice(0, N).forEach((li, k) => {
          flights[k] = {
            x: tallyEl.offsetLeft + tallyEl.offsetWidth / 2 - (li.offsetLeft + li.offsetWidth / 2),
            y: tallyEl.offsetTop + tallyEl.offsetHeight / 2 - (li.offsetTop + li.offsetHeight / 2),
            lift: sheet.faces[k].offsetHeight * 0.2,
          };
        });
      };
      /* Every clipped coupon is painted from the playhead: lifted, cut, flown into
         the tally, which ticks over as each one lands. No per-coupon tweens. */
      const CLIP = 0.56;
      const painted = new Array(N).fill(-1);
      const paintCoupons = t => {
        let v = 0;
        for (let k = 0; k < N; k += 1) {
          const p = clamp((t - (T_COUP + k * STEP)) / CLIP, 0, 1);
          v += T.coupon * clamp((p - 0.75) / 0.25, 0, 1);
          if (p === painted[k]) continue;
          painted[k] = p;
          const face = sheet.faces[k];
          const m = flights[k];
          sheet.slots[k].style.opacity = String(clamp((p - 0.32) / 0.32, 0, 1));
          if (p === 0 || !m) { face.style.transform = ''; face.style.opacity = ''; face.style.visibility = ''; continue; }
          const side = k % 2 ? 1 : -1;
          const q1 = clamp(p / 0.21, 0, 1);
          const q2 = clamp((p - 0.21) / 0.61, 0, 1);
          const lift = -m.lift * Math.sin((q1 * Math.PI) / 2);
          const e = 1 - (1 - q2) ** 3;
          const x = m.x * q2 * q2;
          const y = lift + (m.y - lift) * e;
          const op = 1 - clamp((p - 0.68) / 0.14, 0, 1);
          face.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${(side * (3 * q1 + 13 * q2)).toFixed(2)}deg) scale(${(1 - 0.64 * q2 * q2).toFixed(3)})`;
          face.style.opacity = op.toFixed(3);
          face.style.visibility = op <= 0 ? 'hidden' : '';
        }
        if (v !== tally.v) { tally.v = v; renderTally(); }
      };
      const restOffset = () => Math.max(0, copy.offsetTop + copy.offsetHeight + 24 - (stage.offsetTop + bond.offsetTop));
      const recenter = () => (couponsEl.offsetHeight + parseFloat(getComputedStyle(couponsEl).marginTop || '0')) / 2;

      fitBond();
      track.style.setProperty('--hero-scroll', `${Math.round((T_DONE + 0.5) * (desk ? 40 : 44))}svh`);

      const tl = gsap.timeline({ defaults: { ease: 'none' } });
      if (desk) {
        tl.to(hint, { autoAlpha: 0, duration: 0.35 }, 0);
      } else {
        tl.fromTo(stage, { y: () => restOffset() }, { y: 0, duration: 0.85, ease: 'power2.inOut', immediateRender: true }, 0.15)
          .to(copy, { y: () => -copy.offsetHeight * 0.3, autoAlpha: 0, duration: 0.5, ease: 'power1.out' }, 0);
      }

      /* Conversion: the certificate turns over; what is left of the sheet goes with it. */
      tl.to(card, { rotationY: 180, duration: 1.15, ease: 'power2.inOut' }, T_FLIP)
        .to(card, { z: () => card.offsetWidth * 0.07, duration: 0.575, ease: 'sine.out' }, T_FLIP)
        .to(card, { z: 0, duration: 0.575, ease: 'sine.in' }, T_FLIP + 0.575)
        .to(sheet.faces.slice(N), { autoAlpha: 0, y: 10, duration: 0.3, stagger: 0.03 }, T_FLIP + 0.05)
        .to(couponsEl, { autoAlpha: 0, y: 16, duration: 0.45, ease: 'power1.in' }, T_FLIP + 0.45)
        .to([caption, card, tallyEl], { y: () => recenter(), duration: 0.7, ease: 'power2.inOut' }, T_FLIP + 0.6)
        .to({}, { duration: 0.5 }, T_DONE);

      measure();
      tl.eventCallback('onUpdate', () => {
        const t = tl.time();
        paintCoupons(t);
        setCap(t < T_TALON ? 0 : t < T_COUP ? 1 : t < T_FLIP ? 2 : 3);
        setLit(t >= T_TALON + 0.25);
        setRings(t >= T_FLIP + 0.75);
        if (!desk) { dockFlags.hero = t > 0.85; updateDock(); }
      });

      hero.tl = tl;
      hero.st = ScrollTrigger.create({
        trigger: track,
        start: 'top top',
        end: 'bottom bottom',
        animation: tl,
        scrub: 0.6,
        invalidateOnRefresh: true,
        onRefresh: () => { measure(); painted.fill(-1); paintCoupons(tl.time()); },
      });

      return () => {
        hero.tl = null;
        hero.st = null;
        tally.v = 0;
        renderTally();
        sheet.faces.forEach(f => { f.style.transform = ''; f.style.opacity = ''; f.style.visibility = ''; });
        sheet.slots.forEach(sl => { sl.style.opacity = ''; });
        caps.forEach(c => c.classList.remove('is-on', 'is-off'));
        sheet.talon?.classList.remove('is-lit');
        backRings().forEach(g => g.classList.add('is-on'));
        hero.applyRings = null;
        track.style.removeProperty('--hero-scroll');
      };
    });
  }

  /* Click the bond or the hint: play to the next beat of the story. */
  function initAdvance() {
    const advance = () => {
      if (!hero.tl || !hero.st) return;
      const t = hero.tl.time();
      const dur = hero.tl.duration();
      const next = hero.stops.find(s => s > t + 0.05) ?? dur;
      const y = hero.st.start + (hero.st.end - hero.st.start) * Math.min(1, next / dur);
      if (lenis) lenis.scrollTo(y, { duration: 1.2 }); else window.scrollTo({ top: y, behavior: 'smooth' });
    };
    $('[data-hint]')?.addEventListener('click', advance);
    $('[data-bond]')?.addEventListener('click', advance);
  }

  /* The certificate sits in the hand: it tilts a little under the cursor. */
  function initTilt() {
    if (!motion || !mq.fine.matches) return;
    const bond = $('[data-bond]');
    const card = $('[data-card]');
    let tx = 0;
    let ty = 0;
    let cx = 0;
    let cy = 0;
    let raf = 0;
    const tick = () => {
      cx += (tx - cx) * 0.1;
      cy += (ty - cy) * 0.1;
      const ang = Math.hypot(cx, cy) * 3.2;
      card.style.rotate = ang > 0.01 ? `${(-cy).toFixed(4)} ${cx.toFixed(4)} 0 ${ang.toFixed(3)}deg` : '';
      raf = Math.abs(tx - cx) + Math.abs(ty - cy) > 0.002 ? requestAnimationFrame(tick) : 0;
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
    bond.addEventListener('pointermove', e => {
      const r = bond.getBoundingClientRect();
      tx = clamp(((e.clientX - r.left) / r.width - 0.5) * 2, -1, 1);
      ty = clamp(((e.clientY - r.top) / r.height - 0.5) * 2, -1, 1);
      kick();
    });
    bond.addEventListener('pointerleave', () => { tx = 0; ty = 0; kick(); });
  }

  /* Without scroll motion: a plain switch between the bond and the share. */
  function initSwitch() {
    const sw = $('[data-bond-switch]');
    const bond = $('[data-bond]');
    if (!sw || !bond || motion) return;
    sw.hidden = false;
    const btns = $$('button[data-face]', sw);
    btns.forEach(b => b.addEventListener('click', () => {
      const back = b.dataset.face === 'back';
      bond.classList.toggle('is-back', back);
      btns.forEach(o => o.setAttribute('aria-pressed', String(o === b)));
    }));
  }

  /* Entrance: the headline rises and the bond arrives; it stays hidden for a beat
     while the next task engraves it. */
  const EASE_OUT = 'cubic-bezier(.22,1,.36,1)';
  let enterAt = 0;
  function heroEnter() {
    if (!motion) return;
    enterAt = performance.now();
    $$('.hero__h1 .line > span').forEach((s, i) => {
      s.animate([{ transform: 'translateY(108%)' }, { transform: 'translateY(0)' }], { duration: 1000, delay: 60 + i * 90, easing: EASE_OUT, fill: 'backwards' });
    });
    $$('.hero__copy > :not(h1)').forEach((el, i) => {
      el.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 760, delay: 200 + i * 70, easing: EASE_OUT, fill: 'backwards' });
    });
    $('[data-bond]')?.animate([{ opacity: 0, transform: 'translateY(28px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 1100, delay: 180, easing: EASE_OUT, fill: 'backwards' });
    $('.cert--front .specimen')?.animate([
      { opacity: 0, transform: 'scale(1.7)' },
      { opacity: 0.5, transform: 'scale(.96)', offset: 0.6 },
      { opacity: 0.42, transform: 'scale(1)' },
    ], { duration: 520, delay: 1250, easing: 'cubic-bezier(.3,1.4,.5,1)', fill: 'backwards' });
    $('[data-tally]')?.animate([{ opacity: 0, transform: 'translateY(-16px) rotate(-5deg)' }, { opacity: 1, transform: 'none' }], { duration: 700, delay: 1450, easing: EASE_OUT, fill: 'backwards' });
    $('[data-coupons]')?.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 800, delay: 700, easing: EASE_OUT, fill: 'backwards' });
  }
  /* The guilloche draws itself in, as if engraved; timed from the entrance start. */
  function engraveEnter() {
    if (!motion || !enterAt) return;
    const since = performance.now() - enterAt;
    $$('.cert--front .cert__frame [pathLength]').forEach((p, i) => {
      p.animate([{ strokeDasharray: '1 1', strokeDashoffset: 1 }, { strokeDasharray: '1 1', strokeDashoffset: 0 }], { duration: 1600, delay: Math.max(0, 260 + (i % 6) * 40 - since), easing: 'cubic-bezier(.45,0,.2,1)', fill: 'backwards' });
    });
    $('.cert--front .rosette')?.animate([{ opacity: 0, transform: 'rotate(-14deg) scale(.94)' }, { opacity: 0.55, transform: 'none' }], { duration: 1500, delay: Math.max(0, 420 - since), easing: EASE_OUT, fill: 'backwards' });
  }

  /* ------------------------------------------------------------------------
     Strategy: five routes to a company; each one engraves its ring
     ------------------------------------------------------------------------ */
  function initRoutes() {
    const tabs = $$('.route[role="tab"]');
    const panel = $('[data-route-panel]');
    const texts = $$('[data-route-text]');
    const art = $('.routes__art');
    if (!tabs.length || !panel) return;
    const visited = new Set();
    let current = 0;
    let seen = !motion;
    const paintArt = fresh => {
      if (!art) return;
      $$('.m-ring', art).forEach(g => {
        const k = Number(g.dataset.i);
        g.classList.toggle('is-on', visited.has(k));
        g.classList.toggle('is-sel', k === current);
        if (fresh && k === current && seen) engraveRing(g);
      });
      $$('.m-num', art).forEach(n => n.classList.toggle('is-sel', Number(n.dataset.i) === current));
    };
    const select = (i, focus) => {
      const fresh = !visited.has(i);
      current = i;
      tabs.forEach((t, k) => {
        const on = k === i;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
      });
      texts.forEach((p, k) => {
        const on = k === i;
        p.hidden = !on;
        p.classList.remove('is-in');
        if (on && visited.size) { void p.offsetWidth; p.classList.add('is-in'); }
      });
      panel.setAttribute('aria-labelledby', tabs[i].id);
      visited.add(i);
      tabs[i].classList.add('is-visited');
      paintArt(fresh);
      if (focus) tabs[i].focus();
    };
    tabs.forEach((t, i) => t.addEventListener('click', () => select(i)));
    tabs[0].parentElement.addEventListener('keydown', e => {
      const i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      const last = tabs.length - 1;
      const map = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: last };
      if (!(e.key in map)) return;
      e.preventDefault();
      const n = map[e.key];
      select(n > last ? 0 : n < 0 ? last : n, true);
    });
    select(Math.max(0, tabs.findIndex(t => t.getAttribute('aria-selected') === 'true')));
    /* The first ring engraves itself when the medallion comes into view. */
    if (art && !seen) {
      const io = new IntersectionObserver(entries => {
        if (!entries.some(en => en.isIntersecting)) return;
        io.disconnect();
        seen = true;
        $$('.m-ring.is-on', art).forEach(engraveRing);
      }, { threshold: 0.4 });
      io.observe(art);
    }
  }

  /* Founders and footer: the rings engrave one by one as the medallion comes into view. */
  function initRingFill() {
    if (!motion) return;
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        const n = Number(en.target.dataset.lit) || 0;
        $$('.m-ring', en.target).forEach((g, i) => {
          if (i < n) setTimeout(() => { g.classList.add('is-on'); engraveRing(g); }, 200 + i * 240);
        });
      });
    }, { threshold: 0.45 });
    $$('.founders__art, .ftr__mark').forEach(svg => {
      $$('.m-ring', svg).forEach(g => g.classList.remove('is-on'));
      io.observe(svg);
    });
  }

  /* ------------------------------------------------------------------------
     Calculator
     ------------------------------------------------------------------------ */
  const RANGE_MAX = 250000;
  const calc = { amount: 25000 };
  let calcRender = () => {};

  function parseAmount(str) {
    let s = String(str).replace(/[\s\u00a0\u202f€]/g, '');
    s = lang === 'sl' ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    const v = Number.parseFloat(s);
    return Number.isFinite(v) ? v : NaN;
  }
  const niceAmount = v => clamp(Math.round(v / TERMS.nominal) * TERMS.nominal, TERMS.minimum, TERMS.size);

  function initCalc() {
    const form = $('[data-calc]');
    if (!form) return;
    const input = $('#c-amount');
    const range = $('#c-range');
    const out = {
      bonds: $('[data-calc-bonds]'),
      semi: $('[data-out="semi"]'),
      year: $('[data-out="year"]'),
      total: $('[data-out="total"]'),
      totalLabel: $('[data-out-label="total"]'),
      sched: $('[data-sched]'),
      conv: $('[data-out="conv"]'),
      live: $('[data-calc-live]'),
      min: $('[data-fmt="min"]'),
      max: $('[data-fmt="max"]'),
    };
    const shown = { semi: null, year: null, total: null };
    let liveTimer = 0;

    range.min = String(TERMS.minimum);
    range.max = String(RANGE_MAX);
    range.step = String(TERMS.nominal);
    const setFill = () => range.style.setProperty('--fill', ((Number(range.value) - Number(range.min)) / (Number(range.max) - Number(range.min))).toFixed(4));

    const kpi = (key, v) => {
      const el = out[key];
      if (shown[key] === null || !motion) { shown[key] = v; el.textContent = money(v); return; }
      const st = { v: shown[key] };
      gsap.to(st, { v, duration: 0.5, ease: 'power3.out', overwrite: 'auto', onUpdate: () => { shown[key] = st.v; el.textContent = money(Math.round(st.v)); }, onComplete: () => { el.textContent = money(v); } });
    };

    function render() {
      const a = calc.amount;
      const bonds = a / TERMS.nominal;
      const semi = (a * TERMS.rate) / 100 / TERMS.perYear;
      const year = semi * TERMS.perYear;
      const total = year * TERMS.years;
      const shares = a / TERMS.convPrice;
      setFill();
      out.bonds.innerHTML = D().bonds(ent(intFmt().format(bonds)), word(bonds, 'bond'), tMoney(TERMS.nominal, ['nominal']));
      out.totalLabel.innerHTML = D().totalLabel(tInt(TERMS.years, ['years']), D().inYears(TERMS.years));
      kpi('semi', semi);
      kpi('year', year);
      kpi('total', total);
      out.sched.setAttribute('aria-label', D().schedAria);
      out.sched.innerHTML = T.coupons.map((d, k) => {
        const last = k === T.coupons.length - 1;
        return `<li><span class="s-d">${ent(D().date(d))}</span><span class="s-a">${ent(money(semi))}</span>${last ? `<span class="s-p">+ ${ent(money(a))} ${esc(D().principal)}</span>` : ''}</li>`;
      }).join('');
      out.conv.innerHTML = D().conv(ent(money(a)), tInt(shares, KEYS.shares), word(shares, 'share'), tMoney(TERMS.convPrice, ['convPrice'], 2));
      clearTimeout(liveTimer);
      liveTimer = setTimeout(() => {
        out.live.textContent = D().live(money(semi), TERMS.years, D().inYears(TERMS.years), money(total));
      }, 700);
    }

    const syncInput = () => { input.value = intFmt().format(calc.amount); };
    range.addEventListener('input', () => {
      calc.amount = niceAmount(Number(range.value));
      syncInput();
      render();
    });
    input.addEventListener('input', () => {
      const v = parseAmount(input.value);
      if (!Number.isFinite(v) || v < TERMS.minimum) return;
      calc.amount = niceAmount(v);
      range.value = String(Math.min(RANGE_MAX, calc.amount));
      render();
    });
    input.addEventListener('change', () => {
      const v = parseAmount(input.value);
      calc.amount = Number.isFinite(v) ? niceAmount(v) : calc.amount;
      range.value = String(Math.min(RANGE_MAX, calc.amount));
      syncInput();
      render();
    });
    input.addEventListener('focus', () => input.select());
    form.addEventListener('submit', e => { e.preventDefault(); input.blur(); });

    $('[data-prefill-calc]')?.addEventListener('click', () => prefillLead('investor', calc.amount));

    const renderScale = () => {
      out.min.innerHTML = ent(money(TERMS.minimum));
      out.max.innerHTML = ent(money(RANGE_MAX));
    };
    range.value = String(calc.amount);
    setFill();
    if (lang !== 'sl') { syncInput(); renderScale(); render(); }
    calcRender = () => {
      syncInput();
      renderScale();
      Object.keys(shown).forEach(k => { shown[k] = null; });
      render();
    };
  }

  /* ------------------------------------------------------------------------
     Interest form
     ------------------------------------------------------------------------ */
  let receiptRender = () => {};
  let setRole = () => {};
  function prefillLead(role, amount) {
    setRole(role);
    if (amount) {
      const sel = $('#f-range');
      if (sel) sel.value = amount <= 25000 ? '10-25' : amount <= 100000 ? '25-100' : amount <= 250000 ? '100-250' : '250+';
    }
  }

  function initLead() {
    const form = $('[data-lead]');
    const receipt = $('[data-receipt]');
    if (!form || !receipt) return;
    const f = { name: $('#f-name'), email: $('#f-email'), risk: $('#f-risk'), consent: $('#f-consent') };
    const err = { name: $('#f-name-err'), email: $('#f-email-err'), risk: $('#f-risk-err'), consent: $('#f-consent-err') };
    const roleOf = () => ($('input[name="role"]:checked', form)?.value === 'owner' ? 'owner' : 'investor');
    const active = () => Object.keys(f).filter(k => k !== 'risk' || roleOf() === 'investor');
    const ok = {
      name: () => f.name.value.trim().length >= 2,
      email: () => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.value.trim()),
      risk: () => f.risk.checked,
      consent: () => f.consent.checked,
    };
    const show = (k, bad) => { err[k].hidden = !bad; f[k].setAttribute('aria-invalid', bad ? 'true' : 'false'); };
    Object.keys(f).forEach(k => {
      const box = f[k].type === 'checkbox';
      f[k].addEventListener(box ? 'change' : 'blur', () => { if (box || f[k].dataset.touched) show(k, !ok[k]()); });
      if (!box) f[k].addEventListener('input', () => { f[k].dataset.touched = '1'; if (!err[k].hidden) show(k, !ok[k]()); });
    });

    const applyRole = () => {
      const owner = roleOf() === 'owner';
      $$('[data-investor-only]', form).forEach(el => { el.hidden = owner; });
      if (owner) { err.risk.hidden = true; f.risk.removeAttribute('aria-invalid'); }
      f.risk.required = !owner;
    };
    $$('input[name="role"]', form).forEach(r => r.addEventListener('change', applyRole));
    setRole = role => {
      const r = $(`input[name="role"][value="${role}"]`, form);
      if (r) { r.checked = true; applyRole(); }
    };
    $$('[data-prefill-role]').forEach(a => a.addEventListener('click', () => setRole(a.dataset.prefillRole)));
    applyRole();

    let sent = null;
    receiptRender = () => {
      if (!sent) return;
      $('[data-receipt-text]').innerHTML = sent.role === 'owner' ? D().receiptOwn(esc(sent.email)) : D().receiptInv(esc(sent.email));
    };

    form.addEventListener('submit', e => {
      e.preventDefault();
      let first = null;
      active().forEach(k => { const good = ok[k](); show(k, !good); if (!good && !first) first = f[k]; });
      if (first) { first.focus(); return; }
      sent = { role: roleOf(), email: f.email.value.trim() };
      receiptRender();
      form.hidden = true;
      receipt.hidden = false;
      receipt.classList.remove('is-in');
      void receipt.offsetWidth;
      receipt.classList.add('is-in');
      receipt.focus({ preventScroll: true });
      const r = receipt.getBoundingClientRect();
      if (r.top < 80 || r.bottom > window.innerHeight) goTo($('#interes'));
    });

    $('[data-receipt-reset]').addEventListener('click', () => {
      sent = null;
      form.reset();
      Object.keys(f).forEach(k => { delete f[k].dataset.touched; err[k].hidden = true; f[k].removeAttribute('aria-invalid'); });
      applyRole();
      receipt.hidden = true;
      form.hidden = false;
      f.name.focus();
    });
  }

  /* ------------------------------------------------------------------------
     Reveals, counting stats, living flow lines
     ------------------------------------------------------------------------ */
  function initReveals() {
    if (!motion) return;
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px 12% 0px' });
    $$('.rv').forEach(el => {
      const sibs = $$(':scope > .rv', el.parentElement);
      el.style.setProperty('--d', `${Math.max(0, sibs.indexOf(el)) * 0.07}s`);
      io.observe(el);
    });
  }

  function initCountUp() {
    if (!motion) return;
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        const el = en.target;
        const target = Number(el.dataset.pct);
        const t0 = performance.now();
        const dur = 1200;
        el.dataset.counting = '1';
        const step = now => {
          const p = Math.min(1, (now - t0) / dur);
          const e = 1 - (1 - p) ** 3;
          el.innerHTML = statText(el, target * e);
          if (p < 1) requestAnimationFrame(step);
          else { delete el.dataset.counting; el.innerHTML = statText(el, target); }
        };
        requestAnimationFrame(step);
      });
    }, { threshold: 0.6 });
    $$('.stat__num[data-pct]').forEach(el => io.observe(el));
  }

  function initFlow() {
    const fig = $('.flow-fig');
    if (!fig || !motion) return;
    new IntersectionObserver(entries => {
      entries.forEach(en => fig.classList.toggle('is-live', en.isIntersecting));
    }).observe(fig);
  }

  /* ------------------------------------------------------------------------
     Language switch (View Transition where supported)
     ------------------------------------------------------------------------ */
  function renderAllDynamic() {
    fmtCache.clear();
    run('terms', renderTerms);
    run('coupons', renderCoupons);
    run('tally', renderTallyUnit);
    run('stats', renderStats);
    run('calc', calcRender);
    run('receipt', receiptRender);
    $$('[data-set-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.setLang === lang)));
  }
  function setLang(next) {
    if (next === lang || !DYN[next]) return;
    const apply = () => {
      lang = next;
      root.lang = next;
      root.dataset.lang = next;
      applyStatic();
      renderAllDynamic();
      store.set('localStorage', 'kontinua-lang', next);
    };
    const after = () => { if (hasGsap) ScrollTrigger.refresh(); };
    if (document.startViewTransition && !mq.reduce.matches) {
      try { document.startViewTransition(apply).finished.then(after, after); return; } catch { /* fall through */ }
    }
    apply();
    after();
  }
  function initLangButtons() {
    $$('[data-set-lang]').forEach(b => b.addEventListener('click', () => setLang(b.dataset.setLang)));
  }

  /* ------------------------------------------------------------------------
     Boot: what the first frame needs, then the scroll story, then the rest.
     Yielding between steps keeps each task short on slow phones.
     ------------------------------------------------------------------------ */
  const nextTask = () => new Promise(resolve => {
    if (window.scheduler && typeof window.scheduler.yield === 'function') window.scheduler.yield().then(resolve);
    else setTimeout(resolve, 0);
  });
  const whenIdle = fn => (typeof window.requestIdleCallback === 'function' ? window.requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 120));

  /* Deferred scripts run while readyState is already 'interactive', so wait for the
     event itself (or load, if this file was ever executed after it). */
  const libsReady = () => new Promise(resolve => {
    if (document.readyState === 'complete') { resolve(); return; }
    document.addEventListener('DOMContentLoaded', () => resolve(), { once: true });
    window.addEventListener('load', () => resolve(), { once: true });
  });

  async function boot() {
    /* 1. The first frame: DOM writes and the entrance only, no layout reads. */
    captureSL();
    if (lang !== 'sl') { run('i18n', applyStatic); run('terms', renderTerms); }
    root.classList.remove('i18n-pending');
    $$('[data-set-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.setLang === lang)));
    run('coupons', buildCoupons);
    run('tally', buildTally);
    run('header', initHeader);
    run('menu', initMenu);
    run('anchors', initAnchors);
    run('lang', initLangButtons);
    if (motion) run('enter', heroEnter);
    await nextTask();

    /* 2. Engrave the front of the certificate (sized to fit the stage first). */
    run('engrave', () => { drawMedals($$('.cert--front svg[data-medal]')); drawRosettes($$('.cert--front svg[data-rosette]')); });
    const fitW = motion ? run('fit', fitBond) : 0;
    run('frames', () => drawFrames(['front'], fitW));
    run('engrave-enter', engraveEnter);

    /* 3. The scroll story, once GSAP, ScrollTrigger and Lenis have run. */
    await libsReady();
    await nextTask();
    hasGsap = typeof window.gsap === 'object' && typeof window.ScrollTrigger === 'function';
    if (hasGsap) gsap.registerPlugin(ScrollTrigger);
    if (motion && !hasGsap) {
      motion = false;
      root.classList.remove('motion');
      run('fit', fitBond);
    }
    run('scroll', initScroll);
    if (motion) {
      run('hero', heroMotion);
      run('advance', initAdvance);
      run('tilt', initTilt);
    }
    await nextTask();

    /* 4. Everything below the fold. */
    if (lang !== 'sl') run('stats', renderStats);
    run('routes-art', () => drawMedals($$('.routes__art')));
    run('routes', initRoutes);
    run('spy', initSpy);
    run('dock', initDock);
    run('year', renderYear);
    run('calc', initCalc);
    run('lead', initLead);
    run('switch', initSwitch);
    run('flow', initFlow);
    if (motion) {
      run('reveals', initReveals);
      run('count', initCountUp);
      document.fonts?.ready.then(() => ScrollTrigger.refresh());
    }

    /* 5. Out of sight until later: the share side, the founders and footer art,
       the seal. The SL markup is rendered from the same terms; re-rendering it
       here keeps the two honest without paying for Intl during load. */
    whenIdle(() => {
      run('engrave-back', () => {
        drawMedals($$('.cert--back svg[data-medal]'));
        drawRosettes($$('.cert--back svg[data-rosette]'));
        drawFrames(['back']);
        hero.applyRings?.();
      });
      run('frames-watch', watchFrames);
      whenIdle(() => {
        run('art', () => { drawMedals($$('.founders__art, .ftr__mark')); drawRosettes($$('svg[data-rosette="seal"]')); });
        run('rings', initRingFill);
        const prime = () => run('prime', primeSections);
        if (lang !== 'sl') { prime(); return; }
        whenIdle(() => {
          run('terms', renderTerms);
          run('coupons-text', renderCoupons);
          run('tally-unit', renderTallyUnit);
          run('stats', renderStats);
          run('calc-render', calcRender);
          prime();
        });
      });
    });
  }
  boot();
})();
