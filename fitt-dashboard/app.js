(() => {
  const D = { age: 21, height: 170, weight: 65, rhr: 70, level: 'some', goal: 'health', days: 4, session: 50, sit: 8, cond: false, symp: false, act: '빠르게 걷기 (약 6km/h)' };
  const root = document.querySelector('.fx');
  const $ = (s) => root.querySelector(s);
  const $$ = (s) => Array.from(root.querySelectorAll(s));
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const P = () => ({ ...D, ...dash.params() });
  const num = (v, d) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : d);
  const fmt = d3.format(',');
  const fmt1 = d3.format('.1f');
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const ceil5 = (x) => Math.ceil(x / 5) * 5;
  const DAYS = ['월', '화', '수', '목', '금', '토', '일'];
  const SPREAD = { 1: [2], 2: [1, 4], 3: [0, 2, 4], 4: [0, 1, 3, 5], 5: [0, 1, 3, 4, 5], 6: [0, 1, 2, 3, 4, 5], 7: [0, 1, 2, 3, 4, 5, 6] };
  const COMP = { aerobic: 0, resistance: 1, flexibility: 2, neuromotor: 3 };
  const compColor = (k) => (k in COMP ? dash.colors[COMP[k]] : 'var(--cds-chart-muted)');
  const RT_MIN = 30, FLEX_MIN = 10, NEURO_MIN = 10;

  // colour dots on the FITT cards
  $$('.fx-dot').forEach((d) => { const k = d.className.replace(/.*fx-dot-/, ''); d.style.background = compColor(k); });

  // ---- controls ----
  const ctrls = $$('[data-param]');
  const syncCtrl = (c) => {
    const v = P()[c.dataset.param];
    if (c.type === 'checkbox') c.checked = !!v;
    else c.value = v ?? '';
  };
  ctrls.forEach((c) => {
    c.addEventListener('change', () => {
      const k = c.dataset.param;
      let v;
      if (c.type === 'checkbox') v = c.checked;
      else if (c.type === 'number') {
        if (c.value === '' || !c.validity.valid) return;
        v = Number(c.value);
      } else v = c.value;
      dash.setParams({ [k]: v });
    });
    if (c.type === 'number') c.addEventListener('blur', () => syncCtrl(c));
  });
  $('.fx-reset').addEventListener('click', () => dash.resetParams());

  // choice cards (level, goal): one button per option, click to pick
  const fillChoice = (box, rows, valKey, labKey, descKey) => {
    const param = box.dataset.choice;
    const opts = box.querySelector('.fx-opts');
    const sig = rows.map((r) => String(r[valKey])).join('|');
    if (opts.dataset.filled !== sig) {
      opts.replaceChildren(...rows.map((r) => {
        const b = el('button', 'fx-opt'); b.type = 'button'; b.setAttribute('role', 'radio'); b.dataset.value = String(r[valKey]);
        b.append(el('span', 'fx-opt-t', String(r[labKey])), el('span', 'fx-opt-d', String(r[descKey])));
        b.addEventListener('click', () => dash.setParams({ [param]: b.dataset.value }));
        return b;
      }));
      opts.dataset.filled = sig;
    }
    const cur = P()[param];
    opts.querySelectorAll('.fx-opt').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.value === cur)));
  };

  // activity picker: a button that opens a list grouped by intensity
  const pickBtn = $('.fx-pick'), pickList = $('#act-list');
  const setOpen = (open) => { pickList.hidden = !open; pickBtn.setAttribute('aria-expanded', String(open)); };
  pickBtn.addEventListener('click', () => setOpen(pickList.hidden));
  document.addEventListener('click', (ev) => { if (!pickList.hidden && !ev.target.closest('#choice-act')) setOpen(false); });
  pickList.addEventListener('click', (ev) => {
    const b = ev.target.closest('.fx-pick-i');
    if (!b) return;
    setOpen(false);
    dash.setParams({ act: b.dataset.value });
  });
  const fillActs = (rows) => {
    const sig = rows.map((r) => `${r.activity}:${r.met}`).join('|');
    if (pickList.dataset.filled !== sig) {
      const groups = [['중강도 (3.0–5.9 MET)', (m) => m >= 3 && m < 6], ['고강도 (6 MET 이상)', (m) => m >= 6], ['가벼운 강도 (3 MET 미만)', (m) => m < 3]];
      pickList.replaceChildren(...groups.map(([lab, test]) => {
        const items = rows.filter((r) => test(Number(r.met))).sort((a, b) => Number(a.met) - Number(b.met));
        if (!items.length) return null;
        const g = el('div', 'fx-pick-g'); const wrap = el('div', 'fx-pick-items');
        items.forEach((r) => { const b = el('button', 'fx-pick-i', `${r.activity} · ${r.met} MET`); b.type = 'button'; b.setAttribute('role', 'option'); b.dataset.value = String(r.activity); wrap.append(b); });
        g.append(el('div', 'fx-pick-gh', lab), wrap);
        return g;
      }).filter(Boolean));
      pickList.dataset.filled = sig;
    }
    const cur = rows.find((r) => r.activity === P().act) || rows[0];
    pickBtn.querySelector('.fx-pick-v').textContent = cur ? `${cur.activity} · ${cur.met} MET` : '—';
    pickList.querySelectorAll('.fx-pick-i').forEach((b) => b.setAttribute('aria-selected', String(cur && b.dataset.value === cur.activity)));
  };

  // ---- generic cell marks ----
  const fillMarks = () => {
    $$('[data-source][data-field][data-where]').forEach((m) => {
      const id = m.dataset.source;
      const d = dash.data(id);
      if (d.status !== 'ok') {
        if (d.status === 'error') { m.classList.remove('dash-skeleton'); m.textContent = '불러오지 못함'; }
        return;
      }
      const [k, v] = m.dataset.where.split('=').map(decodeURIComponent);
      const row = d.data.find((r) => String(r[k]) === v);
      m.classList.remove('dash-skeleton');
      m.textContent = row ? String(row[m.dataset.field]) : '—';
    });
  };

  const pickSpaced = (arr, n, off) => {
    if (n >= arr.length) return arr.slice();
    const step = arr.length / n;
    const out = [];
    for (let i = 0; i < n; i++) out.push(arr[Math.floor(i * step + (off ? step / 2 : 0)) % arr.length]);
    return Array.from(new Set(out));
  };

  // ---- the prescription ----
  function compute(p, L, G, R, A) {
    const lvl = L.find((r) => r.level === p.level) || L[0];
    const goal = G.find((r) => r.goal === p.goal) || G[0];
    const rt = R.find((r) => r.key === goal.rt_key) || R[0];
    const act = A.find((r) => r.activity === p.act) || A[0];
    const age = clamp(num(p.age, D.age), 15, 90);
    const rhr = clamp(num(p.rhr, D.rhr), 35, 120);
    const w = clamp(num(p.weight, D.weight), 30, 200);
    const h = clamp(num(p.height, D.height), 120, 220);
    const session = clamp(num(p.session, D.session), 15, 180);
    const days = clamp(Math.round(num(p.days, D.days)), 1, 7);
    const sit = clamp(num(p.sit, D.sit), 0, 18);
    const met = Number(act.met);
    const hrmax = Math.round(208 - 0.7 * age);
    const hrr = hrmax - rhr;
    const bpm = (pct) => Math.round((hrr * pct) / 100 + rhr);
    const vig = met >= 6;
    const factor = vig ? 2 : 1; // vigorous minutes count double
    const order = SPREAD[days];
    const aDays = Math.min(days, 5);
    const rtN = Math.min(Number(lvl.rt_days), days);
    const neuroN = Math.min(Number(lvl.neuro_days), days);
    const aerobicIdx = pickSpaced(order, aDays, false);
    const rtIdx = pickSpaced(order, rtN, days > rtN);
    const neuroIdx = pickSpaced(order, neuroN, false);
    const targetLo = Number(goal.aero_lo), targetHi = Number(goal.aero_hi);
    const perTarget = Math.max(10, ceil5(targetLo / factor / aDays));
    const week = DAYS.map((name, i) => {
      if (!order.includes(i)) return { name, rest: true, items: [], total: 0 };
      const items = [];
      const isRt = rtIdx.includes(i), isNeuro = neuroIdx.includes(i), isAero = aerobicIdx.includes(i);
      if (isNeuro) items.push({ k: 'neuromotor', label: '신경운동(워밍업)', min: NEURO_MIN });
      let avail = session - FLEX_MIN - (isRt ? RT_MIN : 0) - (isNeuro ? NEURO_MIN : 0);
      if (isAero) {
        const m = Math.min(perTarget, Math.max(0, Math.floor(avail / 5) * 5));
        if (m >= 10) items.push({ k: 'aerobic', label: act.activity.replace(/\s*\(.*\)/, ''), min: m });
      }
      if (isRt) items.push({ k: 'resistance', label: '근력 전신', min: RT_MIN });
      items.push({ k: 'flexibility', label: '스트레칭', min: FLEX_MIN });
      const total = d3.sum(items, (d) => d.min);
      return { name, rest: false, items, total, over: total > session };
    });
    const aeroMin = d3.sum(week, (d) => d3.sum(d.items.filter((x) => x.k === 'aerobic'), (x) => x.min));
    const equiv = aeroMin * factor;
    const rtSessions = week.filter((d) => d.items.some((x) => x.k === 'resistance')).length;
    const metMin = Math.round(aeroMin * met + rtSessions * RT_MIN * 3.5);
    const kcal = Math.round(((met * 3.5 * w) / 200) * aeroMin + ((3.5 * 3.5 * w) / 200) * rtSessions * RT_MIN);
    const start = Math.min(Number(lvl.start_min), equiv);
    const startPer = Math.max(10, ceil5(start / factor / aDays));
    const perActual = aDays ? Math.round(aeroMin / aDays) : 0;
    const weeks = Math.max(0, Math.ceil((perActual - startPer) / 5));
    const bmi = w / ((h / 100) ** 2);
    const regular = p.level === 'regular';
    let scr;
    if (p.symp) scr = { t: '의료 승인 필요', c: 'fx-bad', s: '증상이 있으면 운동을 멈추고 먼저 의사의 승인을 받으세요.' };
    else if (p.cond && !regular) scr = { t: '의료 승인 권장', c: 'fx-warn', s: '의사 승인 후 가벼움~중강도로 시작하고 점진적으로 늘리세요.' };
    else if (p.cond) scr = { t: '중강도 지속 가능', c: 'fx-warn', s: '중강도는 계속해도 되지만, 고강도로 올리기 전 의료 승인을 받으세요.' };
    else if (!regular) scr = { t: '바로 시작 가능', c: 'fx-ok', s: '의료 승인 없이 가벼움~중강도부터 시작하세요.' };
    else scr = { t: '바로 시작 가능', c: 'fx-ok', s: '현재 운동을 이어가며 권고에 따라 점진적으로 늘리세요.' };
    return { lvl, goal, rt, act, age, rhr, w, h, session, days, sit, met, vig, hrmax, hrr, bpm, aDays, rtN, neuroN, week, aeroMin, equiv, targetLo, targetHi, perTarget, metMin, kcal, start, startPer, perActual, weeks, bmi, scr };
  }

  const bmiCat = (b) => (b < 18.5 ? ['저체중', 'fx-warn'] : b < 23 ? ['정상', 'fx-ok'] : b < 25 ? ['비만 전단계', 'fx-warn'] : ['비만', 'fx-bad']);

  const setTile = (k, text, unit) => {
    const e = $(`[data-k="${k}"]`);
    e.classList.remove('dash-skeleton');
    e.replaceChildren(document.createTextNode(text));
    if (unit) e.append(el('small', null, unit));
  };
  const setSub = (k, text, cls) => { const e = $(`[data-k="${k}"]`); e.textContent = text; e.className = 'fx-tile-s' + (cls ? ' ' + cls : ''); };

  const listInto = (box, lines) => {
    box.classList.remove('dash-skeleton');
    const ul = el('ul');
    lines.forEach((l) => ul.append(el('li', null, l)));
    box.replaceChildren(ul);
  };

  function renderTiles(x) {
    const lo = x.bpm(x.lvl.hrr_lo), hi = x.bpm(x.lvl.hrr_hi);
    setTile('hr', `${lo}–${hi}`, 'bpm');
    setSub('hr-s', `HRmax ${x.hrmax} · 안정시 ${x.rhr} · ${x.lvl.hrr_lo}–${x.lvl.hrr_hi}% HRR`);
    setTile('aero', fmt(x.equiv), '분/주');
    const ok = x.equiv >= x.targetLo;
    setSub('aero-s', ok ? `목표 ${x.targetLo}–${x.targetHi}분 달성` : `목표 ${x.targetLo}분까지 ${x.targetLo - x.equiv}분 부족`, ok ? 'fx-ok' : 'fx-warn');
    const m = $('[data-k="aero-m"]');
    const max = x.targetHi * 1.2;
    const f = el('div', 'fx-meter-f'); f.style.width = `${clamp(x.equiv / max, 0, 1) * 100}%`; f.style.background = dash.colors[0];
    const t1 = el('div', 'fx-meter-t'); t1.style.left = `${(x.targetLo / max) * 100}%`;
    const t2 = el('div', 'fx-meter-t'); t2.style.left = `${(x.targetHi / max) * 100}%`;
    m.replaceChildren(f, t1, t2);
    setTile('met', fmt(x.metMin), 'MET-분');
    setSub('met-s', x.metMin >= 1000 ? '권장 500–1,000 이상 — 충분' : x.metMin >= 500 ? '권장 500–1,000 범위' : '권장 500 MET-분 미만', x.metMin >= 500 ? 'fx-ok' : 'fx-warn');
    setTile('kcal', fmt(x.kcal), 'kcal');
    setSub('kcal-s', `체중 ${fmt1(x.w)}kg · 유산소 + 근력 기준 추정치`);
    const [cat, cc] = bmiCat(x.bmi);
    setTile('bmi', fmt1(x.bmi), 'kg/m²');
    setSub('bmi-s', `${cat} (대한비만학회 기준)`, cc);
    const scr = $('[data-k="scr"]'); scr.classList.remove('dash-skeleton'); scr.textContent = x.scr.t; scr.className = 'fx-big ' + x.scr.c;
    setSub('scr-s', x.scr.s);
  }

  function renderMine(x) {
    const lo = x.bpm(x.lvl.hrr_lo), hi = x.bpm(x.lvl.hrr_hi);
    const box = (k) => $(`[data-my="${k}"] .fx-my-b`);
    const aero = [
      `주 ${x.aDays}일 × 회당 ${x.perActual}분 ${x.act.activity} (${x.vig ? '고강도' : x.met >= 3 ? '중강도' : '가벼운 강도'}, ${x.met} MET)`,
      `목표 심박수 ${lo}–${hi} bpm (${x.lvl.hrr_lo}–${x.lvl.hrr_hi}% HRR)`,
      `처음엔 회당 ${x.startPer}분으로 시작해 매주 5분씩 늘리면 약 ${x.weeks}주 뒤 목표 단계`,
      x.goal.tip,
    ];
    if (x.vig && x.lvl.level === 'none') aero.push('지금 운동 수준에서는 고강도 활동보다 빠르게 걷기 같은 중강도부터 권장합니다.');
    if (x.perActual < x.perTarget) aero.push(`1회 ${x.session}분으로는 회당 목표 ${x.perTarget}분을 다 채우기 어려워요. 시간을 늘리거나 짧게 나눠서 해도 됩니다.`);
    listInto(box('aerobic'), aero);
    listInto(box('resistance'), [
      `주 ${x.rtN}일 (월·목처럼 하루 이상 쉬고) · 회당 약 ${RT_MIN}분 · 목표: ${x.rt.label}`,
      `부하 ${x.rt.load} · ${x.rt.reps} · ${x.rt.rir} · 세트 간 휴식 ${x.rt.rest}`,
      `처음 4주는 ${x.lvl.rt_sets} → 이후 ${x.rt.sets_week}`,
      '스쿼트·런지·푸시업·로우·플랭크 등 맨몸이나 밴드로도 충분합니다.',
    ]);
    listInto(box('flexibility'), [
      `운동 끝날 때마다 ${FLEX_MIN}분 (주 ${x.days}일, 권장 ${x.lvl.flex_days}일 이상)`,
      `각 동작 ${x.age >= 65 ? '30–60' : '10–30'}초 유지 × 2–4회, 동작당 총 60초`,
      '햄스트링·고관절 굴곡근·종아리·가슴·어깨를 꼭 포함하세요.',
    ]);
    listInto(box('neuromotor'), [
      `주 ${x.neuroN}일 · 워밍업 ${NEURO_MIN}분 (주간 ${x.neuroN * NEURO_MIN}분, 여유가 있으면 60분까지)`,
      '한발 서기 → 눈 감고 한발 서기, 사다리 스텝, 사이드 스텝, 방향 전환',
      '테니스·배드민턴 같은 라켓 스포츠도 민첩성·협응 훈련이 됩니다.',
    ]);
    const sitLines = [`하루 ${x.sit}시간 앉아 있다면 수업·공부 중 30분마다 일어나 2–3분 걷기`];
    if (x.sit >= 8) sitLines.push('8시간 이상은 많은 편입니다. 운동을 해도 오래 앉아 있는 시간은 따로 줄여야 해요.');
    sitLines.push('이동은 계단·도보로, 통화는 서서 걸으며');
    listInto(box('sedentary'), sitLines);
  }

  function renderWeek(x) {
    const lg = $('#week-legend');
    lg.replaceChildren(...[['aerobic', '유산소'], ['resistance', '근력'], ['neuromotor', '신경운동'], ['flexibility', '유연성']].map(([k, l]) => {
      const s = el('span'); const i = el('i'); i.style.background = compColor(k); s.append(i, document.createTextNode(l)); return s;
    }));
    $('#week-note').textContent = `주 ${x.days}일 · 1회 최대 ${x.session}분 기준으로 배치했습니다. 유산소 합계 ${x.aeroMin}분${x.vig ? ` (고강도라 중강도 ${x.equiv}분에 해당)` : ''}, 근력 ${x.rtN}회.`;
    const g = $('#week-grid');
    g.replaceChildren(...x.week.map((d) => {
      const c = el('div', 'fx-day');
      const hd = el('div', 'fx-day-h'); hd.append(el('span', null, d.name), el('span', 'fx-day-t' + (d.over ? ' fx-warn' : ''), d.rest ? '' : `${d.total}분`));
      c.append(hd);
      if (d.rest) c.append(el('span', 'fx-rest', '휴식 · 가볍게 걷기'));
      d.items.forEach((it) => {
        const ch = el('div', 'fx-chip'); const i = el('i'); i.style.background = compColor(it.k);
        ch.style.background = `color-mix(in srgb, ${compColor(it.k)} 14%, transparent)`;
        ch.append(i, document.createTextNode(`${it.label} ${it.min}분`));
        c.append(ch);
      });
      return c;
    }));
  }

  // ---- zone chart ----
  const tip = el('div', 'fx-tip'); tip.hidden = true;
  function renderZones(x, Z) {
    const box = $('#zones-chart');
    box.replaceChildren();
    const W = Math.max(280, box.clientWidth || 600);
    const rowH = 30, gap = 8, top = 26, bottom = 46;
    const H = top + Z.length * (rowH + gap) - gap + bottom;
    const svg = d3.select(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', '심박수 강도 구간');
    const probe = svg.append('g').attr('font-size', 12);
    const lw = d3.max(Z, (z) => { const t = probe.append('text').text(z.zone); const n = t.node().getComputedTextLength(); t.remove(); return n; }) || 60;
    probe.remove();
    const left = Math.ceil(lw) + 12, right = 12;
    const xs = d3.scaleLinear([x.rhr, x.hrmax], [left, W - right]);
    const ax = svg.append('g').attr('transform', `translate(0,${H - bottom + 6})`).call(d3.axisBottom(xs).ticks(Math.max(3, Math.floor((W - left) / 70))).tickSizeOuter(0)).attr('font-size', null).attr('font-family', null);
    ax.selectAll('text').attr('fill', 'var(--color-fg-muted)').style('font-size', 'var(--cds-font-size-caption)');
    ax.selectAll('line,path').attr('stroke', 'var(--cds-chart-axis)');
    svg.append('text').attr('x', W - right).attr('y', H - 2).attr('text-anchor', 'end').attr('fill', 'var(--color-fg-muted)').style('font-size', 'var(--cds-font-size-caption)').text('심박수 (bpm)');
    const g = svg.append('g');
    Z.forEach((z, i) => {
      const y = top + i * (rowH + gap);
      const a = x.bpm(z.hrr_lo), b = x.bpm(z.hrr_hi);
      g.append('text').attr('x', left - 10).attr('y', y + rowH / 2).attr('dy', '0.35em').attr('text-anchor', 'end').attr('fill', 'var(--color-fg)').attr('font-size', 12).text(z.zone);
      const r = g.append('rect').attr('x', xs(a)).attr('y', y).attr('width', Math.max(2, xs(b) - xs(a))).attr('height', rowH).attr('rx', 4)
        .attr('fill', dash.colors[0]).attr('fill-opacity', 0.16 + i * 0.17);
      const label = `${a}–${b}`;
      const tw = xs(b) - xs(a);
      if (tw > 52) g.append('text').attr('x', (xs(a) + xs(b)) / 2).attr('y', y + rowH / 2).attr('dy', '0.35em').attr('text-anchor', 'middle').attr('font-size', 11).attr('fill', 'var(--color-fg)').attr('pointer-events', 'none').text(label);
      r.on('mousemove', (ev) => {
        tip.hidden = false;
        tip.replaceChildren(el('div', 'fx-tip-h', z.zone), el('div', null, `${a}–${b} bpm · ${z.hrr_lo}–${z.hrr_hi}% HRR`), el('div', null, `HRmax ${z.hrmax} · RPE ${z.rpe}`), el('div', null, `${z.met} MET · ${z.talk}`));
        const [mx, my] = d3.pointer(ev, box);
        const tw2 = tip.offsetWidth || 180;
        tip.style.left = `${clamp(mx + 12, 0, box.clientWidth - tw2)}px`;
        tip.style.top = `${my + 14}px`;
        r.attr('stroke', 'var(--color-fg)').attr('stroke-width', 1);
      }).on('mouseleave', () => { tip.hidden = true; r.attr('stroke', null); });
    });
    const lo = x.bpm(x.lvl.hrr_lo), hi = x.bpm(x.lvl.hrr_hi);
    svg.append('rect').attr('x', xs(lo)).attr('y', top - 6).attr('width', Math.max(2, xs(hi) - xs(lo))).attr('height', Z.length * (rowH + gap) - gap + 12).attr('rx', 6)
      .attr('fill', 'none').attr('stroke', 'var(--color-fg)').attr('stroke-width', 2).attr('pointer-events', 'none');
    const cx = clamp((xs(lo) + xs(hi)) / 2, left + 40, W - right - 40);
    svg.append('text').attr('x', cx).attr('y', top - 12).attr('text-anchor', 'middle').attr('font-size', 12).attr('fill', 'var(--color-fg)').attr('font-weight', 500).text(`내 목표 ${lo}–${hi} bpm`);
    box.append(tip);
    $('#method-mine').textContent = `내 값: HRmax = 208 − 0.7 × ${x.age} ≈ ${x.hrmax} bpm, HRR = ${x.hrmax} − ${x.rhr} = ${x.hrr} bpm → ${x.lvl.hrr_lo}% 강도는 ${x.hrr} × ${x.lvl.hrr_lo / 100} + ${x.rhr} ≈ ${lo} bpm. (참고: 220 − 나이 식이면 ${220 - x.age} bpm)`;
  }

  // ---- activity table ----
  let sortKey = 'met', sortDir = -1;
  $$('#act-table th button').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.sort;
    if (sortKey === k) sortDir = -sortDir; else { sortKey = k; sortDir = k === 'met' ? -1 : 1; }
    draw();
  }));
  $('#act-table tbody').addEventListener('click', (ev) => {
    const tr = ev.target.closest('tr[data-key]');
    if (tr) dash.setParams({ act: tr.dataset.key });
  });
  function renderActs(A, x) {
    $$('#act-table th[data-field]').forEach((th) => th.setAttribute('aria-sort', th.dataset.field === sortKey ? (sortDir < 0 ? 'descending' : 'ascending') : 'none'));
    const rows = A.slice().sort((a, b) => (sortKey === 'met' ? (Number(a.met) - Number(b.met)) : String(a.activity).localeCompare(String(b.activity), 'ko')) * sortDir);
    const tb = $('#act-table tbody');
    tb.replaceChildren(...rows.map((r) => {
      const m = Number(r.met);
      const tr = el('tr'); tr.dataset.key = String(r.activity);
      tr.setAttribute('aria-selected', String(r.activity === x.act.activity));
      const [lab, ci] = m >= 6 ? ['고강도', 3] : m >= 3 ? ['중강도', 0] : ['가벼움', null];
      const it = el('span', 'fx-int'); const dot = el('i'); dot.style.background = ci == null ? 'var(--cds-chart-muted)' : dash.colors[ci === 3 ? 4 : 0]; it.append(dot, document.createTextNode(lab));
      const td3 = el('td', 'fx-hide-n'); td3.append(it);
      tr.append(el('td', null, String(r.activity)), el('td', 'fx-num', String(m)), td3,
        el('td', 'fx-num', `${fmt(Math.round(((m * 3.5 * x.w) / 200) * 30))} kcal`),
        el('td', 'fx-num fx-hide-n', `${fmt(Math.ceil(500 / m))}분`));
      return tr;
    }));
  }

  function failAll(msg) {
    ['#week-grid', '#zones-chart'].forEach((s) => { const b = $(s); b.replaceChildren(el('div', 'fx-fail', msg)); });
    $$('[data-k]').forEach((e) => { if (e.classList.contains('fx-big')) { e.classList.remove('dash-skeleton'); e.textContent = '—'; } });
    $$('.fx-my-b').forEach((b) => { b.classList.remove('dash-skeleton'); b.replaceChildren(el('div', 'fx-fail', msg)); });
  }

  function draw() {
    fillMarks();
    const ids = ['levels', 'goals', 'rt_goals', 'activities', 'zones', 'fitt', 'updates'];
    const ds = Object.fromEntries(ids.map((i) => [i, dash.data(i)]));
    if (ds.levels.status === 'ok') fillChoice($('#choice-level'), ds.levels.data, 'level', 'label', 'tip');
    if (ds.goals.status === 'ok') fillChoice($('#choice-goal'), ds.goals.data, 'goal', 'label', 'tip');
    if (ds.activities.status === 'ok') fillActs(ds.activities.data);
    ctrls.forEach((c) => { if (c !== document.activeElement) syncCtrl(c); });
    const need = ['levels', 'goals', 'rt_goals', 'activities', 'zones'];
    if (need.some((i) => ds[i].status === 'error')) { failAll('Failed to load'); $('#takeaway').classList.remove('dash-skeleton'); $('#takeaway').textContent = '기준 자료를 불러오지 못했습니다.'; return; }
    if (need.some((i) => ds[i].status !== 'ok')) {
      $('#week-grid').replaceChildren(); $('#zones-chart').replaceChildren();
      return;
    }
    const p = P();
    const x = compute(p, ds.levels.data, ds.goals.data, ds.rt_goals.data, ds.activities.data);
    const t = $('#takeaway');
    t.classList.remove('dash-skeleton');
    const lo = x.bpm(x.lvl.hrr_lo), hi = x.bpm(x.lvl.hrr_hi);
    const pct = Math.round((x.equiv / x.targetLo) * 100);
    t.replaceChildren(
      document.createTextNode(`${x.age}세 · ${x.lvl.label} · 목표 ‘${x.goal.label}’ → `),
      el('b', null, `주 ${x.aDays}일 유산소 ${x.perActual}분(심박 ${lo}–${hi} bpm) + 주 ${x.rtN}일 근력운동`),
      document.createTextNode(`으로 주간 유산소 목표 ${x.targetLo}분의 ${pct}%를 채웁니다. ${x.lvl.tip}.`),
    );
    renderTiles(x);
    renderMine(x);
    renderWeek(x);
    renderZones(x, ds.zones.data);
    renderActs(ds.activities.data, x);
  }

  dash.onData(draw);
})();
