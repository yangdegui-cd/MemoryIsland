"""Generate complete, disjoint WOFF2 unicode subsets; no supported glyph is lost.
Requires: python -m pip install 'fonttools[woff]'
"""
from pathlib import Path
from collections import Counter
from fontTools.ttLib import TTFont
from fontTools import subset
import hashlib

root = Path(__file__).resolve().parents[1]
source = root / 'public/fonts/mood-handwriting.ttf'
font = TTFont(source)
all_codes = set(font.getBestCmap())
counts = Counter()
for file in (root / 'app').rglob('*'):
    if file.suffix in ('.tsx', '.ts'):
        counts.update(map(ord, file.read_text()))
common = {code for code in all_codes if code < 0x300}
common.update(code for code, _ in counts.most_common() if code in all_codes and code >= 0x300 and counts[code] >= 3)
groups = [sorted(common)]
remaining = sorted(all_codes - common)
groups.extend(remaining[i:i+256] for i in range(0, len(remaining), 256))
out = root / 'public/fonts/mood-subsets'
out.mkdir(exist_ok=True)
css = []
for i, codes in enumerate(groups):
    item = TTFont(source)
    options = subset.Options()
    options.flavor = 'woff2'
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=codes)
    subsetter.subset(item)
    item.flavor = 'woff2'
    temp = out / f'part-{i}.woff2'
    item.save(temp)
    digest = hashlib.sha256(temp.read_bytes()).hexdigest()[:10]
    dest = out / f'part-{i}-{digest}.woff2'
    temp.rename(dest)
    css.append("@font-face{font-family:'Island Hand';font-style:normal;font-weight:400;font-display:swap;src:url('/fonts/mood-subsets/" + dest.name + "') format('woff2');unicode-range:" + ','.join(f'U+{v:X}' for v in codes) + ';}')
(root / 'app/mood/font.css').write_text('\n'.join(css)+'\n')
assert set().union(*map(set, groups)) == all_codes
assert sum(map(len, groups)) == len(all_codes)
print(f'{len(all_codes)} glyphs retained, {len(groups)} subsets, common subset {len(common)} glyphs, {next(out.glob("part-0-*.woff2")).stat().st_size} bytes')
# The English script is small; WOFF2 retains every glyph.
script = TTFont(root / 'public/fonts/game-house-script.ttf')
script.flavor = 'woff2'
script.save(root / 'public/fonts/game-house-script.woff2')
