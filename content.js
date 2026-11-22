/* content.js: the skill graph, lessons and exercise generators (Foundations + Beginner).
   Two kinds of skill:
     theory    = a short guided lesson plus quiz questions, done on the on-screen piano (no instrument needed)
     practical = playing on the learner's own keyboard/piano
   All melodies are traditional / public domain. Everything is marked reviewed:false
   until a piano teacher has looked at it. */
(function (root) {
  'use strict';

  function pick(arr, r) { return arr[Math.floor(r() * arr.length)]; }
  function shuffled(arr, r) { var a = arr.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  var WHITE = { C: 60, D: 62, E: 64, F: 65, G: 67, A: 69, B: 71 };
  var COLORS = { C: '#ff5a5f', D: '#ff9f43', E: '#ffd93d', F: '#3ecf8e', G: '#4ea1ff', A: '#a56cff', B: '#ff7bd5' };
  var HAND_COLORS = { R: '#ff9f43', L: '#4ea1ff' };
  var FINGER_NAMES = { 1: 'Thumb', 2: 'Pointer', 3: 'Middle', 4: 'Ring', 5: 'Pinky' };

  var GROUP_CLUE = {
    C: 'the white key just left of the two black keys',
    D: 'the white key in the middle of the two black keys',
    E: 'the white key just right of the two black keys',
    F: 'the white key just left of the three black keys',
    G: 'the white key between the first and second of the three black keys',
    A: 'the white key between the second and third of the three black keys',
    B: 'the white key just right of the three black keys'
  };

  var KID_CLUE = {
    C: 'Find the key called *C*! It is just left of the TWO black keys.',
    D: 'Find the key called *D*! It is in the MIDDLE of the two black keys.',
    E: 'Find the key called *E*! It is just right of the TWO black keys.',
    F: 'Find the key called *F*! It is just left of the THREE black keys.',
    G: 'Find the key called *G*! It is in the MIDDLE of the three black keys.',
    A: 'Find the key called *A*! It is in the MIDDLE of the three black keys, on the right.',
    B: 'Find the key called *B*! It is just right of the THREE black keys.'
  };

  /* ---- helpers for building quiz questions ---- */
  // Multiple choice with the correct answer placed at a random position.
  function choice(prompt, kid, right, wrong, r, extra) {
    var all = shuffled([{ text: right, ok: true }].concat(wrong.map(function (w) { return { text: w }; })), r);
    var ex = { type: 'quiz', qtype: 'choice', prompt: prompt, kid: kid || prompt, voice: kid || prompt,
      options: all.map(function (o) { return { text: o.text }; }), correct: all.map(function (o) { return !!o.ok; }).indexOf(true) };
    if (extra) for (var k in extra) ex[k] = extra[k];
    return ex;
  }
  function choiceOpts(prompt, kid, opts, correct, r, extra) {
    // opts already carry their own play/pattern; shuffle them while tracking the correct one
    var idx = shuffled(opts.map(function (_, i) { return i; }), r);
    var ex = { type: 'quiz', qtype: 'choice', prompt: prompt, kid: kid || prompt, voice: kid || prompt,
      options: idx.map(function (i) { return opts[i]; }), correct: idx.indexOf(correct) };
    if (extra) for (var k in extra) ex[k] = extra[k];
    return ex;
  }
  function tap(prompt, kid, accept, kb, extra) {
    var ex = { type: 'quiz', qtype: 'tap', prompt: prompt, kid: kid || prompt, voice: kid || prompt, accept: accept, kb: kb };
    if (extra) for (var k in extra) ex[k] = extra[k];
    return ex;
  }

  var SKILLS = [
    /* ======================= FOUNDATIONS: THEORY ======================= */
    {
      id: 'th1', kind: 'theory', stage: 'Foundations', sticker: '🎹', title: 'Meet the keyboard', prereqs: [], maxLevel: 1, reviewed: false,
      blurb: 'White keys, black keys, and low and high sounds.',
      lesson: [
        { title: 'This is a piano keyboard', text: 'A piano keyboard has white keys and black keys. Press a key and it makes a sound. Try pressing one now.', kid: 'This is a piano! It has white keys and black keys. Press one!',
          vis: { k: 'kb', lo: 60, hi: 72 }, tap: [{ mode: 'any' }] },
        { title: 'Low sounds and high sounds', text: 'Keys on the left make low, deep sounds. Keys on the right make high, bright sounds. Press a key on the left, then a key on the right.', kid: 'Keys on the left are LOW, like a big bear. Keys on the right are HIGH, like a little bird. Press a low key. Then a high key!',
          vis: { k: 'kb', lo: 48, hi: 72, zones: [{ lo: 48, hi: 59, color: '#4ea1ff' }, { lo: 60, hi: 72, color: '#ff9f43' }] }, tap: [{ mode: 'range', lo: 48, hi: 55 }, { mode: 'range', lo: 65, hi: 72 }] },
        { title: 'Going up and down', text: 'Moving to the right, the sounds go UP. Moving to the left, the sounds go DOWN. Press the speaker to listen.', kid: 'Go right and the sound goes UP. Go left and it goes DOWN. Listen!',
          vis: { k: 'kb', lo: 60, hi: 72, light: [60, 62, 64, 65, 67, 69, 71, 72] }, play: { notes: [60, 62, 64, 65, 67, 69, 71, 72] }, auto: true },
        { title: 'Black keys come in groups', text: 'Look at the black keys. They come in groups of two and groups of three. These groups help us find our way around the keyboard.', kid: 'Look! The black keys come in groups. Two, then three!',
          vis: { k: 'kb', lo: 60, hi: 72, light: [61, 63, 66, 68, 70] } },
        { title: 'The pattern repeats', text: 'The same pattern repeats along the whole keyboard. A full-size piano has 88 keys.', kid: 'The pattern repeats again and again. A big piano has 88 keys!',
          vis: { k: 'kb', lo: 48, hi: 72 } }
      ],
      gen: function (level, r) {
        var pool = [
          function () { return tap('Tap a LOW key, one on the left.', 'Tap a LOW key!', { mode: 'range', lo: 48, hi: 55 }, { lo: 48, hi: 72 }); },
          function () { return tap('Tap a HIGH key, one on the right.', 'Tap a HIGH key!', { mode: 'range', lo: 65, hi: 72 }, { lo: 48, hi: 72 }); },
          function () { return tap('Tap a black key.', 'Tap a black key!', { mode: 'black' }, { lo: 60, hi: 72 }); },
          function () { return tap('Tap a white key.', 'Tap a white key!', { mode: 'white' }, { lo: 60, hi: 72 }); },
          function () { return choice('Keys on the right of the keyboard make…', 'Keys on the right sound…', 'high sounds', ['low sounds'], r); },
          function () { return choice('Keys on the left of the keyboard make…', 'Keys on the left sound…', 'low sounds', ['high sounds'], r); }
        ];
        if (level >= 1) pool.push(function () {
          var a = pick([48, 50, 52, 53, 55, 57], r), b = a + pick([7, 9, 12, 14], r), up = r() < 0.5;
          var first = up ? a : b, second = up ? b : a;
          return choiceOpts('Press 🔊 on each sound. Which sound is HIGHER?', 'Listen. Which one is HIGHER?',
            [{ text: 'First sound', play: { notes: [first] } }, { text: 'Second sound', play: { notes: [second] } }], up ? 1 : 0, r);
        }, function () {
          var a = pick([48, 50, 52, 53, 55, 57], r), b = a + pick([7, 9, 12, 14], r), up = r() < 0.5;
          var first = up ? a : b, second = up ? b : a;
          return choiceOpts('Press 🔊 on each sound. Which sound is LOWER?', 'Listen. Which one is LOWER?',
            [{ text: 'First sound', play: { notes: [first] } }, { text: 'Second sound', play: { notes: [second] } }], up ? 0 : 1, r);
        });
        return pick(pool, r)();
      }
    },
    {
      id: 'th2', kind: 'theory', stage: 'Foundations', sticker: '🧘', title: 'Sit and shape your hands', prereqs: ['th1'], maxLevel: 0, reviewed: false,
      blurb: 'How to sit, and how to hold your hands and fingers.',
      lesson: [
        { title: 'Sit tall', text: 'Sit up straight near the front of the chair, with your feet flat on the floor. Your back is tall but relaxed.', kid: 'Sit up tall like a tree. Put your feet flat on the floor.', vis: { k: 'big', text: '🪑' } },
        { title: 'Loose arms and wrists', text: 'Let your arms hang loose. Your elbows are about level with the keys. Keep your wrists soft, not too high and not too low.', kid: 'Make your arms floppy like noodles. Soft wrists!', vis: { k: 'big', text: '🍜' } },
        { title: 'Curved fingers', text: 'Curve your fingers as if you are holding a small bubble. Do not flatten them like pancakes.', kid: 'Pretend you hold a tiny bubble. Curvy fingers!', vis: { k: 'big', text: '🫧' } },
        { title: 'Fingertips and thumbs', text: 'Press the keys with the tips of your fingers. Your thumb rests on its side, not flat.', kid: 'Press with the tips of your fingers. Thumbs sit on their sides.', vis: { k: 'big', text: '👆' } },
        { title: 'Relax', text: 'If your hands feel tight or sore, stop and shake them out. Playing the piano should never hurt.', kid: 'Tight hands? Shake, shake, shake!', vis: { k: 'big', text: '🙌' } }
      ],
      gen: function (level, r) {
        var q = [
          function () { return choice('How should your fingers look?', 'How should your fingers look?', 'Curved, like holding a bubble', ['Flat, like pancakes', 'Stiff and straight, like sticks'], r); },
          function () { return choice('Where should your feet go?', 'Where do your feet go?', 'Flat on the floor', ['Hanging in the air', 'Crossed under the chair'], r); },
          function () { return choice('How should your wrists feel?', 'How should your wrists feel?', 'Loose and relaxed', ['Tight and stiff', 'Pressed down hard'], r); },
          function () { return choice('What should you do if your hands feel sore?', 'Your hands feel tight. What do you do?', 'Stop and shake them out', ['Play even harder', 'Ignore it'], r); },
          function () { return choice('Which part of the finger presses the key?', 'Which part of your finger presses the key?', 'The fingertip', ['The whole flat finger', 'The knuckle'], r); }
        ];
        return pick(q, r)();
      }
    },
    {
      id: 'th3', kind: 'theory', stage: 'Foundations', sticker: '🖐️', title: 'Left hand, right hand, finger numbers', prereqs: ['th2'], maxLevel: 1, reviewed: false,
      blurb: 'Know your left from your right, and number your fingers.',
      lesson: [
        { title: 'Two hands', text: 'You have a left hand and a right hand. Your right hand is on your right side. Your left hand is on your left side. Wave your right hand!', kid: 'Right hand is on your right. Left hand is on your left. Wave your right hand!', vis: { k: 'hands', hand: 'both' } },
        { title: 'A trick to remember', text: 'If you mix them up, put a small sticker or a pen mark on your right hand. R is for Right. L is for Left. We use orange for the right hand and blue for the left hand.', kid: 'Put a sticker on your right hand! R is for Right. Orange is right. Blue is left.', vis: { k: 'hands', hand: 'both', sticker: true } },
        { title: 'Finger numbers', text: 'Each finger has a number. Thumb is 1, pointer is 2, middle is 3, ring is 4 and pinky is 5. Both hands use the same numbers.', kid: 'Thumb is 1. Then 2, 3, 4. Pinky is 5! Wiggle each finger as you count.', vis: { k: 'hands', hand: 'R', names: true } },
        { title: 'Which hand plays where?', text: 'Your right hand usually plays the higher keys on the right. Your left hand usually plays the lower keys on the left. Tap a key for each hand.', kid: 'Right hand plays the high keys. Left hand plays the low keys. Tap an orange key. Tap a blue key!',
          vis: { k: 'kb', lo: 48, hi: 72, zones: [{ lo: 48, hi: 59, color: '#4ea1ff' }, { lo: 60, hi: 72, color: '#ff9f43' }] }, tap: [{ mode: 'range', lo: 48, hi: 59 }, { mode: 'range', lo: 60, hi: 72 }] }
      ],
      gen: function (level, r) {
        var q = [
          function () { var n = pick([1, 2, 3, 4, 5], r); var wrong = shuffled([1, 2, 3, 4, 5].filter(function (x) { return x !== n; }), r).slice(0, 2).map(function (x) { return FINGER_NAMES[x]; });
            return choice('Which finger is number ' + n + '?', 'Which finger is number ' + n + '?', FINGER_NAMES[n], wrong, r, { abstract: true }); },
          function () { var n = pick([1, 2, 3, 4, 5], r); var wrong = shuffled([1, 2, 3, 4, 5].filter(function (x) { return x !== n; }), r).slice(0, 2).map(String);
            return choice('What number is your ' + FINGER_NAMES[n].toLowerCase() + ' finger?', 'What number is the ' + FINGER_NAMES[n].toLowerCase() + '?', String(n), wrong, r); },
          function () { return choice('Which hand usually plays the high keys on the right?', 'Which hand plays the HIGH keys?', 'Right hand', ['Left hand'], r); },
          function () { return choice('Which hand usually plays the low keys on the left?', 'Which hand plays the LOW keys?', 'Left hand', ['Right hand'], r); }
        ];
        if (level >= 1) q.push(function () {
          var h = r() < 0.5 ? 'R' : 'L';
          return choice('Look down at your hands like this. Is this the left or the right hand?', 'Is this the LEFT or the RIGHT hand?', h === 'R' ? 'Right hand' : 'Left hand', [h === 'R' ? 'Left hand' : 'Right hand'], r, { vis: { k: 'hands', hand: h, neutral: true } });
        }, function () {
          var h = r() < 0.5 ? 'R' : 'L';
          return choice('The hand colored ' + (h === 'R' ? 'orange' : 'blue') + ' is the…', 'Which hand is ' + (h === 'R' ? 'ORANGE' : 'BLUE') + '?', h === 'R' ? 'Right hand' : 'Left hand', [h === 'R' ? 'Left hand' : 'Right hand'], r, { vis: { k: 'hands', hand: h } });
        });
        return pick(q, r)();
      }
    },
    {
      id: 'th4', kind: 'theory', stage: 'Foundations', sticker: '🔤', title: 'Black key groups and note names', prereqs: ['th1'], maxLevel: 2, reviewed: false,
      blurb: 'Use the black keys to find C, D, E, F, G, A and B.',
      lesson: [
        { title: 'Groups of black keys', text: 'The black keys come in a group of two, then a group of three. We use these groups to find the white keys.', kid: 'Two black keys, then three black keys. They are our map!',
          vis: { k: 'kb', lo: 60, hi: 72, light: [61, 63, 66, 68, 70] } },
        { title: 'The music alphabet', text: 'Notes are named with the letters A B C D E F G. After G we start again at A. Press the speaker to hear them going up.', kid: 'Notes have letter names: A B C D E F G. Then we start again!',
          vis: { k: 'kb', lo: 60, hi: 72, labels: true }, play: { notes: [60, 62, 64, 65, 67, 69, 71, 72] }, auto: true },
        { title: 'Find C', text: 'C is the white key just left of the two black keys. Tap a C. The C near the middle of the piano is called Middle C.', kid: '*C* is just left of the TWO black keys. Tap a *C*! *C*!',
          vis: { k: 'kb', lo: 60, hi: 72, labels: true, light: [60, 72] }, tap: [{ mode: 'pc', pcs: [0] }] },
        { title: 'Find D and E', text: 'D sits in the middle of the two black keys. E is just right of them. Tap a D.', kid: '*D* is in the MIDDLE of the two black keys. Tap a *D*! *D*!',
          vis: { k: 'kb', lo: 60, hi: 72, labels: true, light: [62] }, tap: [{ mode: 'pc', pcs: [2] }] },
        { title: 'Find F, G, A and B', text: 'F is just left of the three black keys. G and A sit between them. B is just right of the three black keys. Tap an F.', kid: '*F* is just left of the THREE black keys. Tap an *F*! *F*!',
          vis: { k: 'kb', lo: 60, hi: 72, labels: true, light: [65, 67, 69, 71] }, tap: [{ mode: 'pc', pcs: [5] }] }
      ],
      gen: function (level, r) {
        if (level >= 1 && r() < 0.2) return choice('What letter comes after G?', 'What letter comes after G?', 'A', ['H', 'B'], r, { abstract: true });
        var pool = level === 0 ? ['C', 'F'] : (level === 1 ? ['C', 'D', 'E', 'F', 'G'] : ['C', 'D', 'E', 'F', 'G', 'A', 'B']);
        var n = pick(pool, r);
        return tap('Tap a note called ' + n + '.', 'Tap the key called *' + n + '*! *' + n + '*!', { mode: 'pc', pcs: [WHITE[n] % 12] }, { lo: 60, hi: 84 }, { nameOnly: n });
      }
    },

    /* ======================= FOUNDATIONS: PRACTICAL ======================= */
    {
      id: 'f1', kind: 'practical', stage: 'Foundations', sticker: '🔴', title: 'Find the note C', prereqs: ['th4'], maxLevel: 0, reviewed: false,
      blurb: 'Find C on your own keyboard.',
      gen: function () {
        return { type: 'find', targets: [60], pitchClassOnly: true,
          prompt: 'Find a C on your piano. It is the white key just left of the two black keys.',
          kid: 'Find *C*! It is just left of the TWO black keys. *C*! Press *C*!',
          voice: 'Find the note C on your piano. It is the white key just left of the two black keys.' };
      }
    },
    {
      id: 'f2', kind: 'practical', stage: 'Foundations', sticker: '⚫', title: 'Black key groups', prereqs: ['f1'], maxLevel: 2, reviewed: false,
      blurb: 'Use the groups of two and three black keys to find your way around your piano.',
      gen: function (level, r) {
        var pool = level === 0 ? ['C', 'F'] : (level === 1 ? ['C', 'D', 'E', 'F'] : ['C', 'D', 'E', 'F', 'G', 'A', 'B']);
        var n = pick(pool, r);
        return { type: 'find', targets: [WHITE[n]], pitchClassOnly: true,
          prompt: 'Find ' + GROUP_CLUE[n] + '.', kid: (n.length === 1 && KID_CLUE[n]) || ('Find ' + GROUP_CLUE[n] + '.'), voice: 'Find ' + GROUP_CLUE[n] + '.' };
      }
    },
    {
      id: 'f3', kind: 'practical', stage: 'Foundations', sticker: '🅰️', title: 'Names of the white keys', prereqs: ['f2'], maxLevel: 2, reviewed: false,
      blurb: 'Find the notes A to G on your own keyboard.',
      gen: function (level, r) {
        var pool = level === 0 ? ['C', 'D', 'E'] : (level === 1 ? ['C', 'D', 'E', 'F', 'G'] : ['C', 'D', 'E', 'F', 'G', 'A', 'B']);
        var n = pick(pool, r);
        return { type: 'find', targets: [WHITE[n]], pitchClassOnly: true,
          prompt: 'Play the note ' + n + '.', kid: 'Play the key called *' + n + '*! Press *' + n + '*!', voice: 'Find the note called ' + n + '.', nameOnly: n };
      }
    },
    {
      id: 'f4', kind: 'practical', stage: 'Foundations', sticker: '🌟', title: 'Right hand five fingers', prereqs: ['f3', 'th3'], maxLevel: 4, reviewed: false,
      blurb: 'Put your right thumb on C and play with your fingers.',
      gen: function (level) {
        var up = [60, 62, 64, 65, 67], f = [1, 2, 3, 4, 5];
        var sets = [
          { t: up.slice(0, 2), f: f.slice(0, 2), s: 'Right hand. Thumb (1) on C. Play 1, 2.', k: 'Right hand! Thumb, then pointer.' },
          { t: up.slice(0, 3), f: f.slice(0, 3), s: 'Right hand. Play 1, 2, 3.', k: 'Right hand! 1, 2, 3.' },
          { t: up, f: f, s: 'Right hand. Play C, D, E, F, G going up.', k: 'Right hand! All five fingers.' },
          { t: up.slice().reverse(), f: f.slice().reverse(), s: 'Right hand. Come back down: G, F, E, D, C.', k: 'Right hand! Come back down.' },
          { t: up.concat(up.slice(0, 4).reverse()), f: f.concat(f.slice(0, 4).reverse()), s: 'Right hand. Up and down: C to G and back to C.', k: 'Right hand! Up, then down.' }
        ];
        var o = sets[level];
        return { type: 'seq', targets: o.t, fingers: o.f, hand: 'R', clef: 'treble', showStaff: true, prompt: o.s, kid: o.k, voice: o.s, hint: true,
          setup: { hand: 'R', fingerNotes: up, confirmNote: 60, title: 'Right hand: get ready',
            text: 'Put your right thumb (1) on Middle C. Rest one finger on each of the next white keys: 2 on D, 3 on E, 4 on F and 5 on G. Then press the key under your thumb.',
            kid: 'Right hand! Thumb on the red key. One finger on each key. Press under your thumb!' } };
      }
    },
    {
      id: 'th5', kind: 'theory', stage: 'Foundations', sticker: '⏱️', title: 'The beat and the metronome', prereqs: ['th1'], maxLevel: 1, reviewed: false,
      blurb: 'Learn about the steady beat, counting, and the metronome.',
      lesson: [
        { title: 'Music has a beat', text: 'Most music has a steady beat, like a clock ticking or a heartbeat. You can tap your foot to it. Press the speaker and tap along.', kid: 'Music has a beat, like a heartbeat. Tap, tap, tap along!',
          vis: { k: 'beats', count: 4 }, play: { clicks: { bpm: 60, count: 4 } }, auto: true },
        { title: 'Counting the beat', text: 'We count beats like this: 1 2 3 4, 1 2 3 4. Listen and count along.', kid: 'Count with me: 1, 2, 3, 4!',
          vis: { k: 'beats', count: 4 }, play: { clicks: { bpm: 60, count: 8 } } },
        { title: 'The metronome', text: 'A metronome is a tool that ticks a steady beat for you, so you can keep time while you play. Many phones and apps have one. We will use one in this app.', kid: 'A metronome is a ticking helper. It keeps the beat for you!',
          vis: { k: 'big', text: '⏱️' }, play: { clicks: { bpm: 72, count: 4 } } },
        { title: 'Fast and slow', text: 'How fast or slow the beat is, is called the tempo. We count it in beats per minute (BPM). Fast ticks mean a fast tempo. Slow ticks mean a slow tempo. Listen to slow, then fast.', kid: 'Slow ticks, then fast ticks. Listen!',
          vis: { k: 'beats', count: 4 }, play: { clicks: { bpm: 60, count: 4, then: { bpm: 120, count: 8 } } } }
      ],
      gen: function (level, r) {
        var q = [
          function () { return choice('What does a metronome do?', 'What does a metronome do?', 'Ticks a steady beat', ['Plays the melody for you', 'Makes the piano louder'], r, { abstract: true }); },
          function () { return choice('Count the beats: 1 2 3 4. How many beats is that?', 'Count: 1 2 3 4. How many beats?', '4', ['2', '3'], r, { abstract: true }); },
          function () { return choice('The tempo is…', 'The tempo is how…', 'how fast or slow the beat is', ['how loud the music is', 'how high the notes are'], r, { abstract: true }); }
        ];
        if (level >= 1) q.push(function () {
          var slow = pick([54, 60, 66], r), fast = pick([100, 112, 120], r), fastFirst = r() < 0.5;
          var a = { text: 'Beat A', play: { clicks: { bpm: fastFirst ? fast : slow, count: 4 } } }, b = { text: 'Beat B', play: { clicks: { bpm: fastFirst ? slow : fast, count: 4 } } };
          return choiceOpts('Press 🔊 on each beat. Which beat is FASTER?', 'Listen. Which beat is FASTER?', [a, b], fastFirst ? 0 : 1, r);
        });
        return pick(q, r)();
      }
    },
    {
      id: 'f5', kind: 'practical', stage: 'Foundations', sticker: '🥁', title: 'Steady beat', prereqs: ['th5', 'f1'], maxLevel: 2, reviewed: false,
      blurb: 'Tap any key right on the beat.',
      gen: function (level) {
        var bpm = [60, 72, 72][level], beats = [4, 4, 8][level];
        return { type: 'rhythm', bpm: bpm, pattern: Array.apply(null, Array(beats)).map(function () { return 1; }),
          prompt: 'Listen to the clicks. Then tap any key on every beat.', kid: 'Tap a key with every click!',
          voice: 'Listen to the clicks. Then tap any key on every beat.' };
      }
    },
    {
      id: 'th6', kind: 'theory', stage: 'Foundations', sticker: '📏', title: 'Short, long and very long', prereqs: ['th5'], maxLevel: 2, reviewed: false,
      blurb: 'Learn how long notes last, counted in beats.',
      lesson: [
        { title: 'Notes have lengths', text: 'Some notes are short and some are long. We measure how long a note lasts in beats.', kid: 'Some sounds are short. Some sounds are long!',
          vis: { k: 'blocks', pattern: [1, 2, 4] } },
        { title: 'Short = 1 beat', text: 'A short note lasts 1 beat. Its musical name is a quarter note. Listen to it with the beat.', kid: 'A SHORT sound lasts 1 beat. Listen!',
          vis: { k: 'blocks', pattern: [1] }, play: { pattern: [1], bpm: 60, clicks: true }, auto: true },
        { title: 'Long = 2 beats', text: 'A long note lasts 2 beats. Its musical name is a half note. Count 1, 2 while it sounds.', kid: 'A LONG sound lasts 2 beats. Count 1, 2!',
          vis: { k: 'blocks', pattern: [2] }, play: { pattern: [2], bpm: 60, clicks: true } },
        { title: 'Very long = 4 beats', text: 'A very long note lasts 4 beats. Its musical name is a whole note. Count 1, 2, 3, 4 while it sounds.', kid: 'A VERY LONG sound lasts 4 beats. Count 1, 2, 3, 4!',
          vis: { k: 'blocks', pattern: [4] }, play: { pattern: [4], bpm: 60, clicks: true } },
        { title: 'Put them together', text: 'Here are short, long and very long notes one after another. Listen and count along.', kid: 'Short, long, very long. Listen and count!',
          vis: { k: 'blocks', pattern: [1, 2, 4] }, play: { pattern: [1, 2, 4], bpm: 72, clicks: true } }
      ],
      gen: function (level, r) {
        var q = [
          function () { return choice('How many beats does a LONG note last?', 'How many beats is a LONG sound?', '2 beats', ['1 beat', '4 beats'], r); },
          function () { return choice('How many beats does a SHORT note last?', 'How many beats is a SHORT sound?', '1 beat', ['2 beats', '4 beats'], r); },
          function () { return choice('How many beats does a VERY LONG note last?', 'How many beats is a VERY LONG sound?', '4 beats', ['1 beat', '2 beats'], r); },
          function () {
            var words = [[1, 'SHORT'], [2, 'LONG'], [4, 'VERY LONG']], w = pick(words, r);
            return choiceOpts('Which block is the ' + w[1] + ' note?', 'Which one is ' + w[1] + '?', [{ text: '', pattern: [1] }, { text: '', pattern: [2] }, { text: '', pattern: [4] }], [1, 2, 4].indexOf(w[0]), r, { blocks: true });
          }
        ];
        if (level >= 1) q.push(function () {
          var pats = [[1, 1, 2], [2, 1, 1], [1, 2, 1], [2, 2], [4], [1, 1, 1, 1]], i = Math.floor(r() * pats.length), o = [i];
          while (o.length < 3) { var j = Math.floor(r() * pats.length); if (o.indexOf(j) < 0) o.push(j); }
          var opts = o.map(function (k) { return { text: '', pattern: pats[k] }; });
          return choiceOpts('Press 🔊 and listen. Which blocks match what you hear?', 'Listen. Which blocks do you hear?', opts, 0, r, { blocks: true, play: { pattern: pats[i], bpm: 72, clicks: true } });
        });
        if (level >= 2) q.push(function () {
          return choice('What is a 1-beat note called?', 'What is the 1-beat note called?', 'A quarter note', ['A half note', 'A whole note'], r, { abstract: true });
        }, function () {
          return choice('What is a 4-beat note called?', 'What is the 4-beat note called?', 'A whole note', ['A quarter note', 'A half note'], r, { abstract: true });
        });
        return pick(q, r)();
      }
    },
    {
      id: 'f6', kind: 'practical', stage: 'Foundations', sticker: '🐢', title: 'Long and short sounds', prereqs: ['f5', 'th6'], maxLevel: 2, reviewed: false,
      blurb: 'Tap short sounds (1 beat) and long sounds (2 beats).',
      gen: function (level, r) {
        var sets = [
          [[1, 1, 1, 1], [2, 2]],
          [[1, 1, 2], [2, 1, 1], [1, 2, 1]],
          [[2, 1, 1, 2, 2], [1, 1, 2, 4], [2, 2, 1, 1, 2]]
        ];
        var p = pick(sets[level], r);
        return { type: 'rhythm', bpm: 64, pattern: p, showPattern: true,
          prompt: 'Tap the pattern. A short block is 1 beat. A long block is 2 beats.', kid: 'Tap the blocks. Short is quick. Long is slow.',
          voice: 'Tap the pattern. Short blocks are one beat. Long blocks are two beats.' };
      }
    },

    /* ======================= BEGINNER ======================= */
    {
      id: 'th7', kind: 'theory', stage: 'Beginner', sticker: '📖', title: 'Reading the staff', prereqs: ['th4', 'th3'], maxLevel: 1, reviewed: false,
      blurb: 'How notes are written down, and what the staff and clefs are.',
      lesson: [
        { title: 'The staff', text: 'Music is written on five lines called the staff. Notes sit on the lines or in the spaces between them.', kid: 'Music lives on five lines. Notes sit on the lines or between them!',
          vis: { k: 'staff', notes: [64, 67], clef: 'treble' } },
        { title: 'Higher and lower', text: 'Higher notes are written higher on the staff. Lower notes are written lower. Press the speaker to hear C D E F G going up.', kid: 'Up on the lines is high. Down is low. Listen!',
          vis: { k: 'staff', notes: [60, 62, 64, 65, 67], clef: 'treble', names: true }, play: { notes: [60, 62, 64, 65, 67] }, auto: true },
        { title: 'Treble clef', text: 'The treble clef is for higher notes. They are usually played with the right hand.', kid: 'The treble clef is for HIGH notes. Right hand!',
          vis: { k: 'staff', notes: [64, 65, 67], clef: 'treble', names: true } },
        { title: 'Bass clef', text: 'The bass clef is for lower notes. They are usually played with the left hand.', kid: 'The bass clef is for LOW notes. Left hand!',
          vis: { k: 'staff', notes: [48, 50, 52, 53, 55], clef: 'bass', names: true } },
        { title: 'Middle C', text: 'Middle C sits on a little extra line below the treble staff, called a ledger line. Tap Middle C on the keyboard.', kid: 'Middle C sits below the lines on a little line. Tap Middle C!',
          vis: { k: 'staff', notes: [60], clef: 'treble', names: true, kb: { lo: 60, hi: 72 } }, tap: [{ mode: 'note', note: 60 }] }
      ],
      gen: function (level, r) {
        var q = [
          function () { var pool = level === 0 ? [60, 62, 64] : [60, 62, 64, 65, 67], n = pick(pool, r);
            return tap('Look at the note. Tap the matching key.', 'Which key is it? Tap it!', { mode: 'note', note: n }, { lo: 60, hi: 72 }, { vis: { k: 'staff', notes: [n], clef: 'treble' }, readMode: true }); },
          function () { return choice('Which clef is usually for the right hand?', 'Which clef is for the RIGHT hand?', 'Treble clef', ['Bass clef'], r, { abstract: true }); },
          function () { return choice('Which clef is usually for the left hand?', 'Which clef is for the LEFT hand?', 'Bass clef', ['Treble clef'], r, { abstract: true }); },
          function () { return choice('A note written higher on the staff sounds…', 'A note higher on the staff sounds…', 'higher', ['lower'], r); }
        ];
        if (level >= 1) q.push(function () { var n = pick([60, 62, 64, 65, 67], r);
          return tap('Look at the note. Tap the matching key.', 'Which key is it? Tap it!', { mode: 'note', note: n }, { lo: 60, hi: 72 }, { vis: { k: 'staff', notes: [n], clef: 'treble' }, readMode: true }); });
        return pick(q, r)();
      }
    },
    {
      id: 'b1', kind: 'practical', stage: 'Beginner', sticker: '🦉', title: 'Left hand five fingers', prereqs: ['f4'], maxLevel: 4, reviewed: false,
      blurb: 'Pinky on the low C, then play up with your left hand.',
      gen: function (level) {
        var up = [48, 50, 52, 53, 55], f = [5, 4, 3, 2, 1];
        var sets = [
          { t: up.slice(0, 2), f: f.slice(0, 2), s: 'Left hand. Pinky (5) on the low C. Play 5, 4.', k: 'Left hand! Pinky, then ring finger.' },
          { t: up.slice(0, 3), f: f.slice(0, 3), s: 'Left hand. Play 5, 4, 3.', k: 'Left hand! 5, 4, 3.' },
          { t: up, f: f, s: 'Left hand. Play C, D, E, F, G going up.', k: 'Left hand! All five fingers.' },
          { t: up.slice().reverse(), f: f.slice().reverse(), s: 'Left hand. Come down: G, F, E, D, C.', k: 'Left hand! Come back down.' },
          { t: up.concat(up.slice(0, 4).reverse()), f: f.concat(f.slice(0, 4).reverse()), s: 'Left hand. Up and down.', k: 'Left hand! Up, then down.' }
        ];
        var o = sets[level];
        return { type: 'seq', targets: o.t, fingers: o.f, hand: 'L', clef: 'bass', showStaff: true, prompt: o.s, kid: o.k, voice: o.s, hint: true,
          setup: { hand: 'L', fingerNotes: up.slice().reverse(), confirmNote: 48, title: 'Left hand: get ready',
            text: 'Put your left pinky (5) on the low C. Rest one finger on each of the next white keys: 4 on D, 3 on E, 2 on F and your thumb (1) on G. Then press the key under your pinky.',
            kid: 'Left hand! Little finger on the low C. One finger on each key. Press under your little finger!' } };
      }
    },
    {
      id: 'b2', kind: 'practical', stage: 'Beginner', sticker: '🍞', title: 'Hot Cross Buns', prereqs: ['f4'], maxLevel: 2, reviewed: false,
      blurb: 'Your first tune. A traditional song.',
      gen: function (level) {
        var A = [64, 62, 60], B = [60, 60, 60, 60, 62, 62, 62, 62];
        var all = A.concat(A, B, A);
        var t = level === 0 ? A : (level === 1 ? A.concat(A) : all);
        var s = level === 0 ? 'Right hand. Play the start of Hot Cross Buns: E, D, C.' : (level === 1 ? 'Right hand. Play the first two lines of Hot Cross Buns.' : 'Right hand. Play all of Hot Cross Buns.');
        return { type: 'seq', targets: t, hand: 'R', clef: 'treble', showStaff: true, prompt: s, kid: level === 0 ? 'Play the start of the song!' : 'Play the song!', voice: s, hint: true,
          fingers: t.map(function (n) { return { 60: 1, 62: 2, 64: 3 }[n]; }) };
      }
    },
    {
      id: 'b3', kind: 'practical', stage: 'Beginner', sticker: '🐑', title: 'Mary Had a Little Lamb', prereqs: ['b2'], maxLevel: 2, reviewed: false,
      blurb: 'A longer tune with a jump at the end.',
      gen: function (level) {
        var l1 = [64, 62, 60, 62, 64, 64, 64], l2 = [62, 62, 62, 64, 67, 67], l3 = [64, 62, 60, 62, 64, 64, 64, 64, 62, 62, 64, 62, 60];
        var all = l1.concat(l2, l3);
        var t = level === 0 ? l1 : (level === 1 ? l1.concat(l2) : all);
        var s = level === 0 ? 'Right hand. Play the start of Mary Had a Little Lamb.' : (level === 1 ? 'Right hand. Play the first half of Mary Had a Little Lamb.' : 'Right hand. Play all of Mary Had a Little Lamb.');
        return { type: 'seq', targets: t, hand: 'R', clef: 'treble', showStaff: true, prompt: s, kid: 'Play the song!', voice: s, hint: true,
          fingers: t.map(function (n) { return { 60: 1, 62: 2, 64: 3, 65: 4, 67: 5 }[n]; }) };
      }
    },
    {
      id: 'b4', kind: 'practical', stage: 'Beginner', sticker: '👀', title: 'Reading notes on the staff', prereqs: ['th7', 'f3', 'f4'], maxLevel: 2, reviewed: false,
      blurb: 'See a note on the staff and play it on your keyboard.',
      gen: function (level, r) {
        var pool = level === 0 ? [60, 62, 64] : [60, 62, 64, 65, 67];
        var n = level === 2 ? 3 : 1, t = [];
        for (var i = 0; i < n; i++) t.push(pick(pool, r));
        return { type: 'seq', targets: t, clef: 'treble', showStaff: true, readMode: true,
          prompt: n === 1 ? 'Look at the note on the staff. Play it on your keyboard.' : 'Play these three notes.', kid: 'Look at the note. Play it!',
          voice: n === 1 ? 'Look at the note on the lines. Play it on the keyboard.' : 'Play these three notes in order.', hint: 'onFail' };
      }
    },
    {
      id: 'b5', kind: 'practical', stage: 'Beginner', sticker: '🎶', title: 'Ode to Joy', prereqs: ['b3'], maxLevel: 2, reviewed: false,
      blurb: 'A famous melody by Beethoven. Public domain.',
      gen: function (level) {
        var l1 = [64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64, 64, 62, 62];
        var l2 = [64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64, 62, 60, 60];
        var t = level === 0 ? l1.slice(0, 8) : (level === 1 ? l1 : l1.concat(l2));
        var s = level === 0 ? 'Right hand. Play the start of Ode to Joy.' : (level === 1 ? 'Right hand. Play the first line of Ode to Joy.' : 'Right hand. Play all of Ode to Joy.');
        return { type: 'seq', targets: t, hand: 'R', clef: 'treble', showStaff: true, prompt: s, kid: 'Play the song!', voice: s, hint: true,
          fingers: t.map(function (n) { return { 60: 1, 62: 2, 64: 3, 65: 4, 67: 5 }[n]; }) };
      }
    }
  ];

  var STAGES = ['Foundations', 'Beginner'];

  function skillById(id) { for (var i = 0; i < SKILLS.length; i++) if (SKILLS[i].id === id) return SKILLS[i]; return null; }
  function ofKind(kind) { return SKILLS.filter(function (s) { return s.kind === kind; }); }
  function makeExercise(skill, level, r) {
    var ex = skill.gen(level, r || Math.random);
    ex.skillId = skill.id; ex.level = level; ex.kind = skill.kind;
    return ex;
  }

  var api = { SKILLS: SKILLS, STAGES: STAGES, COLORS: COLORS, HAND_COLORS: HAND_COLORS, FINGER_NAMES: FINGER_NAMES,
    skillById: skillById, ofKind: ofKind, makeExercise: makeExercise, WHITE: WHITE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Content = api;
})(typeof window !== 'undefined' ? window : this);
