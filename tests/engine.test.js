'use strict';
const assert = require('assert');
const E = require('../engine.js');
const C = require('../content.js');
let n = 0;
function t(name, fn) { fn(); n++; console.log('ok -', name); }
function rng(seed) { let s = seed; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }

t('note names and staff positions', () => {
  assert.strictEqual(E.noteName(60), 'C4');
  assert.strictEqual(E.noteName(69), 'A4');
  assert.strictEqual(E.diatonic(60), 28);
  assert.strictEqual(E.diatonic(64), 30); // E4 = bottom line of treble staff
  assert.strictEqual(E.diatonic(43), 18); // G2 = bottom line of bass staff
});

t('matcher: exact sequence', () => {
  const m = E.createMatcher({ targets: [60, 62, 64] });
  assert.strictEqual(m.feed(60).status, 'correct');
  assert.strictEqual(m.feed(62).status, 'correct');
  assert.strictEqual(m.feed(64).status, 'done');
  assert.strictEqual(m.result().quality, 1);
});
t('matcher: wrong notes cost accuracy, do not advance', () => {
  const m = E.createMatcher({ targets: [60, 62] });
  assert.strictEqual(m.feed(61).status, 'wrong');
  assert.strictEqual(m.feed(60).status, 'correct');
  m.feed(62);
  const r = m.result();
  assert.ok(r.done); assert.strictEqual(r.misses, 1);
  assert.ok(Math.abs(r.accuracy - 2 / 3) < 1e-9);
});
t('matcher: small keyboard octave shift is accepted consistently', () => {
  const m = E.createMatcher({ targets: [60, 62, 64] });
  assert.strictEqual(m.feed(48).status, 'correct'); // an octave lower
  assert.strictEqual(m.feed(50).status, 'correct');
  assert.strictEqual(m.feed(64).status, 'wrong'); // jumped octave mid-phrase
  assert.strictEqual(m.feed(52).status, 'done');
});
t('matcher: non-octave offset rejected', () => {
  const m = E.createMatcher({ targets: [60] });
  assert.strictEqual(m.feed(62).status, 'wrong');
});
t('matcher: pitch class only', () => {
  const m = E.createMatcher({ targets: [60], pitchClassOnly: true });
  assert.strictEqual(m.feed(72).status, 'done');
});
t('matcher: gives up after limit', () => {
  const m = E.createMatcher({ targets: [60] });
  m.feed(61); m.feed(61);
  assert.strictEqual(m.feed(61).gaveUp, true);
  assert.strictEqual(m.result().quality, 0);
});

t('timing: on the beat vs late vs extra', () => {
  const exp = [1000, 2000, 3000, 4000];
  const good = E.scoreTiming(exp, [1010, 1990, 3020, 4005], 300);
  assert.strictEqual(good.hits, 4); assert.strictEqual(good.accuracy, 1);
  assert.strictEqual(good.label, 'right on the beat');
  const late = E.scoreTiming(exp, [1200, 2200, 3200, 4200], 300);
  assert.strictEqual(late.label, 'a little late');
  const miss = E.scoreTiming(exp, [1000, 2000, 3500], 300);
  assert.strictEqual(miss.hits, 2); assert.ok(miss.accuracy < 0.6);
  const spam = E.scoreTiming(exp, [1000, 1100, 1200, 2000, 3000, 4000], 300);
  assert.ok(spam.extra >= 1 && spam.accuracy < 1);
});
t('pattern offsets', () => {
  assert.deepStrictEqual(E.patternOffsets([1, 1, 2, 4]), [0, 1, 2, 4]);
  assert.deepStrictEqual(E.expectedOnsets([0, 1, 2], 500, 100), [100, 600, 1100]);
});

t('mastery: four perfect attempts master a skill, a collapse un-masters', () => {
  const cfg = E.masteryConfig('13-17');
  let s = E.newSkillState();
  for (let i = 0; i < 3; i++) s = E.updateSkill(s, 1, i, cfg);
  assert.strictEqual(s.mastered, false);
  s = E.updateSkill(s, 1, 3, cfg);
  assert.strictEqual(s.mastered, true);
  for (let i = 0; i < 4; i++) s = E.updateSkill(s, 0, 10 + i, cfg);
  assert.strictEqual(s.mastered, false);
});
t('mastery: young learners need 3 attempts', () => {
  const cfg = E.masteryConfig('4-7');
  let s = E.newSkillState();
  for (let i = 0; i < 3; i++) s = E.updateSkill(s, 1, i, cfg);
  assert.strictEqual(s.mastered, true);
});
t('mastery: struggling does not master; fail streak counts', () => {
  const cfg = E.masteryConfig('8-12');
  let s = E.newSkillState();
  for (let i = 0; i < 6; i++) s = E.updateSkill(s, 0.3, i, cfg);
  assert.strictEqual(s.mastered, false); assert.strictEqual(s.failStreak, 6);
  s = E.updateSkill(s, 1, 7, cfg);
  assert.strictEqual(s.failStreak, 0);
});
t('level rises with wins, drops when failing', () => {
  const st = E.newSkillState(); st.wins = 6;
  assert.strictEqual(E.levelFor(st, 3), 3);
  assert.strictEqual(E.levelFor(st, 2), 2);
  st.failStreak = 2;
  assert.strictEqual(E.levelFor(st, 3), 2);
  assert.strictEqual(E.levelFor(E.newSkillState(), 3), 0);
});

t('quiz rules: checkAccept', () => {
  assert.ok(E.checkAccept({ mode: 'any' }, 1));
  assert.ok(E.checkAccept({ mode: 'black' }, 61)); assert.ok(!E.checkAccept({ mode: 'black' }, 60));
  assert.ok(E.checkAccept({ mode: 'white' }, 60)); assert.ok(!E.checkAccept({ mode: 'white' }, 61));
  assert.ok(E.checkAccept({ mode: 'range', lo: 48, hi: 55 }, 50)); assert.ok(!E.checkAccept({ mode: 'range', lo: 48, hi: 55 }, 56));
  assert.ok(E.checkAccept({ mode: 'pc', pcs: [0] }, 72)); assert.ok(!E.checkAccept({ mode: 'pc', pcs: [0] }, 62));
  assert.ok(E.checkAccept({ mode: 'note', note: 60 }, 60)); assert.ok(!E.checkAccept({ mode: 'note', note: 60 }, 72));
  assert.strictEqual(E.quizQuality(0), 1); assert.strictEqual(E.quizQuality(1), 0.55); assert.strictEqual(E.quizQuality(2), 0);
});

t('content: graph is valid (ids, prereqs exist, no cycles, topological order, both kinds present)', () => {
  const ids = new Set(C.SKILLS.map(s => s.id));
  assert.strictEqual(ids.size, C.SKILLS.length);
  const seen = new Set();
  C.SKILLS.forEach(s => {
    s.prereqs.forEach(p => { assert.ok(ids.has(p), 'missing prereq ' + p); assert.ok(seen.has(p), s.id + ' listed before prereq ' + p); });
    seen.add(s.id);
    assert.ok(C.STAGES.includes(s.stage));
    assert.ok(['theory', 'practical'].includes(s.kind));
    assert.ok(s.sticker && s.blurb);
    assert.strictEqual(s.reviewed, false);
    if (s.kind === 'theory') assert.ok(s.lesson && s.lesson.length >= 3, s.id + ' needs a lesson');
  });
  assert.ok(C.ofKind('theory').length >= 6 && C.ofKind('practical').length >= 9);
});

const VIS = ['kb', 'hands', 'blocks', 'staff', 'big', 'beats'];
function checkVis(v, where) {
  assert.ok(VIS.includes(v.k), where + ' unknown vis ' + v.k);
  if (v.k === 'kb') { assert.ok(v.lo % 12 === 0 && v.hi % 12 === 0 && v.hi > v.lo, where + ' kb range must start and end on C'); (v.light || []).forEach(n => assert.ok(n >= v.lo && n <= v.hi, where + ' light out of range')); }
  if (v.k === 'staff') { assert.ok(v.notes.length >= 1); v.notes.forEach(n => assert.ok(E.isWhite(n))); }
  if (v.k === 'blocks') v.pattern.forEach(d => assert.ok([1, 2, 4].includes(d)));
  if (v.k === 'hands') assert.ok(['R', 'L', 'both'].includes(v.hand));
}
function checkPlay(p, where) {
  assert.ok(p.notes || p.clicks || p.pattern, where + ' play needs something to play');
  if (p.clicks && typeof p.clicks === 'object') { assert.ok(p.clicks.bpm >= 40 && p.clicks.bpm <= 160 && p.clicks.count >= 1); }
  if (p.pattern) { assert.ok(p.bpm >= 40 && p.bpm <= 120, 'pattern play needs bpm'); p.pattern.forEach(d => assert.ok([1, 2, 4].includes(d))); }
}
t('content: every lesson step is well formed', () => {
  C.SKILLS.filter(s => s.kind === 'theory').forEach(s => s.lesson.forEach((st, i) => {
    const w = s.id + ' step ' + (i + 1);
    assert.ok(st.title && st.text && st.kid && st.vis, w + ' needs title, text, kid text and vis');
    checkVis(st.vis, w);
    if (st.play) checkPlay(st.play, w);
    if (st.tap) {
      const kbv = st.vis.k === 'kb' ? st.vis : st.vis.kb;
      assert.ok(kbv && kbv.lo % 12 === 0 && kbv.hi % 12 === 0, w + ' tap steps need a keyboard');
      // every tap requirement must be satisfiable by some key on the shown keyboard
      st.tap.forEach(rule => { let any = false; for (let n = kbv.lo; n <= kbv.hi; n++) if (E.checkAccept(rule, n)) any = true; assert.ok(any, w + ' tap rule cannot be met'); });
    }
  }));
});
t('content: every skill at every level makes a valid exercise (400 random draws each)', () => {
  const r = rng(7);
  C.SKILLS.forEach(s => {
    for (let lvl = 0; lvl <= s.maxLevel; lvl++) {
      for (let k = 0; k < 400; k++) {
        const ex = C.makeExercise(s, lvl, r);
        const w = s.id + ' L' + lvl;
        assert.ok(ex.prompt && ex.voice && ex.kid, w + ' needs prompt, kid prompt and voice');
        assert.strictEqual(ex.kind, s.kind);
        if (ex.vis) checkVis(ex.vis, w);
        if (ex.play) checkPlay(ex.play, w);
        if (ex.type === 'quiz') {
          assert.strictEqual(s.kind, 'theory');
          if (ex.qtype === 'choice') {
            assert.ok(ex.options.length >= 2 && ex.options.length <= 4, w + ' option count');
            assert.ok(ex.correct >= 0 && ex.correct < ex.options.length, w + ' correct index');
            const texts = ex.options.map(o => o.text + JSON.stringify(o.pattern || '') + JSON.stringify(o.play || ''));
            assert.strictEqual(new Set(texts).size, texts.length, w + ' duplicate options');
            ex.options.forEach(o => { if (o.play) checkPlay(o.play, w); if (o.pattern) o.pattern.forEach(d => assert.ok([1, 2, 4].includes(d))); });
          } else {
            assert.strictEqual(ex.qtype, 'tap');
            assert.ok(ex.kb.lo % 12 === 0 && ex.kb.hi % 12 === 0);
            let n = 0; for (let m = ex.kb.lo; m <= ex.kb.hi; m++) if (E.checkAccept(ex.accept, m)) n++;
            assert.ok(n >= 1, w + ' no key satisfies the rule');
            if (ex.accept.mode === 'note') { assert.ok(ex.accept.note >= ex.kb.lo && ex.accept.note <= ex.kb.hi); assert.deepStrictEqual(ex.vis.notes, [ex.accept.note]); }
          }
        } else if (ex.type === 'rhythm') {
          assert.strictEqual(s.kind, 'practical');
          assert.ok(ex.pattern.length >= 1 && ex.bpm >= 40 && ex.bpm <= 120);
          ex.pattern.forEach(d => assert.ok([1, 2, 4].includes(d)));
        } else {
          assert.strictEqual(s.kind, 'practical');
          assert.ok(['find', 'seq'].includes(ex.type));
          assert.ok(ex.targets.length >= 1 && ex.targets.length <= 30);
          ex.targets.forEach(x => { assert.ok(x >= 36 && x <= 84, w + ' range'); assert.ok(E.isWhite(x), w + ' white keys only'); });
          if (ex.fingers) { assert.strictEqual(ex.fingers.length, ex.targets.length); ex.fingers.forEach(f => assert.ok(f >= 1 && f <= 5)); }
          if (ex.hand) assert.ok(['R', 'L'].includes(ex.hand));
          if (ex.setup) {
            assert.strictEqual(ex.setup.hand, ex.hand); assert.strictEqual(ex.setup.fingerNotes.length, 5);
            assert.ok(ex.setup.fingerNotes.indexOf(ex.setup.confirmNote) >= 0);
            assert.ok(ex.setup.title && ex.setup.text && ex.setup.kid);
            // the hand position covers every note the exercise asks for
            ex.targets.forEach(x => assert.ok(ex.setup.fingerNotes.indexOf(x) >= 0, w + ' note outside hand position'));
          }
          const m = E.createMatcher(ex);
          let last; ex.targets.forEach(x => { last = m.feed(x); });
          assert.strictEqual(last.status, 'done'); assert.strictEqual(m.result().quality, 1);
        }
      }
    }
  });
});
t('content: finger numbers match the hand position (right: thumb on C; left: pinky on C)', () => {
  const f4 = C.makeExercise(C.skillById('f4'), 2), b1 = C.makeExercise(C.skillById('b1'), 2);
  assert.deepStrictEqual(f4.targets.map((n, i) => [n, f4.fingers[i]]), [[60, 1], [62, 2], [64, 3], [65, 4], [67, 5]]);
  assert.deepStrictEqual(b1.targets.map((n, i) => [n, b1.fingers[i]]), [[48, 5], [50, 4], [52, 3], [53, 2], [55, 1]]);
  const hcb = C.makeExercise(C.skillById('b2'), 2);
  hcb.targets.forEach((n, i) => assert.strictEqual(hcb.fingers[i], { 64: 3, 62: 2, 60: 1 }[n]));
});
t('content: melodies are what they should be', () => {
  const hcb = C.makeExercise(C.skillById('b2'), 2).targets;
  assert.deepStrictEqual(hcb, [64,62,60, 64,62,60, 60,60,60,60,62,62,62,62, 64,62,60]);
  assert.strictEqual(C.makeExercise(C.skillById('b3'), 2).targets.length, 26);
  assert.strictEqual(C.makeExercise(C.skillById('b5'), 2).targets.length, 30);
});
t('content: kid prompts are short and simple', () => {
  const r = rng(11);
  C.SKILLS.forEach(s => { for (let lvl = 0; lvl <= s.maxLevel; lvl++) for (let k = 0; k < 40; k++) {
    const ex = C.makeExercise(s, lvl, r); const words = ex.kid.split(/\s+/).length;
    assert.ok(words <= 16, s.id + ' kid prompt too long (' + words + '): ' + ex.kid);
  } });
  C.SKILLS.filter(s => s.kind === 'theory').forEach(s => s.lesson.forEach((st, i) => assert.ok(st.kid.split(/\s+/).length <= 30, s.id + ' step ' + (i + 1) + ' kid text too long')));
});

t('scheduler: starts with the first lesson, unlocks in order', () => {
  const states = E.ensureStates(C.SKILLS, {});
  let p = E.pickNext(C.SKILLS, states, { counter: 0, lastSkillId: null, sameCount: 0 });
  assert.strictEqual(p.skillId, 'th1'); assert.strictEqual(p.mode, 'learn');
  states.th1.mastered = true;
  assert.deepStrictEqual(E.available(C.SKILLS, states).map(s => s.id), ['th2', 'th4', 'th5']);
});
t('scheduler: no playing before the basics are learned', () => {
  const states = E.ensureStates(C.SKILLS, {});
  assert.strictEqual(E.available(C.ofKind('practical'), states).length, 0);
  ['th1', 'th4'].forEach(id => { states[id].mastered = true; });
  assert.deepStrictEqual(E.available(C.ofKind('practical'), states).map(s => s.id), ['f1']);
});
t('scheduler: rotates after 3 in a row when alternatives exist', () => {
  const states = E.ensureStates(C.SKILLS, {});
  states.th1.mastered = true;
  const p = E.pickNext(C.SKILLS, states, { counter: 3, lastSkillId: 'th2', sameCount: 3 });
  assert.strictEqual(p.skillId, 'th4');
});
t('scheduler: steps back to the weakest prerequisite after 5 fails', () => {
  const states = E.ensureStates(C.SKILLS, {});
  ['th1', 'th2', 'th3', 'th4', 'f1', 'f2', 'f3'].forEach(id => { states[id].mastered = true; states[id].score = 0.9; });
  states.th3.score = 0.6; states.f4.failStreak = 5;
  const p = E.pickNext(C.SKILLS, states, { counter: 5, lastSkillId: 'f4', sameCount: 1 });
  assert.strictEqual(p.mode, 'review'); assert.strictEqual(p.reason, 'step-back'); assert.strictEqual(p.skillId, 'th3');
  // in a Play-only session, only playable prerequisites are offered
  const q = E.pickNext(C.ofKind('practical'), states, { counter: 5, lastSkillId: 'f4', sameCount: 1 });
  assert.strictEqual(q.skillId, 'f3');
});
t('scheduler: support mode after 3 fails', () => {
  const states = E.ensureStates(C.SKILLS, {});
  states.th1.failStreak = 3;
  assert.strictEqual(E.pickNext(C.SKILLS, states, { counter: 1, lastSkillId: 'th1', sameCount: 1 }).mode, 'support');
});
t('scheduler: spaced review of old mastered skills', () => {
  const states = E.ensureStates(C.SKILLS, {});
  states.th1.mastered = true; states.th1.lastSeen = 0;
  const p = E.pickNext(C.SKILLS, states, { counter: 12, lastSkillId: 'th2', sameCount: 1 });
  assert.strictEqual(p.reason, 'spaced'); assert.strictEqual(p.skillId, 'th1');
});
t('session lengths: shorter for little ones, theory shorter than playing', () => {
  assert.strictEqual(E.sessionLength('4-7', 'theory'), 4); assert.strictEqual(E.sessionLength('4-7', 'practical'), 5);
  assert.ok(E.sessionLength('adult', 'practical') > E.sessionLength('adult', 'theory'));
});
t('whole curriculum can be completed by simulated learners of every age, alternating Learn and Play', () => {
  ['4-7', '8-12', '13-17', 'adult'].forEach(age => {
    const cfg = E.masteryConfig(age);
    const states = E.ensureStates(C.SKILLS, {});
    const r = rng(42), ctx = { theory: { last: null, same: 0 }, practical: { last: null, same: 0 } };
    let counter = 0, kind = 'theory', sessions = 0;
    while (!C.SKILLS.every(s => states[s.id].mastered)) {
      let list = C.ofKind(kind);
      // like the app: only offer a session type that has something new to learn
      if (!E.available(list, states).length) { kind = kind === 'theory' ? 'practical' : 'theory'; if (!E.available(C.ofKind(kind), states).length) throw new Error('deadlock ' + age); list = C.ofKind(kind); }
      const n = E.sessionLength(age, kind);
      for (let i = 0; i < n; i++) {
        const c = ctx[kind];
        const p = E.pickNext(list, states, { counter, lastSkillId: c.last, sameCount: c.same });
        c.same = p.skillId === c.last ? c.same + 1 : 1; c.last = p.skillId;
        const q = r() < 0.85 ? 0.8 + r() * 0.2 : 0.3;
        states[p.skillId] = E.updateSkill(states[p.skillId], q, counter, cfg);
        counter++;
      }
      sessions++; kind = kind === 'theory' ? 'practical' : 'theory';
      assert.ok(sessions < 80, 'did not finish for ' + age);
    }
    console.log('   ', age, 'finished everything in', sessions, 'sessions and', counter, 'exercises');
  });
});

console.log('\n' + n + ' tests passed');
