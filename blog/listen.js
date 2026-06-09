/* o1 Labs blog — "Listen to this article" via the Web Speech API.
   No audio files or third-party services: the browser reads the text aloud.
   Falls back to hiding the button where speech synthesis is unavailable. */
(function () {
  var btn = document.getElementById('listenBtn');
  if (!btn) return;
  if (!('speechSynthesis' in window)) { btn.style.display = 'none'; return; }

  var titleEl = document.querySelector('.article-title');
  var bodyEl = document.querySelector('.article-body');
  var label = btn.querySelector('.listen-label');
  var utter = null;
  var state = 'idle'; // idle | playing | paused

  function articleText() {
    var t = titleEl ? titleEl.textContent.trim() + '. ' : '';
    return t + (bodyEl ? bodyEl.innerText : '');
  }
  function reset() {
    state = 'idle';
    btn.classList.remove('playing');
    if (label) label.textContent = 'Listen';
  }
  function start() {
    window.speechSynthesis.cancel();
    utter = new SpeechSynthesisUtterance(articleText());
    utter.rate = 1.0;
    utter.pitch = 1.0;
    utter.onend = reset;
    utter.onerror = reset;
    window.speechSynthesis.speak(utter);
    state = 'playing';
    btn.classList.add('playing');
    if (label) label.textContent = 'Pause';
  }

  btn.addEventListener('click', function () {
    if (state === 'idle') {
      start();
    } else if (state === 'playing') {
      window.speechSynthesis.pause();
      state = 'paused';
      if (label) label.textContent = 'Resume';
    } else {
      window.speechSynthesis.resume();
      state = 'playing';
      if (label) label.textContent = 'Pause';
    }
  });

  // Stop narration when leaving the page.
  window.addEventListener('pagehide', function () { window.speechSynthesis.cancel(); });
})();
