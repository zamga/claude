/* danes. — homepage interactions
   Progressive enhancement: the page reads complete without this file. With it the
   page gains live dates, the torn calendar, the language switch, the calculator
   and the set-off loop. GSAP, ScrollTrigger and Lenis are optional; every module
   checks for them and falls back to a still, fully working page. */
(() => {
  'use strict';

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
  const run = (name, fn) => { try { return fn(); } catch (err) { console.error(`[danes] ${name}`, err); return undefined; } };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const wait = ms => new Promise(r => setTimeout(r, ms));

  window.__danes = true;
  const hasGsap = typeof window.gsap === 'object' && typeof window.ScrollTrigger === 'function';
  const motion = hasGsap && !mq.reduce.matches;
  root.classList.add('js');
  root.classList.toggle('motion', motion);
  if (!motion) root.classList.remove('intro-on');
  if (hasGsap) gsap.registerPlugin(ScrollTrigger);

  /* ------------------------------------------------------------------------
     Language
     ------------------------------------------------------------------------ */
  const UNDERLINE = '<svg viewBox="0 0 300 20" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M2 13 C 60 5, 110 17, 170 9 S 260 6, 298 11"/></svg>';
  const ARROW = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 10h13M11 4.5 16.5 10 11 15.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>';

  const EN = {
    'skip': 'Skip to content',
    'logo.aria': 'danes., back to the top',
    'nav.aria': 'Main navigation',
    'nav.how': 'How it works',
    'nav.services': 'Services',
    'nav.calc': 'Calculator',
    'nav.setoff': 'Set-off',
    'nav.faq': 'FAQ',
    'lang.aria': 'Language',
    'cta.submit': 'Submit an invoice',
    'menu.open': 'Menu',
    'menu.close': 'Close',
    'menu.aria': 'Menu',
    'stamp.today': 'Today',
    'stamp.paid': 'Paid',
    'stamp.received': 'Received',
    'hero.eyebrow': 'Invoice purchase and debt collection · Slovenia + 38 countries',
    'hero.h1': '<span class="line"><span>Stop</span></span> <span class="line"><span>counting days.</span></span>',
    'hero.lede': 'We buy your unpaid invoices or collect them for you. An offer within the hour, the money today.',
    'hero.cta2': 'What would I get?',
    'hero.meta1': 'Offer within 1 hour',
    'hero.meta2': 'Collection: pay only if we succeed',
    'hero.meta3': 'From €1,000 to €500,000',
    'hero.hint': 'Watch 79 days go by',
    'cal.tag': 'invoice purchase &amp;<br>debt collection',
    'cal.todayLabel': 'Excuse of the day',
    'cal.noExcuses': 'No excuses.',
    'cal.paid': 'Paid',
    'tag.late': 'Overdue',
    'exc.title': 'The calendar of excuses: 79 days from the due date to today',
    'pivot.aria': 'Late payment',
    'pivot.text': `Every day of delay is <span class="u">an interest-free loan${UNDERLINE}</span> to your customer.`,
    'pivot.aside': 'Except nobody asked you.',
    'how.eyebrow': 'How it works',
    'how.h2': '<s>79 days of waiting.</s> Or <mark>89 minutes</mark> with us.',
    'how.liveFallback': 'We send offers within an hour, 8:00–16:00 on working days.',
    'how.s1.stamp': 'Received',
    'how.s1.title': 'You send the invoice.',
    'how.s1.text': 'A photo or a PDF. No six-page forms.',
    'how.s2.stamp': 'Checked',
    'how.s2.title': 'We check the debtor.',
    'how.s2.text': 'Credit rating, payment habits, blocked accounts. You do nothing.',
    'how.s3.stamp': 'Offer',
    'how.s3.title': 'You get an offer.',
    'how.s3.text': 'One number: what you get. No asterisks, no fine print.',
    'how.s4.stamp': 'Signed',
    'how.s4.title': 'You sign digitally.',
    'how.s4.text': 'With a qualified digital certificate or remotely. No printing, no scanning.',
    'how.s5.stamp': 'Paid out',
    'how.s5.title': 'The money’s in your account.',
    'how.s5.text': 'A SEPA instant payment arrives within ten seconds.',
    'svc.eyebrow': 'Services',
    'svc.h2': 'What’s worrying you today?',
    'svc.lede': 'Start with the problem, not the product name. We’ll handle the rest.',
    'svc.1.q': '“I need the money now.”',
    'svc.1.name': 'Invoice purchase',
    'svc.1.chip': 'today',
    'svc.1.text': 'We buy your invoice and pay you straight away. We wait for the debtor, not you. You’ve already done your part.',
    'svc.1.f1': 'Offer within 1 hour',
    'svc.1.f2': 'From €1,000 to €500,000',
    'svc.1.f3': 'With or without recourse',
    'svc.1.cta': 'Calculate a purchase',
    'svc.2.q': '“My customer has gone quiet.”',
    'svc.2.name': 'Debt collection',
    'svc.2.chip': '24 h',
    'svc.2.text': 'Polite, persistent and by the book. Reminders and a conversation first; court enforcement based on the invoice only after that. Your customer can stay your customer.',
    'svc.2.f1': 'Pay only if we succeed',
    'svc.2.f2': 'First reminder within 24 hours',
    'svc.2.f3': 'Slovenia + 38 countries',
    'svc.2.cta': 'Start collection',
    'svc.3.q': '“Everyone owes everyone.”',
    'svc.3.name': 'Set-off and chain compensation',
    'svc.3.chip': 'monthly',
    'svc.3.text': 'When companies owe each other in a circle, we close the debts together, without anyone transferring a single euro.',
    'svc.3.f1': 'Every month',
    'svc.3.f2': 'No cash needed',
    'svc.3.f3': 'Sole traders too',
    'svc.3.cta': 'See how it works',
    'svc.4.q': '“There’s a bill of exchange in my drawer.”',
    'svc.4.name': 'Bill of exchange purchase',
    'svc.4.chip': 'today',
    'svc.4.text': 'A bill in a drawer isn’t money. With us it becomes money the same day we check it.',
    'svc.4.f1': 'Same-day offer',
    'svc.4.f2': 'Domestic and foreign bills',
    'svc.4.cta': 'Submit a bill',
    'svc.5.q': '“Next time, I want to sleep at night.”',
    'svc.5.name': 'Credit checks and cover',
    'svc.5.chip': '2 min',
    'svc.5.text': 'We check a customer before you invoice them, and cover the invoice if they still don’t pay.',
    'svc.5.f1': 'Credit check in 2 minutes',
    'svc.5.f2': 'Cover up to 90% of the invoice',
    'svc.5.cta': 'Check a customer',
    'calc.eyebrow': 'Calculator',
    'calc.h2': 'What would you get today?',
    'calc.lede': 'The example is the invoice from the calendar: €12,400, 79 days late. Change the numbers and see what we deduct. There are no other costs.',
    'calc.amount': 'Invoice amount',
    'calc.amountRange': 'Invoice amount, slider',
    'calc.state': 'The invoice is',
    'calc.notDue': 'not yet due',
    'calc.late': 'already overdue',
    'calc.region': 'The debtor is in',
    'calc.si': 'Slovenia',
    'calc.eu': 'another EU country',
    'calc.world': 'outside the EU',
    'calc.payLabel': 'We pay you',
    'calc.when': 'In your account:',
    'calc.keyYou': 'You get',
    'calc.keyFee': 'Fee',
    'calc.rowAmount': 'Invoice amount',
    'calc.rowFee': 'Our fee',
    'calc.rowOther': 'Other costs',
    'calc.cta': 'Submit this invoice',
    'calc.note': 'An estimate. You’ll get the exact offer within an hour of submitting.',
    'inv.title': 'Invoice',
    'inv.no': 'No.',
    'inv.from': 'From',
    'inv.fromName': 'Your Company Ltd',
    'inv.issued': 'Issued',
    'inv.due': 'Due',
    'inv.to': 'Customer',
    'inv.toName': 'Debtor Ltd',
    'inv.terms': 'Payment terms',
    'inv.line': 'Services under contract',
    'inv.total': 'Amount due',
    'inv.r1': '1st reminder',
    'inv.r2': '2nd reminder',
    'inv.r3': 'Final reminder',
    'inv.cap': 'Every late day shows: the reminders pile up and the odds of being paid go down.',
    'loop.eyebrow': 'Set-off',
    'loop.h2': 'Five companies, €41,000 of debt, and nobody wants to pay first.',
    'loop.aria': 'Five companies owe each other in a circle. The set-off reduces every debt by €5,000 and settles €25,000 in total without a single transfer.',
    'loop.n0': 'Construction',
    'loop.n1': 'Joinery',
    'loop.n2': 'Print shop',
    'loop.n3': 'Haulage',
    'loop.n4': 'Retail',
    'loop.cap': 'An arrow means “owes”. Every debt in the loop drops by the smallest one, €5,000. Retail’s debt to Construction disappears entirely.',
    'loop.lede': '“We’ll pay when our client pays us” has a fix. When companies owe each other in a circle, we reduce every debt by the same amount. All at once, with one signature and not a single euro in cash.',
    'loop.run': 'Close the loop',
    'loop.st1': 'Debt before set-off',
    'loop.st2': 'Settled',
    'loop.st3': 'Euros transferred',
    'loop.table': 'Show as a table',
    'loop.tcap': 'Debts before and after set-off',
    'loop.th1': 'Who',
    'loop.th2': 'owes',
    'loop.th3': 'Before',
    'loop.th4': 'After',
    'faq.eyebrow': 'FAQ',
    'faq.h2': 'What people ask us first.',
    'faq.more': 'Can’t find your answer? <a href="#oddaj">Write to us</a> and we’ll reply the same day.',
    'faq.q1': 'Will my customer know I sold the invoice?',
    'faq.a1': 'Usually, yes: we let the debtor know they now pay us. The notice is short and polite. We won’t damage your relationship.',
    'faq.q2': 'What if the debtor doesn’t pay you either?',
    'faq.a2': 'It depends on what we agree. Without recourse, we take on the whole risk. With recourse, the fee is lower, but if the debtor doesn’t pay, you pay the amount back.',
    'faq.q3': 'How much does collection cost?',
    'faq.a3': 'Nothing until we succeed. Then a percentage of what we recover, agreed upfront and written on one page.',
    'faq.q4': 'What do you need from me?',
    'faq.a4': 'The invoice, a contract or purchase order, and proof of delivery such as a delivery note. Missing something? Write to us anyway.',
    'faq.q5': 'Do you collect abroad?',
    'faq.a5': 'Yes, in 38 countries, with partners who speak the debtor’s language and know the local courts.',
    'faq.q6': 'I’m a sole trader. Is this for me too?',
    'faq.a6': 'Yes. We buy invoices from €1,000, just as fast for sole traders as for large companies.',
    'form.eyebrow': 'Submit',
    'form.h2': 'Which invoice is keeping you up today?',
    'form.lede': 'Send it over. Within the hour you’ll get an offer, or an honest answer that we can’t help.',
    'form.nextTitle': 'What happens next',
    'form.next1': 'We review the invoice and the debtor.',
    'form.next2': 'We send an offer with one number.',
    'form.next3': 'You sign, we pay.',
    'form.need': 'What do you need?',
    'form.needBuy': 'Invoice purchase',
    'form.needCollect': 'Collection',
    'form.needSetoff': 'Set-off',
    'form.needCheck': 'Customer check',
    'form.needUnsure': 'Not sure yet',
    'form.company': 'Company or tax number',
    'form.email': 'Email',
    'form.phone': 'Phone',
    'form.optional': '(optional)',
    'form.amount': 'Invoice amount in euros',
    'form.file': 'Invoice',
    'form.drop': 'Drag a PDF or photo here, or <u>choose a file</u>.',
    'form.consent': 'I agree to my details being used to prepare the offer. We never share them.',
    'form.errCompany': 'Enter your company name or tax number.',
    'form.errEmail': 'Enter a valid email address so we can send you the offer.',
    'form.errConsent': 'We need your consent to prepare the offer.',
    'form.submit': 'Submit the invoice',
    'form.note': 'We reply within an hour, 8:00–16:00 on working days.',
    'form.thanks': 'Received.',
    'form.thanks2': 'Until then, there’s nothing for you to count.',
    'form.demo': 'Concept demo: nothing was sent.',
    'form.again': 'Submit another invoice',
    'ftr.tag': 'Invoice purchase and debt collection. Paid today.',
    'ftr.navAria': 'Services in the footer',
    'ftr.services': 'Services',
    'ftr.setoff': 'Set-off',
    'ftr.offices': 'Offices',
    'ftr.hours': 'Mon–Fri, 8:00–17:00',
    'ftr.lang': 'Language',
    'ftr.legal': 'danes. Concept design: the company, figures and calculations are fictional. The excuses, sadly, are not.',
    'ftr.top': 'Back to top',
  };

  const WD_ACC = ['nedeljo', 'ponedeljek', 'torek', 'sredo', 'četrtek', 'petek', 'soboto'];
  const DYN = {
    sl: {
      locale: 'sl-SI',
      title: 'danes. — Odkup in izterjava terjatev. Denar še danes.',
      desc: 'Neplačane račune odkupimo ali izterjamo za vas. Ponudba v eni uri, denar še danes. Izterjava s plačilom le ob uspehu, v Sloveniji in 38 državah.',
      excuses: [
        'Seveda, nakažemo danes.',
        'Nakazilo je že v banki.',
        'Računa nismo prejeli. Ga lahko pošljete še enkrat?',
        'Računovodkinja je na dopustu.',
        'Plačamo, ko plača naša stranka.',
        'Direktor mora še podpisati.',
        'Ta teden. Zagotovo.',
        'Sistem nam ne dela.',
      ],
      excToday: 'Plačano, brez izgovorov.',
      q: s => `»${s}«`,
      labelDue: 'Rok plačila',
      labelExcuse: 'Izgovor dneva',
      labelToday: 'Danes',
      noExcuses: 'Brez izgovorov.',
      stampPaid: 'Plačano',
      stampToday: 'Danes',
      invoiceRef: no => `Račun ${no}`,
      lateFoot: n => `Zamuda ${n} ${dayWord(n)}`,
      paidFoot: amt => `${amt} na računu`,
      doy: (n, left) => `${n}. dan · še ${left}\u00a0${dayWord(left)}`,
      tagLate: 'Zamuda',
      dayShort: d => `${d.getDate()}. ${d.getMonth() + 1}.`,
      dateLong: d => `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`,
      logoDate: d => `${dfmt(d, { weekday: 'short' })} ${d.getDate()}. ${d.getMonth() + 1}.`,
      listDate: d => `${dfmt(d, { weekday: 'short' })} ${d.getDate()}. ${d.getMonth() + 1}.`,
      live: (time, cut) => `Zdaj je <strong>${time}</strong>. ${cut}`,
      cutToday: 'Če račun oddate do 14:00, je denar na računu še danes.',
      cutLater: day => `Če račun oddate zdaj, je denar na računu ${day} dopoldne.`,
      tomorrow: 'jutri',
      today: 'danes',
      onDay: d => `v ${WD_ACC[d.getDay()]}`,
      daysLate: 'Dni zamude',
      daysDue: 'Dni do zapadlosti',
      invLate: 'Zamuda',
      invDue: 'Zapade čez',
      termsVal: n => `${n}\u00a0${dayWord(n)}`,
      whenToday: 'danes do 15:00',
      whenNext: day => `${day} do 10:00`,
      whenOld: 'plačate le ob uspehu',
      payLabel: 'Izplačamo vam',
      payLabelOld: 'Če uspemo, dobite',
      feeRowOld: 'Provizija za izterjavo',
      alt: (pct, fee) => `Raje izterjava? Brez stroškov vnaprej, ob uspehu <strong>${pct}</strong> izterjanega zneska (${fee}).`,
      altOld: 'Račun je starejši od 180 dni, zato ga ne odkupimo. Izterjavo pa lahko začnemo še danes.',
      barLabel: (you, fee) => `Vi dobite ${you}, provizija ${fee}`,
      calcLive: (pay, pct) => `Izplačamo vam ${pay}. Provizija ${pct}.`,
      calcLiveOld: (pay, pct) => `Odkup ni mogoč. Ob uspešni izterjavi dobite ${pay}, provizija ${pct}.`,
      loopRun: 'Zapri krog',
      loopAgain: 'Še enkrat',
      loopDone: 'Krog je zaprt. Poravnano 25.000 €, nakazanih evrov 0.',
      receipt: (time, deadline) => `Prejeto ob <strong>${time}</strong>. Ponudbo vam pošljemo ${deadline}.`,
      deadlineSame: t => `do <strong>${t}</strong>`,
      deadlineNext: day => `${day} do <strong>10:00</strong>`,
    },
    en: {
      locale: 'en-GB',
      title: 'danes. — Invoice purchase and debt collection. Paid today.',
      desc: 'We buy your unpaid invoices or collect them for you. An offer within the hour, the money today. Collection on a no-win, no-fee basis in Slovenia and 38 countries.',
      excuses: [
        'Of course, we’re paying today.',
        'The transfer’s already with the bank.',
        'We never got the invoice. Could you send it again?',
        'Our accountant’s on holiday.',
        'We’ll pay as soon as our client pays us.',
        'The director still needs to sign it.',
        'This week. Definitely.',
        'Our system’s down.',
      ],
      excToday: 'Paid. No excuses.',
      q: s => `“${s}”`,
      labelDue: 'Payment due',
      labelExcuse: 'Excuse of the day',
      labelToday: 'Today',
      noExcuses: 'No excuses.',
      stampPaid: 'Paid',
      stampToday: 'Today',
      invoiceRef: no => `Invoice ${no}`,
      lateFoot: n => `${n} ${dayWord(n)} late`,
      paidFoot: amt => `${amt} paid in`,
      doy: (n, left) => `Day ${n} · ${left} to go`,
      tagLate: 'Overdue',
      dayShort: d => `${d.getDate()} ${dfmt(d, { month: 'short' })}`,
      dateLong: d => `${d.getDate()} ${dfmt(d, { month: 'short' })} ${d.getFullYear()}`,
      logoDate: d => `${dfmt(d, { weekday: 'short' })} ${d.getDate()} ${dfmt(d, { month: 'short' })}`,
      listDate: d => `${dfmt(d, { weekday: 'short' })} ${d.getDate()} ${dfmt(d, { month: 'short' })}`,
      live: (time, cut) => `It’s <strong>${time}</strong>. ${cut}`,
      cutToday: 'Send the invoice by 14:00 and the money arrives today.',
      cutLater: day => `Send it now and the money arrives ${day} morning.`,
      tomorrow: 'tomorrow',
      today: 'today',
      onDay: d => `on ${dfmt(d, { weekday: 'long' })}`,
      daysLate: 'Days overdue',
      daysDue: 'Days until due',
      invLate: 'Overdue',
      invDue: 'Due in',
      termsVal: n => `${n}\u00a0${dayWord(n)}`,
      whenToday: 'today by 15:00',
      whenNext: day => `${day} by 10:00`,
      whenOld: 'you pay only if we succeed',
      payLabel: 'We pay you',
      payLabelOld: 'If we succeed, you get',
      feeRowOld: 'Collection fee',
      alt: (pct, fee) => `Prefer collection? Nothing upfront; <strong>${pct}</strong> of what we recover if we succeed (${fee}).`,
      altOld: 'This invoice is more than 180 days old, so we won’t buy it. We can start collecting it today, though.',
      barLabel: (you, fee) => `You get ${you}, fee ${fee}`,
      calcLive: (pay, pct) => `We pay you ${pay}. Fee ${pct}.`,
      calcLiveOld: (pay, pct) => `Purchase isn’t possible. If collection succeeds you get ${pay}, fee ${pct}.`,
      loopRun: 'Close the loop',
      loopAgain: 'Run it again',
      loopDone: 'Loop closed. €25,000 settled, €0 transferred.',
      receipt: (time, deadline) => `Received at <strong>${time}</strong>. Your offer will arrive ${deadline}.`,
      deadlineSame: t => `by <strong>${t}</strong>`,
      deadlineNext: day => `${day} by <strong>10:00</strong>`,
    },
  };

  let lang = root.dataset.lang === 'en' ? 'en' : 'sl';
  const D = () => DYN[lang];
  const SL = new Map();

  const PLURAL = { sl: new Intl.PluralRules('sl-SI'), en: new Intl.PluralRules('en-GB') };
  const DAY_FORMS = { sl: { one: 'dan', two: 'dneva', few: 'dnevi', other: 'dni' }, en: { one: 'day', other: 'days' } };
  function dayWord(n) { const f = DAY_FORMS[lang]; return f[PLURAL[lang].select(n)] || f.other; }

  const fmtCache = new Map();
  const nf = (key, opts) => {
    const k = `${lang}|${key}`;
    if (!fmtCache.has(k)) fmtCache.set(k, new Intl.NumberFormat(D().locale, opts));
    return fmtCache.get(k);
  };
  const money = v => nf('m2', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
  const money0 = v => nf('m0', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
  const pctFmt = v => nf('p1', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v / 100);
  const intFmt = v => nf('i0', { maximumFractionDigits: 0 }).format(v);
  function dfmt(d, opts) { return new Intl.DateTimeFormat(D().locale, opts).format(d); }
  const timeFmt = d => dfmt(d, { hour: '2-digit', minute: '2-digit', hour12: false });
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

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
     Dates: today, Slovenian public holidays, business days
     ------------------------------------------------------------------------ */
  const today = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const dayOfYear = d => Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 0)) / 864e5);
  const daysInYear = y => ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365);
  const HOLIDAYS = {
    '1-1': ['novo leto', 'New Year’s Day'],
    '1-2': ['novo leto', 'New Year holiday'],
    '2-8': ['Prešernov dan', 'Prešeren Day'],
    '4-27': ['dan upora proti okupatorju', 'Uprising Day'],
    '5-1': ['praznik dela', 'Labour Day'],
    '5-2': ['praznik dela', 'Labour Day'],
    '6-25': ['dan državnosti', 'Statehood Day'],
    '8-15': ['Marijino vnebovzetje', 'Assumption Day'],
    '10-31': ['dan reformacije', 'Reformation Day'],
    '11-1': ['dan spomina na mrtve', 'Remembrance Day'],
    '12-25': ['božič', 'Christmas Day'],
    '12-26': ['dan samostojnosti in enotnosti', 'Independence Day'],
  };
  function easter(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(y, month - 1, day);
  }
  function holiday(d) {
    const fixed = HOLIDAYS[`${d.getMonth() + 1}-${d.getDate()}`];
    const li = lang === 'sl' ? 0 : 1;
    if (fixed) return fixed[li];
    const e = easter(d.getFullYear());
    if (sameDay(d, e)) return ['velika noč', 'Easter Sunday'][li];
    if (sameDay(d, addDays(e, 1))) return ['velikonočni ponedeljek', 'Easter Monday'][li];
    if (sameDay(d, addDays(e, 49))) return ['binkošti', 'Whit Sunday'][li];
    return null;
  }
  const isWorkday = d => d.getDay() > 0 && d.getDay() < 6 && !holiday(d);
  const nextWorkday = d => { let x = addDays(d, 1); while (!isWorkday(x)) x = addDays(x, 1); return x; };
  const dayPhrase = (target, now) => {
    const diff = Math.round((today() - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 864e5);
    const t0 = addDays(today(), -diff);
    if (sameDay(target, t0)) return D().today;
    if (sameDay(target, addDays(t0, 1))) return D().tomorrow;
    return D().onDay(target);
  };
  /* Payout timing: approvals run on working days; money sent before 14:00 lands today. */
  function payoutWhen(now = new Date()) {
    const mins = now.getHours() * 60 + now.getMinutes();
    if (isWorkday(now) && mins < 14 * 60) return { today: true };
    return { today: false, day: nextWorkday(now) };
  }

  /* ------------------------------------------------------------------------
     Odometer: mechanical digit wheels for counters
     ------------------------------------------------------------------------ */
  class Odometer {
    constructor(el, digits) {
      this.cols = [];
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
      }
    }
    set(v) {
      const value = Math.max(0, v);
      if (Math.abs(value - this.value) < 0.0005) return;
      this.value = value;
      this.cols.forEach((strip, k) => {
        const place = 10 ** k;
        let pos;
        if (k === 0) pos = value % 10;
        else {
          const lower = value % place;
          pos = (Math.floor(value / place) % 10) + (lower > place - 1 ? lower - (place - 1) : 0);
        }
        strip.style.transform = `translate3d(0, ${(-pos / 11) * 100}%, 0)`;
      });
    }
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
  function goTo(target, done) {
    const isTop = target === 0;
    const el = isTop ? null : target;
    if (lenis) {
      lenis.start();
      lenis.scrollTo(isTop ? 0 : el, { offset: isTop ? 0 : -headerOffset(), duration: 1.15, onComplete: () => done && done() });
      return;
    }
    const y = isTop ? 0 : el.getBoundingClientRect().top + window.scrollY - headerOffset();
    window.scrollTo({ top: y, behavior: mq.reduce.matches ? 'auto' : 'smooth' });
    if (done) setTimeout(done, mq.reduce.matches ? 0 : 700);
  }
  function focusSection(el) {
    if (!el) return;
    const h = el.matches('main') ? el : (el.querySelector('h1, h2') || el);
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
    let lastY = window.scrollY;
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
    hdr.classList.toggle('is-solid', window.scrollY > 24);
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
    const form = $('#oddaj');
    const footer = $('.ftr');
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (en.target === form) dockFlags.form = en.isIntersecting;
        if (en.target === footer) dockFlags.footer = en.isIntersecting;
        if (en.target.matches('.hero__ctas')) dockFlags.hero = !en.isIntersecting && en.boundingClientRect.top < 0;
      });
      updateDock();
    });
    io.observe(form);
    io.observe(footer);
    if (!motion) io.observe($('.hero__ctas'));
  }

  /* ------------------------------------------------------------------------
     Living dates: logo, footer stamp, year
     ------------------------------------------------------------------------ */
  function renderDates() {
    const now = new Date();
    const logo = $('[data-today-short]');
    if (logo) { logo.dateTime = iso(now); logo.textContent = D().logoDate(now); }
    const stamp = $('[data-ftr-stamp]');
    if (stamp) stamp.innerHTML = `${esc(D().stampToday)}<small>${esc(D().dateLong(now))}</small>`;
    const year = $('[data-year]');
    if (year) year.textContent = `© ${now.getFullYear()}`;
  }

  /* ------------------------------------------------------------------------
     The calendar of excuses
     ------------------------------------------------------------------------ */
  const OFFSETS = [0, 6, 13, 20, 29, 41, 55, 68, 79];
  const INVOICE_AMOUNT = 12400;
  const cal = { pages: [], tag: { late: 0, paid: 0 }, odo: null };

  function buildCalendar() {
    const pad = $('[data-pad]');
    if (!pad) return;
    pad.textContent = '';
    cal.pages = OFFSETS.map((off, i) => {
      const el = document.createElement('div');
      el.className = 'pg';
      if (i === 0) el.classList.add('pg--due');
      el.style.zIndex = String(OFFSETS.length - i);
      el.innerHTML = '<span class="pg__perf"></span><p class="pg__wd"></p><p class="pg__hol"></p><p class="pg__num"></p><p class="pg__mon"></p><span class="pg__rule"></span><p class="pg__lbl"></p><p class="pg__txt"></p><p class="pg__foot"><span class="pg__doy"></span></p><span class="pg__shade"></span><span class="pg__curl"></span>';
      if (i === OFFSETS.length - 1) {
        el.classList.add('pg--today');
        el.insertAdjacentHTML('beforeend', '<p class="pg__stamp stamp"><span data-pg-stamp></span><small data-pg-stampdate></small></p>');
      }
      if (!motion && i < OFFSETS.length - 1) el.hidden = true;
      pad.appendChild(el);
      return el;
    });
    cal.odo = new Odometer($('[data-tag-num]'), 2);
    if (motion) $('[data-tag]').classList.remove('is-paid');
    else { cal.tag.late = 79; cal.tag.paid = 1; $('[data-tag]').classList.add('is-paid'); }
    renderCalendar();
  }

  function renderTag() {
    const v = cal.tag.late * (1 - cal.tag.paid);
    cal.odo?.set(v);
    const unit = $('[data-tag-unit]');
    if (unit) unit.textContent = dayWord(Math.round(v));
  }

  function renderCalendar() {
    const due = addDays(today(), -79);
    const last = OFFSETS.length - 1;
    const no = `${addDays(due, -30).getFullYear()}-0147`;
    cal.pages.forEach((el, i) => {
      const d = addDays(due, OFFSETS[i]);
      const hol = holiday(d);
      el.classList.toggle('is-red', d.getDay() === 0 || !!hol);
      $('.pg__wd', el).textContent = dfmt(d, { weekday: 'long' });
      $('.pg__hol', el).textContent = hol || '';
      $('.pg__num', el).textContent = String(d.getDate());
      $('.pg__mon', el).textContent = `${dfmt(d, { month: 'long' })} ${d.getFullYear()}`;
      $('.pg__lbl', el).textContent = i === 0 ? `${D().labelDue} · ${D().invoiceRef(no)}` : i === last ? `${D().labelToday} · ${D().paidFoot(money(INVOICE_AMOUNT))}` : D().labelExcuse;
      $('.pg__txt', el).textContent = i === last ? D().noExcuses : D().q(D().excuses[i]);
      $('.pg__doy', el).textContent = D().doy(dayOfYear(d), daysInYear(d.getFullYear()) - dayOfYear(d));
      if (i === last) {
        $('[data-pg-stamp]', el).textContent = D().stampPaid;
        $('[data-pg-stampdate]', el).textContent = D().dateLong(d);
      }
    });
    const label = $('[data-tag-label]');
    if (label) label.textContent = D().tagLate;
    renderTag();
    renderExcuses();
  }

  function renderExcuses() {
    const ol = $('[data-excuses]');
    if (!ol) return;
    const due = addDays(today(), -79);
    const last = OFFSETS.length - 1;
    ol.innerHTML = OFFSETS.map((off, i) => {
      const d = addDays(due, off);
      const when = i === 0 ? `${D().labelDue}, ${D().listDate(d)}` : i === last ? `${D().labelToday}, ${D().listDate(d)}` : D().listDate(d);
      const text = i === last ? D().excToday : D().excuses[i];
      return `<li><time datetime="${iso(d)}">${esc(when)}</time><q>${esc(text)}</q></li>`;
    }).join('');
  }

  const hero = { tl: null, st: null, stampAt: 0 };

  function heroMotion() {
    const mm = gsap.matchMedia();
    mm.add({ desk: '(min-width: 900px)', mob: '(max-width: 899.98px)' }, ctx => {
      const { desk } = ctx.conditions;
      const track = $('[data-hero-track]');
      const stage = $('[data-hero-stage]');
      const copy = $('[data-hero-copy]');
      const calEl = $('[data-cal]');
      const flood = $('[data-flood]');
      const hint = $('[data-hint]');
      const tagEl = $('[data-tag]');
      const pages = cal.pages;
      const tears = pages.length - 1;
      const stampAt = 1 + tears;
      const stampEl = $('.pg__stamp', pages[tears]);
      const numEl = $('.pg__num', pages[tears]);
      let stamped = false;

      gsap.set(pages, { transformOrigin: '50% 0%', transformPerspective: 1700 });

      const restOffset = () => {
        const y0 = gsap.getProperty(stage, 'y') || 0;
        const r = calEl.getBoundingClientRect();
        const c = copy.getBoundingClientRect();
        return Math.max(0, c.bottom + 28 - (r.top - y0));
      };
      const floodPos = () => {
        const s = $('[data-hero-sticky]').getBoundingClientRect();
        const r = stage.getBoundingClientRect();
        const y0 = gsap.getProperty(stage, 'y') || 0;
        return { x: r.left - s.left + r.width / 2, y: r.top - y0 - s.top + r.height / 2 };
      };
      const floodScale = () => {
        const p = floodPos();
        const dx = Math.max(p.x, window.innerWidth - p.x);
        const dy = Math.max(p.y, window.innerHeight - p.y);
        return (Math.hypot(dx, dy) * 2) / 120 + 0.4;
      };

      const setStamped = on => {
        if (on === stamped) return;
        stamped = on;
        gsap.killTweensOf(cal.tag);
        if (on) {
          gsap.fromTo(stampEl, { opacity: 0, scale: 1.9 }, { opacity: 0.94, scale: 1, duration: 0.42, ease: 'back.out(2.4)' });
          gsap.to(numEl, { opacity: 0.16, duration: 0.5, delay: 0.12, ease: 'power2.out' });
          gsap.fromTo(pages[tears], { y: 0 }, { y: 5, duration: 0.07, yoyo: true, repeat: 1, ease: 'power2.out', delay: 0.16 });
          gsap.to(cal.tag, { paid: 1, duration: 0.9, delay: 0.2, ease: 'power3.inOut', onUpdate: renderTag });
          tagEl.classList.add('is-paid');
        } else {
          gsap.to(stampEl, { opacity: 0, scale: 1.25, duration: 0.2 });
          gsap.to(numEl, { opacity: 1, duration: 0.25 });
          gsap.to(cal.tag, { paid: 0, duration: 0.35, onUpdate: renderTag });
          tagEl.classList.remove('is-paid');
        }
      };

      const tl = gsap.timeline({ defaults: { ease: 'none' } });

      if (desk) {
        tl.to(calEl, { scale: 1.035, duration: 1, ease: 'sine.inOut' }, 0)
          .to(hint, { autoAlpha: 0, duration: 0.35 }, 0);
      } else {
        tl.fromTo(stage, { y: () => restOffset() }, { y: 0, duration: 0.85, ease: 'power2.inOut', immediateRender: true }, 0.15)
          .to(copy, { y: () => -copy.offsetHeight * 0.3, autoAlpha: 0, duration: 0.5, ease: 'power1.out' }, 0);
      }

      pages.slice(0, tears).forEach((p, i) => {
        const at = 1 + i;
        const side = i % 2 ? 1 : -1;
        const shade = $('.pg__shade', pages[i + 1]);
        const curl = $('.pg__curl', p);
        /* Pull the bottom edge toward you, rip at the perforation, let gravity take it. */
        tl.to(p, { rotationX: 20, y: 10, duration: 0.32, ease: 'sine.inOut' }, at)
          .to(curl, { opacity: 1, duration: 0.32 }, at)
          .to(shade, { opacity: 0.6, duration: 0.32 }, at)
          .to(p, { y: () => window.innerHeight * 1.02, duration: 0.68, ease: 'power2.in' }, at + 0.32)
          .to(p, { rotationX: 52, duration: 0.68, ease: 'power1.in' }, at + 0.32)
          .to(p, { x: side * (30 + ((i * 37) % 60)), rotationZ: side * (6 + ((i * 5) % 8)), duration: 0.68, ease: 'power1.in' }, at + 0.32)
          .to(p, { autoAlpha: 0, duration: 0.2 }, at + 0.8)
          .to(shade, { opacity: 0, duration: 0.45 }, at + 0.5)
          .fromTo(cal.tag, { late: OFFSETS[i] }, { late: OFFSETS[i + 1], duration: 1, immediateRender: false, onUpdate: renderTag }, at);
      });

      tl.to({}, { duration: 0.9 }, stampAt);
      tl.fromTo(flood, { scale: 0 }, { scale: () => floodScale(), duration: 1.1, ease: 'power2.in', immediateRender: false }, stampAt + 0.9);

      const placeFlood = () => { const p = floodPos(); gsap.set(flood, { x: p.x, y: p.y }); };
      placeFlood();

      tl.eventCallback('onUpdate', () => {
        const t = tl.time();
        setStamped(t >= stampAt - 0.02);
        if (!desk) { dockFlags.hero = t > 0.85; updateDock(); }
      });

      const st = ScrollTrigger.create({
        trigger: track,
        start: 'top top',
        end: 'bottom bottom',
        animation: tl,
        scrub: 0.6,
        invalidateOnRefresh: true,
        onRefresh: placeFlood,
      });

      hero.tl = tl;
      hero.st = st;
      hero.stampAt = stampAt;

      return () => {
        hero.tl = null;
        hero.st = null;
        stamped = false;
        cal.tag.paid = 0;
        tagEl.classList.remove('is-paid');
        gsap.set([stampEl, numEl], { clearProps: 'opacity,transform' });
        renderTag();
      };
    });
  }

  /* Click or tap the calendar: tear the next page (scrolls to it). */
  function initCalendarAdvance() {
    const advance = () => {
      if (!hero.tl || !hero.st) return;
      const t = hero.tl.time();
      const target = Math.min(hero.stampAt + 0.5, Math.max(2, Math.floor(t + 0.001) + 1));
      const y = hero.st.start + (hero.st.end - hero.st.start) * (target / hero.tl.duration());
      if (lenis) lenis.scrollTo(y, { duration: 0.9 }); else window.scrollTo({ top: y, behavior: 'smooth' });
    };
    $('[data-cal]')?.addEventListener('click', advance);
    $('[data-hint]')?.addEventListener('click', advance);
  }

  /* The calendar hangs on a nail: it sways a little under the cursor. */
  function initSway() {
    if (!motion || !mq.fine.matches) return;
    const c = $('[data-cal]');
    let raf = 0, target = 0, cur = 0, vel = 0;
    const tick = () => {
      vel = (vel + (target - cur) * 0.06) * 0.84;
      cur += vel;
      c.style.rotate = `${(-1.2 + cur).toFixed(3)}deg`;
      raf = Math.abs(vel) > 0.0008 || Math.abs(target - cur) > 0.0008 ? requestAnimationFrame(tick) : 0;
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
    c.addEventListener('pointermove', e => {
      const r = c.getBoundingClientRect();
      target = ((e.clientX - r.left) / r.width - 0.5) * 2.6;
      kick();
    });
    c.addEventListener('pointerleave', () => { target = 0; kick(); });
  }

  /* ------------------------------------------------------------------------
     First-visit intro: 79 days flip by, then the page is torn off
     ------------------------------------------------------------------------ */
  function intro() {
    const ov = $('[data-intro]');
    if (!ov || !root.classList.contains('intro-on')) return Promise.resolve(false);
    store.set('sessionStorage', 'danes-intro', '1');
    ov.style.animation = 'none';
    const page = $('[data-intro-page]');
    const wd = $('[data-intro-wd]');
    const num = $('[data-intro-num]');
    const mon = $('[data-intro-mon]');
    const stamp = $('[data-intro-stamp]');
    const due = addDays(today(), -79);
    const setDay = d => {
      wd.textContent = dfmt(d, { weekday: 'long' });
      num.textContent = String(d.getDate());
      mon.textContent = `${dfmt(d, { month: 'long' })} ${d.getFullYear()}`;
      num.style.color = d.getDay() === 0 || holiday(d) ? 'var(--late)' : '';
    };
    setDay(due);

    return new Promise(resolve => {
      let done = false;
      let tearing = false;
      const tear = fast => {
        if (tearing) return;
        tearing = true;
        ov.style.background = 'transparent';
        const a = page.animate([
          { transform: 'perspective(1600px) rotateX(0deg) translateY(0) rotate(0deg)', opacity: 1 },
          { transform: 'perspective(1600px) rotateX(12deg) translateY(1.2vh) rotate(0deg)', opacity: 1, offset: 0.2 },
          { transform: 'perspective(1600px) rotateX(68deg) translateY(112vh) rotate(5deg)', opacity: 0 },
        ], { duration: fast ? 520 : 880, easing: 'cubic-bezier(.5,0,.75,.3)', fill: 'forwards' });
        resolve(true);
        a.finished.then(() => { ov.remove(); root.classList.remove('intro-on'); }).catch(() => { ov.remove(); root.classList.remove('intro-on'); });
      };
      const skip = () => { done = true; setDay(today()); tear(true); };
      ov.addEventListener('click', skip, { once: true });
      window.addEventListener('keydown', skip, { once: true });
      window.addEventListener('wheel', skip, { once: true, passive: true });
      window.addEventListener('touchstart', skip, { once: true, passive: true });

      const fontsReady = document.fonts?.ready || Promise.resolve();
      Promise.race([fontsReady, wait(500)]).then(() => {
        if (done) return;
        const start = performance.now();
        const DUR = 850;
        const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
        const step = now => {
          if (done) return;
          const p = Math.min(1, (now - start) / DUR);
          setDay(addDays(due, Math.round(ease(p) * 79)));
          if (p < 1) { requestAnimationFrame(step); return; }
          stamp.animate([
            { opacity: 0, transform: 'scale(1.8)' },
            { opacity: 1, transform: 'scale(.94)', offset: 0.6 },
            { opacity: 0.95, transform: 'scale(1)' },
          ], { duration: 380, easing: 'cubic-bezier(.3,1.5,.5,1)', fill: 'forwards' });
          num.animate([{ opacity: 1 }, { opacity: 0.14 }], { duration: 220, easing: 'ease-out', fill: 'forwards' });
          setTimeout(() => { if (!done) { done = true; tear(false); } }, 420);
        };
        requestAnimationFrame(step);
      });
    });
  }

  /* Hero entrance: lines rise, the calendar swings on its nail and settles. */
  function heroEnter() {
    if (!motion) return;
    const ease = 'cubic-bezier(.22,1,.36,1)';
    $$('.hero__h1 .line > span').forEach((s, i) => {
      s.animate([{ transform: 'translateY(108%)' }, { transform: 'translateY(0)' }], { duration: 1050, delay: 120 + i * 95, easing: ease, fill: 'backwards' });
    });
    $$('.hero__copy > :not(h1)').forEach((el, i) => {
      el.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 800, delay: 360 + i * 80, easing: ease, fill: 'backwards' });
    });
    const c = $('[data-cal]');
    c?.animate([
      { rotate: '-8deg', translate: '0 -34px', opacity: 0 },
      { rotate: '2.6deg', translate: '0 0', opacity: 1, offset: 0.42 },
      { rotate: '-2.9deg', offset: 0.64 },
      { rotate: '-0.2deg', offset: 0.82 },
      { rotate: '-1.2deg', translate: '0 0', opacity: 1 },
    ], { duration: 1700, delay: 140, easing: 'cubic-bezier(.33,1,.68,1)', fill: 'backwards' });
  }

  /* ------------------------------------------------------------------------
     Pivot: words ink in as you read; the underline is drawn by hand
     ------------------------------------------------------------------------ */
  const pivot = { tweens: [] };
  function splitWords(el) {
    const walk = node => {
      Array.from(node.childNodes).forEach(child => {
        if (child.nodeType === Node.TEXT_NODE) {
          if (!child.textContent.trim()) return;
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            const w = document.createElement('span');
            w.className = 'w';
            w.textContent = part;
            frag.appendChild(w);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName.toLowerCase() !== 'svg') {
          walk(child);
        }
      });
    };
    walk(el);
  }
  function pivotMotion() {
    pivot.tweens.forEach(t => { t.scrollTrigger?.kill(); t.kill(); });
    pivot.tweens = [];
    const p = $('.pivot__text');
    if (!p) return;
    splitWords(p);
    pivot.tweens.push(gsap.fromTo($$('.w', p), { opacity: 0.4 }, {
      opacity: 1, ease: 'none', stagger: 0.12,
      scrollTrigger: { trigger: p, start: 'top 84%', end: 'bottom 48%', scrub: 0.5 },
    }));
    const path = $('.u path', p);
    if (path) {
      pivot.tweens.push(gsap.fromTo(path, { strokeDasharray: 1, strokeDashoffset: 1 }, {
        strokeDashoffset: 0, ease: 'none',
        scrollTrigger: { trigger: $('.u', p), start: 'top 72%', end: 'top 46%', scrub: 0.5 },
      }));
    }
  }

  /* ------------------------------------------------------------------------
     How it works: the playhead runs through the morning and stamps each step
     ------------------------------------------------------------------------ */
  function howMotion() {
    const box = $('[data-tl]');
    if (!box) return;
    const steps = $$('.tl__step', box);
    const progress = $('[data-tl-progress]');
    const head = $('[data-tl-head]');
    const fill = $('[data-tl-fill]');
    const mm = gsap.matchMedia();
    mm.add({ desk: '(min-width: 900px)', mob: '(max-width: 899.98px)' }, ctx => {
      const { desk } = ctx.conditions;
      const list = $('.tl__list', box);
      const thresholds = () => (desk
        ? steps.map(s => Number(s.dataset.at) / 120)
        : steps.map(s => (s.offsetTop + 10) / Math.max(1, list.offsetHeight)));
      let marks = thresholds();
      const state = { p: 0 };
      const apply = () => {
        if (desk) gsap.set([progress, head], { xPercent: -100 + state.p * 100 });
        else fill.style.setProperty('--p', state.p.toFixed(4));
        steps.forEach((s, i) => s.classList.toggle('is-stamped', state.p >= marks[i] - 0.002));
      };
      apply();
      gsap.to(state, {
        p: 1, ease: 'none', onUpdate: apply,
        scrollTrigger: {
          trigger: desk ? box : list,
          start: desk ? 'top 72%' : 'top 70%',
          end: desk ? 'bottom 58%' : 'bottom 55%',
          scrub: 0.5,
          onRefresh: () => { marks = thresholds(); apply(); },
        },
      });
      return () => { steps.forEach(s => s.classList.remove('is-stamped')); fill.style.removeProperty('--p'); };
    });
  }

  function initLiveClock() {
    const el = $('[data-live-text]');
    if (!el) return () => {};
    const render = () => {
      const now = new Date();
      const w = payoutWhen(now);
      const cut = w.today ? D().cutToday : D().cutLater(dayPhrase(w.day, now));
      el.innerHTML = D().live(esc(timeFmt(now)), cut);
    };
    render();
    setTimeout(() => { render(); setInterval(render, 60000); }, 60000 - (Date.now() % 60000) + 50);
    return render;
  }

  /* ------------------------------------------------------------------------
     Services accordion
     ------------------------------------------------------------------------ */
  function initServices() {
    const items = $$('.svc__item');
    const set = (item, open) => {
      item.classList.toggle('is-open', open);
      $('.svc__btn', item).setAttribute('aria-expanded', String(open));
      $('.svc__panel', item).inert = !open;
    };
    items.forEach(item => {
      set(item, item.classList.contains('is-open'));
      $('.svc__btn', item).addEventListener('click', () => {
        const open = !item.classList.contains('is-open');
        items.forEach(o => { if (o !== item) set(o, false); });
        set(item, open);
      });
    });
  }

  /* ------------------------------------------------------------------------
     Calculator: what you get today, and the invoice that ages
     ------------------------------------------------------------------------ */
  const AMIN = 1000;
  const AMAX = 500000;
  const calc = { amount: INVOICE_AMOUNT, state: 'late', days: 79, region: 'si', lastDays: { late: 79, due: 30 }, shown: null };
  const niceAmount = a => {
    const step = a < 10000 ? 100 : a < 100000 ? 500 : 1000;
    return Math.min(AMAX, Math.max(AMIN, Math.round(a / step) * step));
  };
  const toSlider = a => Math.round((1000 * Math.log(a / AMIN)) / Math.log(AMAX / AMIN));
  const fromSlider = v => niceAmount(AMIN * (AMAX / AMIN) ** (v / 1000));
  function parseAmount(str) {
    let s = String(str).replace(/[\s  €]/g, '');
    s = lang === 'sl' ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    const v = Number.parseFloat(s);
    return Number.isFinite(v) ? v : NaN;
  }

  /* Illustrative pricing. Not yet due: financing cost to the due date. Overdue: risk grows with age. */
  function quote({ amount, state, days, region }) {
    const reg = { si: 0, eu: 0.6, world: 1.6 }[region];
    const tooOld = state === 'late' && days > 180;
    const raw = state === 'due' ? 1.2 + days * 0.03 + reg : 3 + days * 0.045 + reg;
    const pct = Math.round(Math.min(raw, 14) * 10) / 10;
    const fee = Math.max(45, Math.round(amount * pct) / 100);
    const collectPct = { si: 8, eu: 12, world: 15 }[region] + (state === 'late' && days > 120 ? 3 : 0);
    const collectFee = Math.round(amount * collectPct) / 100;
    return { pct, fee, payout: Math.max(0, amount - fee), tooOld, collectPct, collectFee };
  }

  let calcRender = () => {};
  function initCalc() {
    const form = $('[data-calc]');
    if (!form) return;
    const amountIn = $('#c-amount');
    const amountRange = $('#c-amount-range');
    const daysRange = $('#c-days');
    const daysLabel = $('[data-c-days-label]');
    const daysOut = $('[data-c-days-out]');
    const out = {
      label: $('[data-out-label]'),
      hero: $('[data-out-hero]'),
      when: $('[data-out-when]'),
      bar: $('[data-bar]'),
      amount: $('[data-out-amount]'),
      pct: $('[data-out-pct]'),
      feeLabel: $('[data-i18n="calc.rowFee"]'),
      fee: $('[data-out-fee]'),
      other: $('[data-out-other]'),
      payout: $('[data-out-payout]'),
      payLabel: $('.out__list .is-total dt'),
      alt: $('[data-out-alt]'),
      live: $('[data-calc-live]'),
    };
    const inv = {
      root: $('[data-invoice]'),
      no: $('[data-inv-no]'),
      issued: $('[data-inv-issued]'),
      due: $('[data-inv-due]'),
      terms: $('[data-inv-terms]'),
      amount: $('[data-inv-amount]'),
      total: $('[data-inv-total]'),
      status: $('[data-inv-status]'),
      state: $('[data-inv-state]'),
      days: $('[data-inv-days]'),
      stamps: $$('.invoice__stamps .stamp'),
    };
    const shown = { v: null };
    let liveTimer = 0;

    const setFill = r => r.style.setProperty('--fill', ((r.value - r.min) / (r.max - r.min)).toFixed(4));

    const renderHero = v => { out.hero.textContent = money0(v); };
    const tweenHero = to => {
      if (shown.v === null || !hasGsap || mq.reduce.matches) { shown.v = to; renderHero(to); return; }
      gsap.to(shown, { v: to, duration: 0.5, ease: 'power3.out', overwrite: true, onUpdate: () => renderHero(shown.v) });
    };

    function renderInvoice() {
      const late = calc.state === 'late';
      const t0 = today();
      const due = late ? addDays(t0, -calc.days) : addDays(t0, calc.days);
      const terms = late ? 30 : calc.days <= 30 ? 30 : calc.days <= 60 ? 60 : calc.days <= 90 ? 90 : 120;
      const issued = addDays(due, -terms);
      inv.no.textContent = `${issued.getFullYear()}-0147`;
      inv.issued.textContent = D().dateLong(issued);
      inv.due.textContent = D().dateLong(due);
      inv.terms.textContent = D().termsVal(terms);
      inv.amount.textContent = money(calc.amount);
      inv.total.textContent = money(calc.amount);
      inv.status.classList.toggle('is-ok', !late);
      inv.state.textContent = late ? D().invLate : D().invDue;
      inv.days.textContent = `${calc.days}\u00a0${dayWord(calc.days)}`;
      inv.root.style.setProperty('--aging', (late ? Math.min(1, calc.days / 200) : 0).toFixed(3));
      inv.root.classList.toggle('has-fold', late && calc.days >= 45);
      inv.root.classList.toggle('has-ring', late && calc.days >= 120);
      [8, 30, 60].forEach((limit, i) => inv.stamps[i]?.classList.toggle('is-on', late && calc.days >= limit));
    }

    function render() {
      const q = quote(calc);
      const late = calc.state === 'late';
      daysLabel.textContent = late ? D().daysLate : D().daysDue;
      daysOut.textContent = `${calc.days}\u00a0${dayWord(calc.days)}`;
      setFill(amountRange);
      setFill(daysRange);

      let pay, fee, pct;
      if (q.tooOld) {
        pay = calc.amount - q.collectFee; fee = q.collectFee; pct = q.collectPct;
        out.label.textContent = D().payLabelOld;
        out.when.textContent = D().whenOld;
        out.feeLabel.textContent = D().feeRowOld;
        out.payLabel.textContent = D().payLabelOld;
        out.alt.innerHTML = esc(D().altOld);
        out.alt.classList.add('is-warn');
      } else {
        pay = q.payout; fee = q.fee; pct = q.pct;
        out.label.textContent = tr('calc.payLabel');
        const w = payoutWhen();
        out.when.textContent = w.today ? D().whenToday : D().whenNext(dayPhrase(w.day, new Date()));
        out.feeLabel.textContent = tr('calc.rowFee');
        out.payLabel.textContent = tr('calc.payLabel');
        out.alt.innerHTML = D().alt(esc(pctFmt(q.collectPct)), esc(money(q.collectFee)));
        out.alt.classList.remove('is-warn');
      }
      tweenHero(pay);
      out.amount.textContent = money(calc.amount);
      out.pct.textContent = `(${pctFmt(pct)})`;
      out.fee.textContent = `−${money(fee)}`;
      out.other.textContent = money(0);
      out.payout.textContent = money(pay);
      out.bar.style.setProperty('--pay', String(pay));
      out.bar.style.setProperty('--fee', String(fee));
      out.bar.setAttribute('aria-label', D().barLabel(pctFmt(100 - pct), pctFmt(pct)));
      renderInvoice();

      clearTimeout(liveTimer);
      liveTimer = setTimeout(() => {
        out.live.textContent = q.tooOld ? D().calcLiveOld(money0(pay), pctFmt(pct)) : D().calcLive(money0(pay), pctFmt(pct));
      }, 700);
    }

    const syncAmountField = () => { amountIn.value = intFmt(calc.amount); };

    amountRange.addEventListener('input', () => {
      calc.amount = fromSlider(Number(amountRange.value));
      syncAmountField();
      render();
    });
    amountIn.addEventListener('input', () => {
      const v = parseAmount(amountIn.value);
      if (!Number.isFinite(v)) return;
      calc.amount = Math.min(AMAX, Math.max(AMIN, Math.round(v)));
      amountRange.value = String(toSlider(calc.amount));
      render();
    });
    amountIn.addEventListener('change', () => { syncAmountField(); amountRange.value = String(toSlider(calc.amount)); render(); });
    amountIn.addEventListener('focus', () => amountIn.select());
    daysRange.addEventListener('input', () => {
      calc.days = Number(daysRange.value);
      calc.lastDays[calc.state] = calc.days;
      render();
    });
    $$('input[name="state"]', form).forEach(r => r.addEventListener('change', () => {
      calc.state = r.value;
      calc.days = calc.lastDays[calc.state];
      daysRange.min = calc.state === 'late' ? '1' : '0';
      daysRange.max = calc.state === 'late' ? '240' : '120';
      daysRange.value = String(calc.days);
      render();
    }));
    $$('input[name="region"]', form).forEach(r => r.addEventListener('change', () => { calc.region = r.value; render(); }));
    form.addEventListener('submit', e => e.preventDefault());

    $('[data-prefill-calc]')?.addEventListener('click', () => {
      const q = quote(calc);
      prefillLead(q.tooOld ? 'collect' : 'buy', calc.amount);
    });

    amountRange.value = String(toSlider(calc.amount));
    syncAmountField();
    render();
    calcRender = () => {
      fmtCache.clear();
      syncAmountField();
      $('[data-fmt-min]').textContent = money0(AMIN);
      $('[data-fmt-max]').textContent = money0(AMAX);
      shown.v = null;
      render();
    };
    $('[data-fmt-min]').textContent = money0(AMIN);
    $('[data-fmt-max]').textContent = money0(AMAX);
  }

  /* ------------------------------------------------------------------------
     Set-off loop
     ------------------------------------------------------------------------ */
  const LOOP_BEFORE = [12000, 7000, 9000, 8000, 5000];
  const LOOP_MIN = Math.min(...LOOP_BEFORE);
  const loopState = { k: 0, settled: 0, done: false, running: false };
  let loopRender = () => {};

  function initLoop() {
    const btn = $('[data-loop-run]');
    if (!btn) return;
    const label = $('[data-loop-label]');
    const amts = $$('[data-amt]');
    const edges = $$('.edge-g .edge');
    const heads = $$('.edge-g .edge-head');
    const minus = $$('.minus');
    const pulse = $('[data-pulse]');
    const live = $('[data-loop-live]');
    const settledEl = $('[data-loop-settled]');
    const beforeEl = $('[data-loop-before]');
    const movedEl = $('[data-loop-moved]');
    const tbody = $('[data-loop-tbody]');
    const zero = LOOP_BEFORE.indexOf(LOOP_MIN);

    const amtsM = $$('[data-amt-m]');
    const chainEdges = $$('[data-chain-edge]');
    const chainMinus = $('[data-chain-minus]');
    const render = () => {
      amts.forEach((g, i) => { $('text', g).textContent = money0(Math.round(LOOP_BEFORE[i] - LOOP_MIN * loopState.k)); });
      amtsM.forEach(el => { const i = Number(el.dataset.amtM); el.textContent = money0(Math.round(LOOP_BEFORE[i] - LOOP_MIN * loopState.k)); });
      if (chainMinus) chainMinus.textContent = `−${money0(LOOP_MIN)}`;
      $$('text', $('[data-minus]')).forEach(t => { t.textContent = `−${money0(LOOP_MIN)}`; });
      settledEl.textContent = money0(Math.round(loopState.settled));
      beforeEl.textContent = money0(LOOP_BEFORE.reduce((a, b) => a + b, 0));
      movedEl.textContent = money0(0);
      const gone = loopState.k > 0.98;
      edges[zero].classList.toggle('is-gone', gone);
      heads[zero].style.opacity = gone ? '.16' : '';
      amts[zero].classList.toggle('is-cut', gone);
      chainEdges[zero]?.classList.toggle('is-gone', gone);
      $('.chain__amt', chainEdges[zero] || document.body)?.classList.toggle('is-cut', gone);
      label.textContent = loopState.done ? D().loopAgain : D().loopRun;
    };
    const renderTable = () => {
      const name = i => tr(`loop.n${i}`);
      tbody.innerHTML = LOOP_BEFORE.map((b, i) => `<tr><td>${esc(name(i))}</td><td>${esc(name((i + 1) % LOOP_BEFORE.length))}</td><td>${esc(money0(b))}</td><td>${esc(money0(b - LOOP_MIN))}</td></tr>`).join('');
    };
    loopRender = () => { render(); renderTable(); };
    loopRender();

    const finish = () => {
      loopState.running = false;
      loopState.done = true;
      render();
      live.textContent = D().loopDone;
    };

    btn.addEventListener('click', () => {
      if (loopState.running) return;
      live.textContent = '';
      loopState.k = 0; loopState.settled = 0; loopState.done = false;
      render();
      if (!hasGsap || mq.reduce.matches) {
        loopState.k = 1; loopState.settled = LOOP_MIN * LOOP_BEFORE.length;
        finish();
        return;
      }
      loopState.running = true;
      const tl = gsap.timeline({ onComplete: () => { chainEdges.forEach(e => e.classList.remove('is-hot')); finish(); } });
      chainEdges.forEach((e, i) => {
        tl.call(() => e.classList.add('is-hot'), null, 0.08 + i * 0.22);
        tl.call(() => e.classList.remove('is-hot'), null, 0.08 + i * 0.22 + 0.5);
      });
      if (chainMinus) tl.fromTo(chainMinus, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.3 }, 0.6).to(chainMinus, { opacity: 0, duration: 0.4 }, 2.5);
      tl.set(pulse, { opacity: 1, strokeDasharray: '13 87', strokeDashoffset: 100 }, 0)
        .to(pulse, { strokeDashoffset: 0, duration: 1.3, ease: 'power1.inOut' }, 0)
        .to(pulse, { opacity: 0, duration: 0.3 }, 1.05)
        .to(minus, { opacity: 1, duration: 0.3, stagger: 0.07 }, 0.55)
        .to(loopState, { k: 1, duration: 1, ease: 'power2.inOut', onUpdate: render }, 1)
        .to(loopState, { settled: LOOP_MIN * LOOP_BEFORE.length, duration: 1, ease: 'power2.out', onUpdate: render }, 1)
        .to(minus, { opacity: 0, duration: 0.4 }, 2.5);
    });
  }

  /* ------------------------------------------------------------------------
     Submit form
     ------------------------------------------------------------------------ */
  let receiptRender = () => {};
  function prefillLead(need, amount) {
    const r = $(`input[name="need"][value="${need}"]`);
    if (r) r.checked = true;
    if (amount) $('#f-amount').value = intFmt(amount);
  }

  function initLead() {
    const form = $('[data-lead]');
    const receipt = $('[data-receipt]');
    if (!form || !receipt) return;
    const f = { company: $('#f-company'), email: $('#f-email'), consent: $('#f-consent') };
    const err = { company: $('#f-company-err'), email: $('#f-email-err'), consent: $('#f-consent-err') };
    const ok = {
      company: () => f.company.value.trim().length >= 2,
      email: () => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.value.trim()),
      consent: () => f.consent.checked,
    };
    const show = (k, bad) => { err[k].hidden = !bad; f[k].setAttribute('aria-invalid', bad ? 'true' : 'false'); };
    Object.keys(f).forEach(k => {
      const ev = k === 'consent' ? 'change' : 'blur';
      f[k].addEventListener(ev, () => { if (k === 'consent' || f[k].dataset.touched) show(k, !ok[k]()); });
      f[k].addEventListener('input', () => { f[k].dataset.touched = '1'; if (!err[k].hidden) show(k, !ok[k]()); });
    });

    $$('[data-prefill-need]').forEach(a => a.addEventListener('click', () => prefillLead(a.dataset.prefillNeed)));

    const drop = $('[data-drop]');
    const file = $('#f-file');
    const dropText = $('[data-drop-text]');
    const showFile = () => {
      const name = file.files?.[0]?.name;
      if (name) dropText.innerHTML = `<span class="drop__name">${esc(name)}</span>`;
      else dropText.innerHTML = `<span data-i18n="form.drop">${tr('form.drop')}</span>`;
    };
    file.addEventListener('change', showFile);
    ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('is-over'); }));
    ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, () => drop.classList.remove('is-over')));
    drop.addEventListener('drop', e => {
      e.preventDefault();
      if (e.dataTransfer?.files?.length) { try { file.files = e.dataTransfer.files; } catch { /* read-only FileList */ } showFile(); }
    });

    const amount = $('#f-amount');
    amount.addEventListener('change', () => {
      const v = parseAmount(amount.value);
      if (Number.isFinite(v) && v > 0) amount.value = intFmt(Math.round(v));
    });

    let submittedAt = null;
    receiptRender = () => {
      if (!submittedAt) return;
      const now = submittedAt;
      const mins = now.getHours() * 60 + now.getMinutes();
      let deadline;
      if (isWorkday(now) && mins >= 8 * 60 && mins < 16 * 60) {
        deadline = D().deadlineSame(esc(timeFmt(new Date(now.getTime() + 60 * 60000))));
      } else {
        const day = isWorkday(now) && mins < 8 * 60 ? now : nextWorkday(now);
        deadline = D().deadlineNext(dayPhrase(day, now));
      }
      $('[data-receipt-text]').innerHTML = D().receipt(esc(timeFmt(now)), deadline);
      $('[data-receipt-stampdate]').textContent = `${D().dateLong(now)} · ${timeFmt(now)}`;
    };

    form.addEventListener('submit', e => {
      e.preventDefault();
      let first = null;
      Object.keys(f).forEach(k => { const good = ok[k](); show(k, !good); if (!good && !first) first = f[k]; });
      if (first) { first.focus(); return; }
      submittedAt = new Date();
      receiptRender();
      form.hidden = true;
      receipt.hidden = false;
      receipt.classList.remove('is-in');
      void receipt.offsetWidth;
      receipt.classList.add('is-in');
      receipt.focus({ preventScroll: true });
      const r = receipt.getBoundingClientRect();
      if (r.top < 80 || r.bottom > window.innerHeight) goTo($('#oddaj'));
    });

    $('[data-receipt-reset]').addEventListener('click', () => {
      submittedAt = null;
      form.reset();
      Object.keys(f).forEach(k => { delete f[k].dataset.touched; show(k, false); f[k].removeAttribute('aria-invalid'); });
      showFile();
      receipt.hidden = true;
      form.hidden = false;
      f.company.focus();
    });
  }

  /* ------------------------------------------------------------------------
     Reveal on enter (from a visible resting state)
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

  /* ------------------------------------------------------------------------
     Language switch (View Transition where supported)
     ------------------------------------------------------------------------ */
  let renderLive = () => {};
  function renderAllDynamic() {
    fmtCache.clear();
    run('dates', renderDates);
    run('calendar', renderCalendar);
    run('live', renderLive);
    run('calc', calcRender);
    run('loop', loopRender);
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
      if (motion) run('pivot', pivotMotion);
      store.set('localStorage', 'danes-lang', next);
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

  /* Midnight: the date is part of the identity, so it rolls over live. */
  function scheduleMidnight() {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
    setTimeout(() => { renderAllDynamic(); scheduleMidnight(); }, next - now);
  }

  /* ------------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------------ */
  captureSL();
  if (lang !== 'sl') run('i18n', applyStatic);
  root.classList.remove('i18n-pending');
  $$('[data-set-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.setLang === lang)));

  run('scroll', initScroll);
  run('dates', renderDates);
  run('calendar', buildCalendar);
  run('header', initHeader);
  run('menu', initMenu);
  run('anchors', initAnchors);
  run('spy', initSpy);
  run('dock', initDock);
  run('services', initServices);
  run('calc', initCalc);
  run('loop', initLoop);
  run('lead', initLead);
  run('lang', initLangButtons);
  renderLive = run('live', initLiveClock) || (() => {});
  run('midnight', scheduleMidnight);

  if (motion) {
    run('hero', heroMotion);
    run('advance', initCalendarAdvance);
    run('sway', initSway);
    run('pivot', pivotMotion);
    run('how', howMotion);
    run('reveals', initReveals);
    intro().then(played => { run('enter', heroEnter); if (played) ScrollTrigger.refresh(); });
    document.fonts?.ready.then(() => ScrollTrigger.refresh());
  }
})();
