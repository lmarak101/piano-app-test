# Piano Teacher: prototype

Open `index.html` (served by GitHub Pages) in Chrome on Android.

- `index.html`, `styles.css`, `app.js`: interface
- `engine.js`: matching, timing, mastery, sequencing (pure logic, no DOM)
- `content.js`: the skill graph and exercise generators (Foundations + Beginner, 11 skills)
- `midi-test.html`: standalone MIDI input checker
- `tests/engine.test.js`: run with `node tests/engine.test.js`

All lessons are **pending piano teacher review**. Melodies are traditional/public domain.
Progress is stored only in the browser (localStorage).
