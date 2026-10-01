import { sealSpec } from '../src/seal/guilloche';
import { SealRenderer } from '../src/seal/renderer';
const names = [
  'Krka, d. d., Novo mesto',
  'Akrapovič d.d.',
  'Petrol d.d.',
  'Outfit7',
  'Gorenje',
  'Nova Ljubljanska banka',
];
for (const [i, name] of names.entries()) {
  const fig = document.createElement('figure');
  if (i === 5) fig.className = 'dark';
  const canvas = document.createElement('canvas');
  fig.append(canvas, Object.assign(document.createElement('figcaption'), { textContent: name }));
  document.body.append(fig);
  new SealRenderer(canvas, sealSpec(name), { size: 400, ink: i === 5 ? '#63e4b8' : '#155e46' }).drawStatic();
}
const g = document.createElement('figure');
for (const name of names) {
  const c = document.createElement('canvas');
  c.style.cssText = 'width:40px;height:40px;display:inline-block;margin:6px';
  g.append(c);
  new SealRenderer(c, sealSpec(name, 'glyph'), { size: 40, ink: '#155e46', hairline: 0.7 }).drawStatic();
}
document.body.append(g);
