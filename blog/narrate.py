import os, re, sys, glob, subprocess, html
import numpy as np
import soundfile as sf
from kokoro import KPipeline

BLOG = '/Users/freddy/o1-labs-site/blog'
OUT = os.path.join(BLOG, 'audio')
os.makedirs(OUT, exist_ok=True)

VOICE = os.environ.get('KOKORO_VOICE', 'af_heart')
FFMPEG = '/opt/homebrew/opt/ffmpeg@7/bin/ffmpeg'

def article_text(path):
    s = open(path).read()
    title = re.search(r'<h1 class="article-title">(.*?)</h1>', s, re.S)
    body = re.search(r'<div class="article-body">(.*?)\n  </div>', s, re.S)
    if not body:
        body = re.search(r'<div class="article-body">(.*?)</div>\s*<div class="article-foot">', s, re.S)
    parts = []
    if title:
        parts.append(re.sub(r'<[^>]+>', '', title.group(1)).strip() + '.')
    raw = body.group(1) if body else ''
    raw = re.sub(r'<li>', ' ', raw)
    raw = re.sub(r'</li>', '. ', raw)
    raw = re.sub(r'</(p|h2|h3)>', '\n\n', raw)
    raw = re.sub(r'<[^>]+>', '', raw)
    raw = html.unescape(raw)
    raw = re.sub(r'[ \t]+', ' ', raw)
    raw = re.sub(r'\n{3,}', '\n\n', raw)
    parts.append(raw.strip())
    return '\n\n'.join(parts)

targets = sys.argv[1:] or sorted(
    f for f in glob.glob(os.path.join(BLOG, '*.html'))
    if os.path.basename(f) != 'index.html')

pipeline = KPipeline(lang_code='a')

for path in targets:
    slug = os.path.splitext(os.path.basename(path))[0]
    text = article_text(path)
    if len(text) < 200:
        print('SKIP (no body):', slug); continue
    print('narrating %-44s %6d chars' % (slug, len(text)), flush=True)
    chunks = []
    for _, _, audio in pipeline(text, voice=VOICE, speed=1.0, split_pattern=r'\n\n+'):
        a = audio.detach().cpu().numpy() if hasattr(audio, 'detach') else np.asarray(audio)
        a = a.astype(np.float32)
        chunks.append(a)
        chunks.append(np.zeros(int(24000 * 0.35), dtype=np.float32))  # breath between paragraphs
    full = np.concatenate(chunks)
    wav = os.path.join(OUT, slug + '.wav')
    mp3 = os.path.join(OUT, slug + '.mp3')
    sf.write(wav, full, 24000)
    subprocess.run([FFMPEG, '-y', '-v', 'error', '-i', wav,
                    '-codec:a', 'libmp3lame', '-b:a', '64k', '-ac', '1', mp3], check=True)
    os.remove(wav)
    mins = len(full) / 24000 / 60
    print('   -> %s  %.1f min  %.1f MB' % (os.path.basename(mp3), mins,
                                           os.path.getsize(mp3) / 1e6), flush=True)
print('DONE')
