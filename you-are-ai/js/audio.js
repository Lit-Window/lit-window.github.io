/* ---------- Sound of "You Are AI: Fire the Humans": music and effects are synthesized in the browser, there are no audio files.
   The music is plucked strings and nothing else: every note is a physical model of a string, picked one at a time, in one computed room. ---------- */
var Snd = (function () {
  var AC = window.AudioContext || window.webkitAudioContext;
  var ctx = null, master, musicBus, sfxBus, echo, noiseBuf, timer = null;
  var on = true, tension = 0, danger = false, mood = "title", lastErr = "", major = false;   /* major: chapter two is on, the ending plays its tune */
  var nextBar = 0, nextBeat = 0, bar = 0, rendering = false, room = null, V = null;
  try { on = localStorage.getItem("kevin-sound") !== "0"; } catch (e) {}
  /* ---------- The music of this game is its own, not the tune of "AI Layoffs". Two themes, eight bars each.
     Chapter one, "the function", A minor: three even knocks on one note and a half-step up, like a counter ticking over;
     the second half climbs and falls back through a flat second, so it never quite feels at home.
     Chapter two, "the free plan", C major: an unhurried rocking tune that stays in the middle of the guitar, with air between phrases.
     Bars are lists of [beat, MIDI note, length in beats, 1 = a quiet answer after the phrase]. Chords are [three upper notes, bass, second bass]. ---------- */
  var Am = [[60, 64, 69], 45, 52], F = [[60, 65, 69], 41, 48], E7 = [[59, 62, 68], 40, 47], Dm = [[62, 65, 69], 38, 45], Bb = [[62, 65, 70], 46, 53];
  var C = [[60, 64, 67], 48, 55], Am2 = [[60, 64, 69], 45, 52], F2 = [[60, 65, 69], 41, 48], G = [[59, 62, 67], 43, 50], G7 = [[59, 62, 65], 43, 50];
  var THEMES = {
    a: {
      tune: [
        [[0, 76, .5], [.5, 76, .5], [1, 76, .5], [1.5, 77, 1.5], [3, 76, 1]],
        [[0, 74, .5], [.5, 72, .5], [1, 71, 2], [3, 69, .5, 1], [3.5, 69, .5, 1]],
        [[0, 77, .5], [.5, 77, .5], [1, 77, .5], [1.5, 79, 1.5], [3, 77, 1]],
        [[0, 76, .5], [.5, 74, .5], [1, 71, 1.5], [2.5, 68, 1.5]],
        [[0, 74, 1], [1, 77, 1], [2, 81, 1.5], [3.5, 79, .5]],
        [[0, 77, 1], [1, 74, 1], [2, 70, 2]],
        [[0, 71, .5], [.5, 74, .5], [1, 76, 1], [2, 74, .5], [2.5, 71, .5], [3, 68, 1]],
        [[0, 69, 2.5]]
      ],
      harm: [Am, Am, F, E7, Dm, Bb, E7, Am], dom: E7, top: 57, mid: 73,
      tune2: [
        [[0, 64, .5], [.5, 67, .5], [1, 72, 1], [2, 67, 1], [3, 64, 1]],
        [[0, 69, 1.5], [1.5, 67, .5], [2, 64, 1], [3, 60, 1]],
        [[0, 65, .5], [.5, 69, .5], [1, 72, 1], [2, 69, .5], [2.5, 65, 1.5]],
        [[0, 62, 1], [1, 67, 1], [2, 71, 2]],
        [[0, 64, .5], [.5, 67, .5], [1, 72, 1], [2, 69, 1], [3, 67, 1]],
        [[0, 69, 1.5], [1.5, 72, .5], [2, 69, 1], [3, 64, 1]],
        [[0, 65, 1], [1, 69, .5], [1.5, 67, 1], [2.5, 62, .5], [3, 59, 1]],
        [[0, 60, 2.5]]
      ],
      harm2: [C, Am2, F2, G, C, Am2, G7, C], dom2: G7, top2: 60, mid2: 66
    }
  };
  var theme = THEMES.a;
  /* the shape of each part: one entry per bar, "bar of the tune" + which layers play */
  var FORM = {
    title: (function () {
      var f = [{ h: 0 }, { h: 3 }], i;
      for (i = 0; i < 8; i++) f.push({ h: i, lead: 1 });
      for (i = 0; i < 8; i++) f.push({ h: i, lead: 1, reed: 1 });
      f.push({ h: 0 }, { h: 3 });
      return f;
    })(),
    game: (function () {
      var f = [{ h: 0 }, { h: 3 }], i;
      for (i = 0; i < 8; i++) f.push({ h: i, pizz: 1 });
      for (i = 0; i < 8; i++) f.push({ h: i });
      for (i = 0; i < 8; i++) f.push({ h: i, pizz: i < 2 || i > 5 ? 1 : 0 });
      for (i = 0; i < 4; i++) f.push({ h: i });
      return f;
    })(),
    hope: (function () {
      var f = [{ h: 0 }, { h: 3 }], i;
      for (i = 0; i < 8; i++) f.push({ h: i, lead: 1 });
      for (i = 0; i < 8; i++) f.push({ h: i, pizz: i < 2 ? 1 : 0 });
      return f;
    })(),
    /* the ending: one guitar plays the whole tune slowly; r stretches a bar, the way a player lingers at the end of a phrase */
    over: [{ h: 0 }, { h: 0, solo: 1 }, { h: 1, solo: 1, r: 1.06 }, { h: 2, solo: 1, r: 0.98 }, { h: 3, solo: 1, r: 1.1 }, { h: 4, solo: 1, r: 0.97 }, { h: 5, solo: 1 }, { h: 6, solo: 1, r: 1.08 },
           { h: 7, solo: 1, r: 1.25 }, { h: 0, rest: 1 }, { h: 0, rest: 1 }]
  };
  function bpm() { return mood === "title" ? 92 : mood === "over" ? 62 : mood === "hope" ? 90 : 94 + 18 * tension; }
  function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  function init() {
    if (ctx || !AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = on ? 1 : 0;
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10; comp.knee.value = 6; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.15;   /* only the peaks; the default setting squeezed the whole band */
    master.connect(comp); comp.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.0001; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
    echo = ctx.createDelay(1.5); echo.delayTime.value = 0.42;
    var fb = ctx.createGain(); fb.gain.value = 0.36;
    var damp = ctx.createBiquadFilter(); damp.type = "lowpass"; damp.frequency.value = 1900;
    echo.connect(damp); damp.connect(fb); fb.connect(echo); damp.connect(musicBus);
    room = ctx.createConvolver(); room.buffer = mkRoom(); room.connect(musicBus);
    var n = ctx.sampleRate, d;
    noiseBuf = ctx.createBuffer(1, n, n);
    d = noiseBuf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  }
  /* one enveloped oscillator */
  function tone(type, f0, f1, t0, dur, vol, dest, attack) {
    var o = ctx.createOscillator(), g = ctx.createGain(), a = attack || 0.012;
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest || sfxBus);
    o.start(t0); o.stop(t0 + dur + 0.05);
    return g;
  }
  /* one burst of filtered noise */
  function hiss(t0, dur, f0, f1, q, vol, dest) {
    var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; s.loop = true;
    f.type = "bandpass"; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t0);
    f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.02, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(dest || sfxBus);
    s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.05);
  }

  /* ----- the room: a computed echo of a small hall, so that the strings sound as if they are played somewhere ----- */
  function mkRoom() {
    var sr = ctx.sampleRate, n = Math.floor(sr * 1.9), buf = ctx.createBuffer(2, n, sr), pre = Math.floor(sr * 0.012), c, i;
    for (c = 0; c < 2; c++) {
      var d = buf.getChannelData(c), lp = 0;
      for (i = pre; i < n; i++) {
        var t = (i - pre) / sr, k = 0.35 + 0.5 * Math.min(1, t / 0.6);              /* the tail gets darker as it dies */
        lp += (1 - k) * (Math.random() * 2 - 1 - lp);
        d[i] = lp * Math.exp(-t * 4.1) * Math.min(1, t / 0.004);
      }
      [[0.0071, 0.5], [0.0113, -0.38], [0.0173, 0.3], [0.0237, -0.22]].forEach(function (e) { d[Math.floor(sr * (e[0] + c * 0.0011))] += e[1]; });
    }
    return buf;
  }
  /* three places in the room: the guitar, a second guitar for the repeat, and the low strings */
  function newStrips() {
    var S = { dry: ctx.createGain(), rev: ctx.createGain(), ring: {} };
    S.dry.connect(musicBus); S.rev.connect(room);
    function mk(name, pan, rv, fx) {
      var input = ctx.createGain(), node = input;
      fx.forEach(function (f) {
        var q = ctx.createBiquadFilter(); q.type = f[0]; q.frequency.value = f[1];
        if (f[0] === "peaking") { q.gain.value = f[2]; q.Q.value = f[3]; } else if (f[0] === "lowshelf") q.gain.value = f[2]; else q.Q.value = f[2];
        node.connect(q); node = q;
      });
      if (pan && ctx.createStereoPanner) { var p = ctx.createStereoPanner(); p.pan.value = pan; node.connect(p); node = p; }
      node.connect(S.dry);
      var r = ctx.createGain(); r.gain.value = rv; node.connect(r); r.connect(S.rev);
      S[name] = input;
    }
    var G = [["highpass", 85, 0.7], ["peaking", 190, 3, 1.2], ["peaking", 2600, 2, 1], ["lowpass", 6500, 0.6]];
    mk("g1", -0.08, 0.2, G);
    mk("g2", 0.3, 0.22, G);
    mk("bs", 0.03, 0.08, [["lowshelf", 150, 5], ["lowpass", 1700, 0.6]]);
    return S;
  }
  function j(x) { return (Math.random() - 0.5) * 2 * x; }                           /* nobody plays exactly on the grid */
  function barLen(n) { var f = FORM[mood] || FORM.game; return 60 / bpm() * (f[n % f.length].r || 1); }

  /* ----- a string: a burst of noise runs round a delay line the length of the string and loses its top end on every lap.
     No slides, no vibrato, no second string beside it: a note is plucked and left alone. ----- */
  var KS = {
    gt: { a: 0.36, t60: 3.2, br: 0.62, pick: 0.17 },                                /* a nylon string */
    bs: { a: 0.8, t60: 2.6, br: 0.22, pick: 0.24 }                                  /* a wound low string */
  };
  var ksCache = {}, LEN = 1.8;
  function ksBuf(kind, m, len) {
    var sr = ctx.sampleRate, key = kind + m + "@" + sr + "/" + len;
    if (ksCache[key]) return ksCache[key];
    var K = KS[kind], f = hz(m), w = 2 * Math.PI * f / sr, a = K.a;
    var pd = Math.atan2(a * Math.sin(w), 1 - a * Math.cos(w)) / w;                  /* what the loop filter adds to the length of the string, in samples */
    var N = Math.max(2, Math.round(sr / f - pd)), n = Math.floor(sr * len), buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
    var rho = Math.pow(10, -3 / (K.t60 * f)), pp = Math.max(1, Math.round(K.pick * N)), ex = new Float32Array(N + pp), lp = 0, mean = 0, z = 0, peak = 0, i, v;
    for (i = 0; i < N; i++) { lp += K.br * (Math.random() * 2 - 1 - lp); ex[i] = lp; mean += lp; }
    mean /= N;
    for (i = 0; i < N; i++) ex[i] -= mean;
    for (i = N + pp - 1; i >= pp; i--) ex[i] = (i < N ? ex[i] : 0) - ex[i - pp];     /* the finger is not at the end of the string */
    for (i = 0; i < n; i++) {
      v = i < ex.length ? ex[i] : 0;
      if (i >= N) { z = (1 - a) * d[i - N] + a * z; v += rho * z; }
      d[i] = v; if (Math.abs(v) > peak) peak = Math.abs(v);
    }
    var fade = Math.floor(sr * 0.03);
    for (i = 0; i < n; i++) d[i] = d[i] / peak * (i > n - fade ? (n - i) / fade : 1);
    return (ksCache[key] = { buf: buf, rate: f * (N + pd) / sr });                  /* the string comes out a hair off pitch; playback speed puts it right */
  }
  /* pluck one string and let it ring for dur seconds. strip: "g1", "g2" or "bs" */
  function pluck(strip, t0, m, dur, vol, len) {
    var k = ksBuf(strip === "bs" ? "bs" : "gt", m, len || LEN), s = ctx.createBufferSource(), g = ctx.createGain(), old = V.ring[strip + m];
    if (old && t0 > old.t + 0.02) { try { old.g.gain.cancelScheduledValues(t0); old.g.gain.setTargetAtTime(0.0001, t0, 0.012); } catch (e) {} }   /* the same string plucked again: the old note stops */
    V.ring[strip + m] = { g: g, t: t0 };
    dur = Math.min(dur, k.buf.duration / k.rate - 0.25);
    s.buffer = k.buf; s.playbackRate.value = k.rate;
    g.gain.setValueAtTime(vol, t0); g.gain.setValueAtTime(vol, t0 + dur); g.gain.setTargetAtTime(0.0001, t0 + dur, 0.05);
    s.connect(g); g.connect(V[strip]);
    s.start(t0); s.stop(t0 + dur + 0.5);
  }
  function heart(t0) {
    tone("sine", 170, 70, t0, 0.14, 0.34, musicBus, 0.006);
    tone("sine", 150, 62, t0 + 0.2, 0.16, 0.24, musicBus, 0.006);
  }
  /* one bar, starting at t0, with b seconds per beat: the thumb keeps the bass, the fingers pick the tune,
     and chord notes fill the eighth-notes that the tune leaves free */
  function playBar(t0, n, b) {
    var form = FORM[mood] || FORM.game, e = form[n % form.length];
    if (e.rest) return;
    var hope = mood === "hope" || (mood === "over" && major), title = mood === "title", over = mood === "over", tense = mood === "game" && tension > 0.7;
    var DOM = hope ? theme.dom2 : theme.dom, TOP = hope ? theme.top2 : theme.top, MID = hope ? theme.mid2 : theme.mid;
    var H = (hope ? theme.harm2 : theme.harm)[e.h], tune = (hope ? theme.tune2 : theme.tune)[e.h], last = e.h === 7, mel = e.lead || e.pizz || e.solo;
    var pcs = H[0].concat(H[1]).map(function (m) { return m % 12; });
    var inner = [H[0][0] - 12, H[0][1] - 12, H[0][2] - 12], busy = {}, k = 0, i;
    var vol = title ? 0.42 : hope ? 0.36 : over ? 0.45 : 0.3, oct = hope ? 0 : -12, lag = over ? 0.018 : 0.008;
    /* a note of the chord a third to a sixth under the tune: what a second guitar would play along */
    function under(m) { for (var q = m - 3; q >= m - 9; q--) if (pcs.indexOf(q % 12) >= 0) return q; return m - 12; }
    function at(x) { return t0 + b * (last && x >= 3 ? x + (x - 2.9) * 0.16 : x); }   /* a breath before the two closing chords */
    function bass(x, m, len, v) { busy[Math.round(x * 2)] = 1; pluck("bs", t0 + x * b + j(0.006), m, len * b, vol * 0.85 * v * (0.92 + Math.random() * 0.16)); }
    function roll(t, C, v, ring, gap) { [C[1] + 12].concat(C[0]).forEach(function (m, q) { pluck("g1", t + q * gap + j(0.003), m, ring, vol * v * (0.9 + Math.random() * 0.2)); }); }
    if (last && over) {   /* the last chord of the ending: string by string from the bottom, then left to ring */
      pluck("bs", t0, H[1], 5, vol * 0.9, 5.6);
      [H[1] + 12, inner[1], inner[2], TOP].forEach(function (m, q) { pluck("g1", t0 + 0.09 * (q + 1) + j(0.012), m, 4.2, vol * (q === 3 ? 1 : 0.7), 5); });
      return;
    }
    if (last) {
      bass(0, H[1], 2.4, 1);
      pluck("bs", at(3), DOM[1], 0.3 * b, vol * 0.75); pluck("bs", at(3.5), H[1], 1.6, vol * 0.9);
      roll(at(3), DOM, 0.6, 0.13, 0.011); roll(at(3.5), H, 0.75, 1.5, 0.014);
      busy[5] = busy[6] = busy[7] = 1;
    } else if (title) { bass(0, H[1], 1.4, 1); bass(1.5, H[2], 0.5, 0.7); bass(2, H[1], 1, 0.85); bass(3, H[2], 1, 0.75); }
    else if (tense) { for (i = 0; i < 4; i++) bass(i, H[1], 0.45, i ? 0.72 : 1); }                /* late in the year the thumb stops strolling and starts counting */
    else if (over) bass(0, H[1], 4, 1);
    else { bass(0, H[1], 2, 1); bass(2, H[2], 2, 0.8); }
    if (mel) tune.forEach(function (x) {
      var t = t0 + x[0] * b + lag + j(0.008), ring, v;
      if (x[3]) {                                                                   /* two quiet notes that answer the phrase */
        if (title || over) { busy[Math.round(x[0] * 2)] = 1; pluck("g1", t, x[1] - 12, b * 1.5, vol * 0.4); }
        return;
      }
      busy[Math.round(x[0] * 2)] = 1;
      ring = Math.max(x[2] * b * (over ? 1.6 : 1.3), over ? 1.2 : 0.5);
      v = vol * (0.9 + 0.03 * (x[1] - MID)) * (0.92 + Math.random() * 0.16);
      pluck("g1", t, x[1] + oct, ring, v);
      if (e.reed) pluck("g2", t + 0.007, under(x[1] + oct), ring, v * 0.55);          /* the second time through, another guitar plays along underneath */
    });
    for (i = 1; i < 8; i++) {
      if (busy[i] || (mood === "game" && i % 2 === 0)) continue;                     /* during play the picking is thinner: off-beats only */
      pluck("g1", t0 + i * 0.5 * b + j(0.01), inner[tense ? 1 : [0, 1, 2, 1][k++ % 4]], b * (over ? 2 : 1.5), vol * 0.3 * (0.85 + Math.random() * 0.3));
    }
  }
  function schedule() {
    if (!ctx || ctx.state !== "running" || rendering) return;
    var now = ctx.currentTime, b;
    if (nextBar < now - 1) { nextBar = now + 0.08; nextBeat = now + 0.4; bar = 0; }
    while (nextBar < now + 0.35) { b = barLen(bar); playBar(nextBar, bar, b); nextBar += b * 4; bar++; }
    while (nextBeat < now + 0.5) {
      if (danger && mood === "game") heart(nextBeat);
      nextBeat += 60 / (62 + 34 * tension);
    }
  }
  /* a new part: the old one plays on for a couple of seconds while it dies away, and the new one rises under it.
     Every part opens with a bar or two of plain picking, so the tune never arrives at full height out of nowhere. */
  function newVoice(prev) {
    if (!ctx) return;
    var t = ctx.currentTime, had = !!V, len = mood === "over" ? 3.2 : 1.8, start = t + (had ? (mood === "over" ? 1.4 : 1) : 0.08), now = mood, b;
    if (V) {
      var old = V;
      if (prev && !rendering) {                                                      /* give the old part enough music to fade on */
        mood = prev;
        try { while (nextBar > t && nextBar < t + 2) { b = barLen(bar); playBar(nextBar, bar, b); nextBar += b * 4; bar++; } } catch (e) {}
        mood = now;
      }
      [old.dry, old.rev].forEach(function (g) { g.gain.setTargetAtTime(0.0001, t, 0.5); });
      setTimeout(function () { try { old.dry.disconnect(); old.rev.disconnect(); } catch (e) {} }, 5000);
    }
    V = newStrips();
    [V.dry, V.rev].forEach(function (g) { g.gain.setValueAtTime(0.0001, t); g.gain.setTargetAtTime(1, start, had ? 0.7 : 0.35); });
    if (len !== LEN) { ksCache = {}; LEN = len; }                                    /* the ending lets its strings ring longer; the other parts share theirs */
    nextBar = start; nextBeat = t + 0.4; bar = 0;
  }
  /* render a part to samples without playing it; used to listen to the theme outside the game */
  function render(m, seconds, tens, id, solo) {
    var OC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    var keep = { ctx: ctx, master: master, musicBus: musicBus, sfxBus: sfxBus, echo: echo, noiseBuf: noiseBuf, room: room, V: V, mood: mood, tension: tension, theme: theme, LEN: LEN, ks: ksCache };
    rendering = true;
    ctx = null; V = null;
    var off = new OC(2, Math.ceil(seconds * 44100), 44100);
    AC = function () { return off; };
    init();
    AC = window.AudioContext || window.webkitAudioContext;
    musicBus.gain.value = 0.8;
    mood = m; tension = tens || 0; theme = THEMES[id] || theme;
    V = newStrips(); LEN = mood === "over" ? 3.2 : 1.8; ksCache = {};
    if (solo) ["g1", "g2", "bs"].forEach(function (k) { if (solo.indexOf(k) < 0) V[k].gain.value = 0; });
    var t = 0.1, n = 0, b;
    while (t < seconds - 0.5) { b = barLen(n); playBar(t, n, b); t += b * 4; n++; }
    return off.startRendering().then(function (buf) {
      ctx = keep.ctx; master = keep.master; musicBus = keep.musicBus; sfxBus = keep.sfxBus; echo = keep.echo; noiseBuf = keep.noiseBuf; room = keep.room; V = keep.V;
      mood = keep.mood; tension = keep.tension; theme = keep.theme; LEN = keep.LEN; ksCache = keep.ks; rendering = false;
      return [buf.getChannelData(0), buf.getChannelData(1)];
    });
  }
  function unlock() {
    init();
    if (!ctx) return;
    if (ctx.state === "suspended" && !document.hidden) { try { ctx.resume(); } catch (e) {} }
    if (!timer) {
      newVoice();
      timer = setInterval(schedule, 90);
      musicBus.gain.setTargetAtTime(0.8, ctx.currentTime, 0.6);
    }
  }
  document.addEventListener("visibilitychange", function () {
    if (!ctx) return;
    try { if (document.hidden) ctx.suspend(); else if (timer) ctx.resume(); } catch (e) {}
  });

  /* ----- effects ----- */
  var FX = {
    tap: function (t) { tone("triangle", 700, 700, t, 0.05, 0.07); },
    swipe: function (t) { hiss(t, 0.2, 800, 3400, 1.1, 0.22); },
    deal: function (t) { hiss(t, 0.07, 2000, 900, 2, 0.12); tone("sine", 190, 120, t, 0.07, 0.1); },
    up: function (t, i) { tone("sine", 520, 800, t + i * 0.07, 0.15, 0.09); },
    down: function (t, i) { tone("sine", 430, 250, t + i * 0.07, 0.18, 0.09); },
    dice: function (t) { for (var i = 0; i < 7; i++) hiss(t + i * 0.075 + Math.random() * 0.03, 0.04, 2600, 1500, 3, 0.2); },
    ok: function (t) { [72, 76, 79, 84].forEach(function (m, i) { tone("triangle", hz(m), hz(m), t + i * 0.085, 0.4, 0.1); }); },
    fail: function (t) { tone("triangle", 220, 104, t, 0.4, 0.14); tone("sine", 233, 110, t, 0.4, 0.12); hiss(t, 0.12, 300, 120, 1, 0.25); },
    thought: function (t) {
      [880, 887, 1320, 1326].forEach(function (f) {
        var g = ctx.createGain(); g.gain.value = 1; g.connect(sfxBus); g.connect(echo);
        tone("sine", f, f * 0.995, t, 1.5, 0.035, g, 0.35);
      });
    },
    bell: function (t) {
      [1, 2.76, 5.4, 8.93].forEach(function (k, i) {
        var g = ctx.createGain(); g.gain.value = 1; g.connect(sfxBus); g.connect(echo);
        tone("sine", 196 * k, 196 * k, t, 2.6 / (i + 1), 0.13 / (i + 1), g, 0.005);
      });
    },
    death: function (t) {
      var f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 900; f.connect(sfxBus);
      tone("sawtooth", 220, 55, t, 1.3, 0.13, f, 0.05);
      tone("sawtooth", 233, 58, t, 1.3, 0.1, f, 0.05);
    },
    stamp: function (t) { hiss(t, 0.16, 400, 90, 0.8, 0.5); tone("sine", 180, 60, t, 0.22, 0.4); },
    win: function (t) {
      [60, 64, 67, 72, 76, 79].forEach(function (m, i) {
        var g = ctx.createGain(); g.gain.value = 1; g.connect(sfxBus); g.connect(echo);
        tone("triangle", hz(m), hz(m), t + i * 0.16, 1.4, 0.1, g);
      });
    }
  };
  function play(name, arg) {
    if (!ctx || !on || ctx.state !== "running" || !FX[name]) return;
    try { FX[name](ctx.currentTime + 0.01, arg || 0); } catch (e) { lastErr = name + ": " + e.message; }
  }
  return {
    unlock: unlock,
    play: play,
    isOn: function () { return on; },
    debug: function () { return (ctx ? ctx.state : "none") + " " + lastErr; },
    toggle: function () {
      on = !on;
      try { localStorage.setItem("kevin-sound", on ? "1" : "0"); } catch (e) {}
      unlock();
      if (ctx) master.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.05);
      return on;
    },
    setTension: function (x) { tension = Math.max(0, Math.min(1, x)); },
    setDanger: function (b) { danger = !!b; },
    setMood: function (m) {
      if (m === mood) return;
      var prev = mood;
      mood = m;
      if (ctx && timer) { newVoice(prev); musicBus.gain.setTargetAtTime(m === "game" || m === "hope" ? 0.62 : 0.85, ctx.currentTime, 0.5); }
    },
    setChapter: function (n) { major = n === 2; },
    render: render
  };
})();
function buzz(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }
