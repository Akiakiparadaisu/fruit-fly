// A functional mushroom-body-inspired model, not a connectome or human brain model.
export function random(seed = 42) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const sigmoid = z => 1 / (1 + Math.exp(-Math.max(-35, Math.min(35, z))));
export function shuffle(items, rng) {
  const a = [...items]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a;
}
export function splitTrials(samples, seed = 42) {
  const groups = new Map();
  for (const s of samples) {
    if (!groups.has(s.group)) groups.set(s.group, []);
    const group = groups.get(s.group);
    if (group.length && group[0].y !== s.y) throw new Error('同じ試行IDに異なるラベルがあります。試行IDとラベルの対応を確認してください。');
    group.push(s);
  }
  const train = [], test = [], rng = random(seed);
  for (const label of [0, 1]) {
    const list = shuffle([...groups.values()].filter(g => g[0].y === label), rng);
    if (list.length < 5) throw new Error('評価には既知・未知それぞれ5試行以上が必要です（最低1試行を評価用に確保）。');
    const n = Math.max(1, Math.round(list.length * .2));
    list.forEach((g, i) => (i < n ? test : train).push(...g));
  }
  return { train, test };
}
export class MushroomBody {
  constructor(dim, seed = 42, cells = 256) {
    this.dim = dim; this.cells = cells; this.seed = seed; this.mean = Array(dim).fill(0); this.scale = Array(dim).fill(1);
    const rng = random(seed);
    this.connections = Array.from({ length: cells }, () => Array.from({ length: Math.min(6, dim) }, () => [Math.floor(rng() * dim), (rng() < .5 ? -1 : 1)]));
    this.weights = Array(cells).fill(0); this.bias = 0;
  }
  fitScaler(samples) {
    for (let j = 0; j < this.dim; j++) {
      this.mean[j] = samples.reduce((s, a) => s + a.x[j], 0) / samples.length;
      this.scale[j] = Math.sqrt(samples.reduce((s, a) => s + (a.x[j] - this.mean[j]) ** 2, 0) / samples.length) || 1;
    }
  }
  encode(x) {
    if (x.length !== this.dim || x.some(v => !Number.isFinite(v))) throw new Error('特徴量の次元または値が不正です。');
    const z = x.map((v, i) => Math.max(-6, Math.min(6, (v - this.mean[i]) / this.scale[i])));
    const activity = this.connections.map(cs => Math.max(0, cs.reduce((s, [i, w]) => s + z[i] * w, 0) / Math.sqrt(cs.length)));
    const winners = activity.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v).slice(0, Math.ceil(this.cells * .1));
    const sparse = Array(this.cells).fill(0);
    // Binary winner activity keeps scale fixed and makes synaptic change interpretable.
    for (const { v, i } of winners) if (v > 0) sparse[i] = 1;
    return sparse;
  }
  read(activity) { return sigmoid(activity.reduce((s, a, i) => s + a * this.weights[i], this.bias)); }
  predict(x) { return this.read(this.encode(x)); }
  learn(activity, target, rate = .04, weight = 1) {
    const p = this.read(activity), delta = (target - p) * rate * weight;
    for (let i = 0; i < this.cells; i++) this.weights[i] += delta * activity[i] - rate * .0005 * this.weights[i];
    this.bias += delta; return p;
  }
  toJSON() { return { version: 1, type: 'mushroom-body-inspired', dim: this.dim, cells: this.cells, seed: this.seed, mean: this.mean, scale: this.scale, connections: this.connections, weights: this.weights, bias: this.bias }; }
  static fromJSON(data) { const m = new MushroomBody(data.dim, data.seed, data.cells); Object.assign(m, structuredClone(data)); return m; }
}
export function metrics(model, samples) {
  const matrix = [[0, 0], [0, 0]]; let loss = 0;
  for (const s of samples) { const p = model.predict(s.x); matrix[s.y][p >= .5 ? 1 : 0]++; loss -= s.y * Math.log(Math.max(1e-12, p)) + (1 - s.y) * Math.log(Math.max(1e-12, 1 - p)); }
  const recalls = matrix.map((r, i) => r[i] / (r[0] + r[1] || 1));
  return { n: samples.length, accuracy: (matrix[0][0] + matrix[1][1]) / samples.length, balancedAccuracy: (recalls[0] + recalls[1]) / 2, loss: loss / samples.length, matrix };
}
export function train(samples, epochs = 60, onEpoch = () => {}) {
  const { train: training, test } = splitTrials(samples);
  const model = new MushroomBody(samples[0].x.length); model.fitScaler(training);
  const encoded = training.map(s => ({ ...s, a: model.encode(s.x) })), rng = random(17);
  const counts = [0, 0]; training.forEach(s => counts[s.y]++);
  const history = [];
  for (let epoch = 0; epoch < epochs; epoch++) {
    for (const s of shuffle(encoded, rng)) model.learn(s.a, s.y, .025, training.length / (2 * counts[s.y]));
    const m = metrics(model, training); history.push({ epoch: epoch + 1, loss: m.loss, accuracy: m.accuracy }); onEpoch(history.at(-1));
  }
  return { model: model.toJSON(), history, evaluation: metrics(model, test), trainCount: training.length, testCount: test.length, trainGroups: new Set(training.map(s => s.group)).size, testGroups: new Set(test.map(s => s.group)).size, test };
}
export function demoData() {
  const rng = random(701), rows = [];
  for (let trial = 0; trial < 80; trial++) {
    const known = trial % 2;
    for (let t = 0; t < 128; t++) rows.push({ trial: `trial-${trial + 1}`, word: `${known ? '既知' : '未知'}語-${Math.floor(trial / 2) + 1}`, label: known ? 'known' : 'unknown', time: t / 128,
      Fz: (known ? 2 : .7) * Math.sin(t * .38) + (rng() - .5) * 1.2,
      Cz: (known ? .6 : 2.1) * Math.cos(t * .2) + (rng() - .5),
      Pz: (known ? 1.5 : .5) * Math.sin(t * .53) + (rng() - .5) });
  }
  return rows;
}
