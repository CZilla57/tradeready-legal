/*
 * esign.js — shared e-signature UI for estimate.html, change.html and
 * verify.html (TradeReady Roadmap Phase 19, "E-signatures with audit trail").
 *
 * The disclosure, checkbox label and intent statement are NOT written here:
 * the Worker renders them (view / change-view `esign`) and the Worker hashes
 * exactly that text into the sealed record, so this file only displays what
 * it is given. Everything inserted into the page goes through esc().
 *
 * No dependencies; plain ES5-style so older Safari runs it. Exposes
 * window.TREsign.
 */
(function () {
  'use strict';

  var API_ROOT = 'https://tradeready-backend.tradeready.workers.dev/api';
  var BOX_W = 600;
  var BOX_H = 200;
  // Below the Worker's caps (40 strokes, 2,000 points, 24 KB of JSON) with
  // room to spare, so a long signature never fails server-side.
  var MAX_STROKES = 40;
  var MAX_POINTS = 1200;
  var MAX_STROKE_MS = 3600000;
  var MIN_STEP = 3;
  var MAX_DRAWN_BYTES = 24 * 1024;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function q(params) {
    var parts = [];
    for (var k in params) {
      if (Object.prototype.hasOwnProperty.call(params, k) && params[k] != null && params[k] !== '') {
        parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k]));
      }
    }
    return parts.join('&');
  }

  // ── URLs ──────────────────────────────────────────────────────────────
  function previewUrl(link) { return API_ROOT + '/esign/preview?' + q({ j: link.jobId, t: link.token, c: link.changeOrderId }); }
  function copyUrl(link, format) { return API_ROOT + '/esign/copy?' + q({ j: link.jobId, t: link.token, c: link.changeOrderId, format: format || 'pdf' }); }
  function verifyPageUrl(recordId, digest) { return 'verify.html?' + q({ r: recordId, d: digest }); }

  // ── Document extras (scope / terms, from the frozen snapshot) ─────────
  function scopeHtml(est, documentType) {
    if (!est.scope) return '';
    return '<section class="doc-section" id="docScope"><h2>' + (documentType === 'change_order' ? 'Description of the change' : 'Scope of work') + '</h2>' +
      '<p class="pre">' + esc(est.scope) + '</p></section>';
  }
  function termsHtml(est) {
    if (!est.terms) return '';
    return '<section class="doc-section" id="docTerms"><h2>Terms</h2><p class="pre">' + esc(est.terms) + '</p></section>';
  }

  // ── Agree and sign block (spec §3.1, in this order) ───────────────────
  // texts = the Worker's `esign` object. link = {jobId, token, changeOrderId}.
  function blockHtml(texts, link, documentType) {
    var noun = documentType === 'change_order' ? 'change order' : 'estimate';
    var d = texts.disclosure || { title: '', intro: '', items: [] };
    var items = (d.items || []).map(function (i) {
      return '<li><strong>' + esc(i.label) + '</strong> ' + esc(i.text) + '</li>';
    }).join('');
    var pad = texts.drawPad
      ? '<p class="field-label" id="esignPadLabel">Draw your signature (optional)</p>' +
        '<p class="muted small" id="esignPadHelp">Optional. Your typed name is enough to sign.</p>' +
        '<canvas id="esignPad" class="sig-pad" width="' + BOX_W + '" height="' + BOX_H + '" role="img" ' +
        'aria-labelledby="esignPadLabel" aria-describedby="esignPadHelp"></canvas>' +
        '<button type="button" class="secondary" id="esignClear">Clear drawing</button>'
      : '';
    return '<section class="esign" id="esignBlock" aria-labelledby="esignHeading">' +
      '<h2 id="esignHeading">Agree and sign</h2>' +
      '<p class="small"><a id="esignPreview" href="' + esc(previewUrl(link)) + '" target="_blank" rel="noopener">Download this ' + noun + ' (PDF)</a></p>' +
      '<div class="consent-row">' +
      '<input type="checkbox" id="esignConsent" aria-describedby="esignDisclosure">' +
      '<label for="esignConsent" class="consent-label">' + esc(texts.checkboxLabel) + '</label>' +
      '</div>' +
      '<button type="button" class="linkish" id="esignDisclosureToggle" aria-expanded="false" aria-controls="esignDisclosure">' +
      esc(texts.disclosureLinkLabel || 'Read the electronic records disclosure') + '</button>' +
      '<div id="esignDisclosure" class="disclosure" hidden>' +
      '<p><strong>' + esc(d.title) + '</strong> ' + esc(d.intro) + '</p><ul>' + items + '</ul></div>' +
      '<label for="signer">Your full name</label>' +
      '<input id="signer" autocomplete="name" maxlength="200" aria-required="true">' +
      pad +
      '<label for="esignEmail">Email me a signed copy (optional)</label>' +
      '<input id="esignEmail" type="email" autocomplete="email" inputmode="email" maxlength="254">' +
      '<p id="esignError" class="esign-error" role="alert" hidden></p>' +
      '<p id="esignIntent" class="intent">' + esc(texts.intent) + '</p>' +
      '<button type="button" class="approve" id="approveBtn" aria-describedby="esignIntent">' + esc(texts.approveLabel || 'Approve and sign') + '</button>' +
      '<button type="button" class="decline" id="declineBtn">Decline</button>' +
      '</section>';
  }

  // ── Signature pad (vanilla pointer events, vector strokes) ────────────
  function createPad(canvas) {
    var strokes = [];
    var current = null;
    var points = 0;
    var t0 = null;
    var ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
    if (ctx) {
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#111827';
    }
    function now() { return Date.now(); }
    function pos(e) {
      var r = canvas.getBoundingClientRect();
      var w = r.width || BOX_W;
      var h = r.height || BOX_H;
      var x = Math.round((e.clientX - r.left) * BOX_W / w);
      var y = Math.round((e.clientY - r.top) * BOX_H / h);
      return [Math.max(0, Math.min(BOX_W, x)), Math.max(0, Math.min(BOX_H, y))];
    }
    function stamp() { return Math.max(0, Math.min(MAX_STROKE_MS, Math.round(now() - t0))); }
    function down(e) {
      if (strokes.length >= MAX_STROKES || points >= MAX_POINTS) return;
      if (e.preventDefault) e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* not capturable */ }
      if (t0 === null) t0 = now();
      var p = pos(e);
      current = [[p[0], p[1], stamp()]];
      strokes.push(current);
      points += 1;
      if (ctx) { ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0] + 0.1, p[1]); ctx.stroke(); }
    }
    function move(e) {
      if (!current || points >= MAX_POINTS) return;
      var p = pos(e);
      var last = current[current.length - 1];
      if (Math.abs(p[0] - last[0]) + Math.abs(p[1] - last[1]) < MIN_STEP) return;
      current.push([p[0], p[1], stamp()]);
      points += 1;
      if (ctx) { ctx.beginPath(); ctx.moveTo(last[0], last[1]); ctx.lineTo(p[0], p[1]); ctx.stroke(); }
    }
    function up() { current = null; }
    if (canvas && canvas.addEventListener) {
      canvas.addEventListener('pointerdown', down);
      canvas.addEventListener('pointermove', move);
      canvas.addEventListener('pointerup', up);
      canvas.addEventListener('pointercancel', up);
      canvas.addEventListener('pointerleave', up);
    }
    return {
      clear: function () {
        strokes = []; current = null; points = 0; t0 = null;
        if (ctx) ctx.clearRect(0, 0, BOX_W, BOX_H);
      },
      // null when empty or a single dot ("not drawn"), like the Worker.
      value: function () {
        if (points < 2) return null;
        return { w: BOX_W, h: BOX_H, strokes: strokes.map(function (s) { return s.map(function (p) { return [p[0], p[1], p[2]]; }); }) };
      },
      // For tests and accessibility tooling only.
      _push: function (stroke) { strokes.push(stroke); points += stroke.length; },
    };
  }

  // Wires the block. Returns { collect(decision) → {error, focus} | {fields}, showError, clearError, setBusy }.
  function mountBlock(root) {
    var toggle = root.querySelector('#esignDisclosureToggle');
    var disclosure = root.querySelector('#esignDisclosure');
    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', open ? 'false' : 'true');
      disclosure.hidden = open;
    });
    var canvas = root.querySelector('#esignPad');
    var pad = canvas ? createPad(canvas) : null;
    var clearBtn = root.querySelector('#esignClear');
    if (clearBtn && pad) clearBtn.addEventListener('click', function () { pad.clear(); });
    var errorEl = root.querySelector('#esignError');

    function showError(msg, focusEl) {
      errorEl.textContent = msg;
      errorEl.hidden = false;
      if (focusEl && focusEl.focus) focusEl.focus();
    }
    function clearError() { errorEl.textContent = ''; errorEl.hidden = true; }
    function setBusy(busy, label) {
      ['approveBtn', 'declineBtn'].forEach(function (id) {
        var b = root.querySelector('#' + id);
        if (b) b.disabled = !!busy;
      });
      var approve = root.querySelector('#approveBtn');
      if (approve) {
        if (!approve.getAttribute('data-label')) approve.setAttribute('data-label', approve.textContent);
        approve.textContent = busy && label ? label : approve.getAttribute('data-label');
      }
    }
    function collect(decision) {
      clearError();
      var nameEl = root.querySelector('#signer');
      var name = (nameEl.value || '').trim();
      var emailEl = root.querySelector('#esignEmail');
      var email = (emailEl.value || '').trim();
      if (decision !== 'approved') return { fields: {} };
      var consent = root.querySelector('#esignConsent');
      if (!consent.checked) return { error: 'Please agree to use electronic records and signatures to sign.', focus: consent };
      if (!name) return { error: 'Please type your full name to sign.', focus: nameEl };
      if (email && !/^[^\s@<>()[\]",;:\\]+@[^\s@<>()[\]",;:\\]+\.[^\s@<>()[\]",;:\\]+$/.test(email)) {
        return { error: 'Please check the email address for your copy.', focus: emailEl };
      }
      var drawn = pad ? pad.value() : null;
      if (drawn && JSON.stringify(drawn).length > MAX_DRAWN_BYTES) {
        return { error: 'Your drawing is too detailed. Please clear it and try again, or sign with your typed name only.', focus: clearBtn };
      }
      return {
        fields: {
          signerName: name,
          consent: { accepted: true, version: 1 },
          drawn: drawn,
          signerEmail: email || null,
        },
      };
    }
    return { collect: collect, showError: showError, clearError: clearError, setBusy: setBusy, pad: pad };
  }

  // ── Signed view (§3.1: the document stays, plus the signature block) ──
  function strokesSvg(drawn, label) {
    if (!drawn || !drawn.strokes || !drawn.strokes.length) return '';
    var d = drawn.strokes.map(function (s) {
      return s.map(function (p, i) {
        var x = Number(p[0]) || 0;
        var y = Number(p[1]) || 0;
        return (i === 0 ? 'M' : 'L') + x + ' ' + y + (s.length === 1 ? ' L' + (x + 0.1) + ' ' + y : '');
      }).join(' ');
    }).join(' ');
    return '<svg class="sig-svg" viewBox="0 0 ' + BOX_W + ' ' + BOX_H + '" role="img" aria-label="' + esc(label || 'Drawn signature') + '">' +
      '<path d="' + esc(d) + '" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  function signedHtml(signed, link, documentType) {
    var noun = documentType === 'change_order' ? 'change order' : 'estimate';
    var when = signed.signedAt ? new Date(signed.signedAt) : null;
    var whenText = when && !isNaN(when.getTime())
      ? when.toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' }) + ' (' + signed.signedAt.replace('T', ' ').slice(0, 19) + ' UTC)'
      : '';
    var copy = signed.recordPending
      ? '<p class="note" id="copyPending">Your signed copy is being prepared. Reload this page in a few minutes to download it.</p>'
      : '<p><a class="download" id="downloadSigned" href="' + esc(copyUrl(link, 'pdf')) + '">Download signed copy (PDF)</a></p>' +
        '<p class="small"><a id="downloadRecord" href="' + esc(copyUrl(link, 'json')) + '">Download the signature record (JSON)</a> &middot; ' +
        '<a id="verifyLink" href="' + esc(verifyPageUrl(signed.recordId, signed.recordDigest)) + '">Check this record</a></p>';
    return '<section class="signed" id="signedBlock" aria-labelledby="signedHeading">' +
      '<h2 id="signedHeading">Signature</h2>' +
      '<p class="sig-name">' + esc(signed.typedName) + '</p>' +
      strokesSvg(signed.drawn, 'Drawn signature of ' + (signed.typedName || 'the signer')) +
      '<p class="muted small">Signed electronically' + (whenText ? ' on ' + esc(whenText) : '') + '.</p>' +
      '<p class="muted small">Record ID: <span class="mono">' + esc(signed.recordId) + '</span></p>' +
      '<p class="muted small">Fingerprint (SHA-256): <span class="mono">' + esc(signed.recordDigest) + '</span></p>' +
      copy +
      '<p class="muted small">Keep a copy of this signed ' + noun + ' for your records.</p>' +
      '</section>';
  }

  // ── Independent verification (verify.html) ────────────────────────────
  // Same encoding as the Worker's quoteOptions.canonicalJson: keys sorted,
  // undefined members skipped, JSON.stringify for everything else.
  function canonicalJson(value) {
    if (value === null || typeof value !== 'object') {
      var s = JSON.stringify(value);
      return s === undefined ? 'null' : s;
    }
    if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
    var keys = Object.keys(value).filter(function (k) { return value[k] !== undefined && typeof value[k] !== 'function'; }).sort();
    return '{' + keys.map(function (k) { return JSON.stringify(k) + ':' + canonicalJson(value[k]); }).join(',') + '}';
  }

  function hexOf(buf) {
    var bytes = new Uint8Array(buf);
    var out = '';
    for (var i = 0; i < bytes.length; i += 1) out += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16);
    return out;
  }
  function bytesOfHex(hex) {
    var out = new Uint8Array(hex.length / 2);
    for (var i = 0; i < out.length; i += 1) out[i] = parseInt(hex.substr(i * 2, 2), 16);
    return out;
  }
  function bytesOfBase64(b64) {
    var bin = atob(String(b64).replace(/\s+/g, ''));
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
    return out;
  }
  function sha256Hex(text) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(hexOf);
  }

  // envelope = the JSON from "Download the signature record". keys = {keyId: base64 raw}.
  // Resolves {digestOk, sealOk (true|false|null when the browser can't check), keyId}.
  function verifyEnvelope(envelope, keys) {
    if (!envelope || typeof envelope !== 'object' || !envelope.record || !envelope.seal) {
      return Promise.reject(new Error('This file is not a TradeReady signature record.'));
    }
    return sha256Hex(canonicalJson(envelope.record)).then(function (digest) {
      var digestOk = digest === envelope.recordDigest && envelope.record.recordId === envelope.recordId;
      var keyB64 = keys && keys[envelope.seal.keyId];
      if (!keyB64) return { digestOk: digestOk, sealOk: false, keyId: envelope.seal.keyId, digest: digest };
      return crypto.subtle.importKey('raw', bytesOfBase64(keyB64), { name: 'Ed25519' }, false, ['verify'])
        .then(function (key) {
          return crypto.subtle.verify({ name: 'Ed25519' }, key, bytesOfBase64(envelope.seal.signature), bytesOfHex(digest));
        })
        .then(function (ok) { return { digestOk: digestOk, sealOk: !!ok, keyId: envelope.seal.keyId, digest: digest }; },
          function () { return { digestOk: digestOk, sealOk: null, keyId: envelope.seal.keyId, digest: digest }; });
    });
  }

  window.TREsign = {
    API_ROOT: API_ROOT,
    esc: esc,
    previewUrl: previewUrl,
    copyUrl: copyUrl,
    verifyPageUrl: verifyPageUrl,
    scopeHtml: scopeHtml,
    termsHtml: termsHtml,
    blockHtml: blockHtml,
    mountBlock: mountBlock,
    createPad: createPad,
    strokesSvg: strokesSvg,
    signedHtml: signedHtml,
    canonicalJson: canonicalJson,
    sha256Hex: sha256Hex,
    verifyEnvelope: verifyEnvelope,
  };
})();
