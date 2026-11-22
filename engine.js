/* engine.js: pure teaching logic, no DOM. Runs in the browser (window.Engine) and in Node (tests). */
(function (root) {
  'use strict';

  var PC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  var WHITE_DN = { 0: 0, 2: 1, 4: 2, 5: 3, 7: 4, 9: 5, 11: 6 };

  function mod12(m) { return ((m % 12) + 12) % 12; }
  function noteName(m) { return PC[mod12(m)] + (Math.floor(m / 12) - 1); }
  function pcName(m) { return PC[mod12(m)]; }
  function isWhite(m) { return Object.prototype.hasOwnProperty.call(WHITE_DN, mod12(m)); }
  // Diatonic step number counted from C(-1); used to place notes on a staff.
  function diatonic(m) {
    var pc = mod12(m);
    var base = isWhite(m) ? WHITE_DN[pc] : WHITE_DN[pc - 1];
    return (Math.floor(m / 12) - 1) * 7 + base;
  }

  /* ---------- note matching (find / sequence / read exercises) ---------- */
  // Accepts the right notes in order. For small keyboards, the whole phrase may be
  // played in a different octave: the first note fixes the shift, later notes must follow it.
  function createMatcher(ex) {
    var t = ex.targets, i = 0, misses = 0, shift = null;
    var limit = ex.maxMisses != null ? ex.maxMisses : (t.length === 1 ? 3 : t.length + 3);
    function ok(note, exp) {
      if (ex.pitchClassOnly) return mod12(note) === mod12(exp);
      if (shift === null) { var d = note - exp; return d % 12 === 0 && Math.abs(d) <= 36; }
      return note - exp === shift;
    }
    return {
      next: function () { return i < t.length ? t[i] : null; },
      feed: function (note) {
        if (i >= t.length) return { status: 'done' };
        var exp = t[i];
        if (ok(note, exp)) {
          if (!ex.pitchClassOnly && shift === null) shift = note - exp;
          i++;
          return { status: i === t.length ? 'done' : 'correct', index: i, played: note, expected: exp };
        }
        misses++;
        return { status: 'wrong', index: i, played: note, expected: exp, misses: misses, gaveUp: misses >= limit };
      },
      result: function () {
        var acc = t.length / (t.length + misses);
        var progress = i / t.length;
        return { done: i >= t.length, misses: misses, accuracy: acc, progress: progress, quality: acc * progress };
      },
      shift: function () { return shift || 0; }
    };
  }

  /* ---------- timing (beat / rhythm exercises) ---------- */
  function expectedOnsets(beatOffsets, beatMs, startMs) {
    return beatOffsets.map(function (b) { return startMs + b * beatMs; });
  }
  function patternOffsets(pattern) {
    var out = [], c = 0;
    pattern.forEach(function (d) { out.push(c); c += d; });
    return out;
  }
  function scoreTiming(expected, played, tolMs) {
    var used = expected.map(function () { return false; });
    var hits = 0, extra = 0, offs = [];
    played.forEach(function (p) {
      var best = -1, bd = Infinity;
      for (var k = 0; k < expected.length; k++) {
        if (used[k]) continue;
        var d = Math.abs(p - expected[k]);
        if (d < bd) { bd = d; best = k; }
      }
      if (best >= 0 && bd <= tolMs) { used[best] = true; hits++; offs.push(p - expected[best]); } else { extra++; }
    });
    var total = expected.length;
    var avg = offs.length ? offs.reduce(function (a, b) { return a + b; }, 0) / offs.length : 0;
    var accuracy = Math.max(0, Math.min(1, hits / total - 0.1 * extra));
    var label = avg > tolMs * 0.4 ? 'a little late' : (avg < -tolMs * 0.4 ? 'a little early' : 'right on the beat');
    return { hits: hits, total: total, extra: extra, avgOffsetMs: avg, accuracy: accuracy, label: label };
  }
  function toleranceBeats(age) { return age === '4-7' ? 0.4 : (age === '8-12' ? 0.33 : 0.28); }

  /* ---------- mastery ---------- */
  function masteryConfig(age) { return { minAttempts: age === '4-7' ? 3 : 4, threshold: 0.8 }; }
  function newSkillState() { return { score: 0, attempts: 0, wins: 0, failStreak: 0, mastered: false, lastSeen: -1, history: [] }; }
  function ensureStates(skills, states) {
    skills.forEach(function (s) { if (!states[s.id]) states[s.id] = newSkillState(); });
    return states;
  }
  function updateSkill(st, quality, counter, cfg) {
    var s = JSON.parse(JSON.stringify(st));
    s.score = s.attempts === 0 ? quality : 0.65 * s.score + 0.35 * quality;
    s.attempts++;
    if (quality >= 0.7) s.wins++;
    s.lastSeen = counter;
    s.failStreak = quality < 0.5 ? s.failStreak + 1 : 0;
    s.history = (s.history || []).concat([Math.round(quality * 100) / 100]).slice(-10);
    if (!s.mastered && s.attempts >= cfg.minAttempts && s.score >= cfg.threshold) { s.mastered = true; s.masteredAt = counter; }
    else if (s.mastered && s.score < 0.6) { s.mastered = false; }
    return s;
  }
  function levelFor(st, maxLevel) {
    var lvl = Math.min(maxLevel, Math.floor(st.wins / 2));
    if (st.failStreak >= 2) lvl = Math.max(0, lvl - 1);
    return lvl;
  }
  function stars(q) { return q >= 0.9 ? 3 : (q >= 0.6 ? 2 : 1); }

  /* ---------- sequencing ---------- */
  function byId(skills) { var m = {}; skills.forEach(function (s) { m[s.id] = s; }); return m; }
  function available(skills, states) {
    return skills.filter(function (s) {
      return !states[s.id].mastered && s.prereqs.every(function (p) { return states[p].mastered; });
    });
  }
  // Decide what to practise next. ctx: { counter, lastSkillId, sameCount }
  function pickNext(skills, states, ctx) {
    var avail = available(skills, states);
    var map = byId(skills);
    var cur = avail.filter(function (s) { return s.id === ctx.lastSkillId; })[0];

    // 1. Stuck: step back to the weakest prerequisite.
    if (cur && states[cur.id].failStreak >= 5 && cur.prereqs.length) {
      var weakest = cur.prereqs.slice().sort(function (a, b) { return states[a].score - states[b].score; })[0];
      return { skillId: weakest, mode: 'review', reason: 'step-back', from: cur.id };
    }
    // 2. Spaced review of older skills every 4th activity.
    if (ctx.counter > 0 && ctx.counter % 4 === 0) {
      var due = skills.filter(function (s) { return states[s.id].mastered && ctx.counter - states[s.id].lastSeen >= 8; })
        .sort(function (a, b) { return states[a.id].lastSeen - states[b.id].lastSeen; })[0];
      if (due) return { skillId: due.id, mode: 'review', reason: 'spaced' };
    }
    // 3. Everything mastered: keep fresh by reviewing the oldest.
    if (!avail.length) {
      var all = skills.slice().sort(function (a, b) { return states[a.id].lastSeen - states[b.id].lastSeen; })[0];
      return all ? { skillId: all.id, mode: 'review', reason: 'all-done' } : null;
    }
    // 4. Learn: continue the current skill, but rotate after 3 in a row for variety.
    var pick = cur || avail[0];
    if (cur && ctx.sameCount >= 3 && avail.length > 1) {
      pick = avail.filter(function (s) { return s.id !== cur.id; })[0];
    }
    return { skillId: pick.id, mode: states[pick.id].failStreak >= 3 ? 'support' : 'learn', reason: 'next' };
  }
  function stageDone(skills, states, stage) {
    return skills.filter(function (s) { return s.stage === stage; }).every(function (s) { return states[s.id].mastered; });
  }
  function sessionLength(age) { return age === '4-7' ? 5 : (age === '8-12' ? 8 : 10); }
  function defaultReading(age) { return age === '4-7' ? 'none' : (age === '8-12' ? 'some' : 'fluent'); }

  var api = {
    noteName: noteName, pcName: pcName, isWhite: isWhite, diatonic: diatonic, mod12: mod12,
    createMatcher: createMatcher, expectedOnsets: expectedOnsets, patternOffsets: patternOffsets,
    scoreTiming: scoreTiming, toleranceBeats: toleranceBeats,
    masteryConfig: masteryConfig, newSkillState: newSkillState, ensureStates: ensureStates,
    updateSkill: updateSkill, levelFor: levelFor, stars: stars,
    available: available, pickNext: pickNext, stageDone: stageDone,
    sessionLength: sessionLength, defaultReading: defaultReading
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Engine = api;
})(typeof window !== 'undefined' ? window : this);
