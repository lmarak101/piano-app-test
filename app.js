/* app.js: user interface for the Piano Teacher prototype (Milestone 1.5: Learn + Play). */
(function () {
  'use strict';
  var E = window.Engine, C = window.Content;
  var app = document.getElementById('app');
  var KEY = 'pianoapp.v1';

  /* ---------------- storage ---------------- */
  function load() {
    try { var s = JSON.parse(localStorage.getItem(KEY)); if (s && s.profiles) return s; } catch (e) {}
    return { profiles: [], current: null };
  }
  var store = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} }
  function prof() { for (var i = 0; i < store.profiles.length; i++) if (store.profiles[i].id === store.current) return store.profiles[i]; return null; }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function cfgFor(p) { return E.masteryConfig(p.age); }
  function states(p) { p.states = E.ensureStates(C.SKILLS, p.states); return p.states; }
  // "Kid mode": ages 4-7 and anyone who cannot read yet. Voice-led, picture-led, short words, lots of repeating.
  function isKid(p) { return !!p && (p.age === '4-7' || p.reading === 'none'); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function ctxOf(p, kind) { p.ctx = p.ctx || {}; p.ctx[kind] = p.ctx[kind] || { last: null, same: 0 }; return p.ctx[kind]; }
  function skillTitle(id) { return C.skillById(id).title; }

  /* ---------------- audio ---------------- */
  var actx = null;
  function audio() {
    if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; } }
    if (actx && actx.state === 'suspended') { try { actx.resume(); } catch (e) {} }
    return actx;
  }
  function tone(note, dur, when, vol) {
    var a = audio(); if (!a) return;
    try {
      var t0 = (when || a.currentTime), o = a.createOscillator(), g = a.createGain();
      o.type = 'triangle'; o.frequency.value = 440 * Math.pow(2, (note - 69) / 12);
      g.gain.setValueAtTime(vol || 0.25, t0); g.gain.exponentialRampToValueAtTime(0.0008, t0 + (dur || 0.5));
      o.connect(g); g.connect(a.destination); o.start(t0); o.stop(t0 + (dur || 0.5) + 0.05);
    } catch (e) {}
  }
  function click(accent, when) {
    var a = audio(); if (!a) return;
    try {
      var o = a.createOscillator(), g = a.createGain();
      o.frequency.value = accent ? 1500 : 1000; g.gain.setValueAtTime(0.3, when); g.gain.exponentialRampToValueAtTime(0.001, when + 0.05);
      o.connect(g); g.connect(a.destination); o.start(when); o.stop(when + 0.07);
    } catch (e) {}
  }
  var voiceCache = null;
  function bestVoice() {
    if (voiceCache) return voiceCache;
    try {
      var vs = speechSynthesis.getVoices().filter(function (v) { return /^en/i.test(v.lang); });
      if (!vs.length) return null;
      var pref = vs.filter(function (v) { return /female|samantha|zira|google uk english female|google us english|aria|jenny/i.test(v.name); })[0];
      voiceCache = pref || vs[0]; return voiceCache;
    } catch (e) { return null; }
  }
  // Split "Keys on the left are LOW, like a bear" or "Tap the key called *C*" into plain parts and focus words.
  var FOCUS_RE = /\*([^*]+)\*|\b([A-Z]{2,}(?: [A-Z]{2,})*)\b/g;
  function parseFocus(text) {
    var parts = [], last = 0, m;
    FOCUS_RE.lastIndex = 0;
    while ((m = FOCUS_RE.exec(text))) {
      if (m.index > last) parts.push({ t: text.slice(last, m.index) });
      parts.push({ t: m[1] || m[2], focus: true }); last = m.index + m[0].length;
    }
    if (last < text.length) parts.push({ t: text.slice(last) });
    return parts;
  }
  function focusWords(text) { return parseFocus(text).filter(function (x) { return x.focus; }).map(function (x) { return x.t; }); }
  function plain(text) { return text.replace(/\*/g, ''); }
  function utter(text, rate, pitch) {
    var u = new SpeechSynthesisUtterance(text); u.lang = 'en-US'; u.rate = rate; u.pitch = pitch; u.volume = 1;
    var v = bestVoice(); if (v) u.voice = v; speechSynthesis.speak(u);
  }
  // Kids hear the sentence, and the important word said again and again IN the sentence:
  // "Keys on the left are ... low! ... low! ... low! ... like a big bear."
  function say(text) {
    var p = prof(); if (!p || !p.voice || !text || !('speechSynthesis' in window)) return;
    try {
      speechSynthesis.cancel();
      if (!isKid(p)) { utter(plain(text), 1, 1); return; }
      parseFocus(text).forEach(function (x) {
        var t = x.t.trim(); if (!t) return;
        if (x.focus) { var w = /^[A-G]$/.test(t) ? t : t.toLowerCase(); utter(w + '!', 0.65, 1.6); utter(w + '!', 0.65, 1.6); utter(w + '!', 0.7, 1.5); }
        else utter(t, 0.82, 1.25);
      });
    } catch (e) {}
  }
  var PRAISE = ['Yay! Great job! You did it!', 'Wow! Super! You are a star!', 'Hooray! Well done! Great playing!', 'Amazing! You did it, you did it!'];
  var TRYAGAIN = ['Oops! That is okay! Try again! You can do it!', 'Almost! Try again! You can do it!', 'Nice try! One more time! You can do it!'];
  var nudgeText = null, nudgeCount = 0, nudgeTimer = null;
  function armNudge(text) {
    clearTimeout(nudgeTimer); nudgeTimer = null;
    if (text !== undefined) { nudgeText = text; nudgeCount = 0; }
    var p = prof(); if (!nudgeText || !p || !isKid(p) || !p.voice || nudgeCount >= 2) return;
    nudgeTimer = setTimeout(function () {
      nudgeCount++; var m = document.querySelector('.mascot'); if (m) { m.classList.add('wiggle'); setTimeout(function () { m.classList.remove('wiggle'); }, 1200); }
      say(nudgeText); armNudge();
    }, 11000);
  }
  function stopNudge() { clearTimeout(nudgeTimer); nudgeTimer = null; nudgeText = null; }
  var timers = [];
  function clearTimers() { timers.forEach(clearTimeout); timers = []; stopNudge(); }
  function later(fn, ms) { var t = setTimeout(fn, Math.max(0, ms)); timers.push(t); return t; }

  function pulseCircle(label) {
    var c = document.getElementById('circ'); if (!c) return;
    if (label != null) c.textContent = label;
    c.classList.add('pulse'); setTimeout(function () { c.classList.remove('pulse'); }, 90);
  }
  function setOutline(k) {
    var bl = document.querySelectorAll('.pattern div');
    for (var j = 0; j < bl.length; j++) bl[j].style.outline = j === k ? '3px solid #ffd93d' : 'none';
  }
  // Play a described sound: { notes } | { clicks:{bpm,count,then} } | { pattern, bpm, note, clicks }.
  // Also lights keys and pulses the circle so learners can see what they hear.
  function playSpec(spec) {
    var a = audio(); if (!a || !spec) return 0;
    var t0 = a.currentTime + 0.05, ms = 0, i;
    if (spec.notes) {
      var gap = spec.notes.length > 12 ? 0.32 : (spec.notes.length === 1 ? 0.6 : 0.45);
      spec.notes.forEach(function (n, k) {
        tone(n, 0.5, t0 + k * gap);
        later(function () { var kb = document.querySelector('.kbwrap'); if (kb) lightKey(kb, n, 'k-target', gap * 1000 - 40); }, 50 + k * gap * 1000);
      });
      ms = spec.notes.length * gap * 1000;
    } else if (spec.clicks) {
      var c = spec.clicks, bm = 60 / c.bpm;
      for (i = 0; i < c.count; i++) { click(i % 4 === 0, t0 + i * bm); (function (i) { later(function () { pulseCircle(String(i % 4 + 1)); }, 50 + i * bm * 1000); })(i); }
      ms = c.count * bm * 1000;
      if (c.then) {
        var bm2 = 60 / c.then.bpm, off = c.count * bm + 0.4;
        for (i = 0; i < c.then.count; i++) { click(i % 4 === 0, t0 + off + i * bm2); (function (i) { later(function () { pulseCircle(String(i % 4 + 1)); }, 50 + (off + i * bm2) * 1000); })(i); }
        ms = (off + c.then.count * bm2) * 1000;
      }
    } else if (spec.pattern) {
      var beat = 60 / spec.bpm, sum = spec.pattern.reduce(function (x, y) { return x + y; }, 0), pos = 0;
      if (spec.clicks) for (i = 0; i < sum; i++) click(i % 4 === 0, t0 + i * beat);
      spec.pattern.forEach(function (d, k) {
        tone(spec.note || 72, d * beat * 0.92, t0 + pos * beat, 0.25);
        (function (k) { later(function () { setOutline(k); }, 50 + pos * beat * 1000); })(k);
        pos += d;
      });
      later(function () { setOutline(-1); }, 50 + sum * beat * 1000);
      ms = sum * beat * 1000;
    }
    return ms;
  }

  /* ---------------- input: MIDI + on-screen ---------------- */
  var Input = { handler: null, state: 'off', name: '' };
  function emit(note, t) { armNudge(); if (Input.handler) Input.handler(note, t || performance.now()); }
  function updateChip() {
    var el = document.getElementById('midichip'); if (!el) return;
    var map = {
      on: ['good', '🎹 ' + Input.name], none: ['bad', '🎹 No keyboard found. Tap to retry'],
      blocked: ['bad', '🎹 MIDI blocked. Tap to retry'], unsupported: ['bad', '🎹 MIDI not available here. Use the on-screen keys'],
      off: ['', '🎹 Tap to connect your keyboard']
    };
    var m = map[Input.state] || map.off; el.className = 'chip-status ' + m[0]; el.textContent = m[1];
  }
  function connectMIDI() {
    if (!navigator.requestMIDIAccess) { Input.state = 'unsupported'; updateChip(); return; }
    navigator.requestMIDIAccess({ sysex: false }).then(function (a) {
      function bind() {
        var names = [];
        a.inputs.forEach(function (i) {
          names.push(i.name);
          i.onmidimessage = function (ev) {
            var d = ev.data;
            if ((d[0] & 0xf0) === 0x90 && d[2] > 0) {
              var ts = ev.timeStamp > 0 && Math.abs(ev.timeStamp - performance.now()) < 5000 ? ev.timeStamp : performance.now();
              emit(d[1], ts);
            }
          };
        });
        Input.name = names.join(', '); Input.state = names.length ? 'on' : 'none'; updateChip();
      }
      a.onstatechange = bind; bind();
    }).catch(function () { Input.state = 'blocked'; updateChip(); });
  }

  /* ---------------- drawing ---------------- */
  function colorOf(m) { return C.COLORS[E.pcName(m)] || null; }

  // opts: { light:[notes], zones:[{lo,hi,color}], labels:bool, badges:{note:{t,c}} }
  function keyboardHTML(lo, hi, p, opts) {
    opts = opts || {};
    var whites = [], m, pos = {}, colored = p.reading !== 'fluent', letters = p.reading !== 'fluent' || opts.labels;
    for (m = lo; m <= hi; m++) if (E.isWhite(m)) whites.push(m);
    var kw = 40, H = isKid(p) ? 190 : 150, s = '';
    s += '<svg viewBox="0 0 ' + (whites.length * kw) + ' ' + H + '" xmlns="http://www.w3.org/2000/svg">';
    whites.forEach(function (n, i) {
      pos[n] = i * kw;
      s += '<rect class="k-w' + ((opts.light || []).indexOf(n) >= 0 ? ' k-target' : '') + '" data-note="' + n + '" x="' + (i * kw) + '" y="0" width="' + kw + '" height="' + H + '"/>';
      (opts.zones || []).forEach(function (z) { if (n >= z.lo && n <= z.hi) s += '<rect x="' + (i * kw + 1) + '" y="' + (H * 0.62) + '" width="' + (kw - 2) + '" height="' + (H * 0.38 - 1) + '" fill="' + z.color + '" opacity=".35" style="pointer-events:none"/>'; });
      if (colored && colorOf(n)) s += '<rect x="' + (i * kw + 2) + '" y="' + (H - 34) + '" width="' + (kw - 4) + '" height="30" rx="5" fill="' + colorOf(n) + '" style="pointer-events:none"/>';
      if (letters) s += '<text x="' + (i * kw + kw / 2) + '" y="' + (H - 12) + '" text-anchor="middle" font-size="13" font-weight="700" fill="' + (colored && colorOf(n) ? '#222' : '#666') + '" style="pointer-events:none">' + E.pcName(n) + '</text>';
      else if (E.pcName(n) === 'C') s += '<text x="' + (i * kw + kw / 2) + '" y="' + (H - 12) + '" text-anchor="middle" font-size="13" font-weight="700" fill="#666" style="pointer-events:none">C</text>';
    });
    for (m = lo; m <= hi; m++) if (!E.isWhite(m) && pos[m - 1] != null) {
      s += '<rect class="k-b' + ((opts.light || []).indexOf(m) >= 0 ? ' k-target' : '') + '" data-note="' + m + '" x="' + (pos[m - 1] + kw * 0.66) + '" y="0" width="' + (kw * 0.64) + '" height="' + (H * 0.6) + '" rx="3"/>';
    }
    var badges = opts.badges || {};
    for (var b in badges) if (pos[b] != null) {
      var cx = pos[b] + kw / 2, cy = H - 56;
      s += '<circle cx="' + cx + '" cy="' + cy + '" r="13" fill="' + badges[b].c + '" stroke="#222" stroke-width="1.5" style="pointer-events:none"/><text x="' + cx + '" y="' + (cy + 5) + '" text-anchor="middle" font-size="15" font-weight="800" fill="#111" style="pointer-events:none">' + badges[b].t + '</text>';
    }
    return s + '</svg>';
  }
  function kbRange(ex, p) {
    var ts = ex.targets && ex.targets.length ? ex.targets : [60];
    var lo = Math.floor(Math.min.apply(null, ts) / 12) * 12, oct = isKid(p) ? 1 : 2;
    if (ex.type === 'rhythm' || (ex.type === 'find' && ex.pitchClassOnly)) lo = 60;
    var hi = lo + 12 * oct, mx = Math.max.apply(null, ts);
    while (hi < mx) hi += 12;
    return [lo, hi];
  }
  function lightKey(root, note, cls, ms) {
    var els = root.querySelectorAll('rect[data-note="' + note + '"]'), r = els[0];
    if (!r) return;
    r.classList.add(cls); if (ms) setTimeout(function () { r.classList.remove(cls); }, ms);
  }
  function clearHint(root) { var l = root.querySelectorAll('.k-target'); for (var i = 0; i < l.length; i++) l[i].classList.remove('k-target'); }
  function bindKeys(root) {
    var svg = root && root.querySelector('svg'); if (!svg) return;
    svg.addEventListener('pointerdown', function (e) {
      var n = e.target && e.target.getAttribute && e.target.getAttribute('data-note'); if (!n) return;
      e.preventDefault(); n = +n; tone(n, 0.6); lightKey(root, n, 'k-ok', 140); emit(n, e.timeStamp > 0 ? e.timeStamp : performance.now());
    });
  }

  function staffHTML(ex, ctx, p) {
    var t = ex.targets || ex.notes, n = t.length, sp = 38, w = Math.max(260, 70 + n * sp), bottom = 84, hs = 6;
    var clef = ex.clef || 'treble', bdn = clef === 'bass' ? 18 : 30;
    function y(dn) { return bottom - (dn - bdn) * hs; }
    var s = '<svg width="' + w + '" height="130" xmlns="http://www.w3.org/2000/svg">', i;
    for (i = 0; i < 5; i++) s += '<line x1="4" x2="' + (w - 4) + '" y1="' + (bottom - i * 12) + '" y2="' + (bottom - i * 12) + '" stroke="#333" stroke-width="1.2"/>';
    s += '<text x="8" y="22" font-size="11" fill="#777">' + (clef === 'bass' ? 'bass clef (low notes)' : 'treble clef (high notes)') + '</text>';
    t.forEach(function (m, k) {
      var x = 56 + k * sp, dn = E.diatonic(m), yy = y(dn), ld;
      for (ld = bdn - 2; ld >= dn; ld -= 2) s += '<line x1="' + (x - 12) + '" x2="' + (x + 12) + '" y1="' + y(ld) + '" y2="' + y(ld) + '" stroke="#333" stroke-width="1.2"/>';
      for (ld = bdn + 10; ld <= dn; ld += 2) s += '<line x1="' + (x - 12) + '" x2="' + (x + 12) + '" y1="' + y(ld) + '" y2="' + y(ld) + '" stroke="#333" stroke-width="1.2"/>';
      var fill = k < ctx.done ? '#2fb77d' : (k === ctx.done ? '#2f8bf5' : (colorOf(m) && p.reading !== 'fluent' ? colorOf(m) : '#222'));
      s += '<ellipse cx="' + x + '" cy="' + yy + '" rx="8" ry="6" fill="' + fill + '" stroke="#222" stroke-width="1"/>';
      if (ex.fingers && ex.fingers[k]) s += '<text x="' + x + '" y="122" text-anchor="middle" font-size="14" font-weight="700" fill="#444">' + ex.fingers[k] + '</text>';
      if (ctx.names) s += '<text x="' + x + '" y="108" text-anchor="middle" font-size="12" fill="#666">' + E.pcName(m) + '</text>';
    });
    return s + '</svg>';
  }

  // Top-down view of a hand, as the player sees their own hand over the keys.
  function oneHand(x0, hand, o) {
    var kw = 48, base = 100, len = { 1: 46, 2: 64, 3: 72, 4: 64, 5: 50 }, names = C.FINGER_NAMES;
    var order = hand === 'R' ? [1, 2, 3, 4, 5] : [5, 4, 3, 2, 1];
    var col = o.neutral ? '#9aa1ad' : C.HAND_COLORS[hand], s = '';
    order.forEach(function (f, i) {
      var cx = x0 + i * kw + kw / 2, tip = base - len[f];
      s += '<rect x="' + (cx - 15) + '" y="' + tip + '" width="30" height="' + (len[f] + 14) + '" rx="15" fill="' + col + '" stroke="#222" stroke-width="1.5"/>';
      s += '<text x="' + cx + '" y="' + (tip + 21) + '" text-anchor="middle" font-size="18" font-weight="800" fill="#111">' + f + '</text>';
      if (o.names) s += '<text x="' + cx + '" y="' + (base + 74) + '" text-anchor="middle" font-size="11" fill="#cfd3da">' + names[f] + '</text>';
    });
    s += '<rect x="' + (x0 + 4) + '" y="' + base + '" width="' + (5 * kw - 8) + '" height="54" rx="24" fill="' + col + '" stroke="#222" stroke-width="1.5"/>';
    if (o.sticker || o.letter) s += '<circle cx="' + (x0 + 2.5 * kw) + '" cy="' + (base + 27) + '" r="17" fill="#fff" stroke="#222"/><text x="' + (x0 + 2.5 * kw) + '" y="' + (base + 34) + '" text-anchor="middle" font-size="22" font-weight="800" fill="#111">' + hand + '</text>';
    if (o.keys) {
      var notes = hand === 'R' ? [60, 62, 64, 65, 67] : [48, 50, 52, 53, 55], ky = base + 62;
      notes.forEach(function (n, i) { s += '<rect x="' + (x0 + i * kw) + '" y="' + ky + '" width="' + kw + '" height="74" fill="#f4f4f4" stroke="#444"/><text x="' + (x0 + i * kw + kw / 2) + '" y="' + (ky + 66) + '" text-anchor="middle" font-size="14" font-weight="700" fill="#555">' + E.pcName(n) + '</text>'; });
      [1, 2, 4].forEach(function (b) { s += '<rect x="' + (x0 + b * kw - 12) + '" y="' + ky + '" width="24" height="44" rx="3" fill="#15171b"/>'; });
    }
    return s;
  }
  function handsHTML(hand, o) {
    o = o || {};
    var H = o.keys ? 240 : (o.names ? 196 : 170), W = hand === 'both' ? 540 : 240;
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + (hand === 'both' ? 330 : 250) + '" xmlns="http://www.w3.org/2000/svg">';
    if (hand === 'both') {
      s += oneHand(0, 'L', o) + oneHand(300, 'R', o);
      s += '<text x="120" y="' + (H - 4) + '" text-anchor="middle" font-size="18" font-weight="800" fill="' + (o.neutral ? '#9aa1ad' : C.HAND_COLORS.L) + '">LEFT</text><text x="420" y="' + (H - 4) + '" text-anchor="middle" font-size="18" font-weight="800" fill="' + (o.neutral ? '#9aa1ad' : C.HAND_COLORS.R) + '">RIGHT</text>';
    } else s += oneHand(0, hand, o);
    return s + '</svg>';
  }
  function blocksHTML(pattern, o) {
    o = o || {}; var u = o.small ? 26 : 46;
    return '<div class="pattern">' + pattern.map(function (d) { return '<div style="width:' + (d * u) + 'px' + (o.small ? ';height:26px;font-size:11px' : '') + '">' + (o.small ? '' : (d === 1 ? 'short' : (d === 2 ? 'long' : 'very long'))) + '</div>'; }).join('') + '</div>';
  }
  function visHTML(v, p) {
    if (!v) return '';
    if (v.k === 'kb') return '<div class="kbwrap">' + keyboardHTML(v.lo, v.hi, p, v) + '</div>';
    if (v.k === 'hands') return '<div class="lessonvis">' + handsHTML(v.hand, v) + '</div>';
    if (v.k === 'blocks') return '<div class="lessonvis">' + blocksHTML(v.pattern) + (v.pattern.length === 1 ? '<div class="mut">' + v.pattern[0] + (v.pattern[0] === 1 ? ' beat' : ' beats') + '</div>' : '') + '</div>';
    if (v.k === 'staff') return '<div class="staffwrap">' + staffHTML({ notes: v.notes, targets: v.notes, clef: v.clef }, { done: -1, names: !!v.names }, p) + '</div>' + (v.kb ? '<div class="kbwrap" style="margin-top:8px">' + keyboardHTML(v.kb.lo, v.kb.hi, p, { labels: true }) + '</div>' : '');
    if (v.k === 'big') return '<div class="lessonvis big-emoji">' + v.text + '</div>';
    if (v.k === 'beats') { var d = ''; for (var i = 0; i < (v.count || 4); i++) d += '<i></i>'; return '<div class="beatwrap"><div class="circle" id="circ">♪</div><div class="beats">' + d + '</div></div>'; }
    return '';
  }

  /* ---------------- small view helpers ---------------- */
  function show(html) { app.innerHTML = html; window.scrollTo(0, 0); document.body.className = isKid(prof()) ? 'kid' : ''; }
  function chips(name, opts, cur) {
    return '<div class="chips">' + opts.map(function (o) {
      return '<span class="chip' + (cur === o[0] ? ' on' : '') + '" data-a="ob" data-k="' + name + '" data-v="' + o[0] + '">' + o[1] + '</span>';
    }).join('') + '</div>';
  }
  function modal(html) { closeModal(); var d = document.createElement('div'); d.className = 'modal'; d.id = 'modal'; d.innerHTML = '<div>' + html + '</div>'; document.body.appendChild(d); }
  function closeModal() { var m = document.getElementById('modal'); if (m) m.remove(); }
  function focusHTML(text) {
    return parseFocus(text).map(function (x) { return x.focus ? '<b class="focus">' + esc(x.t.toLowerCase() === x.t || x.t.length > 1 ? x.t.toLowerCase() : x.t) + '</b>' : esc(x.t); }).join('');
  }
  // Mascot + a short picture-style bubble. The words are for the grown-up; the voice is for the child.
  function guide(p, text) {
    var fw = focusWords(text);
    var big = fw.length ? fw.map(function (w) { return '<span class="fchip">' + esc(/^[A-G]$/.test(w) ? w : w.toLowerCase()) + '</span>'; }).join(' ') : '<span class="fchip">🔊</span>';
    return '<div class="guide" data-a="hearagain"><span class="mascot">🐻</span><div class="bubble"><div class="bigwords">' + big + '</div><div class="caption">' + focusHTML(text) + '</div></div></div>';
  }
  // Buttons for kid mode show a picture, not words.
  function bt(p, icon, text) { return isKid(p) ? '<span class="icobtn">' + icon + '</span>' : text; }

  /* ---------------- welcome / onboarding ---------------- */
  var ob = { name: '', age: '8-12', reading: 'some', input: 'midi', keys: '88' };

  function viewWelcome() {
    store.current = null; clearTimers(); Input.handler = null; closeModal();
    if (!store.profiles.length) { viewOnboarding(); return; }
    var cards = store.profiles.map(function (p) {
      var st = states(p), done = C.SKILLS.filter(function (s) { return st[s.id].mastered; }).length;
      return '<div class="card row spread" data-a="pickprofile" data-id="' + p.id + '" style="cursor:pointer"><div><h3>' + esc(p.name) + '</h3><div class="mut small">Age ' + p.age + ' · ' + done + ' of ' + C.SKILLS.length + ' skills mastered</div></div><button>Open</button></div>';
    }).join('');
    show('<h1>🎹 Piano Teacher</h1><p class="mut">Who is learning?</p>' + cards +
      (store.profiles.length < 5 ? '<button class="ghost big" data-a="addprofile">+ Add a learner</button>' : '<p class="mut small">Family pack limit: 5 learners.</p>') +
      '<p class="center" style="margin-top:20px"><span class="chip-status" data-a="parent">Parent area</span></p>' +
      '<p class="mut small center">Prototype. Lessons are waiting for a piano teacher to review them.</p>');
  }
  function viewOnboarding() {
    show('<h1>Welcome! Let\'s set up a learner</h1><div class="card">' +
      '<label class="lbl">Name</label><input type="text" id="obname" maxlength="20" placeholder="First name" value="' + esc(ob.name) + '">' +
      '<label class="lbl">Age group</label>' + chips('age', [['4-7', '4 to 7'], ['8-12', '8 to 12'], ['13-17', '13 to 17'], ['adult', 'Adult']], ob.age) +
      '<label class="lbl">Reading</label>' + chips('reading', [['none', "Can't read yet"], ['some', 'Reads a little'], ['fluent', 'Reads well']], ob.reading) +
      '<label class="lbl">What will you play on?</label>' + chips('input', [['midi', 'Keyboard or piano with MIDI (USB-C)'], ['screen', 'On-screen keys for now']], ob.input) +
      '<p class="mut small">Acoustic pianos and keyboards without MIDI will work through the microphone in a later version.</p>' +
      '<label class="lbl">How many keys?</label>' + chips('keys', [['25', '25'], ['49', '37 to 49'], ['61', '61'], ['88', '76 to 88'], ['0', 'Not sure']], ob.keys) +
      '</div><button class="big" data-a="createprofile">Start learning</button>' +
      (store.profiles.length ? '<button class="ghost big" style="margin-top:8px" data-a="welcome">Back</button>' : ''));
    var inp = document.getElementById('obname'); inp.oninput = function () { ob.name = inp.value; };
  }

  /* ---------------- home ---------------- */
  function recommend(p) {
    var st = states(p), aT = E.available(C.ofKind('theory'), st).length, aP = E.available(C.ofKind('practical'), st).length;
    if (!aT && aP) return 'practical'; if (!aP && aT) return 'theory'; if (!aT && !aP) return 'practical';
    return p.lastKind === 'theory' ? 'practical' : 'theory';
  }
  function nextTitle(p, kind) {
    var st = states(p), list = C.ofKind(kind), c = ctxOf(p, kind);
    if (!E.available(list, st).length) return list.every(function (s) { return st[s.id].mastered; }) ? 'All done: review' : 'Finish the other side first';
    var pk = E.pickNext(list, st, { counter: p.counter || 0, lastSkillId: c.last, sameCount: c.same });
    return pk ? skillTitle(pk.skillId) : '';
  }
  function skillCard(p, s) {
    var all = states(p), st = all[s.id], avail = E.available(C.SKILLS, all).some(function (a) { return a.id === s.id; });
    var locked = !st.mastered && !avail, status = st.mastered ? '<span class="pill ok">Mastered ✓</span>' : (locked ? '<span class="pill lock">Locked</span>' : '<span class="pill learn">' + (st.attempts ? 'Learning' : 'New') + '</span>');
    var need = locked ? '<div class="mut small">First: ' + s.prereqs.filter(function (q) { return !all[q].mastered; }).map(skillTitle).join(', ') + '</div>' : '';
    return '<div class="skill' + (locked ? ' locked' : '') + '" data-a="skill" data-id="' + s.id + '"><div style="flex:1"><div class="row spread"><b>' + (s.kind === 'theory' ? '📖 ' : '🎹 ') + s.title + '</b>' + status + '</div>' + need +
      '<div class="bar' + (st.mastered ? ' ok' : '') + '" style="margin-top:6px"><i style="width:' + Math.round((st.mastered ? Math.max(st.score, 0.8) : st.score) * 100) + '%"></i></div></div></div>';
  }
  function viewHome() {
    clearTimers(); Input.handler = null; closeModal();
    var p = prof(); if (!p) { viewWelcome(); return; }
    var st = states(p), kid = isKid(p), rec = recommend(p), allDone = C.SKILLS.every(function (s) { return st[s.id].mastered; });
    var h = '<div class="row spread"><h1>' + (kid ? 'Hi ' : 'Hello, ') + esc(p.name) + '! 🎹</h1><button class="ghost" data-a="welcome">Switch</button></div>';
    if (p.input === 'midi') h += '<p><span id="midichip" class="chip-status" data-a="midi"></span></p>';
    if (kid) { h += guide(p, rec === 'theory' ? "Let's LEARN! Learn something new!" : "Let's PLAY! Play the piano!"); if (p.voice) setTimeout(function () { if (document.querySelector('.kindbtn')) say(rec === 'theory' ? "Hello " + p.name + "! Let's LEARN! Learn something new!" : "Hello " + p.name + "! Let's PLAY! Play the piano!"); }, 400); }
    function kindBtn(kind, icon, name, sub) {
      var list = C.ofKind(kind), none = !E.available(list, st).length && !list.every(function (s) { return st[s.id].mastered; });
      return '<button class="kindbtn' + (rec === kind ? ' rec' : '') + '" data-a="start" data-kind="' + kind + '"' + (none ? ' disabled' : '') + '><span class="ico">' + icon + '</span><b>' + name + '</b>' + (kid ? '' : '<span>' + esc(nextTitle(p, kind)) + '</span>') + '</button>';
    }
    h += '<div class="twobtn">' + kindBtn('theory', kid ? '🦉' : '📖', 'Learn', 'Stories and games') + kindBtn('practical', '🎹', 'Play', 'Play your piano') + '</div>' +
      (kid ? '<p class="center" style="font-size:30px">' + (rec === 'theory' ? '👆🦉' : '👆🎹') + '</p>' : '<p class="mut small center">' + (rec === 'theory' ? 'Suggested next: Learn' : 'Suggested next: Play') + ' · Learn uses the on-screen piano. Play uses your own piano or keyboard.</p>');
    h += '<h2>My stickers</h2><div class="stickers">' + C.SKILLS.map(function (s) { return '<div class="sticker' + (st[s.id].mastered ? '' : ' off') + '" title="' + esc(s.title) + '">' + (st[s.id].mastered ? s.sticker : '❔') + '</div>'; }).join('') + '</div>';
    if (allDone) {
      h += '<div class="card premium" style="margin-top:12px"><h3>🎉 You finished Beginner!</h3><p>You can play Hot Cross Buns, Mary Had a Little Lamb and Ode to Joy, and read your first notes.</p>' +
        '<p class="mut small"><b>Preview of what comes next (no payment in this prototype):</b> Early Intermediate onward is Premium: ₹299 per month per learner, or the Family pack ₹599 per month (up to 5 learners). Yearly: ₹2,499 or ₹4,999.</p></div>';
    }
    if (!kid) C.STAGES.forEach(function (stage) {
      var list = C.SKILLS.filter(function (s) { return s.stage === stage; });
      var d = list.filter(function (s) { return st[s.id].mastered; }).length;
      h += '<h2>' + stage + ' <span class="mut small">' + d + ' of ' + list.length + '</span></h2>' + list.map(function (s) { return skillCard(p, s); }).join('');
    });
    h += '<div class="row" style="margin-top:14px"><button class="ghost" data-a="settings">Settings</button><button class="ghost" data-a="parent">Parent area</button></div>';
    show(h); updateChip();
    if (p.input === 'midi' && Input.state === 'off') connectMIDI();
  }

  /* ---------------- lessons (theory) ---------------- */
  var lesson = null;
  function showLesson(skill, done) {
    clearTimers(); Input.handler = null;
    lesson = { skill: skill, i: 0, done: done, met: [] };
    renderLessonStep();
  }
  function renderLessonStep() {
    var p = prof(), L = lesson, st = L.skill.lesson[L.i], kid = isKid(p), n = L.skill.lesson.length;
    clearTimers(); Input.handler = null;
    var dots = ''; for (var i = 0; i < n; i++) dots += '<i class="' + (i < L.i ? 'done' : (i === L.i ? 'cur' : '')) + '"></i>';
    var need = st.tap ? st.tap.length : 0;
    L.met = st.tap ? st.tap.map(function () { return false; }) : [];
    var text = kid ? st.kid : st.text;
    var h = '<div class="row spread"><button class="ghost" data-a="lessonexit">✕</button><div class="dots">' + dots + '</div><button class="ghost" data-a="lessonhear">🔊</button></div>' +
      '<div class="card" style="margin-top:10px">' + (kid ? '<div class="topico">' + L.skill.sticker + '</div>' : '<div class="mut small">Lesson: ' + esc(L.skill.title) + ' · step ' + (L.i + 1) + ' of ' + n + '</div><h2 style="margin-top:6px">' + esc(st.title) + '</h2>') +
      (kid ? guide(p, text) : '<p class="prompt" style="font-size:18px;font-weight:600">' + esc(text) + '</p>') +
      '<div id="vis">' + visHTML(st.vis, p) + '</div><div id="fb" class="feedback"></div></div>' +
      '<div class="row spread"><button class="ghost" data-a="lessonback"' + (L.i === 0 ? ' disabled' : '') + '>' + bt(p, '◀', '◀ Back') + '</button><button id="lessonnext" class="' + (kid ? 'bigicon' : '') + '" data-a="lessonnext"' + (need ? ' disabled' : '') + '>' + bt(p, L.i === n - 1 ? '⭐' : '▶', L.i === n - 1 ? 'Done ✓' : 'Next ▶') + '</button></div>';
    show(h);
    var kbs = document.querySelectorAll('#vis .kbwrap');
    for (var k = 0; k < kbs.length; k++) bindKeys(kbs[k]);
    var fb = document.getElementById('fb');
    if (need) {
      fb.textContent = kid ? '👆🎹' : '👆 Try it on the keyboard.';
      Input.handler = function (note) {
        st.tap.forEach(function (rule, j) { if (!L.met[j] && E.checkAccept(rule, note)) L.met[j] = true; });
        var left = L.met.filter(function (x) { return !x; }).length;
        if (!left) { fb.className = 'feedback ok'; fb.textContent = kid ? '⭐⭐⭐' : '✓ Great!'; var nb = document.getElementById('lessonnext'); if (nb) nb.disabled = false; if (kid) say(pick(PRAISE)); }
        else { fb.className = 'feedback'; fb.textContent = left === need ? (kid ? '👆🎹' : '👆 Try it on the keyboard.') : (kid ? '👍 one more!' : '✓ Good! One more to go.'); if (kid && left !== need) say('Good! One more!'); }
      };
    }
    if (p.voice) say(text);
    armNudge(text);
    if (st.auto && st.play) later(function () { playSpec(st.play); }, kid ? 2500 : 300);
  }
  function endLesson() {
    var p = prof(); p.lessons = p.lessons || {}; p.lessons[lesson.skill.id] = true; save();
    var f = lesson.done; lesson = null; clearTimers(); Input.handler = null; if (f) f(); else viewHome();
  }

  /* ---------------- sessions ---------------- */
  var sess = null, cur = null;

  function startSession(opts) {
    var p = prof(); opts = opts || {};
    var kind = opts.kind || C.skillById(opts.skillOnly).kind;
    sess = { kind: kind, total: opts.testOut ? 3 : E.sessionLength(p.age, kind), n: 0, results: [], started: Date.now(), skillOnly: opts.skillOnly || null, testOut: !!opts.testOut, newly: [], notes: [], setupShown: {} };
    audio(); nextExercise();
  }
  function nextExercise() {
    clearTimers(); Input.handler = null;
    var p = prof(), st = states(p);
    if (sess.n >= sess.total) { endSession(); return; }
    var skill, mode = 'learn';
    if (sess.skillOnly) { skill = C.skillById(sess.skillOnly); }
    else {
      var list = C.ofKind(sess.kind), c = ctxOf(p, sess.kind);
      var pk = E.pickNext(list, st, { counter: p.counter || 0, lastSkillId: c.last, sameCount: c.same });
      if (!pk) { endSession(); return; }
      skill = C.skillById(pk.skillId); mode = pk.mode;
      if (pk.reason === 'step-back') { st[pk.from].failStreak = 2; sess.notes.push('Going back to "' + skill.title + '" to build a stronger base.'); }
      c.same = pk.skillId === c.last ? c.same + 1 : 1; c.last = pk.skillId;
    }
    function build() {
      var level = E.levelFor(st[skill.id], skill.maxLevel);
      if (mode === 'support') level = Math.max(0, level - 1);
      var ex0 = C.makeExercise(skill, level);
      if (isKid(p)) for (var tries = 0; tries < 12 && ex0.abstract; tries++) ex0 = C.makeExercise(skill, level);
      cur = { skill: skill, ex: ex0, mode: mode, misses: 0, tries: 0, hinted: false, done: false, demoing: false };
      renderExercise();
    }
    p.lessons = p.lessons || {};
    if (skill.lesson && !p.lessons[skill.id] && !sess.testOut) showLesson(skill, build); else build();
  }
  function modeLabel(m) { return m === 'review' ? 'Review' : (m === 'support' ? 'Extra help' : 'New practice'); }

  function frame(inner) {
    var dots = '';
    for (var i = 0; i < sess.total; i++) dots += '<i class="' + (i < sess.n ? 'done' : (i === sess.n ? 'cur' : '')) + '"></i>';
    return '<div class="row spread"><button class="ghost" data-a="quit">✕</button><div class="dots">' + dots + '</div><div class="row" style="gap:6px">' +
      (cur.skill.lesson ? '<button class="ghost" data-a="relesson">📖</button>' : '') + '<button class="ghost" data-a="listen">🔊</button></div></div>' +
      '<div class="card" style="margin-top:10px">' + (isKid(prof()) ? '<div class="topico">' + cur.skill.sticker + '</div>' : '<div class="mut small">' + (cur.skill.kind === 'theory' ? '📖 Learn' : '🎹 Play') + ' · ' + esc(cur.skill.title) + ' · ' + modeLabel(cur.mode) + (sess.testOut ? ' · Test out' : '') + '</div>') + inner + '</div>';
  }
  function promptHTML(p, ex) {
    var tag = ex.hand ? '<div class="handtag" style="background:' + C.HAND_COLORS[ex.hand] + '">' + (ex.hand === 'R' ? '🟠 RIGHT HAND' : '🔵 LEFT HAND') + '</div>' : '';
    return tag + (isKid(p) ? guide(p, ex.kid) : '<div class="prompt">' + esc(ex.prompt) + '</div>');
  }
  function needSetup() {
    var p = prof(), ex = cur.ex, st = states(p)[cur.skill.id];
    return !!ex.setup && !sess.setupShown[cur.skill.id] && (isKid(p) || st.attempts < 4);
  }
  function renderExercise() {
    var p = prof(), ex = cur.ex;
    if (ex.type === 'quiz') { renderQuiz(); if (p.voice) say(isKid(p) ? ex.kid : ex.prompt); armNudge(isKid(p) ? ex.kid : null); return; }
    if (needSetup()) { renderSetup(); return; }
    if (ex.type === 'rhythm') renderRhythm(); else renderNotes();
    if (p.voice) say(isKid(p) ? ex.kid : ex.prompt);
    armNudge(isKid(p) ? ex.kid : null);
  }

  /* --- quiz (theory) --- */
  // Pictures for answers so a child who cannot read can still choose.
  var PICS = {
    'right hand': '🟠🤚', 'left hand': '🔵🤚', 'high sounds': '🐦', 'low sounds': '🐻', 'higher': '⬆️🐦', 'lower': '⬇️🐻',
    'curved, like holding a bubble': '🫧✋', 'flat, like pancakes': '🥞', 'stiff and straight, like sticks': '🪵',
    'flat on the floor': '🦶⬇️', 'hanging in the air': '🦶☁️', 'crossed under the chair': '🪑❌',
    'loose and relaxed': '🍜', 'tight and stiff': '🪨', 'pressed down hard': '💪',
    'stop and shake them out': '🙌', 'play even harder': '😖', 'ignore it': '🙈',
    'the fingertip': '👆', 'the whole flat finger': '🖐️', 'the knuckle': '✊'
  };
  var DIGITS = { 1: '1️⃣', 2: '2️⃣', 3: '3️⃣', 4: '4️⃣', 5: '5️⃣' };
  function picOf(text) {
    var t = String(text).toLowerCase(), m = /^(\d) beats?$/.exec(t);
    if (PICS[t]) return PICS[t];
    if (m) return DIGITS[m[1]] ? DIGITS[m[1]] + (m[1] === '1' ? ' 🥁' : ' 🥁🥁') : null;
    if (/^\d$/.test(t)) return DIGITS[t] || null;
    return null;
  }
  function renderQuiz() {
    var p = prof(), ex = cur.ex, inner = promptHTML(p, ex) + '<div id="vis">' + (ex.vis ? visHTML(ex.vis, p) : '') + '</div>';
    if (ex.nameOnly) inner += '<div class="lessonvis"><div class="circle" style="background:' + (colorOf(C.WHITE[ex.nameOnly]) || '#4ea1ff') + ';color:#111">' + ex.nameOnly + '</div></div>';
    if (ex.play) inner += '<button class="ghost" data-a="listen">🔊 Play the sound</button>';
    if (ex.qtype === 'choice') {
      var kidq = isKid(p);
      inner += '<div class="opts' + (kidq ? ' kidopts' : '') + '" id="opts">' + ex.options.map(function (o, i) {
        var pic = kidq && !o.pattern ? picOf(o.text) : null;
        return '<div class="optrow">' + (o.play ? '<button class="play" data-a="playopt" data-i="' + i + '">🔊</button>' : (kidq && !o.pattern ? '<button class="play" data-a="sayopt" data-i="' + i + '">🔊</button>' : '')) +
          '<button class="optbtn' + (o.pattern ? ' blocks' : '') + (pic ? ' pic' : '') + '" data-a="answer" data-i="' + i + '">' + (o.pattern ? blocksHTML(o.pattern, { small: true }) : (pic ? '<span class="optpic">' + pic + '</span>' : esc(o.text))) + '</button></div>';
      }).join('') + '</div>';
    }
    inner += '<div id="fb" class="feedback"></div><div id="ctl"></div>';
    var h = frame(inner);
    if (ex.qtype === 'tap') h += '<div class="kbwrap" id="kb">' + keyboardHTML(ex.kb.lo, ex.kb.hi, p, { labels: true }) + '</div>';
    show(h);
    var visKbs = document.querySelectorAll('#vis .kbwrap'); for (var v = 0; v < visKbs.length; v++) bindKeys(visKbs[v]);
    if (ex.qtype === 'tap') {
      var kb = document.getElementById('kb'); bindKeys(kb);
      Input.handler = function (note) {
        if (cur.done) return;
        if (E.checkAccept(ex.accept, note)) { lightKey(kb, note, 'k-ok', 400); cur.done = true; finishQuiz(); }
        else {
          cur.tries++; lightKey(kb, note, 'k-bad', 300);
          var fb = document.getElementById('fb'); fb.className = 'feedback bad'; fb.textContent = isKid(p) ? '🙂 Try again!' : 'Not quite. Try again.'; if (isKid(p)) say(pick(TRYAGAIN) + ' ' + (cur.ex.kid || ''));
          if (cur.tries === 1) lightAnswer(kb);
          if (cur.tries >= 2) { cur.done = true; lightAnswer(kb); finishQuiz(); }
        }
      };
    }
  }
  function lightAnswer(kb) {
    var ex = cur.ex; clearHint(kb);
    for (var m = ex.kb.lo; m <= ex.kb.hi; m++) if (E.checkAccept(ex.accept, m)) { lightKey(kb, m, 'k-target'); if (ex.accept.mode !== 'pc' && ex.accept.mode !== 'note') break; }
  }
  function answerOption(i) {
    if (!cur || cur.done || cur.ex.type !== 'quiz') return;
    var ex = cur.ex, btns = document.querySelectorAll('.optbtn'), fb = document.getElementById('fb'), p = prof();
    if (i === ex.correct) { btns[i].classList.add('right'); cur.done = true; finishQuiz(); return; }
    cur.tries++; btns[i].classList.add('wrong'); btns[i].disabled = true;
    fb.className = 'feedback bad'; fb.textContent = isKid(p) ? '🙂 Try again!' : 'Not quite. Try again.'; if (isKid(p)) say(pick(TRYAGAIN) + ' ' + (cur.ex.kid || ''));
    if (cur.tries >= 2 || ex.options.length - cur.tries <= 1) { btns[ex.correct].classList.add('right'); cur.done = true; finishQuiz(); }
  }
  function finishQuiz() {
    var q = E.quizQuality(Math.min(cur.tries, 2));
    finishExercise(q, cur.tries === 0 ? 'Correct!' : (q > 0 ? 'Got it!' : "That's okay. Let's try again later."));
  }

  /* --- hand set-up (before the first exercise of a hand skill) --- */
  function badgesFor(hand, fingerNotes) {
    var b = {}, order = hand === 'R' ? [1, 2, 3, 4, 5] : [5, 4, 3, 2, 1];
    fingerNotes.forEach(function (n, i) { b[n] = { t: order[i], c: C.HAND_COLORS[hand] }; });
    return b;
  }
  function renderSetup() {
    var p = prof(), s = cur.ex.setup, kid = isKid(p), lo = s.fingerNotes[0] - (s.fingerNotes[0] % 12);
    var h = frame('<div class="handtag" style="background:' + C.HAND_COLORS[s.hand] + '">' + (s.hand === 'R' ? '🟠 RIGHT HAND' : '🔵 LEFT HAND') + '</div>' + (kid ? '' : '<h2 style="margin-top:4px">' + esc(s.title) + '</h2>') +
      (kid ? guide(p, s.kid) : '<p class="prompt" style="font-size:17px;font-weight:600">' + esc(s.text) + '</p>') +
      '<div class="lessonvis">' + handsHTML(s.hand, { keys: true, letter: true }) + '</div>' + (kid ? '<p class="center" style="font-size:28px">👀⬇️🤚</p>' : '<p class="mut small center">Look down at your own hand. This is how it should look from above.</p>') + '<div id="fb" class="feedback"></div>' +
      '<div class="row"><button class="ghost" data-a="setupskip">' + bt(p, '⏭', 'Skip') + '</button></div>');
    h += '<div class="kbwrap" id="kb">' + keyboardHTML(lo, lo + 12, p, { badges: badgesFor(s.hand, s.fingerNotes) }) + '</div>';
    show(h); bindKeys(document.getElementById('kb'));
    Input.handler = function (note) {
      var fb = document.getElementById('fb');
      if (note === s.confirmNote) {
        fb.className = 'feedback ok'; fb.textContent = kid ? '⭐⭐⭐' : '✓ Perfect. Your hand is in the right place!'; Input.handler = null;
        if (kid) say('Perfect! Your hand is in the right place! Yay!');
        later(function () { sess.setupShown[cur.skill.id] = true; renderExercise(); }, 900);
      } else {
        fb.className = 'feedback bad';
        fb.textContent = kid ? (s.hand === 'R' ? '👍 1' : '🤙 5') : 'Press the key under your ' + (s.hand === 'R' ? 'thumb (1).' : 'little finger (5).');
        if (kid) say(s.hand === 'R' ? 'Press the key under your THUMB! Thumb is number ONE!' : 'Press the key under your LITTLE finger! Little finger is number FIVE!');
      }
    };
    if (p.voice) say(kid ? s.kid : s.text);
  }

  /* --- find / sequence / read --- */
  function hintWanted() {
    var p = prof(), st = states(p)[cur.skill.id], ex = cur.ex;
    if (ex.hint === 'onFail') return cur.misses >= 2;
    var fade = (isKid(p) || p.reading === 'none') ? 4 : 2;
    return st.attempts < fade || cur.misses >= 2 || st.failStreak >= 2;
  }
  function renderNotes() {
    var p = prof(), ex = cur.ex, rg = kbRange(ex, p), st = states(p)[cur.skill.id];
    var badges = (ex.hand && ex.setup && (isKid(p) || st.attempts < 4 || cur.misses >= 2)) ? badgesFor(ex.hand, ex.setup.fingerNotes) : {};
    var h = frame(promptHTML(p, ex) + '<div id="vis"></div><div id="fb" class="feedback"></div><div id="ctl"></div>');
    h += '<div class="kbwrap" id="kb">' + keyboardHTML(rg[0], rg[1], p, { badges: badges }) + '</div>';
    show(h); bindKeys(document.getElementById('kb'));
    cur.matcher = E.createMatcher(ex); cur.demoing = false;
    var autoDemo = ex.type === 'seq' && !ex.readMode && (isKid(p) || st.attempts < 2);
    refreshNotes();
    Input.handler = onNotePlayed;
    if (autoDemo && !cur.demoShown) later(function () { runDemo(); }, isKid(p) ? 1800 : 600);
  }
  function runDemo() {
    var ex = cur.ex, p = prof(), kb = document.getElementById('kb'), fb = document.getElementById('fb'); if (!kb || cur.done) return;
    cur.demoShown = true; cur.demoing = true; clearHint(kb);
    fb.className = 'feedback'; fb.textContent = '👀 Watch and listen first…';
    var gap = ex.targets.length > 12 ? 320 : 480, a = audio(), t0 = a ? a.currentTime + 0.05 : 0;
    ex.targets.forEach(function (n, i) {
      if (a) tone(n, 0.5, t0 + i * gap / 1000);
      later(function () { lightKey(kb, n, 'k-target', gap - 60); }, 50 + i * gap);
    });
    later(function () { cur.demoing = false; fb.className = 'feedback'; fb.textContent = '🎹 Now your turn!'; if (p.voice && isKid(p)) say('Now it is YOUR turn! Your turn! Your turn!'); refreshNotes(); }, 100 + ex.targets.length * gap);
  }
  function refreshNotes() {
    var p = prof(), ex = cur.ex, kb = document.getElementById('kb'), vis = document.getElementById('vis');
    var done = Math.round(cur.matcher.result().progress * ex.targets.length), hint = hintWanted();
    if (ex.showStaff) {
      vis.innerHTML = '<div class="staffwrap" id="staffwrap">' + staffHTML(ex, { done: done, names: p.reading !== 'fluent' && (!ex.readMode || hint) }, p) + '</div>';
      var sw = document.getElementById('staffwrap'); sw.scrollLeft = Math.max(0, 56 + done * 38 - sw.clientWidth / 2);
    } else if (ex.nameOnly) {
      vis.innerHTML = '<div class="circle" style="background:' + (colorOf(ex.targets[0]) || '#4ea1ff') + ';color:#111">' + ex.nameOnly + '</div>';
    } else { vis.innerHTML = ''; }
    if (cur.demoing) return;
    clearHint(kb);
    if (hint && !cur.done) {
      cur.hinted = true; var nx = cur.matcher.next();
      if (nx != null) {
        if (ex.pitchClassOnly) { var r = kbRange(ex, p); for (var m = r[0]; m <= r[1]; m++) if (m % 12 === nx % 12) lightKey(kb, m, 'k-target'); }
        else lightKey(kb, nx, 'k-target');
      }
    }
  }
  function onNotePlayed(note) {
    var ex = cur.ex;
    if (cur.done || cur.demoing) return;
    var r = cur.matcher.feed(note), fb = document.getElementById('fb'), p = prof(), kb = document.getElementById('kb');
    if (r.status === 'wrong') {
      cur.misses++;
      lightKey(kb, note, 'k-bad', 300);
      fb.className = 'feedback bad';
      fb.textContent = isKid(p) ? '🙂 Try again!' : (ex.readMode ? 'Not quite. Try again.' : 'Not quite: that was ' + E.noteName(note) + '. Try again.');
      if (isKid(p) && !r.gaveUp) say(pick(TRYAGAIN) + ' ' + (ex.kid || ''));
      if (r.gaveUp) { cur.done = true; revealAndFinish(); return; }
      refreshNotes();
    } else {
      fb.className = 'feedback ok'; fb.textContent = r.status === 'done' ? '' : '✓';
      if (r.status === 'done') { cur.done = true; refreshNotes(); finishNotes(); } else refreshNotes();
    }
  }
  function finishNotes() {
    var res = cur.matcher.result(), q = res.quality * (cur.hinted ? 0.92 : 1);
    finishExercise(q, res.misses === 0 ? 'Perfect!' : (res.misses <= 2 ? 'Nice work!' : 'You got there!'));
  }
  function revealAndFinish() {
    var kb = document.getElementById('kb'), p = prof(); clearHint(kb);
    var nx = cur.matcher.next(); if (nx != null) lightKey(kb, nx, 'k-target');
    document.getElementById('fb').textContent = "Let's listen to it together.";
    playSpec({ notes: cur.ex.targets }); say(isKid(p) ? "That's a tricky one. Let's listen together." : 'Let us listen to it together.');
    finishExercise(cur.matcher.result().quality * 0.8, "That's okay. We'll practise it again.");
  }

  /* --- rhythm / steady beat --- */
  function renderRhythm() {
    var p = prof(), ex = cur.ex, beatMs = 60000 / ex.bpm;
    var total = ex.pattern.reduce(function (a, b) { return a + b; }, 0), offs = E.patternOffsets(ex.pattern);
    var pat = ex.showPattern ? blocksHTML(ex.pattern) : '';
    var h = frame(promptHTML(p, ex) + '<div id="vis">' + pat + '<div class="beatwrap"><div class="circle" id="circ">♪</div><div class="beats" id="beats">' + offs.map(function () { return '<i></i>'; }).join('') + '</div></div></div>' +
      '<div id="fb" class="feedback"></div><div id="ctl"><button class="ghost big" data-a="listen" style="margin-bottom:8px">' + (isKid(p) ? '👂' : '🔊 Hear it first') + '</button><button class="big' + (isKid(p) ? ' bigicon' : '') + '" data-a="rstart">' + (isKid(p) ? '▶' : 'Start (' + ex.bpm + ' beats per minute)') + '</button></div>');
    h += '<div class="kbwrap" id="kb">' + keyboardHTML(60, 72, p, {}) + '</div>';
    show(h); bindKeys(document.getElementById('kb'));
    cur.r = { beatMs: beatMs, total: total, offs: offs, running: false, played: [], expected: [], used: [], tol: beatMs * E.toleranceBeats(p.age) };
    Input.handler = function (note, t) { rhythmNote(t); };
  }
  function startRhythm() {
    var r = cur.r, a = audio();
    document.getElementById('ctl').innerHTML = '';
    var now = performance.now(), start = now + 400, first = start + 4 * r.beatMs;
    r.expected = E.expectedOnsets(r.offs, r.beatMs, first); r.used = r.expected.map(function () { return false; }); r.first = first; r.running = true; r.played = [];
    if (a) { var base = a.currentTime + 0.4; for (var i = 0; i < 4 + r.total; i++) click(i % 4 === 0, base + i * r.beatMs / 1000); }
    var circ = document.getElementById('circ'), fb = document.getElementById('fb');
    fb.className = 'feedback'; fb.textContent = 'Listen… 1 2 3 4';
    for (var b = 0; b < 4 + r.total; b++) (function (b) {
      later(function () {
        circ.textContent = b < 4 ? String(b + 1) : '♪'; circ.classList.add('pulse'); setTimeout(function () { circ.classList.remove('pulse'); }, 90);
        if (b === 4) fb.textContent = 'Go!';
      }, start + b * r.beatMs - performance.now());
    })(b);
    later(function () { endRhythm(); }, first + r.total * r.beatMs + r.beatMs * 0.7 - performance.now());
  }
  function rhythmNote(t) {
    var r = cur && cur.r; if (!r || !r.running) return;
    if (t < r.first - r.tol) return;
    r.played.push(t);
    var best = -1, bd = Infinity, k;
    for (k = 0; k < r.expected.length; k++) { if (r.used[k]) continue; var d = Math.abs(t - r.expected[k]); if (d < bd) { bd = d; best = k; } }
    var dots = document.querySelectorAll('#beats i');
    if (best >= 0 && bd <= r.tol) { r.used[best] = true; if (dots[best]) dots[best].className = 'hit'; }
  }
  function endRhythm() {
    var p = prof(), r = cur.r; if (!r.running) return; r.running = false;
    var res = E.scoreTiming(r.expected, r.played, r.tol);
    var dots = document.querySelectorAll('#beats i');
    for (var k = 0; k < dots.length; k++) if (!r.used[k]) dots[k].className = 'miss';
    finishExercise(res.accuracy, isKid(p) ? (res.accuracy >= 0.7 ? 'Great beat!' : "Let's try again!") : res.hits + ' of ' + res.total + ' on time · ' + res.label);
  }

  /* --- results --- */
  function finishExercise(q, msg) {
    var p = prof(), st = states(p), sk = cur.skill, fb = document.getElementById('fb'), kid = isKid(p), newSticker = false;
    clearTimers(); Input.handler = null; if (cur.r) cur.r.running = false;
    q = Math.max(0, Math.min(1, q));
    sess.results.push({ skillId: sk.id, q: q });
    if (!sess.testOut) {
      var before = st[sk.id].mastered;
      st[sk.id] = E.updateSkill(st[sk.id], q, p.counter || 0, cfgFor(p)); p.counter = (p.counter || 0) + 1;
      if (!before && st[sk.id].mastered) { sess.newly.push(sk.sticker + ' ' + sk.title); newSticker = true; }
    }
    save();
    var s3 = E.stars(q), starStr = '★★★'.slice(0, s3) + '☆☆☆'.slice(0, 3 - s3);
    fb.className = 'feedback ' + (q >= 0.6 ? 'ok' : 'bad');
    fb.innerHTML = (kid ? '' : esc(msg || '')) + '<div class="stars' + (kid ? ' party' : '') + '" style="color:#ffd93d">' + starStr + '</div>' + (newSticker ? '<div class="newsticker">' + (kid ? '' : '🎉 New sticker: ') + sk.sticker + (kid ? '' : ' ' + esc(sk.title) + '!') + '</div>' : '');
    document.getElementById('ctl').innerHTML = '<button class="big' + (kid ? ' bigicon' : '') + '" data-a="next">' + bt(p, sess.n + 1 >= sess.total ? '⭐' : '▶', sess.n + 1 >= sess.total ? 'Finish' : 'Next ▶') + '</button>';
    if (p.voice && kid) say((newSticker ? 'You got a new sticker! ' : '') + (q >= 0.6 ? pick(PRAISE) : 'Good try! You are learning! Let us keep going!'));
    sess.n++;
    var dots = document.querySelectorAll('.dots i'); if (dots[sess.n - 1]) dots[sess.n - 1].className = 'done'; if (dots[sess.n]) dots[sess.n].className = 'cur';
  }
  function playDemo() {
    if (!cur) return; var ex = cur.ex;
    if (ex.type === 'rhythm') { playSpec({ pattern: ex.pattern, bpm: ex.bpm, clicks: true }); return; }
    if (ex.type === 'quiz') { if (ex.play) playSpec(ex.play); return; }
    playSpec({ notes: ex.targets });
  }

  function stars_(se) { return se.results.reduce(function (a, r) { return a + E.stars(r.q); }, 0); }
  function endSession() {
    var p = prof(), st = states(p), kid = isKid(p), secs = Math.round((Date.now() - sess.started) / 1000);
    p.seconds = (p.seconds || 0) + secs; p.sessions = (p.sessions || 0) + 1; if (!sess.testOut) p.lastKind = sess.kind;
    var h, avg = sess.results.length ? sess.results.reduce(function (a, r) { return a + r.q; }, 0) / sess.results.length : 0;
    if (sess.testOut) {
      var sk = C.skillById(sess.skillOnly), passed = avg >= 0.8 && sess.results.length >= 3;
      if (passed) {
        var s = st[sk.id], c = cfgFor(p); s.mastered = true; s.score = Math.max(s.score, 0.85); s.attempts = Math.max(s.attempts, c.minAttempts); s.wins = Math.max(s.wins, 4);
        s.lastSeen = p.counter || 0; s.failStreak = 0; s.masteredAt = p.counter || 0; p.lessons = p.lessons || {}; if (sk.lesson) p.lessons[sk.id] = true;
      }
      h = '<div class="card center"><h1>' + (passed ? '🎉 You already know this!' : 'Not quite yet') + '</h1><p>' + (passed ? '"' + esc(sk.title) + '" is marked as mastered.' : 'No problem. Keep practising "' + esc(sk.title) + '" and you will get there.') + '</p></div>';
    } else {
      var stars = sess.results.reduce(function (a, r) { return a + E.stars(r.q); }, 0), seen = {};
      sess.results.forEach(function (r) { seen[r.skillId] = 1; });
      h = kid ? '<div class="card center"><div class="topico" style="font-size:80px">🐥🎉</div><div class="stars party" style="color:#ffd93d;font-size:40px">' + stars_(sess) + ' ⭐</div><div class="stickers" style="justify-content:center">' + sess.newly.map(function (n) { return '<div class="sticker">' + n.split(' ')[0] + '</div>'; }).join('') + '</div><p style="font-size:30px">👋 😊</p></div>' : '<div class="card center"><h1>' + (kid ? 'All done for today! 🐥' : (sess.kind === 'theory' ? 'Learn session complete' : 'Play session complete')) + '</h1><div class="stars" style="color:#ffd93d">' + stars + ' ⭐</div>' +
        '<p class="mut">' + sess.results.length + ' questions · about ' + Math.max(1, Math.round(secs / 60)) + ' min</p>' +
        (sess.newly.length ? '<p>🎉 New stickers: <b>' + sess.newly.map(esc).join(', ') + '</b></p>' : '') +
        '<p class="mut small">Practised: ' + Object.keys(seen).map(skillTitle).map(esc).join(' · ') + '</p>' +
        sess.notes.map(function (n) { return '<p class="mut small">' + esc(n) + '</p>'; }).join('') +
        '<p class="mut small">' + (sess.kind === 'theory' ? 'Next, try a Play session to use what you learned on your piano.' : 'Next, try a Learn session for something new.') + '</p>' +
        (kid ? '<p>See you tomorrow!</p>' : '') + '</div>';
    }
    save();
    show(h + '<button class="big' + (kid ? ' bigicon' : '') + '" data-a="home">' + bt(p, '🏠', 'Back to home') + '</button>'); if (p.voice && kid) say('Hooray! You are all done for today! Great job! See you tomorrow! Bye bye!');
    sess = null; cur = null;
  }

  /* ---------------- modals, settings, parent ---------------- */
  function skillModal(id) {
    var p = prof(), all = states(p), s = C.skillById(id), st = all[id], avail = E.available(C.SKILLS, all).some(function (a) { return a.id === id; });
    var can = st.mastered || avail;
    modal('<h3>' + (s.kind === 'theory' ? '📖 ' : '🎹 ') + esc(s.title) + '</h3><p class="mut">' + esc(s.blurb) + '</p>' +
      '<p class="mut small">' + (s.kind === 'theory' ? 'Learn skill (on-screen piano)' : 'Play skill (your own keyboard)') + ' · Score ' + Math.round(st.score * 100) + '% · ' + st.attempts + ' attempts' + (st.mastered ? ' · mastered' : '') + '</p>' +
      (can ? (s.lesson ? '<button class="ghost big" style="margin-bottom:8px" data-a="openlesson" data-id="' + id + '">📖 Show the lesson</button>' : '') +
        '<button class="big" data-a="practiceskill" data-id="' + id + '">' + (s.kind === 'theory' ? 'Practise with questions' : 'Practise this') + '</button>' + (!st.mastered ? '<button class="ghost big" style="margin-top:8px" data-a="testout" data-id="' + id + '">I already know this: test out</button>' : '') :
        '<p>Finish these first: ' + s.prereqs.filter(function (q) { return !all[q].mastered; }).map(skillTitle).map(esc).join(', ') + '.</p>') +
      '<button class="ghost big" style="margin-top:8px" data-a="closemodal">Close</button>');
  }
  function settingsModal() {
    var p = prof();
    modal('<h3>Settings for ' + esc(p.name) + '</h3><label class="lbl">Spoken instructions</label>' +
      '<div class="chips"><span class="chip' + (p.voice ? ' on' : '') + '" data-a="setvoice" data-v="1">On</span><span class="chip' + (!p.voice ? ' on' : '') + '" data-a="setvoice" data-v="0">Off</span></div>' +
      '<label class="lbl">Reading level</label><div class="chips">' + [['none', "Can't read yet"], ['some', 'Reads a little'], ['fluent', 'Reads well']].map(function (o) { return '<span class="chip' + (p.reading === o[0] ? ' on' : '') + '" data-a="setreading" data-v="' + o[0] + '">' + o[1] + '</span>'; }).join('') + '</div>' +
      '<label class="lbl">Input</label><div class="chips"><span class="chip' + (p.input === 'midi' ? ' on' : '') + '" data-a="setinput" data-v="midi">MIDI keyboard</span><span class="chip' + (p.input === 'screen' ? ' on' : '') + '" data-a="setinput" data-v="screen">On-screen keys</span></div>' +
      '<button class="ghost big" style="margin-top:14px" data-a="closemodal">Done</button>');
  }
  function parentGate() {
    var a = 6 + Math.floor(Math.random() * 4), b = 5 + Math.floor(Math.random() * 4); window._gate = a + b;
    show('<h1>Parent area</h1><div class="card"><p>Grown-ups only. What is ' + a + ' + ' + b + '?</p><input type="number" id="gate" inputmode="numeric"><button class="big" style="margin-top:10px" data-a="gateok">Open</button></div><button class="ghost big" data-a="welcome">Back</button>');
  }
  function viewParent() {
    var rows = store.profiles.map(function (p) {
      var st = states(p), done = C.SKILLS.filter(function (s) { return st[s.id].mastered; }).length;
      var stuck = C.SKILLS.filter(function (s) { return st[s.id].failStreak >= 3 && !st[s.id].mastered; }).map(function (s) { return s.title; });
      var detail = C.SKILLS.map(function (s) { var x = st[s.id]; return '<tr><td>' + (s.kind === 'theory' ? '📖' : '🎹') + ' ' + esc(s.title) + '</td><td>' + (x.mastered ? '✓' : (x.attempts ? 'learning' : '-')) + '</td><td>' + Math.round(x.score * 100) + '%</td><td>' + x.attempts + '</td></tr>'; }).join('');
      return '<div class="card"><div class="row spread"><h3>' + esc(p.name) + ' <span class="mut small">age ' + p.age + '</span></h3><span class="pill ok">' + done + '/' + C.SKILLS.length + '</span></div>' +
        '<p class="mut small">' + (p.sessions || 0) + ' sessions · ' + Math.round((p.seconds || 0) / 60) + ' min total' + (stuck.length ? ' · <span style="color:#ffb84d">Needs help: ' + stuck.map(esc).join(', ') + '</span>' : '') + '</p>' +
        '<table><tr><th>Skill</th><th></th><th>Score</th><th>Tries</th></tr>' + detail + '</table>' +
        '<div class="row" style="margin-top:8px"><button class="ghost" data-a="resetprofile" data-id="' + p.id + '">Reset progress</button><button class="danger" data-a="delprofile" data-id="' + p.id + '">Remove learner</button></div></div>';
    }).join('');
    show('<h1>Parent area</h1>' + (rows || '<p class="mut">No learners yet.</p>') +
      '<div class="card"><h3>About this prototype</h3><p class="mut small">All lessons are marked <b>pending teacher review</b>. Progress is saved only on this phone, in this browser. Nothing is sent anywhere.</p>' +
      '<button class="ghost" data-a="export">Show my progress data</button><div id="exp"></div></div>' +
      '<button class="big" data-a="welcome">Back</button>');
  }

  /* ---------------- events ---------------- */
  var actions = {
    pickprofile: function (d) { store.current = d.id; save(); viewHome(); },
    addprofile: function () { ob = { name: '', age: '8-12', reading: 'some', input: 'midi', keys: '88' }; viewOnboarding(); },
    welcome: function () { viewWelcome(); },
    home: function () { viewHome(); },
    ob: function (d) {
      var nm = document.getElementById('obname'); if (nm) ob.name = nm.value;
      ob[d.k] = d.v; if (d.k === 'age') ob.reading = E.defaultReading(d.v);
      viewOnboarding();
    },
    createprofile: function () {
      var nm = document.getElementById('obname'); if (nm) ob.name = nm.value;
      var name = (ob.name || '').trim() || 'Learner';
      var p = { id: 'p' + Date.now(), name: name, age: ob.age, reading: ob.reading, input: ob.input, keys: ob.keys, voice: ob.age === '4-7' || ob.reading === 'none', states: {}, lessons: {}, counter: 0, sessions: 0, seconds: 0, created: Date.now() };
      store.profiles.push(p); store.current = p.id; save(); viewHome();
    },
    midi: function () { connectMIDI(); },
    start: function (d) { startSession({ kind: d.kind }); },
    skill: function (d) { skillModal(d.id); },
    closemodal: closeModal,
    practiceskill: function (d) { closeModal(); startSession({ skillOnly: d.id }); },
    testout: function (d) { closeModal(); startSession({ skillOnly: d.id, testOut: true }); },
    openlesson: function (d) { closeModal(); showLesson(C.skillById(d.id), null); },
    relesson: function () { var c = cur; showLesson(cur.skill, function () { cur = c; renderExercise(); }); },
    lessonnext: function () { if (lesson.i < lesson.skill.lesson.length - 1) { lesson.i++; renderLessonStep(); } else endLesson(); },
    lessonback: function () { if (lesson.i > 0) { lesson.i--; renderLessonStep(); } },
    lessonexit: function () {
      var f = lesson.done; lesson = null; clearTimers(); Input.handler = null;
      if (f && sess) f(); else if (sess) { sess = null; cur = null; viewHome(); } else viewHome();
    },
    lessonhear: function () {
      var st = lesson.skill.lesson[lesson.i], p = prof();
      if (st.play) playSpec(st.play); else say(isKid(p) ? st.kid : st.text);
    },
    answer: function (d) { answerOption(+d.i); },
    next: function () { nextExercise(); },
    quit: function () { clearTimers(); Input.handler = null; sess = null; cur = null; viewHome(); },
    listen: function () { playDemo(); },
    sayopt: function (d) { var o = cur.ex.options[+d.i]; if (o) say(o.text); },
    hearagain: function () { var p = prof(); if (lesson) { var st = lesson.skill.lesson[lesson.i]; say(isKid(p) ? st.kid : st.text); } else if (cur && cur.ex) say(isKid(p) ? cur.ex.kid : cur.ex.prompt); },
    playopt: function (d) { var o = cur.ex.options[+d.i]; if (o && o.play) playSpec(o.play); },
    rstart: function () { startRhythm(); },
    setupskip: function () { sess.setupShown[cur.skill.id] = true; renderExercise(); },
    settings: settingsModal,
    setvoice: function (d) { prof().voice = d.v === '1'; save(); settingsModal(); },
    setreading: function (d) { var pp = prof(); pp.reading = d.v; if (d.v === 'none') pp.voice = true; save(); settingsModal(); },
    setinput: function (d) { prof().input = d.v; save(); viewHome(); },
    parent: function () { parentGate(); },
    gateok: function () { var v = +document.getElementById('gate').value; if (v === window._gate) viewParent(); else { alert('Not quite. Ask a grown-up.'); parentGate(); } },
    resetprofile: function (d) { if (confirm('Reset all progress for this learner?')) { store.profiles.forEach(function (p) { if (p.id === d.id) { p.states = {}; p.lessons = {}; p.ctx = {}; p.counter = 0; p.lastKind = null; p.sessions = 0; p.seconds = 0; } }); save(); viewParent(); } },
    delprofile: function (d) { if (confirm('Remove this learner and their progress?')) { store.profiles = store.profiles.filter(function (p) { return p.id !== d.id; }); save(); viewParent(); } },
    export: function () { document.getElementById('exp').innerHTML = '<textarea readonly>' + esc(JSON.stringify(store, null, 1)) + '</textarea>'; }
  };
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-a]'); if (!t) return;
    var f = actions[t.getAttribute('data-a')]; if (f) f(t.dataset, e);
  });
  window.addEventListener('error', function (ev) {
    var d = document.createElement('div'); d.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#4a2326;color:#fff;padding:8px;font:12px monospace;z-index:99';
    d.textContent = 'Error: ' + ev.message + ' (' + (ev.filename || '').split('/').pop() + ':' + ev.lineno + ')'; document.body.appendChild(d);
  });

  window.__test = { cur: function () { return cur; }, sess: function () { return sess; }, lesson: function () { return lesson; } };
  viewWelcome();
})();
