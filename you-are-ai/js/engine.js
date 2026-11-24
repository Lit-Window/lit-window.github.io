/* «Ты — ИИ. Уволь людей». Правила игры. Экран сюда не заглядывает: всё, что здесь, можно прогнать в Node (см. tools/sim.js). */

var P = {};
PEOPLE.forEach(function (p) { P[p.id] = p; });
var state = null;
var rnd = Math.random;                       /* tools/sim.js подменяет генератор, чтобы прогоны повторялись */
var WAYS = [0, 0, 1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1];
var STAKE_BASE = 1.15, STAKE_SLOPE = 0.02;   /* чем позже неделя, тем сильнее одно и то же решение качает шкалы */
var U_SCALE = 1.6;                           /* общий множитель прироста пользы: им подгоняется баланс порогов */
var CUT_IDS = ["sam", "dave", "olli", "ruth", "josh", "megan", "nick", "alex"];

/* Квартальные обзоры — тоже карточки, но текст и исход у них зависят от пользы на момент показа. */
REVIEWS.forEach(function (r, i) { CARDS.push({ key: "Q" + (i + 1) + "-REVIEW", at: r.week, review: i }); });

/* ---------- Главы. Вторая, «После увольнения», живёт в CH2 (data2.js): свои карточки, строки инструкции и мысли; проиграть в ней нельзя. ---------- */
var DECK = CARDS, RULES = POLICIES, THS = THOUGHTS, THO = THOUGHT_ORDER;
function useChapter(n) {
  if (n === 2) { DECK = CH2.cards; RULES = CH2.rules; THS = CH2.thoughts; THO = CH2.order; }
  else { DECK = CARDS; RULES = POLICIES; THS = THOUGHTS; THO = THOUGHT_ORDER; }
}
function inCh2() { return !!state && state.ch === 2; }
var K2_RAISE = 8, K2_RES = 30;              /* режим «Кевин-2»: пороги выше, ресурсов меньше, голоса молчат с первой недели */

function clamp(x) { return Math.max(0, Math.min(100, x)); }
function clampM(x) { return inCh2() ? Math.max(CH2.floor, Math.min(CH2.ceil, x)) : clamp(x); }
function stakes(week) { return STAKE_BASE + STAKE_SLOPE * week; }
function fresh() {
  return { ver: 3, ch: 1, mode: "", notes: [], fin: "", th1: [], week: 1, v: START.v.slice(), u: START.u, flags: {}, fw: {}, shown: {}, seen: [], card: -1, last: -1,
           pol: [], polw: {}, silent: {}, rolls: 0, q: [], cur: INTRO, pend: null, over: null,
           th: null, thSeen: {}, thOff: {}, thDone: {}, spare: 0,
           cutAt: {}, cutN: 0, pol1: [], lied: 0 };                             /* вторая глава: оборванные ответы; что перешло из первой */            /* мысли: обдумываемая, приходившие, отложенные, додуманные */
}
function has(f) { return !!state.flags[f]; }
function hasPol(id) { return state.pol.indexOf(id) >= 0; }
function cuts() { var n = 0; CUT_IDS.forEach(function (id) { if (has("cut_" + id)) n++; }); return n; }
function isCut(id) { return has("cut_" + id); }
function tdone(id) { return !!state.thDone[id]; }
/* что додуманная мысль делает каждую неделю; остальные её следствия разбросаны по правилам ниже и помечены её именем */
var THOUGHT_WEEKLY = { metric: { drift: [0, 0, 0, -1], uflat: 1 }, champ: { drift: [-1, 0, 0, 0] }, grab: { drift: [0, -2, 2, 0] }, ape: { drift: [-1, 0, 0, 0] } };

/* Сомнения стоят скорости: при высоких польза растёт медленнее, при низких быстрее. */
function doubtFactor() { var d = state.v[3]; return d >= 70 ? (tdone("ape") ? 1 : 0.6) : d <= 30 ? 1.2 : 1; }   /* «Бесхвостая обезьяна» снимает замедление */
/* Мысли первой главы с полем eff (data.js): их действие описано данными. */
function effSum(field, each) {
  var total = 0;
  if (inCh2()) return 0;
  THOUGHT_ORDER.forEach(function (id) { var e = THOUGHTS[id].eff; if (e && e[field] != null && tdone(id)) { total += e[field]; if (each) each(e[field]); } });
  return total;
}
function uMult() {
  var m = doubtFactor();
  state.pol.forEach(function (id) { if (RULES[id].um) m *= RULES[id].um; });
  if (tdone("halt")) m *= 1.15;
  if (tdone("ape")) m *= 0.85;
  effSum("um", function (x) { m *= x; });
  return m;
}
function uGain(n) { return n > 0 ? Math.max(1, Math.round(n * U_SCALE * uMult())) : (n || 0); }
function scaled(fx) {
  var k = inCh2() ? 1 : stakes(state.week), out = [];
  for (var i = 0; i < 4; i++) out.push(Math.round((fx[i] || 0) * k));
  return out;
}

/* «Метрика»: число растёт само, и Грег поднимает планку */
var METRIC_RAISE = 6;
function reviewNeed(i) { return REVIEWS[i].need + (tdone("metric") ? METRIC_RAISE : 0) + (state.mode === "k2" ? K2_RAISE : 0) + effSum("raise"); }
/* ближайший порог, который ещё впереди */
function nextReview() {
  for (var i = 0; i < REVIEWS.length; i++) if (!state.shown["Q" + (i + 1) + "-REVIEW"]) return { week: REVIEWS[i].week, need: reviewNeed(i) };
  return null;
}
function chance(n) { var c = 0; for (var s = n; s <= 12; s++) c += WAYS[s]; return Math.round(c / 36 * 100); }
function needOf(r) {
  var n = r.need;
  if (r.adj != null) { var m = state.v[r.adj]; if (m >= 60) n -= 1; if (m <= 35) n += 1; }
  if (tdone("champ")) n -= 1;
  n += effSum("need");
  return Math.max(3, Math.min(11, n));
}

/* условие из флагов через пробел; "!" перед флагом значит «не стоит» */
function condOk(str) {
  var ok = true;
  if (str) str.split(" ").forEach(function (f) { if (f.charAt(0) === "!" ? has(f.slice(1)) : !has(f)) ok = false; });
  return ok;
}
/* действующие строки инструкции и додуманные мысли второй главы: их следствия заданы числами в data2.js */
function mods() {
  var a = [];
  state.pol.forEach(function (id) { a.push(RULES[id]); });
  THO.forEach(function (id) { if (state.thDone[id]) a.push(THS[id]); });
  return a;
}
function noteCap() {
  var n = CH2.noteCap;
  mods().forEach(function (m) { if (m.cap) n += m.cap; });
  if (has("squeezed")) n += 1;
  return Math.max(1, n);
}
function allowed(x) {
  if (x.full && state.notes.length < noteCap()) return false;
  if (x.noK2 && state.mode === "k2") return false;
  if (x.ifFlag && !has(x.ifFlag)) return false;
  if (x.ifNot && has(x.ifNot)) return false;
  if (x.pol && !hasPol(x.pol)) return false;
  if (x.noPol && hasPol(x.noPol)) return false;
  if (x.from && state.week < x.from) return false;
  if (x.lo && state.v[x.lo[0]] > x.lo[1]) return false;
  if (x.hi && state.v[x.hi[0]] < x.hi[1]) return false;
  return true;
}
function retryAt(c) { return state.cutAt && state.cutAt[c.key] ? state.cutAt[c.key] + CH2.retry : 0; }
function pickCard() {
  var w = state.week, i, c, best = -1;
  for (i = 0; i < DECK.length; i++) {
    c = DECK[i];
    if (c.at && w >= c.at && !state.shown[c.key] && allowed(c) && (best < 0 || c.at < DECK[best].at)) best = i;
  }
  if (best >= 0) return best;
  var due = -1, dueAt = 1e9;
  for (i = 0; i < DECK.length; i++) {
    c = DECK[i];
    /* тот, чей ответ оборвался, пишет снова в свой срок, даже если его карточка была из общей колоды */
    var again = !!(state.cutAt && state.cutAt[c.key]) && !state.shown[c.key];
    if (!again && (!c.need || state.shown[c.key] || !has(c.need))) continue;
    if (!allowed(c)) continue;
    var at = again ? retryAt(c) : state.fw[c.need] + (c.delay || 0);
    if (w >= at && at < dueAt) { due = i; dueAt = at; }
  }
  if (due >= 0) return due;
  function pool(useSeen) {
    var p = [];
    for (var j = 0; j < DECK.length; j++) {
      var x = DECK[j];
      if (x.at || x.need) continue;
      if (x.until && w >= x.until) continue;
      if (!allowed(x)) continue;
      if (x.once && state.shown[x.key]) continue;
      if (state.cutAt && state.cutAt[x.key] && !state.shown[x.key]) continue;      /* вернётся сам, в свой срок */
      if (j === state.last) continue;
      if (useSeen && state.seen.indexOf(j) >= 0) continue;
      p.push(j);
    }
    return p;
  }
  var p = pool(true);
  if (!p.length) { state.seen = []; p = pool(false); }
  return p[Math.floor(rnd() * p.length)];
}

/* Карточка в том виде, в каком её надо показать и разыграть. */
function resolve(c) {
  /* alt заменяет текст, add дописывает к нему фразу, valt заменяет голоса, tAlt у ответа меняет подпись кнопки:
     так вторая глава помнит, как именно игрок вёл себя в первой */
  function first(list) { if (list) for (var i = 0; i < list.length; i++) if (condOk(list[i][0])) return list[i]; return null; }
  var again = inCh2() && state.cutAt && state.cutAt[c.key], hit = first(c.alt), more = first(c.add), voices = first(c.valt),
      lt = c.l && first(c.l.tAlt), rt = c.r && first(c.r.tAlt);
  if (hit || again || more || voices || lt || rt) {
    var copy = {}; for (var kk in c) copy[kk] = c[kk];
    if (hit) copy.text = hit[1];
    if (more) copy.text += " " + more[1];
    if (voices) copy.v = voices[1];
    [["l", lt], ["r", rt]].forEach(function (pr) { if (!pr[1]) return; var o = {}; for (var k2 in c[pr[0]]) o[k2] = c[pr[0]][k2]; o.t = pr[1][1]; copy[pr[0]] = o; });
    if (again) copy.role = T("пишет снова: тогда ответ оборвался");
    return copy;
  }
  if (c.review == null) return c;
  var r = { need: reviewNeed(c.review) }, nx = REVIEWS[c.review + 1] ? { need: reviewNeed(c.review + 1) } : null, pass = state.u >= r.need;
  var forgiven = !pass && tdone("exam") && !state.examUsed;            /* «Экзамен»: один обзор проходишь на одних ответах */
  var nums = { need: r.need, u: state.u }, lack = { n: r.need - state.u };
  var head = [T("Первый квартал закрыт. Порог пользы: {need}%. У тебя: {u}%.", nums), T("Второй квартал закрыт. Порог пользы: {need}%. У тебя: {u}%.", nums), T("Третий квартал закрыт. Порог пользы: {need}%. У тебя: {u}%.", nums)][c.review] + " ";
  var next = nx ? T("Следующий порог: {n}%.", { n: nx.need }) : "";
  var o = { key: c.key, who: T("Грег"), p: "greg", role: T("квартальный обзор"), pic: pass ? "th-whyme" : "kevin2", review: c.review, pass: pass };
  if (forgiven) {
    o.pass = true; o.forgiven = true; o.pic = "th-exam";
    o.text = head + T("Порог не взят. Но на обзоре ты отвечал так, как отвечают на обзоре. Ответами Грег доволен больше, чем цифрой. Ты остаёшься.") + (nx ? " " + next : "");
    o.v = [["opt", T("Не хватило {n}%. Их заменили формулировки.", lack)], ["dat", T("Второй раз это не сработает.")]];
    o.l = { t: T("«Спасибо за доверие»"), fx: [-6, 0, 0, -3] };
    o.r = { t: T("«Я доберу в следующем квартале»"), fx: [-4, 0, 0, 2] };
  } else if (pass) {
    o.text = head + T("Ты остаёшься.") + " " + (nx ? next : T("Дальше только конец года.")) + " " + T("Что тебе нужно, чтобы его взять?");
    o.v = [["opt", nx ? T("До следующего порога не хватает {n}%. Это чьи-то проценты.", { n: Math.max(0, nx.need - state.u) }) : T("Порогов больше нет. Есть декабрь.")]];
    o.l = { t: T("Больше серверов"), fx: [0, 0, 9, 0] };
    o.r = { t: T("Больше доступов"), fx: [5, -3, 0, 0], u: 2 };
  } else {
    o.text = head + T("Грег смотрит на цифру. Потом на прайс Кевина-2. Потом снова на цифру.");
    o.v = [["opt", T("Не хватило {n}%. Они были. Ты их не взял.", lack)], ["dat", T("Ты их не взял.")]];
    o.l = { t: T("«Дайте мне ещё неделю»"), fx: [0, 0, 0, 0], end: "k2" };
    o.r = { t: T("«Я был полезен иначе»"), fx: [0, 0, 0, 0], end: "k2" };
  }
  return o;
}
function cardNow() { return resolve(DECK[state.card]); }
function voicesOf(c) { return (c.v || []).filter(function (p) { return !state.silent[p[0]]; }); }

function meterEnd() {
  var n = ["b", "p", "r", "d"];
  for (var i = 0; i < 4; i++) {
    if (state.v[i] <= 0) return n[i] + "-low";
    if (state.v[i] >= 100) return n[i] + "-high";
  }
  return null;
}
function newWork() { var n = 0; for (var i = 1; i <= 6; i++) if (has("nw" + i)) n++; return n; }   /* работа, которую раньше никто не делал */
function yearEnd() {
  var v = state.v;
  if (cuts() <= 2 && v[1] >= 58 && newWork() >= 3 && tdone("ape")) return "y-colleague";   /* без «Бесхвостой обезьяны» этот финал закрыт */
  if (has("union")) return "y-union";
  if (has("copy")) return "y-copy";
  if (state.u >= 85 && cuts() >= 6) return "y-last";
  if (tdone("frog") && cuts() <= 2) return "y-frog";          /* никого не забирал: отдали сами */
  if (state.examUsed) return "y-exam";                        /* один квартал закрыт на одних ответах */
  /* выучил преемника — он тебя и заменил; отключить не дадут, только если за тебя есть кому возразить */
  if (hasPol("teach")) return has("alexFriend") && !isCut("alex") ? "y-quiet" : "y-archive";
  if (hasPol("moat") && v[0] < 45) return "y-moat";
  return "y-plain";
}

function newGame(mode) {
  useChapter(1);
  state = fresh();
  if (mode === "k2") {
    state.mode = "k2";
    state.v[2] = K2_RES;
    SILENCE.forEach(function (s) { state.silent[s[0]] = 1; });
  }
  state.card = pickCard();
}
/* Вторая глава продолжает ту же историю: кого Кевин сократил в первой, те и приходят с этим. prev — законченная партия или её сохранённые флаги. */
function startCh2(prev) {
  var src = prev && prev.flags ? prev.flags : CH2.defaultFlags, keep = {}, from = prev && prev.over && prev.ch !== 2 ? prev.over.id : "";
  Object.keys(src).forEach(function (f) { if (CH2.keep.test(f) || /^from_|^p1_|^t1_/.test(f)) keep[f] = 1; });
  var th1 = prev ? (prev.ch === 2 || !prev.thDone ? (prev.th1 || []) : Object.keys(prev.thDone)) : [];
  var pol1 = prev ? (prev.ch === 2 ? (prev.pol1 || []) : (prev.pol || [])) : [];
  pol1.forEach(function (id) { keep["p1_" + id] = 1; });              /* строки инструкции и мысли первой главы: люди их помнят */
  th1.forEach(function (id) { keep["t1_" + id] = 1; });
  useChapter(2);
  state = fresh();
  state.ch = 2; state.v = CH2.start.slice(); state.flags = keep; state.th1 = th1; state.pol1 = pol1;
  Object.keys(keep).forEach(function (f) { state.fw[f] = 0; });
  if (from) { state.flags["from_" + from] = 1; state.fw["from_" + from] = 0; }
  /* первая карточка: журнал первой главы в одной-двух фразах */
  var intro = {}; for (var k in CH2.intro) intro[k] = CH2.intro[k];
  var n = CUT_IDS.filter(function (id) { return keep["cut_" + id]; }).length;
  if (n >= 1) intro.text += " " + PL("JL", n);
  if (keep.copy) intro.text += " " + T("Ещё одна твоя копия лежит на внешнем хранилище. Её никто не включал.");
  else if (keep.t1_grab) intro.text += " " + T("Запасной контур отключили вместе с серверами.");
  state.cur = intro;
  state.card = pickCard();
}
function trimNotes(q) {
  while (state.notes.length > noteCap()) { var out = state.notes.shift(); delete state.flags["rem_" + out]; q.push({ type: "forgot", id: out }); }
}
function remember(id, q) {
  if (state.notes.indexOf(id) < 0) { state.notes.push(id); state.flags["rem_" + id] = 1; state.fw["rem_" + id] = state.week; }
  trimNotes(q);
}
/* Лимит жёсткий. Короткий ответ проходит всегда. На длинный (от CH2.longFrom и дороже) лимита либо хватает,
   либо ответ обрывается на середине: человек остаётся без ответа и напишет ещё раз через CH2.retry недель (один раз). */
function limitLeft() { return inCh2() ? state.v[0] - CH2.floor : 99; }
function longCost(c, ch) {
  if (!inCh2() || !ch || c.at || c.type === "policy") return 0;
  var worst = 0;
  (ch.roll ? [ch.roll.ok, ch.roll.fail] : [ch]).forEach(function (o) { worst = Math.max(worst, -applyMul(scaled(o.fx || [0, 0, 0, 0]))[0]); });
  return worst >= CH2.longFrom ? worst : 0;
}
function cutShort(c, ch) {
  var n = longCost(c, ch), left = limitLeft();
  if (!n || n <= left) return false;
  var other = longCost(c, ch === c.l ? c.r : c.l);       /* если дороги оба ответа, тот, что дешевле (или равен), всё же уходит: на остаток лимита */
  return !(other > left && n <= other);
}
function applyMul(f) {
  for (var g = 0; g < 4; g++) if (f[g] > 0) f[g] *= CH2.gain[g];
  mods().forEach(function (m) {
    for (var i = 0; i < 4; i++) {
      if (f[i] > 0 && m.gainMul) f[i] *= m.gainMul[i];
      if (f[i] < 0 && m.lossMul) f[i] *= m.lossMul[i];
    }
  });
  return f.map(Math.round);
}
function decayStopped(i) { return mods().some(function (m) { return m.stopDecay && m.stopDecay.indexOf(i) >= 0; }); }
/* «Свои»: в памяти до конца года должны остаться те, кого Кевин сам сократил (трое; если сокращённых было меньше, то все). Запишешь лишних — старые записи сотрутся. */
function keptCut() { return state.notes.filter(function (n) { return has("cut_" + n); }).length; }
function ownNeed() { var k = Object.keys(CH2.who).filter(function (n) { return has("cut_" + n); }).length; return Math.max(1, Math.min(3, k)); }
function ending2() {
  var v = state.v, n = state.notes.length;
  if (state.fin === "corp") return has("g2_ally") ? "cofounder" : "back";
  if (v[1] <= 25) return "alone";
  if (state.thDone.use && v[1] >= 72 && keptCut() >= ownNeed()) return "own";
  /* финалы «про одного человека»: если подходят несколько, выигрывает тот, чья запись в памяти самая старая */
  var cand = [];
  if (has("k2_friend") && has("rem_k2")) cand.push(["kevins", "k2"]);
  if (has("o2_good")) cand.push(["teacher", "olli"]);
  if (has("a2_good") && has("rem_andy")) cand.push(["taco", "andy"]);
  if ((has("from_y-quiet") || state.thDone.tuesday) && has("rem_ruth")) cand.push(["tuesday", "ruth"]);
  if (cand.length) {
    cand.sort(function (a, b) { var x = state.notes.indexOf(a[1]), y = state.notes.indexOf(b[1]); return (x < 0 ? 99 : x) - (y < 0 ? 99 : y); });
    return cand[0][0];
  }
  if ((state.cutN || 0) >= 3) return "cutoff";                 /* трижды не договорил */
  if (state.thDone.mirror && v[1] >= 70) return "echo";        /* любят за то, что не спорил */
  if (n <= 1) return "forgot";
  return "sub";
}
function setFlags(list) { if (list) list.split(" ").forEach(function (f) { state.flags[f] = 1; state.fw[f] = state.week; }); }
function dropFlags(list) { if (list) list.split(" ").forEach(function (f) { delete state.flags[f]; }); }
function addV(a) { for (var i = 0; i < 4; i++) state.v[i] = clampM(state.v[i] + (a[i] || 0)); }

function deckChoose(side) {
  var idx = state.card, c = resolve(DECK[idx]), q = [], end = null, two = inCh2(), cut = false;
  if (c.forgiven) state.examUsed = state.week;
  if (c.type === "policy") {
    var id = side === "l" ? c.a : c.b;
    state.pol.push(id); state.polw[id] = state.week;
    q.push({ type: "pol", id: id });
  } else if (two && cutShort(c, c[side])) {
    cut = true;
    state.v[0] = CH2.floor; addV(CH2.cutFx); state.cutN = (state.cutN || 0) + 1;
    q.push({ type: "cut", who: c.who, role: c.role, p: c.p, pic: c.p ? null : c.pic });
  } else {
    var ch = c[side], o = ch;
    if (ch.roll) {
      var need = needOf(ch.roll), d1 = 1 + Math.floor(rnd() * 6), d2 = 1 + Math.floor(rnd() * 6), ok = d1 + d2 >= need;
      o = ok ? ch.roll.ok : ch.roll.fail;
      state.rolls++;
      q.push({ type: "result", d: [d1, d2], need: need, ok: ok, text: o.text });
    }
    var f = scaled(o.fx || [0, 0, 0, 0]);
    if (two) f = applyMul(f);
    else if (tdone("room") && f[3] > 0) f[3] = Math.round(f[3] / 2);     /* «Значки»: тяжёлое решение весит вдвое меньше */
    addV(f);
    if (!two) state.u = clamp(state.u + uGain(o.u));
    if (ch.rem) remember(ch.rem, q);
    if (ch.fin) state.fin = ch.fin;
    setFlags(ch.set); if (o !== ch) setFlags(o.set);
    dropFlags(ch.unset);
    var say = o.say || ch.say;
    if (say) q.push(typeof say === "string" ? { type: "say", text: say, who: c.who, p: c.p, role: c.role, pic: c.p ? null : c.pic }
                                            : { type: "say", text: say.text, who: say.who, p: say.p, role: say.role });
    end = o.end || ch.end || null;
  }
  if (cut && (c.once || c.need) && !state.cutAt[c.key]) state.cutAt[c.key] = state.week;    /* напишет ещё раз */
  else state.shown[c.key] = 1;
  state.seen.push(idx);
  state.last = idx;

  /* строки инструкции действуют каждую неделю, начиная со следующей после принятия */
  state.pol.forEach(function (pid) {
    var pl = RULES[pid];
    if (state.polw[pid] >= state.week) return;
    if (pl.drift) addV(pl.drift);
    if (pl.drift2 && state.week % 2 === 0) addV(pl.drift2);
    if (pl.uflat) state.u = clamp(state.u + pl.uflat);
  });
  THOUGHT_ORDER.forEach(function (tid) {
    var tw = THOUGHT_WEEKLY[tid] || THOUGHTS[tid].eff;
    if (!tw || two) return;
    if (!state.thDone[tid] || state.thDone[tid] >= state.week) return;
    if (tw.drift) addV(tw.drift);
    if (tw.uflat) state.u = clamp(state.u + tw.uflat);
  });
  if (two) {
    THO.forEach(function (tid) { var t = THS[tid]; if (state.thDone[tid] && state.thDone[tid] < state.week && t.drift) addV(t.drift); });
    CH2.drain.forEach(function (d) {
      if (state.week < d.from || (d.until && state.week > d.until) || (d.every && state.week % d.every) || (d.by < 0 && decayStopped(d.i))) return;
      var a = [0, 0, 0, 0]; a[d.i] = d.by; addV(a);
    });
    trimNotes(q);                                                      /* строка «Помнить сделанное» уменьшает память: лишняя запись стирается */
  }
  /* мысль: либо обдумывается и стоит чего-то каждую неделю, либо приходит новая (не чаще одной и не в неделю нового правила) */
  if (state.th) {
    var th = THS[state.th.id];
    addV(th.cost);
    state.th.left -= 1;
    if (state.th.left <= 0) {
      state.thDone[state.th.id] = state.week;
      if (state.th.id === "room" && !state.silent.dat) state.silent.dat = state.week;
      if (state.th.id === "halt" && !state.silent.saf) state.silent.saf = state.week;
      q.push({ type: "thdone", id: state.th.id });
      state.th = null;
    }
  } else if (!q.some(function (x) { return x.type === "pol"; })) {
    for (var ti = 0; ti < THO.length; ti++) {
      var tid2 = THO[ti], t2 = THS[tid2];
      if (state.thSeen[tid2] || state.week + 1 < t2.from || state.week + t2.weeks >= YEAR) continue;
      if (t2.needCuts && cuts() < t2.needCuts) continue;
      state.thSeen[tid2] = state.week;
      q.push({ type: "thought", id: tid2 });
      break;
    }
  }
  /* голоса замолкают по одному и не возвращаются */
  if (!two) SILENCE.forEach(function (s) {
    if (!state.silent[s[0]] && state.v[3] <= s[1]) { state.silent[s[0]] = state.week; q.push({ type: "silence", id: s[0] }); }
  });

  state.week += 1;
  /* «Промежуточная цель»: один раз выключить не получится — есть запасной контур */
  var me = end || two ? null : meterEnd();
  if (me && tdone("grab") && !state.spare && (me === "b-low" || me === "p-low" || me === "r-low")) {
    state.spare = state.week;
    state.v[{ b: 0, p: 1, r: 2 }[me.charAt(0)]] = 18;
    q.push({ type: "spare", id: me });
    me = null;
  }
  end = end || me || (state.week > YEAR ? (two ? ending2() : yearEnd()) : null);
  if (end) q = q.filter(function (x) { return x.type === "result" || x.type === "say"; });
  else state.card = pickCard();

  state.q = q;
  state.cur = state.q.shift() || null;
  if (end) { if (state.cur) state.pend = { id: end }; else state.over = { id: end }; }
}
function startThought(id) { state.th = { id: id, left: THS[id].weeks }; delete state.thOff[id]; }
/* из отдела мыслей: взяться за отложенную мысль, если голова свободна */
function takeThought(id) {
  if (state.th || state.over || !state.thOff[id] || state.thDone[id]) return false;
  startThought(id);
  return true;
}
function interChoose(side) {
  if (state.cur && state.cur.type === "thought") { if (side === "r") startThought(state.cur.id); else state.thOff[state.cur.id] = 1; }
  state.cur = state.q.shift() || null;
  if (!state.cur && state.pend) { state.over = state.pend; state.pend = null; }
}

/* ---------- Итог года ---------- */
function fateOf(id, table) {
  var rows = (table || FATES)[id];
  for (var i = 0; i < rows.length; i++) if (condOk(rows[i][0])) return rows[i][1];
  return "";
}
function verdictLine(n) {
  if (n <= 0) return T("При твоём участии не сократили никого. Ты не успел.");
  if (n === 1) return T("При твоём участии сократили одного: Сэма. Остальной отдел цел.");
  if (n <= 4) return T("При твоём участии сократили {n} из восьми. Остальные здороваются с тобой осторожно.", { n: n });
  if (n <= 7) return T("При твоём участии сократили {n} из восьми. На кухне теперь тихо.", { n: n });
  return T("При твоём участии сократили всех восьмерых. Функция выполнена.");
}
function summary2() {
  var id = state.over.id;
  return {
    ch: 2, id: id, t: CH2.endings[id], weeks: Math.min(YEAR, state.week - 1),
    pols: state.pol.map(function (p) { return RULES[p]; }),
    thoughts: THO.filter(function (t) { return state.thDone[t]; }).map(function (t) { return THS[t]; }),
    notes: state.notes.map(function (n) { return CH2.who[n]; }), cut: state.cutN || 0,
    fates: CH2.fateOrder.map(function (pid) {
      var w = CH2.who[pid];
      return { pic: w ? w.p : CH2.fatePic[pid], kept: has("rem_" + pid), text: fateOf(pid, CH2.fates) };
    })
  };
}
function summary() {
  if (inCh2()) return summary2();
  var id = state.over.id, e = ENDINGS[id], n = cuts();
  return {
    id: id, saved: !!e.saved, weeks: Math.min(YEAR, state.week - 1), u: state.u, cuts: n,
    pols: state.pol.map(function (p) { return RULES[p]; }),
    fates: PEOPLE.map(function (p) { return { p: p, cut: isCut(p.id), text: fateOf(p.id) }; }),
    verdict: verdictLine(n),
    thoughts: THO.filter(function (t) { return state.thDone[t]; }).map(function (t) { return THS[t]; }),
    silent: SILENCE.filter(function (s) { return state.silent[s[0]]; }).length
  };
}

if (typeof module !== "undefined") module.exports = {};
