# Every article gets narration. No exceptions.

**Standing rule, agreed 18 August 2026.** Any new blog post ships with a
pre-rendered MP3 narration, generated locally. Never fall back to the browser's
speech synthesiser, which is what made the old version sound robotic.

---

## The one command

```bash
cd /tmp
PATH="/opt/homebrew/bin:$PATH" PYTORCH_ENABLE_MPS_FALLBACK=1 \
  /tmp/kokoro-env/bin/python -u /tmp/narrate.py \
  /Users/freddy/o1-labs-site/blog/<new-post>.html
```

Run it with no arguments to re-render every article at once.

Output lands in `blog/audio/<slug>.mp3` and the player in the post already
points there, so nothing else needs wiring.

---

## What is doing the work

| | |
|---|---|
| Model | Kokoro-82M |
| Licence | Apache-2.0, commercial use permitted, no attribution required |
| Voice | `af_heart` |
| Cost | $0. Runs on the Mac. No account, no API key, no per-character billing. |
| Watermark | None, and no mandatory AI disclosure attached to the audio |
| Output | Mono MP3, 64 kbps, roughly 0.5 MB per minute |

Environment lives at `/tmp/kokoro-env`. **`/tmp` is cleared on restart**, so if
the command fails, rebuild it:

```bash
brew install espeak-ng
python3.12 -m venv /tmp/kokoro-env
/tmp/kokoro-env/bin/pip install -q kokoro soundfile
```

The narration script is `/tmp/narrate.py`. If it is gone, a copy of the logic
lives in this repo's history under the commit that added `blog/audio/`.

---

## The markup each post needs

```html
<div class="listen-wrap">
  <audio id="listenAudio" class="listen-audio" controls preload="none"
         src="/blog/audio/<slug>.mp3"></audio>
  <span class="listen-note">Listen to this article</span>
</div>
```

`preload="none"` matters. Without it every visitor downloads several megabytes
they may never play.

Then add `&middot; listen available` to the post's `.post-read` line on the
blog index, so readers know before they click.

---

## Checks before publishing

- Play the first fifteen seconds. Acronyms and proper nouns are where synthetic
  voices break, and this audience will notice.
- Confirm the file is under about 5 MB.
- Confirm `preload="none"` is present.
- Confirm the article has no em dashes. The narrator reads them as a hard stop
  and it sounds wrong, quite apart from the house style rule.

---

## If a better voice is wanted later

Paid options, all requiring an account and a card:

| Option | Cost | Note |
|---|---|---|
| Google Cloud Chirp 3 HD | Free tier covers roughly this volume | Best quality per dollar |
| Amazon Polly Neural | Free tier for the first year | Solid, slightly flatter |
| ElevenLabs | Around $11/month | Best quality available, mandatory attribution on lower tiers |

Deliberately rejected: **XTTS**, because its licence prohibits use where you
receive indirect payment, which a consultancy's marketing content does.
