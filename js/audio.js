'use strict';
/* ============================================================
   聲音：全部用 Web Audio 即時合成（不需要任何音檔）
   - 點擊 / 提示音效
   - 角色說話的「嘟嘟聲」（每個字一個音，像動物森友會那樣）
   - 背景音樂：內建五聲音階音樂盒；CONFIG.AUDIO.bgm 有填音檔就改播音檔
   ============================================================ */
const Sound = {
  ctx: null, master: null, sfx: null, music: null, echo: null,
  muted: false, mood: null, timer: null, step: 0, nextT: 0, mel: 4, file: null,

  init() {
    try { this.muted = localStorage.getItem('zhaocha.muted') === '1'; } catch (e) {}
    document.body.classList.toggle('muted', this.muted);
    const unlock = () => this.unlock();
    addEventListener('pointerdown', unlock, { capture: true }); addEventListener('keydown', unlock, { capture: true });
    // 所有按鈕共用的點擊音
    document.addEventListener('pointerdown', e => {
      const el = e.target.closest && e.target.closest('button, a, .sort-item');
      if (!el || el.disabled) return;
      el.classList.contains('sort-item') ? this.tick() : this.click();
    });
    document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-sound]')) this.toggle(); });
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) { this.ctx.suspend(); this.file && this.file.pause(); }
      else { this.ctx.resume(); if (this.file && !this.muted) this.file.play().catch(() => {}); }
    });
  },

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : 1; this.master.connect(c.destination);
    this.sfx = c.createGain(); this.sfx.gain.value = .9; this.sfx.connect(this.master);
    this.music = c.createGain(); this.music.gain.value = .55; this.music.connect(this.master);
    // 簡單的回聲，讓音樂盒有空間感
    const d = c.createDelay(1); d.delayTime.value = .36; const fb = c.createGain(); fb.gain.value = .32;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
    d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(this.music); this.echo = d;
    if (this.mood) { const m = this.mood; this.mood = null; this.bgm(m); }
    this.loadSamples();
    if (this._rainWanted) { const l = this._rainWanted; this._rainWanted = 0; this.rain(true, l); }
  },

  /* ---------- 音效檔（載不到就用合成音） ---------- */
  buf: {},
  loadSamples() {
    const list = (CONFIG.AUDIO && CONFIG.AUDIO.sfx) || {};
    Object.entries(list).forEach(([name, src]) => {
      if (!src) return;
      const a = new Audio(); a.preload = 'auto'; a.src = src; // 用 <audio> 當來源，直接開啟檔案（file://）時也能播
      a.addEventListener('canplaythrough', () => { this.buf[name] = a; }, { once: true });
      a.addEventListener('error', () => { delete this.buf[name]; }, { once: true });
      a.load();
    });
  },
  sample(name, vol = 1) {
    const a = this.buf[name]; if (!a || !this.ctx) return false;
    if (this.muted) return true;
    const n = a.cloneNode(); n.volume = clamp01((CONFIG.AUDIO.sfxVolume ?? .6) * vol); n.play().catch(() => {});
    return true;
  },

  toggle() {
    this.muted = !this.muted; try { localStorage.setItem('zhaocha.muted', this.muted ? '1' : '0'); } catch (e) {}
    document.body.classList.toggle('muted', this.muted);
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 1, this.ctx.currentTime, .05);
    if (this.file) { this.file.muted = this.muted; if (!this.muted) this.file.play().catch(() => {}); }
    if (!this.muted) this.click();
  },

  /** 一個帶包絡的音：f 起始頻率、f2 結束頻率 */
  tone({ f, f2, type = 'sine', at = 0, dur = .12, vol = .2, attack = .005, out }) {
    const c = this.ctx; if (!c || this.muted) return;
    const t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(.0008, t + dur);
    o.connect(g); g.connect(out || this.sfx); o.start(t); o.stop(t + dur + .03);
  },

  /* ---------- 音效 ---------- */
  click() { if (this.sample('click')) return; this.tone({ f: 880, f2: 520, type: 'triangle', dur: .07, vol: .22 }); this.tone({ f: 1760, dur: .03, vol: .06 }); },
  tick() { if (this.sample('tick', .8)) return; this.tone({ f: 620, f2: 480, type: 'triangle', dur: .05, vol: .12 }); },
  pop() { if (this.sample('pop')) return; this.tone({ f: 420, f2: 940, type: 'sine', dur: .11, vol: .22 }); },
  page() { this.tone({ f: 520, f2: 780, type: 'triangle', dur: .1, vol: .14 }); this.tone({ f: 1040, at: .08, dur: .16, vol: .1 }); },
  ok() { if (this.sample('ok')) return; [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone({ f, type: 'triangle', at: i * .085, dur: .32, vol: .2 })); },
  bad() { if (this.sample('bad')) return; this.tone({ f: 330, f2: 262, type: 'triangle', dur: .16, vol: .18 }); this.tone({ f: 262, f2: 196, type: 'triangle', at: .15, dur: .24, vol: .18 }); },
  chime() { [783.99, 1174.66, 1567.98].forEach((f, i) => this.tone({ f, at: i * .16, dur: 1.1, vol: .12 })); },
  whoosh() { this.tone({ f: 180, f2: 1400, type: 'sawtooth', dur: 2.4, vol: .05, attack: .9 }); this.tone({ f: 1400, f2: 2800, at: 2.5, dur: .7, vol: .1 }); },
  badge() { [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98].forEach((f, i) => this.tone({ f, type: 'triangle', at: .3 + i * .1, dur: .6, vol: .18 })); },

  /* ---------- 雨聲 / 雷聲（白噪音濾波） ---------- */
  noiseBuf(sec) {
    const c = this.ctx, b = c.createBuffer(1, Math.floor(c.sampleRate * sec), c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  },
  rain(on, level = 1) {
    const c = this.ctx; if (!c) { this._rainWanted = on ? level : 0; return; }
    if (on && !this._rain) {
      const src = c.createBufferSource(); src.buffer = this.noiseBuf(2); src.loop = true;
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200;
      const g = c.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(.09 * level, c.currentTime, .8);
      src.connect(hp); hp.connect(lp); lp.connect(g); g.connect(this.sfx); src.start();
      this._rain = { src, g };
    } else if (!on && this._rain) {
      const { src, g } = this._rain; this._rain = null;
      g.gain.setTargetAtTime(0, c.currentTime, .9); setTimeout(() => { try { src.stop(); } catch (e) {} }, 4000);
    }
  },
  thunder() {
    const c = this.ctx; if (!c || this.muted) return;
    const t = c.currentTime, src = c.createBufferSource(); src.buffer = this.noiseBuf(3.2);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(420, t); lp.frequency.exponentialRampToValueAtTime(90, t + 2.6);
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.55, t + .06); g.gain.setValueAtTime(.4, t + .35); g.gain.exponentialRampToValueAtTime(.001, t + 3);
    src.connect(lp); lp.connect(g); g.connect(this.sfx); src.start(t); src.stop(t + 3.2);
  },

  /* ---------- 說話的嘟嘟聲 ---------- */
  VOICE: {
    sam: { base: 500, type: 'sawtooth', fm: 1.35, vol: .5, dur: .075 },     // 小小的、高高的
    uncle: { base: 165, type: 'sawtooth', fm: .95, vol: .55, dur: .1 },     // 低低的、慢慢的
    narr: null,
  },
  VOWELS: [[800, 1250], [330, 2200], [350, 800], [520, 1850], [470, 900]], // a i u e o 的共振峰
  blip(who, ch) {
    const c = this.ctx; if (!c || this.muted) return;
    if (!ch || /[\s，。！？…、；：「」『』（）()《》,.!?・—\-～〜]/.test(ch)) return;
    const v = this.VOICE[who];
    if (!v) { this.tone({ f: 1500, dur: .018, vol: .025 }); return; } // 旁白：很輕的打字聲
    const code = ch.codePointAt(0), semi = [0, 2, 4, 5, 7, 9, 12][code % 7];
    const f = v.base * Math.pow(2, semi / 12) * (1 + (Math.random() - .5) * .05);
    const [f1, f2] = this.VOWELS[(code >> 3) % 5], t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.type = v.type; o.frequency.setValueAtTime(f * 1.04, t); o.frequency.exponentialRampToValueAtTime(f * .96, t + v.dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v.vol, t + .008); g.gain.setValueAtTime(v.vol, t + v.dur * .55); g.gain.exponentialRampToValueAtTime(.001, t + v.dur);
    [f1, f2].forEach((ff, i) => {
      const b = c.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = ff * v.fm; b.Q.value = 5;
      const bg = c.createGain(); bg.gain.value = i ? .5 : 1; o.connect(b); b.connect(bg); bg.connect(g);
    });
    g.connect(this.sfx); o.start(t); o.stop(t + v.dur + .02);
  },

  /* ---------- 背景音樂 ---------- */
  MOODS: {
    title: { bpm: 76, dens: .5, min: false, vol: .55 },
    day: { bpm: 84, dens: .62, min: false, vol: .55 },
    dusk: { bpm: 70, dens: .42, min: false, vol: .5 },
    grey: { bpm: 60, dens: .34, min: true, vol: .45 },
    dawn: { bpm: 54, dens: .22, min: true, vol: .4 },
    night: { bpm: 62, dens: .4, min: false, vol: .5 },
  },
  SCALE: { maj: [60, 62, 64, 67, 69, 72, 74, 76, 79], min: [57, 60, 62, 64, 67, 69, 72, 74, 76] },
  CHORDS: { maj: [[48, 55, 64], [45, 52, 60], [41, 48, 57], [43, 50, 59]], min: [[45, 52, 60], [41, 48, 57], [38, 50, 57], [40, 52, 59]] },
  hz: m => 440 * Math.pow(2, (m - 69) / 12),

  bgm(mood) {
    if (mood === this.mood) return; this.mood = mood;
    const M = this.MOODS[mood]; if (!this.ctx) return; // 還沒解鎖：等第一次點擊
    if (CONFIG.AUDIO.bgm && this.file !== false) { // 有音檔：播音檔
      if (!this.file) {
        const a = this.file = new Audio(CONFIG.AUDIO.bgm); a.loop = true; a.muted = this.muted;
        a.addEventListener('error', () => { this.file = false; const m = this.mood; this.mood = null; this.bgm(m); }, { once: true });
        a.play().catch(() => {});
      }
      if (this.file) { this.file.volume = M ? clamp01(CONFIG.AUDIO.bgmVolume * (M.vol / .55)) : 0; return; }
    }
    clearInterval(this.timer); this.timer = null;
    if (!M) return;
    this.music.gain.setTargetAtTime(M.vol, this.ctx.currentTime, .8);
    this.nextT = Math.max(this.nextT, this.ctx.currentTime + .15);
    this.timer = setInterval(() => this.schedule(), 110);
  },

  pluck(midi, t, vol, dur = 1.4) {
    const c = this.ctx, f = this.hz(midi), g = c.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .012); g.gain.exponentialRampToValueAtTime(.0006, t + dur);
    [['triangle', 1, 1], ['sine', 2, .35], ['sine', 3, .1]].forEach(([type, mul, v]) => {
      const o = c.createOscillator(), og = c.createGain(); o.type = type; o.frequency.value = f * mul; og.gain.value = v;
      o.connect(og); og.connect(g); o.start(t); o.stop(t + dur + .05);
    });
    g.connect(this.music); const send = c.createGain(); send.gain.value = .35; g.connect(send); send.connect(this.echo);
  },
  pad(notes, t, dur, vol) {
    const c = this.ctx;
    notes.forEach((m, i) => {
      const o = c.createOscillator(), g = c.createGain(); o.type = i ? 'sine' : 'triangle'; o.frequency.value = this.hz(m) * (1 + (i - 1) * .002);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + dur * .3); g.gain.linearRampToValueAtTime(0, t + dur);
      o.connect(g); g.connect(this.music); o.start(t); o.stop(t + dur + .05);
    });
  },
  schedule() {
    const c = this.ctx, M = this.MOODS[this.mood]; if (!M || this.muted || c.state !== 'running') { if (c) this.nextT = c.currentTime + .15; return; }
    const key = M.min ? 'min' : 'maj', sc = this.SCALE[key], six = 60 / M.bpm / 2; // 八分音符
    while (this.nextT < c.currentTime + .35) {
      const s = this.step++, t = this.nextT, bar = Math.floor(s / 8), chord = this.CHORDS[key][Math.floor(bar / 2) % 4], pos = s % 8;
      if (s % 16 === 0) this.pad(chord, t, six * 16, .05);
      if (pos === 0) this.pluck(chord[0], t, .16, 2.2);
      else if (pos === 4 && Math.random() < .6) this.pluck(chord[1], t, .1, 1.6);
      const p = M.dens * (pos % 4 === 0 ? 1.25 : pos % 2 === 0 ? .9 : .45);
      if (Math.random() < p) {
        let n = this.mel + [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)];
        if (n < 1) n = 2; if (n > sc.length - 1) n = sc.length - 3;
        // 重拍盡量落在和弦音上
        if (pos % 4 === 0) { const tones = chord.map(x => x % 12); if (!tones.includes(sc[n] % 12)) n = Math.min(sc.length - 1, n + 1); }
        this.mel = n; this.pluck(sc[n] + 12, t, .13, 1.5);
      }
      this.nextT += six * (pos % 2 ? .94 : 1.06); // 一點點搖擺
    }
  },
};
const clamp01 = v => Math.max(0, Math.min(1, v));
