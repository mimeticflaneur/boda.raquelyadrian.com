(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BodaIngest = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  async function post(url, payload) {
    const response = await fetch(url, {
      method: 'POST', signal: AbortSignal.timeout(25000),
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload)
    });
    let data;
    try { data = await response.json(); } catch (_) { data = {}; }
    if (!data || typeof data !== 'object' || Array.isArray(data)) data = {};
    const receipt = !url.endsWith('/api/rsvp') || typeof data.id === 'string';
    return { ok: response.ok && data.ok === true && receipt, data };
  }
  let last = {};
  async function submissionId(payload) {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)));
    const hash = Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
    try { last = JSON.parse(sessionStorage.getItem('boda-rsvp-request') || '{}'); } catch (_) { /* Storage is optional. */ }
    if (last.hash !== hash || !last.id) last = { hash, id: crypto.randomUUID() };
    try { sessionStorage.setItem('boda-rsvp-request', JSON.stringify(last)); } catch (_) { /* Memory still covers retries. */ }
    return last.id;
  }
  return { post, submissionId };
});
