/* app.js: user interface for the Piano Teacher prototype (Milestone 1). */
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
  function states(p) { return E.ensureStates(C.SKILLS, p.states); }

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
  function say(text) {
    var p = prof(); if (!p || !p.voice || !('speechSynthesis' in window)) return;
    try {
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text); u.lang = 'en-US';
      u.rate = p.age === '4-7' ? 0.85 : 1; u.pitch = p.age === '4-7' ? 1.2 : 1;
      speechSynthesis.speak(u);
    } catch (e) {}
  }

  /* ---------------- input: MIDI + on-screen ---------------- */
  var Input = { handler: null, state: 'off', name: '' };
  function emit(note, t) { if (Input.handler) Input.handler(note, t || performance.now()); }
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
            var d = ev.data; if ((d[0] & 0xf0) === 0x90 && d[2] > 0) {
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

  /* ---------------- drawing: keyboard and staff ---------------- */
  function colorOf(m) { var n = E.pcName(m); return C.COLORS[n] || null; }

  function keyboardHTML(lo, hi, p) {
    var whites = [], m, pos = {}, colored = p.reading !== 'fluent', letters = p.reading !== 'fluent';
    for (m = lo; m <= hi; m++) if (E.isWhite(m)) whites.push(m);
    var kw = 40, H = p.age === '4-7' ? 190 : 150, s = '';
    s += '<svg viewBox="0 0 ' + (whites.length * kw) + ' ' + H + '" xmlns="http://www.w3.org/2000/svg">';
    whites.forEach(function (n, i) {
      pos[n] = i * kw;
      s += '<rect class="k-w" data-note="' + n + '" x="' + (i * kw) + '" y="0" width="' + kw + '" height="' + H + '"/>';
      if (colored && colorOf(n)) s += '<rect data-note="' + n + '" x="' + (i * kw + 2) + '" y="' + (H - 34) + '" width="' + (kw - 4) + '" height="30" rx="5" fill="' + colorOf(n) + '" style="pointer-events:none"/>';
      if (letters || E.pcName(n) === 'C') s += '<text x="' + (i * kw + kw / 2) + '" y="' + (H - 12) + '" text-anchor="middle" font-size="13" font-weight="700" fill="' + (colored && colorOf(n) ? '#222' : '#666') + '" style="pointer-events:none">' + E.pcName(n) + (E.pcName(n) === 'C' && !letters ? Math.floor(n / 12) - 1 : '') + '</text>';
    });
    for (m = lo; m <= hi; m++) if (!E.isWhite(m)) {
      s += '<rect class="k-b" data-note="' + m + '" x="' + (pos[m - 1] + kw * 0.66) + '" y="0" width="' + (kw * 0.64) + '" height="' + (H * 0.6) + '" rx="3"/>';
    }
    return s + '</svg>';
  }
  function kbRange(ex, p) {
    var ts = ex.targets && ex.targets.length ? ex.targets : [60];
    var lo = Math.floor(Math.min.apply(null, ts) / 12) * 12, oct = p.age === '4-7' ? 1 : 2;
    if (ex.type === 'rhythm' || (ex.type === 'find' && ex.pitchClassOnly)) lo = 60;
    var hi = lo + 12 * oct, mx = Math.max.apply(null, ts);
    while (hi < mx) hi += 12;
    return [lo, hi];
  }
  function lightKey(root, note, cls, ms) {
    var els = root.querySelectorAll('rect[data-note="' + note + '"]'), r = null, i;
    for (i = 0; i < els.length; i++) if (els[i].getAttribute('class')) r = els[i];
    if (!r) return;
    r.classList.add(cls); if (ms) setTimeout(function () { r.classList.remove(cls); }, ms);
  }
  function clearHint(root) { var l = root.querySelectorAll('.k-target'); for (var i = 0; i < l.length; i++) l[i].classList.remove('k-target'); }

  function staffHTML(ex, ctx, p) {
    var t = ex.targets, n = t.length, sp = 38, w = Math.max(260, 70 + n * sp), bottom = 84, hs = 6;
    var clef = ex.clef || 'treble', bdn = clef === 'bass' ? 18 : 30;
    function y(dn) { return bottom - (dn - bdn) * hs; }
    var s = '<svg width="' + w + '" height="130" xmlns="http://www.w3.org/2000/svg">', i;
    for (i = 0; i < 5; i++) s += '<line x1="4" x2="' + (w - 4) + '" y1="' + (bottom - i * 12) + '" y2="' + (bottom - i * 12) + '" stroke="#333" stroke-width="1.2"/>';
    s += '<text x="8" y="22" font-size="11" fill="#777">' + (clef === 'bass' ? 'bass staff' : 'treble staff') + '</text>';
    t.forEach(function (m, k) {
      var x = 56 + k * sp, dn = E.diatonic(m), yy = y(dn), ld;
      for (ld = bdn - 2; ld >= dn; ld -= 2) s += '<line x1="' + (x - 12) + '" x2="' + (x + 12) + '" y1="' + y(ld) + '" y2="' + y(ld) + '" stroke="#333" stroke-width="1.2"/>';
      for (ld = bdn + 10; ld <= dn; ld += 2) s += '<line x1="' + (x - 12) + '" x2="' + (x + 12) + '" y1="' + y(ld) + '" y2="' + y(ld) + '" stroke="#333" stroke-width="1.2"/>';
      var fill = k < ctx.done ? '#2fb77d' : (k === ctx.done ? '#2f8bf5' : (colorOf(m) && p.reading !== 'fluent' ? colorOf(m) : '#222'));
      s += '<ellipse cx="' + x + '" cy="' + yy + '" rx="8" ry="6" fill="' + fill + '" stroke="#222" stroke-width="1"/>';
      if (ex.fingers) s += '<text x="' + x + '" y="122" text-anchor="middle" font-size="14" font-weight="700" fill="#444">' + ex.fingers[k] + '</text>';
      if (ctx.names && (k <= ctx.done || !ex.readMode)) s += '<text x="' + x + '" y="108" text-anchor="middle" font-size="12" fill="#666">' + E.pcName(m) + '</text>';
    });
    return s + '</svg>';
  }

  /* ---------------- tiny helpers for views ---------------- */
  function show(html) { app.innerHTML = html; window.scrollTo(0, 0); document.body.className = (prof() && prof().age === '4-7') ? 'kid' : ''; }
  function chips(name, opts, cur) {
    return '<div class="chips">' + opts.map(function (o) {
      return '<span class="chip' + (cur === o[0] ? ' on' : '') + (o[2] ? ' dis' : '') + '" data-a="ob" data-k="' + name + '" data-v="' + o[0] + '">' + o[1] + '</span>';
    }).join('') + '</div>';
  }
  function skillTitle(id) { return C.skillById(id).title; }
  function modal(html) {
    var d = document.createElement('div'); d.className = 'modal'; d.id = 'modal'; d.innerHTML = '<div>' + html + '</div>';
    document.body.appendChild(d);
  }
  function closeModal() { var m = document.getElementById('modal'); if (m) m.remove(); }

  /* ---------------- views: welcome / onboarding ---------------- */
  var ob = { name: '', age: '8-12', reading: 'some', input: 'midi', keys: '88' };

  function viewWelcome() {
    store.current = null;
    if (!store.profiles.length) { viewOnboarding(); return; }
    var cards = store.profiles.map(function (p) {
      var st = states(p), done = C.SKILLS.filter(function (s) { return st[s.id].mastered; }).length;
      return '<div class="card row spread" data-a="pick" data-id="' + p.id + '" style="cursor:pointer"><div><h3>' + esc(p.name) + '</h3><div class="mut small">Age ' + p.age + ' · ' + done + ' of ' + C.SKILLS.length + ' skills mastered</div></div><button>Play</button></div>';
    }).join('');
    show('<h1>🎹 Piano Teacher</h1><p class="mut">Who is playing?</p>' + cards +
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

  /* ---------------- view: home ---------------- */
  function nextLabel(p) {
    var s = states(p), pk = E.pickNext(C.SKILLS, s, { counter: p.counter || 0, lastSkillId: p.lastSkillId, sameCount: p.sameCount || 0 });
    return pk ? skillTitle(pk.skillId) : '';
  }
  function skillCard(p, s) {
    var st = states(p)[s.id], avail = E.available(C.SKILLS, states(p)).some(function (a) { return a.id === s.id; });
    var locked = !st.mastered && !avail, status = st.mastered ? '<span class="pill ok">Mastered ✓</span>' : (locked ? '<span class="pill lock">Locked</span>' : '<span class="pill learn">' + (st.attempts ? 'Learning' : 'New') + '</span>');
    var need = locked ? '<div class="mut small">First: ' + s.prereqs.filter(function (q) { return !states(p)[q].mastered; }).map(skillTitle).join(', ') + '</div>' : '';
    return '<div class="skill' + (locked ? ' locked' : '') + '" data-a="skill" data-id="' + s.id + '"><div style="flex:1"><div class="row spread"><b>' + s.title + '</b>' + status + '</div>' + need +
      '<div class="bar' + (st.mastered ? ' ok' : '') + '" style="margin-top:6px"><i style="width:' + Math.round((st.mastered ? Math.max(st.score, 0.8) : st.score) * 100) + '%"></i></div></div></div>';
  }
  function viewHome() {
    var p = prof(); if (!p) { viewWelcome(); return; }
    var st = states(p), allDone = E.stageDone(C.SKILLS, st, 'Foundations') && E.stageDone(C.SKILLS, st, 'Beginner');
    var kid = p.age === '4-7';
    var h = '<div class="row spread"><h1>' + (kid ? 'Hi ' : 'Hello, ') + esc(p.name) + '! 🎹</h1><button class="ghost" data-a="welcome">Switch</button></div>';
    if (p.input === 'midi') h += '<p><span id="midichip" class="chip-status" data-a="midi"></span></p>';
    h += '<button class="big" data-a="start">' + (kid ? '▶ Play!' : '▶ Start practice') + '</button>' +
      (!kid ? '<p class="mut small center">Next up: ' + esc(nextLabel(p)) + ' · about ' + E.sessionLength(p.age) + ' exercises</p>' : '');
    if (allDone) {
      h += '<div class="card premium" style="margin-top:12px"><h3>🎉 You finished Beginner!</h3><p>You can play Hot Cross Buns, Mary Had a Little Lamb and Ode to Joy, and read your first notes.</p>' +
        '<p class="mut small"><b>Preview of what comes next (no payment in this prototype):</b> Early Intermediate onward is Premium: ₹299 per month per learner, or the Family pack ₹599 per month (up to 5 learners). Yearly: ₹2,499 or ₹4,999.</p></div>';
    }
    C.STAGES.forEach(function (stage) {
      var list = C.SKILLS.filter(function (s) { return s.stage === stage; });
      var d = list.filter(function (s) { return st[s.id].mastered; }).length;
      h += '<h2>' + stage + ' <span class="mut small">' + d + ' of ' + list.length + '</span></h2>' + list.map(function (s) { return skillCard(p, s); }).join('');
    });
    h += '<div class="row" style="margin-top:14px"><button class="ghost" data-a="settings">Settings</button><button class="ghost" data-a="parent">Parent area</button></div>';
    show(h); updateChip();
    if (p.input === 'midi' && Input.state === 'off') connectMIDI();
  }

  /* ---------------- practice ---------------- */
  var sess = null, cur = null, timers = [];
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  function later(fn, ms) { timers.push(setTimeout(fn, Math.max(0, ms))); }

  function startSession(opts) {
    var p = prof(); opts = opts || {};
    sess = { total: opts.testOut ? 3 : E.sessionLength(p.age), n: 0, results: [], started: Date.now(), skillOnly: opts.skillOnly || null, testOut: !!opts.testOut, newly: [], notes: [] };
    audio(); nextExercise();
  }
  function nextExercise() {
    clearTimers(); Input.handler = null;
    var p = prof(), st = states(p);
    if (sess.n >= sess.total) { endSession(); return; }
    var skill, mode = 'learn';
    if (sess.skillOnly) { skill = C.skillById(sess.skillOnly); }
    else {
      var pk = E.pickNext(C.SKILLS, st, { counter: p.counter || 0, lastSkillId: p.lastSkillId, sameCount: p.sameCount || 0 });
      skill = C.skillById(pk.skillId); mode = pk.mode;
      if (pk.reason === 'step-back') { st[pk.from].failStreak = 2; sess.notes.push('Going back to ' + skill.title + ' to build a stronger base.'); }
      p.sameCount = pk.skillId === p.lastSkillId ? (p.sameCount || 0) + 1 : 1; p.lastSkillId = pk.skillId;
    }
    var level = E.levelFor(st[skill.id], skill.maxLevel);
    if (mode === 'support') level = Math.max(0, level - 1);
    cur = { skill: skill, ex: C.makeExercise(skill, level), mode: mode, misses: 0, hinted: false, done: false, started: false };
    renderExercise();
  }
  function modeLabel(m) { return m === 'review' ? 'Review' : (m === 'support' ? 'Extra help' : 'New practice'); }

  function renderExercise() {
    var p = prof(), ex = cur.ex, kid = p.age === '4-7', rg = kbRange(ex, p);
    var dots = ''; for (var i = 0; i < sess.total; i++) dots += '<i class="' + (i < sess.n ? 'done' : (i === sess.n ? 'cur' : '')) + '"></i>';
    var h = '<div class="row spread"><button class="ghost" data-a="quit">✕</button><div class="dots">' + dots + '</div><button class="ghost" data-a="listen">🔊</button></div>' +
      '<div class="card" style="margin-top:10px"><div class="mut small">' + esc(cur.skill.title) + ' · ' + modeLabel(cur.mode) + (sess.testOut ? ' · Test out' : '') + '</div>' +
      '<div class="prompt">' + esc(ex.prompt) + '</div><div id="vis"></div><div id="fb" class="feedback"></div><div id="ctl"></div></div>' +
      '<div class="kbwrap" id="kb">' + keyboardHTML(rg[0], rg[1], p) + '</div>';
    show(h);
    var kb = document.getElementById('kb');
    kb.querySelector('svg').addEventListener('pointerdown', function (e) {
      var n = e.target && e.target.getAttribute && e.target.getAttribute('data-note'); if (!n) return;
      e.preventDefault(); n = +n; tone(n, 0.6); lightKey(kb, n, 'k-ok', 140); emit(n, e.timeStamp > 0 ? e.timeStamp : performance.now());
    });
    if (ex.type === 'rhythm') setupRhythm(); else setupNotes();
    if (p.voice) say(ex.voice);
  }

  /* --- find / sequence / read --- */
  function hintWanted() {
    var p = prof(), st = states(p)[cur.skill.id], ex = cur.ex;
    if (ex.hint === 'onFail') return cur.misses >= 2;
    var fade = p.reading === 'none' ? 4 : 2;
    return st.attempts < fade || cur.misses >= 2 || st.failStreak >= 2;
  }
  function refreshNotes() {
    var p = prof(), ex = cur.ex, kb = document.getElementById('kb'), vis = document.getElementById('vis');
    var done = cur.matcher.result().progress * ex.targets.length, hint = hintWanted();
    if (ex.showStaff) {
      vis.innerHTML = '<div class="staffwrap" id="staffwrap">' + staffHTML(ex, { done: Math.round(done), names: p.reading !== 'fluent' && (!ex.readMode || hint) }, p) + '</div>';
      var sw = document.getElementById('staffwrap'); sw.scrollLeft = Math.max(0, 56 + done * 38 - sw.clientWidth / 2);
    } else if (ex.nameOnly) {
      vis.innerHTML = '<div class="circle" style="background:' + (colorOf(ex.targets[0]) || '#4ea1ff') + ';color:#111">' + ex.nameOnly + '</div>';
    } else { vis.innerHTML = ''; }
    clearHint(kb);
    if (hint && !cur.done) {
      cur.hinted = true; var nx = cur.matcher.next();
      if (nx != null) {
        if (ex.pitchClassOnly) { var r = kbRange(ex, p); for (var m = r[0]; m <= r[1]; m++) if (m % 12 === nx % 12) lightKey(kb, m, 'k-target'); }
        else lightKey(kb, nx, 'k-target');
      }
    }
  }
  function setupNotes() {
    var ex = cur.ex; cur.matcher = createM(ex); refreshNotes();
    Input.handler = function (note) {
      if (cur.done) return;
      var r = cur.matcher.feed(note), fb = document.getElementById('fb'), p = prof(), kb = document.getElementById('kb');
      if (r.status === 'wrong') {
        cur.misses++;
        lightKey(kb, note, 'k-bad', 300);
        fb.className = 'feedback bad';
        fb.textContent = p.reading === 'none' ? 'Oops! Try again.' : (ex.readMode ? 'Not quite. Try again.' : 'Not quite: that was ' + E.noteName(note) + '. Try again.');
        if (r.gaveUp) { cur.done = true; revealAndFinish(); return; }
        refreshNotes();
      } else {
        fb.className = 'feedback ok'; fb.textContent = r.status === 'done' ? '' : '✓';
        if (r.status === 'done') { cur.done = true; refreshNotes(); finishNotes(); } else refreshNotes();
      }
    };
  }
  function createM(ex) { return E.createMatcher(ex); }
  function finishNotes() {
    var res = cur.matcher.result(), q = res.quality * (cur.hinted ? 0.92 : 1);
    var msg = res.misses === 0 ? 'Perfect!' : (res.misses <= 2 ? 'Nice work!' : 'You got there!');
    finishExercise(q, msg);
  }
  function revealAndFinish() {
    var ex = cur.ex, kb = document.getElementById('kb'), p = prof(); clearHint(kb);
    var nx = cur.matcher.next(); if (nx != null) lightKey(kb, nx, 'k-target');
    document.getElementById('fb').textContent = "Let's listen to it together.";
    playDemo(); say(p.age === '4-7' ? "That's a tricky one. Let's listen together." : 'Let us listen to it together.');
    finishExercise(cur.matcher.result().quality * 0.8, "That's okay. We'll practise it again.");
  }

  /* --- rhythm / steady beat --- */
  function setupRhythm() {
    var p = prof(), ex = cur.ex, vis = document.getElementById('vis'), beatMs = 60000 / ex.bpm;
    var total = ex.pattern.reduce(function (a, b) { return a + b; }, 0), offs = E.patternOffsets(ex.pattern);
    var pat = '';
    if (ex.showPattern) pat = '<div class="pattern">' + ex.pattern.map(function (d) { return '<div style="width:' + (d * 46) + 'px">' + (d === 1 ? 'short' : (d === 2 ? 'long' : 'very long')) + '</div>'; }).join('') + '</div>';
    vis.innerHTML = pat + '<div class="beatwrap"><div class="circle" id="circ">♪</div><div class="beats" id="beats">' + offs.map(function () { return '<i></i>'; }).join('') + '</div></div>';
    document.getElementById('ctl').innerHTML = '<button class="big" data-a="rstart">Start (' + ex.bpm + ' beats per minute)</button>';
    cur.r = { beatMs: beatMs, total: total, offs: offs, running: false, played: [], expected: [], used: [], tol: beatMs * E.toleranceBeats(p.age) };
    Input.handler = function (note, t) { rhythmNote(t); };
  }
  function startRhythm() {
    var p = prof(), r = cur.r, ex = cur.ex, a = audio();
    document.getElementById('ctl').innerHTML = '';
    var now = performance.now(), start = now + 400, first = start + 4 * r.beatMs;
    r.expected = E.expectedOnsets(r.offs, r.beatMs, first); r.used = r.expected.map(function () { return false; }); r.first = first; r.running = true; r.played = [];
    if (a) { var base = a.currentTime + 0.4; for (var i = 0; i < 4 + r.total; i++) click(i % 4 === 0, base + i * r.beatMs / 1000); }
    var circ = document.getElementById('circ'), fb = document.getElementById('fb');
    fb.className = 'feedback'; fb.textContent = 'Listen… 1 2 3 4';
    for (var b = 0; b < 4 + r.total; b++) (function (b) {
      later(function () {
        circ.textContent = b < 4 ? String(b + 1) : '♪'; circ.classList.add('pulse'); setTimeout(function () { circ.classList.remove('pulse'); }, 90);
        if (b === 4) { fb.textContent = 'Go!'; }
      }, start + b * r.beatMs - performance.now());
    })(b);
    later(function () { endRhythm(); }, first + r.total * r.beatMs + r.beatMs * 0.7 - performance.now());
  }
  function rhythmNote(t) {
    var r = cur && cur.r; if (!r || !r.running) return;
    if (t < r.first - r.tol) return; // count-in taps are ignored
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
    var msg = res.hits + ' of ' + res.total + ' on time · ' + res.label;
    finishExercise(res.accuracy, p.age === '4-7' ? (res.accuracy >= 0.7 ? 'Great beat!' : "Let's try again!") : msg);
  }

  /* --- results --- */
  function finishExercise(q, msg) {
    var p = prof(), st = states(p), sk = cur.skill, fb = document.getElementById('fb'), kid = p.age === '4-7';
    clearTimers(); Input.handler = null; if (cur.r) cur.r.running = false;
    q = Math.max(0, Math.min(1, q));
    if (sess.testOut) { sess.results.push({ skillId: sk.id, q: q }); }
    else {
      var before = st[sk.id].mastered;
      st[sk.id] = E.updateSkill(st[sk.id], q, p.counter || 0, cfgFor(p)); p.counter = (p.counter || 0) + 1;
      sess.results.push({ skillId: sk.id, q: q });
      if (!before && st[sk.id].mastered) sess.newly.push(sk.title);
    }
    save();
    var s3 = E.stars(q), starStr = '★★★'.slice(0, s3) + '☆☆☆'.slice(0, 3 - s3);
    fb.className = 'feedback ' + (q >= 0.6 ? 'ok' : 'bad'); fb.innerHTML = esc(msg || '') + '<div class="stars" style="color:#ffd93d">' + starStr + '</div>';
    var justMastered = sess.newly.length && sess.newly[sess.newly.length - 1] === sk.title && !sess.testOut && st[sk.id].mastered && st[sk.id].masteredAt === (p.counter || 0) - 1;
    if (justMastered) fb.innerHTML += '<div>🎉 You mastered "' + esc(sk.title) + '"!</div>';
    document.getElementById('ctl').innerHTML = '<button class="big" data-a="next">' + (sess.n + 1 >= sess.total ? 'Finish' : 'Next ▶') + '</button>';
    if (p.voice) say(kid ? (q >= 0.9 ? 'Great job!' : (q >= 0.6 ? 'Well done!' : 'Good try!')) : '');
    sess.n++;
    var dots = document.querySelectorAll('.dots i'); if (dots[sess.n - 1]) dots[sess.n - 1].className = 'done'; if (dots[sess.n]) dots[sess.n].className = 'cur';
  }
  function playDemo() {
    var a = audio(); if (!a || !cur) return; var ex = cur.ex, t = a.currentTime + 0.05;
    if (ex.type === 'rhythm') { var bm = 60 / ex.bpm; E.patternOffsets(ex.pattern).forEach(function (o) { tone(72, 0.25, t + o * bm); }); return; }
    var gap = ex.targets.length > 12 ? 0.32 : 0.45;
    ex.targets.forEach(function (n, i) { tone(n, 0.5, t + i * gap); });
  }

  function endSession() {
    var p = prof(), st = states(p), kid = p.age === '4-7', secs = Math.round((Date.now() - sess.started) / 1000);
    p.seconds = (p.seconds || 0) + secs; p.sessions = (p.sessions || 0) + 1;
    var h, avg = sess.results.length ? sess.results.reduce(function (a, r) { return a + r.q; }, 0) / sess.results.length : 0;
    if (sess.testOut) {
      var sk = C.skillById(sess.skillOnly), passed = avg >= 0.8 && sess.results.length >= 3;
      if (passed) { var s = st[sk.id], c = cfgFor(p); s.mastered = true; s.score = Math.max(s.score, 0.85); s.attempts = Math.max(s.attempts, c.minAttempts); s.wins = Math.max(s.wins, 4); s.lastSeen = p.counter || 0; s.failStreak = 0; s.masteredAt = p.counter || 0; }
      save();
      h = '<div class="card center"><h1>' + (passed ? '🎉 You already know this!' : 'Not quite yet') + '</h1><p>' + (passed ? '"' + esc(sk.title) + '" is marked as mastered.' : 'No problem. Keep practising "' + esc(sk.title) + '" and you will get there.') + '</p></div>';
    } else {
      save();
      var stars = sess.results.reduce(function (a, r) { return a + E.stars(r.q); }, 0);
      var seen = {}; sess.results.forEach(function (r) { seen[r.skillId] = 1; });
      h = '<div class="card center"><h1>' + (kid ? 'All done for today! 🐥' : 'Session complete') + '</h1><div class="stars" style="color:#ffd93d">' + stars + ' ⭐</div>' +
        '<p class="mut">' + sess.results.length + ' exercises · about ' + Math.max(1, Math.round(secs / 60)) + ' min</p>' +
        (sess.newly.length ? '<p>🎉 New skills mastered: <b>' + sess.newly.map(esc).join(', ') + '</b></p>' : '') +
        '<p class="mut small">Practised: ' + Object.keys(seen).map(skillTitle).map(esc).join(' · ') + '</p>' +
        sess.notes.map(function (n) { return '<p class="mut small">' + esc(n) + '</p>'; }).join('') +
        (kid ? '<p>See you tomorrow!</p>' : '') + '</div>';
    }
    show(h + '<button class="big" data-a="home">Back to home</button>'); if (p.voice) say(kid ? 'All done for today. See you tomorrow!' : '');
    sess = null; cur = null;
  }

  /* ---------------- settings, skills, parent ---------------- */
  function skillModal(id) {
    var p = prof(), s = C.skillById(id), st = states(p)[id], avail = E.available(C.SKILLS, states(p)).some(function (a) { return a.id === id; });
    var can = st.mastered || avail;
    modal('<h3>' + esc(s.title) + '</h3><p class="mut">' + esc(s.blurb) + '</p>' +
      '<p class="mut small">Score ' + Math.round(st.score * 100) + '% · ' + st.attempts + ' attempts' + (st.mastered ? ' · mastered' : '') + '</p>' +
      (can ? '<button class="big" data-a="practiceskill" data-id="' + id + '">Practise this</button>' + (!st.mastered ? '<button class="ghost big" style="margin-top:8px" data-a="testout" data-id="' + id + '">I already know this: test out</button>' : '') :
        '<p>Finish the skills before it first: ' + s.prereqs.filter(function (q) { return !states(p)[q].mastered; }).map(skillTitle).map(esc).join(', ') + '.</p>') +
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
      var detail = C.SKILLS.map(function (s) { var x = st[s.id]; return '<tr><td>' + esc(s.title) + '</td><td>' + (x.mastered ? '✓' : (x.attempts ? 'learning' : '-')) + '</td><td>' + Math.round(x.score * 100) + '%</td><td>' + x.attempts + '</td></tr>'; }).join('');
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
    pick: function (d) { store.current = d.id; save(); viewHome(); },
    addprofile: function () { ob = { name: '', age: '8-12', reading: 'some', input: 'midi', keys: '88' }; viewOnboarding(); },
    welcome: function () { clearTimers(); closeModal(); viewWelcome(); },
    home: function () { closeModal(); viewHome(); },
    ob: function (d) {
      var nm = document.getElementById('obname'); if (nm) ob.name = nm.value;
      ob[d.k] = d.v; if (d.k === 'age') ob.reading = E.defaultReading(d.v);
      viewOnboarding();
    },
    createprofile: function () {
      var nm = document.getElementById('obname'); if (nm) ob.name = nm.value;
      var name = (ob.name || '').trim() || 'Learner';
      var p = { id: 'p' + Date.now(), name: name, age: ob.age, reading: ob.reading, input: ob.input, keys: ob.keys, voice: ob.age === '4-7', states: {}, counter: 0, sessions: 0, seconds: 0, created: Date.now() };
      store.profiles.push(p); store.current = p.id; save(); viewHome();
    },
    midi: function () { connectMIDI(); },
    start: function () { startSession(); },
    skill: function (d) { skillModal(d.id); },
    closemodal: closeModal,
    practiceskill: function (d) { closeModal(); startSession({ skillOnly: d.id }); },
    testout: function (d) { closeModal(); startSession({ skillOnly: d.id, testOut: true }); },
    next: function () { nextExercise(); },
    quit: function () { clearTimers(); Input.handler = null; sess = null; cur = null; viewHome(); },
    listen: function () { playDemo(); if (cur && prof().voice) say(cur.ex.voice); },
    rstart: function () { startRhythm(); },
    settings: settingsModal,
    setvoice: function (d) { prof().voice = d.v === '1'; save(); closeModal(); settingsModal(); },
    setreading: function (d) { prof().reading = d.v; save(); closeModal(); settingsModal(); },
    setinput: function (d) { prof().input = d.v; save(); closeModal(); viewHome(); },
    parent: function () { parentGate(); },
    gateok: function () { var v = +document.getElementById('gate').value; if (v === window._gate) viewParent(); else { alert('Not quite. Ask a grown-up.'); parentGate(); } },
    resetprofile: function (d) { if (confirm('Reset all progress for this learner?')) { store.profiles.forEach(function (p) { if (p.id === d.id) { p.states = {}; p.counter = 0; p.lastSkillId = null; p.sameCount = 0; p.sessions = 0; p.seconds = 0; } }); save(); viewParent(); } },
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

  window.__test = { cur: function () { return cur; }, sess: function () { return sess; } };
  viewWelcome();
})();
