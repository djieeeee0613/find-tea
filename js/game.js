'use strict';
/* ============================================================
   大家來找茶：四關茶葉知識小遊戲
   1 台灣名茶產地 → 2 日月潭紅茶四大品種 → 3 熱泡實作 → 4 回沖與冷泡
   進度與星數存在瀏覽器（localStorage），不需要登入
   ============================================================ */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const wait = ms => new Promise(r => setTimeout(r, ms));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pickN = (arr, n, not) => shuffle(arr.filter(x => x !== not)).slice(0, n);
const A = 'assets/';
const SAMIMG = { idle: A + 'chali_idle_1.png?v=2', talk: A + 'chali_idle_2.png?v=2', happy: A + 'chali_happy_correct.png?v=2', cold: A + 'chali_wrong_1.png?v=2', wilt: A + 'chali_wrong_2.png?v=2' };   // 導覽角色：茶理先生
Object.values(SAMIMG).forEach(s => { new Image().src = s; });
const stage = $('#tStage');
let mistakes = 0;

/* ---------------- 進度 ---------------- */
const Prog = {
  key: 'zhaocha.progress.v2', data: {},
  load() { try { this.data = JSON.parse(localStorage.getItem(this.key) || '{}'); } catch (e) { this.data = {}; } },
  set(i, stars) { const old = this.data[i] || 0; if (stars > old) this.data[i] = stars; try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) {} },
  get(i) { return this.data[i] || 0; },
  all() { return LEVELS.every((_, i) => this.get(i) > 0); },
  total() { return LEVELS.reduce((s, _, i) => s + this.get(i), 0); },
};

/* ---------------- 茶理先生導覽 ---------------- */
const G = {
  run: 0, skip: false,
  init() { this.text = $('#gText'); this.img = $('#gImg'); this.btn = $('#gBtn'); this.sam = $('.g-sam'); $('#gBox').addEventListener('click', () => { this.skip = true; }); },
  anim(name) { this.sam.classList.remove('shaking', 'hopping'); void this.sam.offsetWidth; this.sam.classList.add(name); },
  async say(s, mood = 'idle', ...args) {
    const id = ++this.run, chars = [...t(s, ...args)]; this.skip = false;
    this.img.src = SAMIMG[mood] || SAMIMG.idle;
    if (mood === 'happy') this.anim('hopping'); if (mood === 'cold' || mood === 'wilt') this.anim('shaking');
    for (let i = 1; i <= chars.length; i++) {
      if (id !== this.run) return; if (this.skip) break;
      this.text.textContent = chars.slice(0, i).join(''); const c = chars[i - 1];
      if (i % 2) Sound.blip('chali', c);
      if (mood === 'idle' && i % 5 === 0) this.img.src = this.img.src.includes('idle_1') ? SAMIMG.talk : SAMIMG.idle;
      await wait('，。！？…、'.includes(c) ? 100 : 26);
    }
    if (id !== this.run) return; this.text.textContent = chars.join(''); if (mood === 'idle') this.img.src = SAMIMG.idle;
  },
  next(label) {
    const b = this.btn; b.textContent = label; b.disabled = false; b.classList.add('ready');
    return new Promise(res => { b.onclick = () => { b.onclick = null; b.disabled = true; b.classList.remove('ready'); res(); }; });
  },
  hideBtn() { this.btn.disabled = true; this.btn.classList.remove('ready'); this.btn.onclick = null; },
};

/* ---------------- 共用畫面元件 ---------------- */
async function setScene(html) {
  stage.classList.add('swap'); await wait(220);
  stage.className = 't-stage swap'; stage.innerHTML = html; void stage.offsetWidth; stage.classList.remove('swap');
}
const chip = name => `<div class="t-chip" style="padding-left:12px">${name}</div><div class="t-count" id="cnt"></div>`;
const count = s => { const c = $('#cnt'); if (c) c.textContent = s; };
const miss = (msg, ...a) => { mistakes++; Sound.bad(); if (navigator.vibrate) try { navigator.vibrate(40); } catch (e) {} return G.say(msg, 'wilt', ...a); };
const nope = el => { el.classList.remove('no'); void el.offsetWidth; el.classList.add('no'); };
function setStep(i) { $$('#steps li').forEach((li, k) => { li.classList.toggle('on', k === i); li.classList.toggle('done', Prog.get(k) > 0 && k !== i); }); }
const CUP = () => `<svg viewBox="0 0 160 130"><g class="steam" fill="none" stroke="#c9bfa6" stroke-width="4" stroke-linecap="round"><path d="M58,34 q-10,-12 0,-22 q8,-8 0,-16"/><path d="M82,36 q-10,-12 0,-24 q8,-8 0,-16"/><path d="M104,34 q-10,-12 0,-22 q8,-8 0,-16"/></g><g filter="url(#wob-s)" stroke="#55534f" stroke-width="5" stroke-linejoin="round"><path d="M122,62 q30,-4 28,18 q-2,20 -34,20" fill="none"/><path d="M26,52 h108 q4,60 -54,64 q-58,-4 -54,-64Z" fill="#fbf7ea"/><ellipse class="liq" cx="80" cy="54" rx="54" ry="13"/></g></svg>`;
const leafStrip = (x, y, r) => `<div class="curl" style="left:${x}%;top:${y}%;rotate:${r}deg;--c:#3b2a22"><svg viewBox="0 0 64 34"><g stroke-linecap="round" stroke-linejoin="round"><path class="c2" stroke-width="3.4" d="M4 27 C12 12 30 3 60 6 C50 11 46 17 37 22 C27 27 13 31 4 27Z"/></g></svg></div>`;

/** 四選一卡片題（上面一杯茶，下面四張卡） */
async function cardRound({ title, color, clue, options, answer, dex, index, total }) {
  await setScene(`<div class="b-bg"></div>${chip(title)}
    <div class="b-cup" style="top:12%;--liq:${color}">${CUP()}</div>
    <div class="v-cards">${options.map((o, i) => `<button class="v-card" data-id="${o.id}" style="animation-delay:${i * 60}ms">${o.name}</button>`).join('')}</div>`);
  count(`${index + 1} / ${total}`);
  G.say(clue);
  await new Promise(res => {
    stage.onclick = e => {
      const b = e.target.closest('.v-card'); if (!b) return;
      if (b.dataset.id !== answer) { nope(b); miss('不是這個喔，再想一想！'); return; }
      stage.onclick = null; b.classList.add('yes'); Sound.ok(); res();
    };
  });
  await wait(350);
  stage.insertAdjacentHTML('beforeend', dex);
}
const dexHTML = (name, color, rows, kicker = '收進圖鑑') => `<div class="dex" style="--liq:${color}"><span class="kicker">${kicker}</span>
  <div class="dex-top"><i class="dex-dot"></i><h3>${name}</h3></div><dl>${rows.filter(r => r[1]).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl></div>`;

/** 選擇題 */
async function quiz(title, qs) {
  for (let i = 0; i < qs.length; i++) {
    const q = qs[i], opts = shuffle([q.right, ...q.wrongs]), a = opts.indexOf(q.right);
    await setScene(`<div class="b-bg"></div>${chip(title)}<div class="q-box"><h3>${q.q}</h3>
      ${opts.map((o, k) => `<button class="btn q-opt" data-k="${k}"><i>${String.fromCharCode(65 + k)}</i><span>${o}</span></button>`).join('')}</div>`);
    count(`${i + 1} / ${qs.length}`);
    G.say(q.ask || '選一個答案吧！');
    await new Promise(res => {
      stage.onclick = e => {
        const b = e.target.closest('.q-opt'); if (!b) return;
        if (+b.dataset.k !== a) { nope(b); miss('不對喔，再想一想。'); return; }
        stage.onclick = null; b.classList.add('yes'); Sound.ok(); res();
      };
    });
    await G.say(q.why, 'happy');
    await G.next(i < qs.length - 1 ? '下一題' : '完成這一關');
  }
}

/* ============================================================
   四個關卡
   ============================================================ */
async function level1() {
  await G.say('台灣有很多有名的茶，各有自己的家鄉。你知道它們產在哪裡嗎？'); await G.next('開始');
  const places = TW_TEAS.map(x => x.place);
  await quiz('台灣名茶產地', shuffle(TW_TEAS).map(x => ({ q: `${x.tea}最有名的產地是哪裡？`, right: x.place, wrongs: pickN(places, 2, x.place), why: x.why })));
}

async function level2() {
  await G.say('日月潭的紅茶不只一種喔！看茶湯的顏色和香氣，猜猜是哪一個品種。'); await G.next('開始');
  const order = shuffle(VARIETIES);
  for (let i = 0; i < order.length; i++) {
    const v = order[i];
    await cardRound({ title: '日月潭紅茶四大品種', color: v.liquor_color, clue: v.clue + '這是哪一種？', options: shuffle(VARIETIES), answer: v.id, index: i, total: order.length,
      dex: dexHTML(v.name, v.liquor_color, [['茶湯', v.liquor], ['香氣', v.aroma], ['口感', v.taste], ['由來', v.origin], ['補充', v.note]]) });
    await G.say('答對了！這是{0}。', 'happy', v.name);
    await G.next(i < order.length - 1 ? '下一杯' : '完成這一關');
  }
}

/* ---------- 第 3 關：熱泡實作 ---------- */
const SCALE = `<svg viewBox="0 0 120 70"><g filter="url(#wob-s)" stroke="#45433f" stroke-width="4" stroke-linejoin="round"><path d="M8 40 h104 l-8 26 h-88Z" fill="#e7e1cf"/><rect x="26" y="46" width="44" height="14" rx="4" fill="#2f5a26"/><ellipse cx="60" cy="36" rx="46" ry="8" fill="#fbf7ea"/></g></svg>`;
const CAN = `<svg viewBox="0 0 80 100"><g filter="url(#wob-s)" stroke="#45433f" stroke-width="4" stroke-linejoin="round"><rect x="10" y="22" width="60" height="74" rx="8" fill="#b9482b"/><rect x="6" y="10" width="68" height="16" rx="5" fill="#8a2f18"/><circle cx="40" cy="58" r="17" fill="#f7f2e3"/></g><text x="40" y="64" text-anchor="middle" font-size="16" font-weight="700" fill="#b9482b">茶</text></svg>`;
const KETTLE = c => `<svg viewBox="0 0 70 56"><g filter="url(#wob-s)" stroke="#45433f" stroke-width="3.5" stroke-linejoin="round"><path d="M14 22 q21 -14 42 0 v24 q-21 8 -42 0Z" fill="${c}"/><path d="M14 28 q-12 -2 -10 -14" fill="none"/><path d="M56 28 q10 0 10 10" fill="none"/><path d="M26 14 h18" fill="none"/></g></svg>`;

async function weigh() {
  const target = BREW.hot.tea_g;
  await setScene(`<div class="b-bg"></div><div class="b-table"></div>${chip('熱泡・放茶葉')}
    <div class="b-scale">${SCALE}</div><div class="b-heap"></div><div class="b-read">0 g</div>
    <button class="b-can" aria-label="茶罐">${CAN}</button><button class="btn btn-primary b-ok" hidden>放好了</button>`);
  G.say('日月潭紅茶熱泡的比例是：茶葉 {0} 克配 {1} cc 的水。點茶罐，一次放 1 克，放到 {0} 克就按「放好了」。', 'idle', target, BREW.hot.water_ml);
  const read = $('.b-read', stage), heap = $('.b-heap', stage), ok = $('.b-ok', stage); let g = 0;
  const reset = () => { g = 0; read.textContent = '0 g'; heap.innerHTML = ''; ok.hidden = true; };
  await new Promise(res => {
    $('.b-can', stage).onclick = async () => {
      g++; read.textContent = g + ' g'; Sound.tick(); ok.hidden = false;
      heap.insertAdjacentHTML('beforeend', leafStrip(20 + Math.random() * 60, 30 + Math.random() * 40, Math.random() * 160));
      if (g > target + 1) { await miss('太多了，茶會苦苦的！倒掉重新來。'); reset(); }
    };
    ok.onclick = () => {
      if (g === target) { Sound.ok(); res(); return; }
      miss(g < target ? '還不夠喔，現在只有 {0} 克。' : '多放了，現在是 {0} 克。倒掉重新來。', g);
      if (g > target) reset();
    };
  });
}
async function pickTemp() {
  const target = BREW.hot.first.temp, opts = shuffle([target, 85, 100]);
  await setScene(`<div class="b-bg"></div><div class="b-table"></div>${chip('熱泡・選水溫')}
    <div class="b-cup" style="top:10%;--k:0">${CUP()}</div>
    <div class="k-row">${opts.map((c, i) => `<button class="kettle" data-c="${c}" style="animation-delay:${i * 70}ms">${KETTLE(c >= 95 ? '#e0702f' : '#f2a03a')}<b>${c}°C</b></button>`).join('')}</div>`);
  G.say('第一泡要用幾度的熱水？選一壺吧！');
  await new Promise(res => {
    stage.onclick = e => {
      const k = e.target.closest('.kettle'); if (!k) return;
      if (+k.dataset.c !== target) { nope(k); miss(+k.dataset.c > target ? '太燙了，香氣會被燙走。' : '這是回沖用的溫度喔，第一泡要再熱一點。'); return; }
      stage.onclick = null; k.classList.add('yes'); Sound.ok(); res();
    };
  });
}
async function pour() {
  const ml = BREW.hot.water_ml, MAX = 200, lo = ml - 10, hi = ml + 10;
  await setScene(`<div class="b-bg"></div><div class="b-table"></div>${chip('熱泡・注水')}
    <div class="b-ml">0 cc</div><div class="b-stream"></div>
    <div class="b-pot" style="--w:0"><i style="bottom:${ml / MAX * 100}%" data-l="${ml} cc"></i><b></b></div>
    <button class="btn btn-primary b-hold">按住倒水</button>`);
  G.say('按住按鈕倒水，倒到 {0} cc 的紅線就放開。', 'idle', ml);
  const pot = $('.b-pot', stage), lab = $('.b-ml', stage), btn = $('.b-hold', stage);
  let w = 0, hold = false, last = 0, done = false;
  const draw = () => { pot.style.setProperty('--w', w / MAX * 100); lab.textContent = Math.round(w) + ' cc'; };
  await new Promise(res => {
    const up = async () => {
      if (!hold) return; hold = false; btn.classList.remove('down'); stage.classList.remove('pouring');
      if (w < lo) { G.say('還不到 {0} cc，再倒一點。', 'idle', ml); return; }
      if (w > hi) { await miss('倒太多了，茶會變淡。倒掉重來！'); w = 0; draw(); return; }
      done = true; btn.disabled = true; Sound.ok(); res();
    };
    const loop = now => { if (done) return; const dt = Math.min(.3, (now - last) / 1000); last = now; if (hold) { w = Math.min(MAX, w + dt * 60); draw(); if (w >= MAX) up(); } requestAnimationFrame(loop); };
    btn.addEventListener('pointerdown', e => { e.preventDefault(); if (done) return; hold = true; btn.classList.add('down'); stage.classList.add('pouring'); try { btn.setPointerCapture(e.pointerId); } catch (err) {} });
    btn.addEventListener('pointerup', up); btn.addEventListener('pointercancel', up);
    last = performance.now(); requestAnimationFrame(loop);
  });
}
async function steep() {
  const sec = BREW.hot.first.sec, SPEED = 5, LIMIT = sec * 2, v = VARIETIES[Math.floor(Math.random() * VARIETIES.length)];
  await setScene(`<div class="b-bg"></div><div class="b-table"></div>${chip('熱泡・計時出湯')}
    <div class="b-clock" style="--p:0"><span>0<em>秒</em></span></div>
    <div class="b-cup" style="top:40%;--liq:${v.liquor_color};--k:.1">${CUP()}</div>
    <button class="btn btn-primary b-hold">出湯</button>`);
  G.say('第一泡要泡 {0} 秒，不需要洗茶。時間會快轉，到了就按「出湯」！', 'idle', sec);
  const clock = $('.b-clock', stage), num = $('span', clock), cup = $('.b-cup', stage), btn = $('.b-hold', stage);
  for (;;) {
    let s = 0, last = performance.now(), stopped = false;
    const r = await new Promise(res => {
      const tick = now => {
        if (stopped) return; s = Math.min(LIMIT, s + (now - last) / 1000 * SPEED); last = now;
        num.firstChild.textContent = Math.floor(s); clock.style.setProperty('--p', Math.min(1, s / LIMIT)); cup.style.setProperty('--k', clamp(.1 + s / sec * .9, .1, 1));
        if (s >= LIMIT) { stopped = true; res(s); return; } requestAnimationFrame(tick);
      };
      btn.onclick = () => { if (stopped) return; stopped = true; res(s); };
      requestAnimationFrame(tick);
    });
    if (Math.abs(r - sec) <= 5) { Sound.ok(); btn.disabled = true; return v; }
    await miss(r < sec ? '太早了，才 {0} 秒，茶味還很淡。再來一次！' : '泡太久了（{0} 秒），會變苦澀。再來一次！', Math.floor(r));
    clock.style.setProperty('--p', 0); num.firstChild.textContent = 0; cup.style.setProperty('--k', .1); await wait(500);
  }
}
async function level3() {
  await G.say('來親手泡一杯日月潭紅茶吧！秤茶、選水溫、注水、計時，一步一步來。'); await G.next('開始');
  await weigh(); await G.say('秤好了！', 'happy'); await wait(700);
  await pickTemp(); await G.say('對，第一泡用 {0}°C！', 'happy', BREW.hot.first.temp); await wait(700);
  await pour(); await G.say('水倒好了！', 'happy'); await wait(600);
  const v = await steep();
  await G.say('剛剛好！一杯{0}泡好了。', 'happy', v.name);
  await G.next('完成這一關');
}

async function level4() {
  await G.say('最後一關！同一份茶葉可以回沖好幾次，天熱時也能做冷泡茶。考考你！'); await G.next('開始');
  const h = BREW.hot.re;
  await quiz('回沖與冷泡', [
    { q: '第二泡（回沖）要用幾度的熱水？', right: h.temp + '°C', wrongs: ['95°C', '100°C'], why: '從第二泡開始，改用 85°C 的熱水，泡 40 秒。' },
    { q: '第三泡要泡多久？', right: h.secs[1] + ' 秒', wrongs: ['40 秒', '150 秒'], why: '第三泡用 85°C 熱水，泡 80 秒。' },
    { q: '第四泡要泡多久？', right: h.secs[2] + ' 秒', wrongs: ['60 秒', '80 秒'], why: '第四泡用 85°C 熱水，泡 120 秒；第五泡以後可以放涼當開水喝。' },
    { q: '冷泡的茶葉和水，比例是多少？', right: '1g：100cc', wrongs: ['4g：150cc', '1g：500cc'], why: '冷泡是茶葉 1 克配 100 cc 的水。' },
    { q: '冷泡要用什麼樣的水？', right: '常溫水（約 25–30°C）', wrongs: ['剛煮滾的熱水', '加了冰塊的冰水'], why: '把茶葉放進常溫水（約 25–30°C），先靜置 10–20 分鐘。' },
    { q: '靜置之後，要放進冰箱冷藏多久？', right: '4–6 小時', wrongs: ['10 分鐘', '3 天'], why: '放進冰箱冷藏 4–6 小時後就可以喝了。' },
  ]);
}

const LEVELS = [
  { name: '台灣名茶產地', desc: '包種、凍頂、東方美人…的家鄉', run: level1 },
  { name: '日月潭紅茶四大品種', desc: '阿薩姆、紅玉、紅韻、原生種山茶', run: level2 },
  { name: '熱泡實作', desc: '秤茶、選水溫、注水、計時出湯', run: level3 },
  { name: '回沖與冷泡', desc: '第二泡之後怎麼泡？冷泡怎麼做？', run: level4 },
];

/* ============================================================
   選單 / 證書 / 開場
   ============================================================ */
let busy = false;
async function showMenu(say = true) {
  G.hideBtn(); setStep(-1); G.run++;
  const all = Prog.all();
  await setScene(`<div class="b-bg"></div><div class="menu-lv">
    <p class="lv-head"><span>${ORG.school}　${ORG.team}</span><b>${ORG.name}</b><span>茶葉知識小遊戲</span></p>
    ${LEVELS.map((lv, i) => { const s = Prog.get(i); return `<button class="lv${s ? ' done' : ''}" data-i="${i}" style="animation-delay:${i * 50}ms"><i>${i + 1}</i><span><b>${lv.name}</b><small>${lv.desc}</small></span><em>${s ? '★'.repeat(s) + '☆'.repeat(3 - s) : ''}</em></button>`; }).join('')}
    ${all ? '<button class="btn btn-primary lv-cert" data-cert>領取找茶證書</button>' : ''}
    <button class="lv-about" data-about>關於與資料來源</button>
  </div>`);
  stage.onclick = e => {
    const b = e.target.closest('.lv'); if (b) { stage.onclick = null; play(+b.dataset.i); return; }
    if (e.target.closest('[data-cert]')) { stage.onclick = null; certificate(); return; }
    if (e.target.closest('[data-about]')) { stage.onclick = null; about(); }
  };
  if (say) G.say(all ? '四關都完成了！可以領證書，或回去挑戰更多星星。' : Prog.total() ? '選一關繼續吧！打勾的是已經完成的。' : '選一關開始吧！建議從第 1 關依序玩下去。');
}

async function play(i) {
  if (busy) return; busy = true;
  try {
    setStep(i); mistakes = 0;
    await LEVELS[i].run();
    const stars = mistakes <= 1 ? 3 : mistakes <= 3 ? 2 : 1;
    Prog.set(i, stars); setStep(i); Sound.badge();
    await setScene(`<div class="b-bg"></div><div class="lv-clear"><span class="kicker">第 ${i + 1} 關完成</span><h2>${LEVELS[i].name}</h2>
      <div class="stars">${[1, 2, 3].map(k => `<b class="${k <= stars ? 'on' : ''}">★</b>`).join('')}</div></div>`);
    await G.say(['過關了！多試幾次，星星會更多喔。', '做得好！只錯了一點點。', '太厲害了，幾乎沒有失誤！'][stars - 1], 'happy');
    const nextI = LEVELS.findIndex((_, k) => k > i && !Prog.get(k));
    if (nextI > -1) { await G.next('下一關：' + LEVELS[nextI].name); busy = false; return play(nextI); }
    await G.next(Prog.all() ? '去領證書' : '回到關卡選單');
  } finally { busy = false; }
  if (Prog.all()) certificate(); else showMenu();
}

async function certificate() {
  G.hideBtn(); setStep(-1);
  const total = Prog.total(), title = total >= 11 ? '找茶達人' : total >= 8 ? '找茶好手' : '找茶新手';
  const date = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' });
  await setScene(`<div class="cert">
    <span class="kicker">找茶證書</span>
    <img class="cert-sam" src="${A}chali_happy_correct.png?v=2" alt="">
    <h2>${title}</h2>
    <p class="cert-stars">★ ${total} / ${LEVELS.length * 3}</p>
    <p class="cert-txt">完成「大家來找茶」四關茶葉知識挑戰，認識了台灣名茶、日月潭紅茶與沖泡方法。</p>
    <p class="cert-org">${ORG.school}　${ORG.team}<br>${ORG.name}　${date}</p>
    <div class="final-btns"><button class="btn" data-menu>回到關卡</button><button class="btn btn-primary" data-share>分享給朋友</button></div>
  </div>`);
  stage.onclick = async e => {
    if (e.target.closest('[data-menu]')) { stage.onclick = null; showMenu(); return; }
    if (e.target.closest('[data-share]')) {
      const text = `我在「${ORG.name}」的茶葉知識小遊戲拿到「${title}」證書（★${total}）！一起來找茶：`, url = location.href.split('#')[0].split('?')[0];
      try { if (navigator.share) await navigator.share({ title: '大家來找茶', text, url }); else { await navigator.clipboard.writeText(text + url); toast('已複製分享文字'); } } catch (err) {}
    }
  };
  await G.say('恭喜！這是你的找茶證書，可以截圖分享給朋友。', 'happy');
}

async function about() {
  G.hideBtn(); setStep(-1);
  await setScene(`<div class="about-box"><h2>關於大家來找茶</h2>
    <p>這是${ORG.school} ${ORG.team}「${ORG.name}」製作的茶葉知識推廣小遊戲，非營利用途。導覽角色「茶理先生」是一片鹿谷茶園的茶葉，對話均為創作。</p>
    <h3>資料來源</h3><ul>${SOURCES.map(s => `<li>${s}</li>`).join('')}</ul>
    <button class="btn btn-primary" data-back>回到關卡</button></div>`);
  stage.onclick = e => { if (e.target.closest('[data-back]')) { stage.onclick = null; showMenu(); } };
  G.say('內容如果有需要更正的地方，歡迎告訴協會！');
}

function toast(s) { const el = $('#toast'); el.textContent = s; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 2400); }

async function main() {
  Prog.load(); Sound.init(); G.init();
  document.addEventListener('gesturestart', e => e.preventDefault());
  $('#steps').innerHTML = LEVELS.map((_, i) => `<li>${i + 1}</li>`).join('');
  $('#btnMenu').addEventListener('click', () => { if (busy) { if (!confirm('要離開這一關，回到關卡選單嗎？')) return; location.reload(); return; } showMenu(); });
  Sound.bgm('day');
  stage.innerHTML = `<div class="intro-art"><p class="intro-school">${ORG.school}<br>${ORG.team}</p><h1>${ORG.name}</h1><p>茶葉知識小遊戲・四個關卡</p>
    <div class="intro-row"><img src="${A}item_withered_leaf.png" alt=""><img src="${A}chali_idle_1.png?v=2" alt=""><div class="b-cup" style="position:relative;left:auto;translate:none;width:30%;--liq:#c4301c">${CUP()}</div></div></div>`;
  await G.say('嗨！我是茶理先生，鹿谷茶園裡的一片茶葉。歡迎來到大家來找茶！我們一起用四個關卡，認識茶的大小事。');
  await G.next(Prog.total() ? '繼續找茶' : '開始找茶');
  showMenu();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', main); else main();
