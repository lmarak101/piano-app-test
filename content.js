/* content.js: the skill graph and exercise generators (Foundations + Beginner).
   All melodies are traditional / public domain. Everything here is marked reviewed:false
   until a piano teacher has looked at it. */
(function (root) {
  'use strict';

  function pick(arr, r) { return arr[Math.floor(r() * arr.length)]; }
  function shuffled(arr, r) { var a = arr.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  var WHITE = { C: 60, D: 62, E: 64, F: 65, G: 67, A: 69, B: 71 };
  var COLORS = { C: '#ff5a5f', D: '#ff9f43', E: '#ffd93d', F: '#3ecf8e', G: '#4ea1ff', A: '#a56cff', B: '#ff7bd5' };

  var GROUP_CLUE = {
    C: 'the white key just left of the two black keys',
    D: 'the white key in the middle of the two black keys',
    E: 'the white key just right of the two black keys',
    F: 'the white key just left of the three black keys',
    G: 'the white key between the first and second of the three black keys',
    A: 'the white key between the second and third of the three black keys',
    B: 'the white key just right of the three black keys'
  };

  var SKILLS = [
    {
      id: 'f1', stage: 'Foundations', title: 'Find the note C', prereqs: [], maxLevel: 0, reviewed: false,
      blurb: 'Learn where C lives on the keyboard.',
      gen: function () {
        return { type: 'find', targets: [60], pitchClassOnly: true,
          prompt: 'Find a C. It is the white key just left of the two black keys.',
          voice: 'Find the note C. It is the white key just left of the two black keys.' };
      }
    },
    {
      id: 'f2', stage: 'Foundations', title: 'Black key groups', prereqs: ['f1'], maxLevel: 2, reviewed: false,
      blurb: 'Use the groups of two and three black keys to find your way around.',
      gen: function (level, r) {
        var pool = level === 0 ? ['C', 'F'] : (level === 1 ? ['C', 'D', 'E', 'F'] : ['C', 'D', 'E', 'F', 'G', 'A', 'B']);
        var n = pick(pool, r);
        return { type: 'find', targets: [WHITE[n]], pitchClassOnly: true,
          prompt: 'Find ' + GROUP_CLUE[n] + '.', voice: 'Find ' + GROUP_CLUE[n] + '.' };
      }
    },
    {
      id: 'f3', stage: 'Foundations', title: 'Names of the white keys', prereqs: ['f2'], maxLevel: 2, reviewed: false,
      blurb: 'Learn the note names A to G.',
      gen: function (level, r) {
        var pool = level === 0 ? ['C', 'D', 'E'] : (level === 1 ? ['C', 'D', 'E', 'F', 'G'] : ['C', 'D', 'E', 'F', 'G', 'A', 'B']);
        var n = pick(pool, r);
        return { type: 'find', targets: [WHITE[n]], pitchClassOnly: true,
          prompt: 'Play the note ' + n + '.', voice: 'Find the note called ' + n + '.', nameOnly: n };
      }
    },
    {
      id: 'f4', stage: 'Foundations', title: 'Right hand five fingers', prereqs: ['f3'], maxLevel: 3, reviewed: false,
      blurb: 'Put your right thumb on C and play with all five fingers.',
      gen: function (level) {
        var up = [60, 62, 64, 65, 67], f = [1, 2, 3, 4, 5];
        var sets = [
          { t: up.slice(0, 3), f: f.slice(0, 3), s: 'Right hand: thumb (1) on C. Play 1, 2, 3.' },
          { t: up, f: f, s: 'Right hand: play C, D, E, F, G going up.' },
          { t: up.slice().reverse(), f: f.slice().reverse(), s: 'Now come back down: G, F, E, D, C.' },
          { t: up.concat(up.slice(0, 4).reverse()), f: f.concat(f.slice(0, 4).reverse()), s: 'Up and down: C to G and back to C.' }
        ];
        var o = sets[level];
        return { type: 'seq', targets: o.t, fingers: o.f, clef: 'treble', showStaff: true, prompt: o.s, voice: o.s, hint: true };
      }
    },
    {
      id: 'f5', stage: 'Foundations', title: 'Steady beat', prereqs: ['f1'], maxLevel: 2, reviewed: false,
      blurb: 'Tap any key right on the beat.',
      gen: function (level) {
        var bpm = [60, 72, 72][level], beats = [4, 4, 8][level];
        return { type: 'rhythm', bpm: bpm, pattern: Array.apply(null, Array(beats)).map(function () { return 1; }),
          prompt: 'Listen to the clicks, then tap any key on every beat.', voice: 'Listen to the clicks. Then tap any key on every beat.' };
      }
    },
    {
      id: 'f6', stage: 'Foundations', title: 'Long and short sounds', prereqs: ['f5'], maxLevel: 2, reviewed: false,
      blurb: 'Tap short sounds (1 beat) and long sounds (2 beats).',
      gen: function (level, r) {
        var sets = [
          [[1, 1, 1, 1], [2, 2]],
          [[1, 1, 2], [2, 1, 1], [1, 2, 1]],
          [[2, 1, 1, 2, 2], [1, 1, 2, 4], [2, 2, 1, 1, 2]]
        ];
        var p = pick(sets[level], r);
        return { type: 'rhythm', bpm: 64, pattern: p, showPattern: true,
          prompt: 'Tap the pattern. A short block is 1 beat, a long block is 2 beats.',
          voice: 'Tap the pattern. Short blocks are one beat. Long blocks are two beats.' };
      }
    },
    {
      id: 'b1', stage: 'Beginner', title: 'Left hand five fingers', prereqs: ['f4'], maxLevel: 3, reviewed: false,
      blurb: 'Pinky on the low C, then play up with the left hand.',
      gen: function (level) {
        var up = [48, 50, 52, 53, 55], f = [5, 4, 3, 2, 1];
        var sets = [
          { t: up.slice(0, 3), f: f.slice(0, 3), s: 'Left hand: pinky (5) on the low C. Play 5, 4, 3.' },
          { t: up, f: f, s: 'Left hand: play C, D, E, F, G going up.' },
          { t: up.slice().reverse(), f: f.slice().reverse(), s: 'Left hand coming down: G, F, E, D, C.' },
          { t: up.concat(up.slice(0, 4).reverse()), f: f.concat(f.slice(0, 4).reverse()), s: 'Left hand up and down.' }
        ];
        var o = sets[level];
        return { type: 'seq', targets: o.t, fingers: o.f, clef: 'bass', showStaff: true, prompt: o.s, voice: o.s, hint: true };
      }
    },
    {
      id: 'b2', stage: 'Beginner', title: 'Hot Cross Buns', prereqs: ['f4'], maxLevel: 2, reviewed: false,
      blurb: 'Your first tune. A traditional song.',
      gen: function (level) {
        var A = [64, 62, 60], B = [60, 60, 60, 60, 62, 62, 62, 62];
        var all = A.concat(A, B, A);
        var t = level === 0 ? A : (level === 1 ? A.concat(A) : all);
        var s = level === 0 ? 'Play the start of Hot Cross Buns: E, D, C.' : (level === 1 ? 'Play the first two lines of Hot Cross Buns.' : 'Play all of Hot Cross Buns.');
        return { type: 'seq', targets: t, clef: 'treble', showStaff: true, prompt: s, voice: s, hint: true };
      }
    },
    {
      id: 'b3', stage: 'Beginner', title: 'Mary Had a Little Lamb', prereqs: ['b2'], maxLevel: 2, reviewed: false,
      blurb: 'A longer tune with a jump at the end.',
      gen: function (level) {
        var l1 = [64, 62, 60, 62, 64, 64, 64], l2 = [62, 62, 62, 64, 67, 67], l3 = [64, 62, 60, 62, 64, 64, 64, 64, 62, 62, 64, 62, 60];
        var all = l1.concat(l2, l3);
        var t = level === 0 ? l1 : (level === 1 ? l1.concat(l2) : all);
        var s = level === 0 ? 'Play the start of Mary Had a Little Lamb.' : (level === 1 ? 'Play the first half of Mary Had a Little Lamb.' : 'Play all of Mary Had a Little Lamb.');
        return { type: 'seq', targets: t, clef: 'treble', showStaff: true, prompt: s, voice: s, hint: true };
      }
    },
    {
      id: 'b4', stage: 'Beginner', title: 'Reading notes on the staff', prereqs: ['f3', 'f4'], maxLevel: 2, reviewed: false,
      blurb: 'See a note on the staff and play it.',
      gen: function (level, r) {
        var pool = level === 0 ? [60, 62, 64] : [60, 62, 64, 65, 67];
        var n = level === 2 ? 3 : 1, t = [];
        for (var i = 0; i < n; i++) t.push(pick(pool, r));
        return { type: 'seq', targets: t, clef: 'treble', showStaff: true, readMode: true,
          prompt: n === 1 ? 'Look at the note on the staff. Play it.' : 'Play these three notes.',
          voice: n === 1 ? 'Look at the note on the lines. Play it on the keyboard.' : 'Play these three notes in order.', hint: 'onFail' };
      }
    },
    {
      id: 'b5', stage: 'Beginner', title: 'Ode to Joy', prereqs: ['b3'], maxLevel: 2, reviewed: false,
      blurb: 'A famous melody by Beethoven. Public domain.',
      gen: function (level) {
        var l1 = [64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64, 64, 62, 62];
        var l2 = [64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64, 62, 60, 60];
        var t = level === 0 ? l1.slice(0, 8) : (level === 1 ? l1 : l1.concat(l2));
        var s = level === 0 ? 'Play the start of Ode to Joy.' : (level === 1 ? 'Play the first line of Ode to Joy.' : 'Play all of Ode to Joy.');
        return { type: 'seq', targets: t, clef: 'treble', showStaff: true, prompt: s, voice: s, hint: true };
      }
    }
  ];

  var STAGES = ['Foundations', 'Beginner'];

  function skillById(id) { for (var i = 0; i < SKILLS.length; i++) if (SKILLS[i].id === id) return SKILLS[i]; return null; }
  function makeExercise(skill, level, r) {
    var ex = skill.gen(level, r || Math.random);
    ex.skillId = skill.id; ex.level = level;
    return ex;
  }

  var api = { SKILLS: SKILLS, STAGES: STAGES, COLORS: COLORS, skillById: skillById, makeExercise: makeExercise, WHITE: WHITE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Content = api;
})(typeof window !== 'undefined' ? window : this);
