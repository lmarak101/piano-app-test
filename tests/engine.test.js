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

t('content: graph is valid (ids, prereqs exist, no cycles, topological order)', () => {
  const ids = new Set(C.SKILLS.map(s => s.id));
  assert.strictEqual(ids.size, C.SKILLS.length);
  const seen = new Set();
  C.SKILLS.forEach(s => {
    s.prereqs.forEach(p => { assert.ok(ids.has(p), 'missing prereq ' + p); assert.ok(seen.has(p), s.id + ' listed before prereq ' + p); });
    seen.add(s.id);
    assert.ok(C.STAGES.includes(s.stage));
    assert.strictEqual(s.reviewed, false);
  });
});
t('content: every skill at every level makes a valid exercise (500 random draws each)', () => {
  const r = rng(7);
  C.SKILLS.forEach(s => {
    for (let lvl = 0; lvl <= s.maxLevel; lvl++) {
      for (let k = 0; k < 500; k++) {
        const ex = C.makeExercise(s, lvl, r);
        assert.ok(ex.prompt && ex.voice, s.id + ' needs prompt+voice');
        assert.ok(['find', 'seq', 'rhythm'].includes(ex.type));
        if (ex.type === 'rhythm') {
          assert.ok(ex.pattern.length >= 1 && ex.bpm >= 40 && ex.bpm <= 120);
          ex.pattern.forEach(d => assert.ok([1, 2, 4].includes(d)));
        } else {
          assert.ok(ex.targets.length >= 1 && ex.targets.length <= 30);
          ex.targets.forEach(x => { assert.ok(x >= 36 && x <= 84, s.id + ' range'); assert.ok(E.isWhite(x), s.id + ' white keys only'); });
          if (ex.fingers) assert.strictEqual(ex.fingers.length, ex.targets.length);
          // an ideal player always passes
          const m = E.createMatcher(ex);
          let last; ex.targets.forEach(x => { last = m.feed(x); });
          assert.strictEqual(last.status, 'done'); assert.strictEqual(m.result().quality, 1);
        }
      }
    }
  });
});
t('content: melodies are what they should be', () => {
  const hcb = C.makeExercise(C.skillById('b2'), 2).targets;
  assert.deepStrictEqual(hcb, [64,62,60, 64,62,60, 60,60,60,60,62,62,62,62, 64,62,60]);
  assert.strictEqual(C.makeExercise(C.skillById('b3'), 2).targets.length, 26);
  assert.strictEqual(C.makeExercise(C.skillById('b5'), 2).targets.length, 30);
});

t('scheduler: starts at first skill, unlocks in order', () => {
  const states = E.ensureStates(C.SKILLS, {});
  let p = E.pickNext(C.SKILLS, states, { counter: 0, lastSkillId: null, sameCount: 0 });
  assert.strictEqual(p.skillId, 'f1'); assert.strictEqual(p.mode, 'learn');
  states.f1.mastered = true;
  assert.deepStrictEqual(E.available(C.SKILLS, states).map(s => s.id), ['f2', 'f5']);
});
t('scheduler: rotates after 3 in a row when alternatives exist', () => {
  const states = E.ensureStates(C.SKILLS, {});
  states.f1.mastered = true;
  const p = E.pickNext(C.SKILLS, states, { counter: 3, lastSkillId: 'f2', sameCount: 3 });
  assert.strictEqual(p.skillId, 'f5');
});
t('scheduler: steps back to weakest prerequisite after 5 fails', () => {
  const states = E.ensureStates(C.SKILLS, {});
  ['f1', 'f2', 'f3'].forEach(id => { states[id].mastered = true; states[id].score = 0.9; });
  states.f2.score = 0.7;
  states.f4.failStreak = 5;
  const p = E.pickNext(C.SKILLS, states, { counter: 5, lastSkillId: 'f4', sameCount: 1 });
  assert.strictEqual(p.mode, 'review'); assert.strictEqual(p.reason, 'step-back'); assert.strictEqual(p.skillId, 'f3');
});
t('scheduler: support mode after 3 fails', () => {
  const states = E.ensureStates(C.SKILLS, {});
  states.f1.failStreak = 3;
  assert.strictEqual(E.pickNext(C.SKILLS, states, { counter: 1, lastSkillId: 'f1', sameCount: 1 }).mode, 'support');
});
t('scheduler: spaced review of old mastered skills', () => {
  const states = E.ensureStates(C.SKILLS, {});
  states.f1.mastered = true; states.f1.lastSeen = 0;
  const p = E.pickNext(C.SKILLS, states, { counter: 12, lastSkillId: 'f2', sameCount: 1 });
  assert.strictEqual(p.reason, 'spaced'); assert.strictEqual(p.skillId, 'f1');
});
t('whole curriculum can be completed by a simulated learner, in sensible time', () => {
  ['4-7', '8-12', '13-17', 'adult'].forEach(age => {
    const cfg = E.masteryConfig(age);
    const states = E.ensureStates(C.SKILLS, {});
    const r = rng(42);
    let counter = 0, last = null, same = 0;
    while (!E.stageDone(C.SKILLS, states, 'Beginner') || !E.stageDone(C.SKILLS, states, 'Foundations')) {
      const p = E.pickNext(C.SKILLS, states, { counter, lastSkillId: last, sameCount: same });
      same = p.skillId === last ? same + 1 : 1; last = p.skillId;
      const q = r() < 0.85 ? 0.8 + r() * 0.2 : 0.3; // mostly good, sometimes weak
      states[p.skillId] = E.updateSkill(states[p.skillId], q, counter, cfg);
      counter++;
      assert.ok(counter < 400, 'did not finish for ' + age);
    }
    console.log('   ', age, 'finished Beginner in', counter, 'exercises');
  });
});

console.log('\n' + n + ' tests passed');
