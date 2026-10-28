export function createCollector(config) {
  const { channels, label, known, unknown, trial, word, mode } = config;
  if (!channels?.length || channels.length > 32) throw new Error('脳波・特徴量の列を1〜32列選択してください。');
  if (!label || known === unknown || !known || !unknown) throw new Error('ラベル列と、異なる既知・未知の値を指定してください。');
  if (channels.includes(label) || channels.includes(trial) || channels.includes(word)) throw new Error('ラベル・試行ID・単語の列は入力特徴量に含められません。');
  if (mode === 'raw' && !trial) throw new Error('連続脳波には試行IDが必要です。刺激イベントを使って事前に試行ごとに区切ってください。');
  let rows = 0, skipped = 0; const groups = new Map(), samples = [];
  function add(row) {
    rows++;
    const value = String(row[label] ?? '').trim();
    if (value !== known && value !== unknown) { skipped++; return; }
    const x = channels.map(c => String(row[c] ?? '').trim()).map(v => v === '' ? NaN : Number(v));
    if (x.some(v => !Number.isFinite(v) || Math.abs(v) > 1e12)) { skipped++; return; }
    const y = value === known ? 1 : 0, id = trial ? String(row[trial] ?? '').trim() : `row-${rows}`;
    if (!id) { skipped++; return; }
    const name = word ? String(row[word] ?? '') : id;
    if (mode === 'features') {
      if (samples.length >= 50000) throw new Error('上限の50,000特徴量行を超えました。対象の試行を絞ってください。');
      samples.push({ x, y, group: id, word: name }); return;
    }
    if (!groups.has(id)) {
      if (groups.size >= 50000) throw new Error('上限の50,000試行を超えました。');
      groups.set(id, { y, group: id, word: name, n: 0, mean: x.map(() => 0), m2: x.map(() => 0), square: x.map(() => 0), diff: x.map(() => 0), previous: x });
    }
    const g = groups.get(id);
    if (g.y !== y) throw new Error(`試行ID「${id.slice(0, 50)}」内でラベルが変わっています。試行の区切りを確認してください。`);
    g.n++;
    x.forEach((v, j) => { const delta = v - g.mean[j]; g.mean[j] += delta / g.n; g.m2[j] += delta * (v - g.mean[j]); g.square[j] += v * v; if (g.n > 1) g.diff[j] += Math.abs(v - g.previous[j]); }); g.previous = x;
  }
  function finish() {
    let shortTrials = 0;
    if (mode === 'raw') for (const g of groups.values()) {
      if (g.n < 8) { shortTrials++; continue; }
      samples.push({ x: channels.flatMap((_, j) => [g.mean[j], Math.sqrt(g.m2[j] / g.n), Math.sqrt(g.square[j] / g.n), g.diff[j] / (g.n - 1)]), y: g.y, group: g.group, word: g.word });
    }
    if (!samples.length) throw new Error('有効な試行がありません。列・ラベル値を確認してください（連続脳波は1試行8点以上必要）。');
    return { samples, rows, skipped, shortTrials, featureNames: mode === 'raw' ? channels.flatMap(c => ['mean', 'std', 'rms', 'meanAbsDiff'].map(f => `${c}:${f}`)) : channels };
  }
  return { add, finish };
}
