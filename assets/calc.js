// Missed-Call Calculator — shared by /detailing and /tattoo.
// The page sets <body data-niche="auto|tattoo">; values come from assets/config.js
// (generated from .env + config/niches.js by scripts/build-site.js).
(function () {
  'use strict';

  const CFG = window.CM_CONFIG;
  const nicheKey = document.body.dataset.niche;
  const niche = CFG && CFG.niches[nicheKey];
  if (!niche) {
    document.getElementById('calc-error').textContent = 'Calculator config missing. Please try again later.';
    return;
  }

  const $ = (id) => document.getElementById(id);
  const usd = (n) => '$' + Math.round(n).toLocaleString('en-US');

  // ---------- inputs: slider + number box kept in sync ----------
  const FIELDS = ['callsPerWeek', 'missedPct', 'avgTicket', 'closeRate'];
  const values = {};

  function clamp(el, v) {
    const min = Number(el.min), max = Number(el.max);
    if (!Number.isFinite(v)) return min;
    return Math.min(max, Math.max(min, v));
  }

  for (const f of FIELDS) {
    const range = $(`r-${f}`);
    const box = $(`n-${f}`);
    const start = niche.defaults[f];
    // Let the number box go past the slider range for big shops.
    range.value = start;
    box.value = start;
    values[f] = start;

    range.addEventListener('input', () => {
      values[f] = Number(range.value);
      box.value = range.value;
      render();
    });
    box.addEventListener('input', () => {
      if (box.value === '') return;
      const v = Math.max(0, Number(box.value));
      if (!Number.isFinite(v)) return;
      values[f] = f.endsWith('Pct') || f === 'closeRate' ? Math.min(100, v) : v;
      range.value = clamp(range, values[f]);
      render();
    });
    box.addEventListener('blur', () => { box.value = values[f]; });
  }

  // ---------- math ----------
  function monthlyLoss() {
    const { callsPerWeek, missedPct, avgTicket, closeRate } = values;
    return callsPerWeek * (missedPct / 100) * (closeRate / 100) * avgTicket * (52 / 12);
  }

  function render() {
    const m = monthlyLoss();
    $('out-month').textContent = usd(m);
    $('out-year').textContent = usd(m * 12);
    const jobs = m / niche.compareValue;
    const n = jobs >= 10 ? Math.round(jobs) : Math.round(jobs * 10) / 10;
    $('out-compare').textContent = m > 0
      ? `That's roughly ${n.toLocaleString('en-US')} ${niche.compareLabel} a month.`
      : '';
  }
  render();

  // ---------- gate form ----------
  const form = $('gate-form');
  const select = $('f-business-type');
  for (const t of niche.businessTypes) {
    const o = document.createElement('option');
    o.value = t; o.textContent = t;
    select.appendChild(o);
  }

  const params = new URLSearchParams(location.search);
  const utm = (k, d = '') => (params.get(k) || d).slice(0, 100);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('form-error');
    err.textContent = '';
    if (!form.reportValidity()) return;

    const btn = $('submit-btn');
    btn.disabled = true;
    btn.textContent = 'Sending…';

    const fd = new FormData(form);
    const email = String(fd.get('email') || '').trim();
    const business = String(fd.get('business') || '').trim();
    const payload = {
      access_key: CFG.formAccessKey,
      subject: `Calculator lead (${nicheKey}): ${business}`,
      from_name: 'Missed-Call Calculator',
      replyto: email,
      botcheck: String(fd.get('botcheck') || ''),
      name: String(fd.get('name') || '').trim(),
      business,
      email,
      phone: String(fd.get('phone') || '').trim(),
      business_type: String(fd.get('business_type') || ''),
      tips_opt_in: fd.get('tips_opt_in') ? 'yes' : 'no',
      niche: nicheKey,
      calc_monthly_loss: String(Math.round(monthlyLoss())),
      calc_calls_per_week: String(values.callsPerWeek),
      calc_missed_pct: String(values.missedPct),
      calc_avg_ticket: String(values.avgTicket),
      calc_close_rate: String(values.closeRate),
      utm_source: utm('utm_source', 'direct'),
      utm_medium: utm('utm_medium'),
      utm_campaign: utm('utm_campaign'),
      page: location.pathname,
    };

    try {
      const res = await fetch(CFG.formEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.success !== true) {
        const code = body.code || '';
        if (code === 'rate_limited') throw new Error('Too many tries in a row. Wait a minute and try again.');
        if (code === 'quota_reached') throw new Error('Our form is temporarily full. Email michael@chubbymonkeyai.com and I\'ll send it over.');
        throw new Error(body.message || 'Something went wrong. Please try again.');
      }
      showThanks(payload.name);
    } catch (ex) {
      err.textContent = ex.message === 'Failed to fetch'
        ? 'Couldn\'t reach the server. Check your connection and try again.'
        : ex.message;
      btn.disabled = false;
      btn.textContent = 'Email me the breakdown';
    }
  });

  function showThanks(name) {
    $('gate').hidden = true;
    const t = $('thanks');
    $('thanks-name').textContent = name ? `, ${name.split(/\s+/)[0]}` : '';
    $('book-link').href = CFG.bookingUrl;
    t.hidden = false;
    t.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
})();
