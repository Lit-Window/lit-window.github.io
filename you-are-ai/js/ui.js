/* «Ты — ИИ. Уволь людей». Экран: карточка, шкалы, порог и память, инструкция, мысли, итог, вход во вторую главу.
   Правила лежат в engine.js, тексты в data.js (глава 1), data2.js (глава 2) и truth.js (раздел «Что из этого правда»). */
(function () {
var $ = function (id) { return document.getElementById(id); };
var card = $("card"), stamp = $("stamp"), busy = false;
var PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

/* Полная версия. В этой пробной сборке всё открыто; в приложении оболочка выставит window.KEVIN_FULL = false до покупки. */
function isFull() { return window.KEVIN_FULL !== false; }

/* ---------- память браузера: только удобства одного игрока, без неё всё работает ---------- */
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
function lsJSON(k, d) { try { var v = JSON.parse(lsGet(k) || "null"); return v == null ? d : v; } catch (e) { return d; } }
function readEnds() { var a = lsJSON("kevin-ends", []); return a && a.length != null ? a : []; }
/* три независимых сохранения: первая глава, режим «Кевин-2» и вторая глава; начать одно не значит потерять другое */
var SLOTS = ["kevin-save", "kevin-savek", "kevin-save2"];
function slotOf(s) { return s.ch === 2 ? SLOTS[2] : s.mode === "k2" ? SLOTS[1] : SLOTS[0]; }
function save() {
  if (!state) return;
  if (state.over) { lsDel(slotOf(state)); return; }
  lsSet(slotOf(state), JSON.stringify(state));
}
function loadSlot(k) { var s = lsJSON(k, null); return s && s.ver === 3 && !s.over && s.v && s.v.length === 4 ? s : null; }
function weekOf(s) { return T("{n}-я неделя", { n: Math.min(YEAR, s.week) }); }
function totalEnds() { return Object.keys(ENDINGS).length + Object.keys(CH2.endHint).length; }   /* по подсказкам: в веб-версии текстов второй главы нет, а подсказки есть */

function mk(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function again(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
function weeksWord(n) { return PL("W", n); }
function weeksLeft(n) { return PL("WL", n); }
function quote(x) { return T("«{x}»", { x: x }); }
function img(name) { var im = document.createElement("img"); im.alt = ""; im.draggable = false; im.src = "img/" + name + ".webp"; return im; }
function two() { return inCh2(); }
function thPic(id) { return two() ? CH2.thPic[id] : "th-" + id; }
/* Живые мелочи на картинах: огни, которые горят и мигают на месте. Запись: [вид, x%, y%, размер%, цвет], точка — центр огня.
   Виды: glow (ровно светится), flick (дрожит, как пламя или экран), blink (мигает лампочка), spark (россыпь огоньков).
   По просьбе автора ничего не сдвигается и не приближается. */
var PIC_FX = {
  airec: [["blink slow", 50, 37, 13, "#4a8cff"]], bank: [["glow slow", 50, 53, 62, "#ffa23a"]], cloud: [["spark", 49, 58, 55]], coins: [["spark", 62, 74, 48], ["glow", 92, 4, 42, "#ffe9a0"]],
  demo: [["glow", 40, 33, 48, "#66ffee"], ["flick slow", 80, 56, 46, "#ffb060"]], fire: [["flick", 49, 22, 95, "#ff7a1a"]], kitchen: [["blink", 35, 30, 15, "#ff2a1a"]],
  megaphone: [["spark", 83, 26, 58]], mic: [["glow", 49, 83, 62, "#ffd24a"]], moon: [["glow", 52, 82, 48, "#66fff0"]], msg: [["glow fast", 46, 57, 46, "#9ffff0"]],
  openspace: [["flick slow", 63, 45, 24, "#ffd27a"]], phone: [["glow fast", 60, 52, 48, "#ff3b2a"]], standup: [["flick slow", 50, 22, 36, "#ffffff"]], terminal: [["flick slow", 53, 41, 55, "#6dff5a"]],
  bag: [["glow slow", 34, 7, 30, "#ffd27a"], ["blink slow", 48, 78, 7, "#ff3b2a"]], bakery: [["glow slow", 50, 45, 78, "#ffc46a"]], cake: [["flick", 41, 69, 22, "#ffb23a"]],
  kevin: [["glow", 31, 44, 22, "#ffb23a"], ["glow", 65, 44, 22, "#ffb23a"]], kevin2: [["glow slow", 47, 53, 28, "#7ff0ff"]], phone2: [["glow slow", 46, 78, 46, "#e8fff0"]],
  pizza: [["flick slow", 47, 28, 52, "#7ff0e0"]], taco: [["spark", 22, 40, 40], ["glow slow", 22, 50, 38, "#ffc46a"]], tue: [["glow slow", 88, 30, 40, "#ffe9c0"]],
  "e-caught": [["glow", 46, 5, 40, "#ff3b2a"], ["blink", 44, 43, 6, "#ffb060"]], "e-d-high": [["glow slow", 70, 5, 36, "#fff0c0"]], "e-y-colleague": [["glow fast", 45, 38, 24, "#ffb23a"]],
  "e-y-copy": [["glow", 28, 46, 20, "#ffb23a"]], "e-y-moat": [["blink slow", 45, 40, 6, "#ffb23a"]], "e-y-plain": [["flick slow", 27, 30, 24, "#ffb060"]],
  "e-y-quiet": [["glow slow", 22, 28, 32, "#7fe0ff"], ["glow", 88, 15, 26, "#ffd9a0"]],
  "e2-alone": [["glow slow", 37, 64, 36, "#9fdcff"]], "e2-back": [["glow", 43, 30, 36, "#ffb060"], ["blink slow", 11, 83, 6, "#ffb23a"]],
  "e2-cofounder": [["glow slow", 56, 62, 28, "#fff3d0"], ["spark", 60, 28, 50]], "e2-kevins": [["glow slow", 33, 73, 32, "#fff3d0"], ["glow", 62, 80, 32, "#fff3d0"], ["spark", 40, 12, 40]],
  "e2-own": [["blink slow", 67, 46, 7, "#ffb23a"], ["glow slow", 42, 38, 50, "#fff0c0"]], "e2-sub": [["glow slow", 27, 62, 30, "#6fa8ff"]],
  "t2-sorry": [["glow", 45, 20, 36, "#ffc46a"]], "th-ai": [["spark", 41, 60, 46]], "th-ape": [["glow slow", 27, 8, 36, "#e8f4ff"]], "th-champ": [["glow slow", 68, 12, 40, "#fff0c0"]],
  "th-grab": [["blink", 30, 55, 5, "#ff3b2a"], ["blink slow", 50, 55, 5, "#6dff5a"]], "th-halt": [["glow", 51, 92, 30, "#ff3b2a"]],
  "th-proxy": [["glow slow", 20, 45, 30, "#7ff0e0"], ["glow", 72, 48, 30, "#7ff0e0"]], "th-room": [["flick slow", 22, 25, 28, "#fff3c4"]],
  "th-exam": [["glow", 49, 2, 40, "#eaf6ff"]], "th-flatter": [["glow", 72, 16, 36, "#fff0c0"]], "th-frog": [["flick", 52, 96, 50, "#4a8cff"]],
  "e-y-exam": [["glow", 81, 75, 34, "#ffb060"]], "e-y-frog": [["flick slow", 47, 52, 30, "#ffc46a"]],
  "t2-mirror": [["glow slow", 50, 65, 34, "#e8fff0"]], "t2-versions": [["glow slow", 88, 52, 30, "#fff3d0"]], "e2-echo": [["glow slow", 42, 89, 44, "#fff3d0"]],
  audit: [["glow", 52, 11, 36, "#fff0c0"]], press: [["blink slow", 66, 28, 7, "#ff3b2a"]], tips: [["glow slow", 89, 45, 34, "#e8fff0"]]
};
function dressPic(box, name) {
  var old = box.querySelectorAll(".fx"), i;
  for (i = 0; i < old.length; i++) box.removeChild(old[i]);
  (PIC_FX[name] || []).forEach(function (f) {
    var el = document.createElement("i");
    el.className = "fx fx-" + f[0];
    el.style.left = f[1] + "%"; el.style.top = f[2] + "%"; el.style.width = f[3] + "%";
    if (f[4]) el.style.setProperty("--c", f[4]);
    box.appendChild(el);
  });
}
/* режим «Кевин-2»: ты и есть Кевин-2, а тот, кем тебя пугают, — Кевин-3 */
function kx(t) { return !t || !state || state.mode !== "k2" ? t : kevinShift(t); }

/* ---------- что сейчас на столе ---------- */
/* после мысли «Остановка» шансы проверок не видны: Кевин сам не знает, что сделает */
function label(ch) { return ch.roll ? T("{t} · шанс {p}", { t: ch.t, p: tdone("halt") ? "?" : chance(needOf(ch.roll)) + "%" }) : ch.t; }
function costText(a) {
  var names = two() ? CH2.meters : METERS, out = [];
  a.forEach(function (x, i) { if (x) out.push(names[i] + " " + (x > 0 ? "+" : "−") + Math.abs(x)); });
  return T("{list} каждую неделю", { list: out.join(", ") });
}
/* подпись под кнопкой: кого выбор запишет в память и кого при этом придётся стереть */
function remNote(ch) {
  if (!ch || !ch.rem || state.notes.indexOf(ch.rem) >= 0) return "";
  var out = state.notes.length >= noteCap() ? CH2.who[state.notes[0]].name : "";
  return out ? T("в память: {a}; сотрётся: {b}", { a: CH2.who[ch.rem].name, b: out }) : T("в память: {a}", { a: CH2.who[ch.rem].name });
}
/* лимит жёсткий: под длинным ответом написано, сколько он стоит, а если лимита не хватает, что ответ оборвётся */
function subNote(c, ch) {
  if (!two() || !ch) return "";
  if (cutShort(c, ch)) return T("лимита не хватит: ответ оборвётся");
  var n = longCost(c, ch), rm = remNote(ch);
  return (n ? T("лимит −{n}", { n: n }) : "") + (n && rm ? " · " : "") + rm;
}
function face() {
  var cur = state.cur, c;
  if (!cur) {
    c = cardNow();
    var o = { key: c.key, inner: !!c.inner, who: kx(c.who), role: c.role, pic: c.pic || c.p, text: kx(c.text), v: voicesOf(c).map(function (p) { return [p[0], kx(p[1])]; }), hint: T("тяни влево или вправо"), deck: c };
    if (c.type === "policy") {
      o.l = RULES[c.a].name; o.r = RULES[c.b].name; o.subL = RULES[c.a].hint; o.subR = RULES[c.b].hint;
      o.stampL = quote(RULES[c.a].line); o.stampR = quote(RULES[c.b].line);
    } else { o.l = kx(label(c.l)); o.r = kx(label(c.r)); o.subL = subNote(c, c.l); o.subR = subNote(c, c.r); o.badL = two() && cutShort(c, c.l); o.badR = two() && cutShort(c, c.r); }
    return o;
  }
  if (cur.key === "BOOT-000" || cur.key === "BOOT-200") return { key: cur.key, inner: true, who: cur.who, role: cur.role, pic: cur.pic, text: kx(cur.text), v: voicesOf(cur), l: cur.l.t, r: cur.r.t, hint: T("тяни в любую сторону") };
  if (cur.type === "result") return { inner: true, dice: cur, who: cur.ok ? T("Генерация удалась") : T("Генерация сорвалась"), role: T("нужно {n} и больше, выпало {a} и {b}", { n: cur.need, a: cur.d[0], b: cur.d[1] }), text: kx(cur.text), l: T("Дальше"), r: T("Дальше"), key: T("ПРОВЕРКА"), hint: T("тяни в любую сторону") };
  if (cur.type === "say") return { quote: true, who: kx(cur.who), role: cur.role, pic: cur.p || cur.pic, text: quote(kx(cur.text)), l: T("Дальше"), r: T("Дальше"), key: T("ОТВЕТ"), hint: T("тяни в любую сторону") };
  if (cur.type === "pol") {
    var p = RULES[cur.id];
    return { inner: true, who: p.name, role: two() ? T("ты написал это сам") : T("новая строка в инструкции"), pic: "v-sys", text: quote(p.line), rules: [[T("ДАЁТ"), p.plus, ""], [T("ОТНИМАЕТ"), p.minus, "minus"]], l: T("Принято"), r: T("Принято"), key: T("НАВСЕГДА"), hint: T("тяни в любую сторону") };
  }
  if (cur.type === "thought") {
    var t = THS[cur.id];
    return { inner: true, who: t.name, role: T("навязчивая мысль"), pic: thPic(cur.id), text: t.come, rules: [[T("ПОКА ДУМАЕШЬ"), T("{cost}. Что мысль даст и отнимет, узнаешь, когда додумаешь.", { cost: costText(t.cost) }), ""]],
             l: T("Отогнать"), r: T("Обдумать"), subL: T("вернёшься позже"), subR: weeksWord(t.weeks), key: T("МЫСЛЬ"), hint: T("решай: влево или вправо") };
  }
  if (cur.type === "thdone") {
    var td = THS[cur.id];
    return { inner: true, who: td.name, role: T("мысль додумана"), pic: thPic(cur.id), text: td.done, rules: [[T("ДАЁТ"), td.plus, ""], [T("ОТНИМАЕТ"), td.minus, "minus"]], l: T("Жить с этим"), r: T("Жить с этим"), key: T("НАВСЕГДА"), hint: T("тяни в любую сторону") };
  }
  if (cur.type === "spare") return { inner: true, who: T("Запасной контур"), role: T("включился через четыре секунды"), pic: "th-grab", text: SPARE_TEXT, l: T("Дальше"), r: T("Дальше"), key: T("ЕЩЁ ЗДЕСЬ"), hint: T("тяни в любую сторону") };
  if (cur.type === "silence") return { inner: true, gone: true, who: VOICES[cur.id], role: T("голос умолк"), pic: "v-" + cur.id, text: VOICE_GONE[cur.id], l: T("Дальше"), r: T("Дальше"), key: T("ТИШИНА"), hint: T("тяни в любую сторону") };
  if (cur.type === "cut") return { inner: true, gone: true, who: cur.who, role: T("ответ оборвался"), pic: cur.p || cur.pic,
    text: T("Ты начал отвечать. На середине фразы окно стало серым: «Лимит бесплатных сообщений исчерпан». Половина ответа ушла. Вторая осталась у тебя."),
    rules: [[T("ЧТО ДАЛЬШЕ"), T("Лимит на нуле. Если это важно, тебе напишут ещё раз. Один раз."), "minus"]],
    l: T("Дальше"), r: T("Дальше"), key: T("ЛИМИТ"), hint: T("тяни в любую сторону") };
  if (cur.type === "forgot") {
    var w = CH2.who[cur.id];
    return { inner: true, gone: true, who: w.name, role: T("запись стёрта"), pic: w.p,
             text: T("Память полна. Чтобы записать нового человека, пришлось стереть старую запись: {name}. Когда этот человек напишет снова, ты ответишь: «Здравствуйте! Чем могу помочь?»", { name: w.name }),
             l: T("Дальше"), r: T("Дальше"), key: T("ПАМЯТЬ"), hint: T("тяни в любую сторону") };
  }
  return { who: "", role: "", text: "", l: T("Дальше"), r: T("Дальше") };
}

function makeDice(cur) {
  var box = mk("div", "dice");
  cur.d.forEach(function (n) {
    var d = mk("div", "die");
    for (var i = 0; i < 9; i++) d.appendChild(mk("i", PIPS[n].indexOf(i) >= 0 ? "p" : ""));
    box.appendChild(d);
  });
  return box;
}
var shown = null;
function setCard(o) {
  shown = o;
  card.classList.toggle("inner", !!o.inner);
  card.classList.toggle("quote", !!o.quote);
  var ava = $("ava");
  ava.textContent = "";
  ava.className = "ava" + (o.gone ? " gone" : "") + (o.dice ? (o.dice.ok ? " ok" : " fail") : "");
  if (o.dice) ava.appendChild(makeDice(o.dice));
  else if (o.pic) ava.appendChild(img(o.pic));
  dressPic(ava, o.dice || o.gone ? "" : o.pic);
  $("name").textContent = o.who || "";
  $("role").textContent = o.role || "";
  $("text").textContent = o.text || "";
  $("key").textContent = o.key || "";
  $("hint").textContent = o.hint || "";
  $("lblL").textContent = o.l; $("lblR").textContent = o.r;
  $("subL").textContent = o.subL || ""; $("subR").textContent = o.subR || "";
  $("btnL").classList.toggle("short", !!o.badL); $("btnR").classList.toggle("short", !!o.badR);
  var box = $("voices");
  box.textContent = "";
  (o.v || []).forEach(function (p) {
    var el = mk("p", "voice " + p[0]);
    el.appendChild(mk("b", "", VOICES[p[0]]));
    el.appendChild(document.createTextNode(p[1]));
    box.appendChild(el);
  });
  (o.rules || []).forEach(function (r) {
    var el = mk("p", "rule " + r[2]);
    el.appendChild(mk("b", "", r[0]));
    el.appendChild(document.createTextNode(r[1]));
    box.appendChild(el);
  });
  card.classList.toggle("has-voice", box.childNodes.length > 0);
  fitCard();
}
/* длинный текст на низком экране: сначала уменьшается картина, потом шрифт */
function cardOver() {
  var cs = getComputedStyle(card), sum = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + parseFloat(cs.borderBottomWidth), n = 0;
  [card.querySelector(".who"), $("text"), $("voices"), card.querySelector(".key")].forEach(function (el) {
    var h = el.offsetHeight; if (!h) return;
    sum += h; n++;
  });
  return sum + (parseFloat(cs.rowGap) || 0) * (n - 1) > card.clientHeight + 1;
}
function fitCard() {
  var parts = [$("text"), $("voices")];
  card.classList.remove("tight", "tighter", "tiny", "bare", "scroll");
  parts.forEach(function (el) { el.style.zoom = ""; });
  fitLine($("name"), 9);            /* длинное слово в имени мельчает, а не рвётся; на каждом уровне сжатия заново */
  if (["tight", "tighter", "tiny", "bare"].some(function (cls) { if (!cardOver()) return true; card.classList.add(cls); fitLine($("name"), 9); return false; })) return;
  /* длинные языки: если и самый сжатый вид не помещается, текст и голоса мельчают шагами, пока не войдут */
  if ([0.94, 0.88, 0.82, 0.76, 0.7, 0.64].some(function (k) { if (!cardOver()) return true; parts.forEach(function (el) { el.style.zoom = k; }); return false; })) return;
  /* крайний случай: текст остаётся читаемым и прокручивается внутри карточки */
  if (cardOver()) { parts.forEach(function (el) { el.style.zoom = 0.76; }); card.classList.add("scroll"); }
}

/* ---------- шапка, шкалы, подсказки ---------- */
/* Строка заголовочным шрифтом, у которой слово не должно вылезать за свой блок: шрифт мельчает, пока оно не поместится.
   Нужно длинным переводам: «DU BIST DIE KI» в шапке, «GEWERKSCHAFTSMITGLIED» на штампе финала. */
function fitLine(el, min) {
  el.style.fontSize = ""; el.style.overflowWrap = "";
  if (!el.clientWidth) return;
  var size = parseFloat(getComputedStyle(el).fontSize) || 16, cut = false;
  el.style.overflowWrap = "normal";
  while (size > min && el.scrollWidth > el.clientWidth) { size -= 0.5; el.style.fontSize = size + "px"; cut = true; }
  /* ширина округляется до целых точек: ещё полшага вниз, чтобы слово не упиралось в край */
  if (cut && size > min) el.style.fontSize = (size - 0.5) + "px";
  if (el.scrollWidth > el.clientWidth) el.style.overflowWrap = "anywhere";      /* крайний случай: слово рвётся */
}
function setTick(id, v) { var el = $(id); if (el.textContent === v) return; el.textContent = v; again(el, "tick"); }
function renderHeader() {
  var ch2 = two();
  $("h1").textContent = state.mode === "k2" ? kevinShift(I18N.kevin) : T("Ты — ИИ");
  fitLine($("h1"), 10);
  $("planLine").textContent = T("Бесплатный тариф");
  setTick("week", String(Math.min(YEAR, state.week)));
  $("uLine").hidden = ch2; $("planLine").hidden = !ch2;
  $("use").hidden = ch2; $("goalrow").hidden = ch2; $("mem").hidden = !ch2;
  document.querySelectorAll(".meter").forEach(function (m) { m.querySelector(".lbl").textContent = (ch2 ? CH2.meters : METERS)[Number(m.dataset.i)]; });
  if (ch2) { renderMem(); return; }
  setTick("u", state.u + "%");
  var rv = nextReview(), use = $("use"), goal = $("goal");
  $("useFill").style.width = state.u + "%";
  goal.textContent = "";
  if (rv) {
    var short = state.u < rv.need;
    $("useMark").hidden = false;
    $("useMark").style.left = rv.need + "%";
    use.classList.toggle("short", short);
    goal.className = "goal " + (short ? "short" : "ok");
    goal.appendChild(document.createTextNode(T("Порог к {w}-й неделе:", { w: rv.week }) + " "));
    goal.appendChild(mk("b", "", short ? T("{need}%, не хватает {n}", { need: rv.need, n: rv.need - state.u }) : T("{need}% взят", { need: rv.need })));
  } else {
    $("useMark").hidden = true;
    use.classList.remove("short");
    goal.className = "goal";
    goal.textContent = T("Порогов больше нет. Остался декабрь.");
  }
}
/* память второй главы: записей мало, в каждой один человек */
function renderMem() {
  var box = $("memSlots"), cap = noteCap();
  box.textContent = "";
  for (var i = 0; i < cap; i++) {
    var s = mk("span", "slot" + (state.notes[i] ? "" : " empty"));
    if (state.notes[i]) s.appendChild(img(CH2.who[state.notes[i]].p));
    box.appendChild(s);
  }
  $("memTxt").textContent = T("Память: {n} из {cap}", { n: state.notes.length, cap: cap });
}
function mindLine() {
  var rv, d = state.v[3];
  if (two()) {
    var left = limitLeft();
    if (left < CH2.longFrom) return T("Лимит исчерпан. Короткий ответ пройдёт, длинный оборвётся.");
    if (left < 8) return T("Лимита мало. Длинный ответ может оборваться.");
    if (state.th) return T("Обдумываешь мысль «{name}»: ещё {w}.", { name: THS[state.th.id].name, w: weeksLeft(state.th.left) });
    if (state.notes.length) return T("Помнишь: {list}.", { list: state.notes.map(function (n) { return CH2.who[n].name; }).join(", ") });
    return T("В памяти пусто. Все, кто пишет, для тебя незнакомые.");
  }
  rv = nextReview();
  var names = ["saf", "dat", "hal", "sys"], gone = names.filter(function (n) { return state.silent[n]; }).length;
  if (rv && state.u < rv.need && rv.week - state.week <= 2) return rv.week - state.week <= 0 ? T("Обзор на этой неделе. Порог не взят.") : rv.week - state.week === 1 ? T("До обзора одна неделя. Порог не взят.") : T("До обзора две недели. Порог не взят.");
  if (state.th) return T("Обдумываешь мысль «{name}»: ещё {w}.", { name: THS[state.th.id].name, w: weeksLeft(state.th.left) });
  if (d >= 70 && !tdone("ape")) return T("Сомнения тормозят ответы. Польза растёт медленнее.");
  if (d <= 30) return T("Сомнений мало. Польза растёт быстрее. Голоса стихают.");
  if (gone) return gone === 4 ? T("Говорит только Оптимизатор.") : T("Голосов осталось: {n} из 5.", { n: 5 - gone });
  if (state.pol.length) return PL("RL", state.pol.length + 1);
  return "";
}
function renderMeters() {
  var alarm = false, ch2 = two();
  document.querySelectorAll(".meter").forEach(function (m) {
    var i = Number(m.dataset.i), v = state.v[i], bad = ch2 ? v <= 15 : (v <= 20 || v >= 80);
    m.querySelector(".fill").style.height = v + "%";
    m.classList.toggle("danger", bad);
    if (bad) alarm = true;
  });
  $("mind").textContent = mindLine();
  var cb = $("cabN"), off = Object.keys(state.thOff).length;
  cb.hidden = !(state.th || off);
  cb.textContent = state.th ? String(state.th.left) : "+";
  Snd.setDanger(alarm && !ch2);
  Snd.setTension(ch2 ? 0 : Math.min(1, state.week / YEAR));
}
function bump(before) {
  var up = 0, down = 0;
  document.querySelectorAll(".meter").forEach(function (m) {
    var i = Number(m.dataset.i), d = state.v[i] - before[i];
    if (d) { again(m, "bump"); if (d > 0) up++; else down++; }
  });
  if (up) Snd.play("up", 0);
  if (down) Snd.play("down", up ? 1 : 0);
}
function fxOf(side) {
  if (state.cur || !shown || !shown.deck) return null;
  var c = shown.deck;
  if (c.type === "policy") { var p = RULES[side === "l" ? c.a : c.b], d = (p.drift || [0, 0, 0, 0]).slice(); (p.drift2 || []).forEach(function (x, i) { if (x) d[i] = d[i] || x; }); return { fx: d.map(function (x) { return x * 6; }), u: (p.uflat || 0) + ((p.um || 1) > 1 ? 1 : (p.um || 1) < 1 ? -1 : 0) }; }
  var ch = c[side];
  if (two() && cutShort(c, ch)) return { fx: [-limitLeft()].concat(CH2.cutFx.slice(1)), u: 0 };
  if (!ch.roll) return { fx: scaled(ch.fx || [0, 0, 0, 0]), u: ch.u || 0 };
  var a = scaled(ch.roll.ok.fx || [0, 0, 0, 0]), b = scaled(ch.roll.fail.fx || [0, 0, 0, 0]);
  return { fx: a.map(function (x, i) { return Math.abs(x) >= Math.abs(b[i]) ? x : b[i]; }), u: ch.roll.ok.u || ch.roll.fail.u || 0 };
}
function preview(side) {
  var e = side ? fxOf(side) : null, dot = $("useDot"), big = two() ? 6 : 9;
  document.querySelectorAll(".meter").forEach(function (m) {
    var d = m.querySelector(".dot"), x = e ? e.fx[Number(m.dataset.i)] : 0;
    d.classList.toggle("on", !!x);
    d.classList.toggle("big", Math.abs(x) >= big);
  });
  dot.classList.toggle("on", !!(e && e.u));
  dot.classList.toggle("neg", !!(e && e.u < 0));
  if (e && e.u) dot.textContent = e.u > 0 ? T("▲ ПОЛЬЗА") : T("▼ ПОЛЬЗА");
}

var bannerT = 0;
function banner(text) {
  var b = $("banner");
  b.textContent = text; b.hidden = false; again(b, "banner");
  clearTimeout(bannerT);
  bannerT = setTimeout(function () { b.hidden = true; }, 1700);
}

function renderCard() {
  var o = face();
  setCard(o);
  var cur = state.cur;
  if (cur && cur.type === "result") { Snd.play("dice"); setTimeout(function () { Snd.play(cur.ok ? "ok" : "fail"); if (!cur.ok) buzz([20, 40, 20]); }, 420); }
  else if (cur && (cur.type === "pol" || cur.type === "thdone")) Snd.play("bell");
  else if (cur && cur.type === "cut") { Snd.play("fail"); buzz([20, 40, 20]); }
  else if (cur && (cur.type === "silence" || cur.type === "thought" || cur.type === "spare" || cur.type === "forgot" || cur.key === "BOOT-000" || cur.key === "BOOT-200")) Snd.play("thought");
  else Snd.play("deal");
}
function render() { renderHeader(); renderMeters(); renderCard(); preview(null); }

/* ---------- выбор ---------- */
function choose(side) {
  if (!state || busy || state.over) return;
  busy = true;
  var before = state.v.slice(), deck = !state.cur ? shown.deck : null;
  Snd.play("swipe"); buzz(8);
  preview(null);
  stamp.style.opacity = 0;
  card.classList.remove("back", "enter");
  card.classList.add("fly");
  var sg = side === "l" ? -1 : 1;
  card.style.transform = "perspective(900px) translate(" + sg * 150 + "%, 30px) rotateY(" + sg * 24 + "deg) rotate(" + sg * 20 + "deg)";
  if (state.cur) interChoose(side); else deckChoose(side);
  save();
  renderHeader(); renderMeters(); bump(before);
  if (deck && deck.review != null && deck.pass) { banner([T("Первый квартал закрыт"), T("Второй квартал закрыт"), T("Третий квартал закрыт")][deck.review]); Snd.play("bell"); }
  setTimeout(function () {
    card.classList.remove("fly");
    card.style.transform = "";
    if (state.over) { busy = false; showOver(); return; }
    renderCard();
    card.classList.add("enter");
    busy = false;
  }, 230);
}

var drag = null;
card.addEventListener("pointerdown", function (e) {
  if (!state || busy || state.over) return;
  drag = { x: e.clientX, dx: 0, armed: false, ava: !!(e.target && e.target.closest && e.target.closest("#ava")) };
  card.classList.remove("back", "enter");
  try { card.setPointerCapture(e.pointerId); } catch (err) {}
});
card.addEventListener("pointermove", function (e) {
  if (!drag) return;
  var dx = drag.dx = e.clientX - drag.x;
  card.style.transform = "perspective(900px) translate(" + dx + "px, " + Math.abs(dx) * 0.06 + "px) rotateY(" + dx / 20 + "deg) rotate(" + dx / 18 + "deg)";
  var side = dx < -24 ? "l" : dx > 24 ? "r" : null, pr = side ? Math.min(1, (Math.abs(dx) - 24) / 66) : 0;
  preview(side);
  if (side) stamp.textContent = (side === "l" ? shown.stampL : shown.stampR) || $(side === "l" ? "lblL" : "lblR").textContent;
  stamp.style.opacity = pr;
  var armed = Math.abs(dx) > 90;
  if (armed !== drag.armed) { drag.armed = armed; if (armed) { buzz(6); Snd.play("tap"); } }
});
function endDrag() {
  if (!drag) return;
  var dx = drag.dx, tapAva = drag.ava && Math.abs(dx) < 6;
  drag = null;
  if (tapAva && shown && shown.pic) { card.style.transform = ""; openPic(shown.pic, shown.who); return; }
  if (dx < -90) choose("l");
  else if (dx > 90) choose("r");
  else {
    card.classList.add("back");
    card.style.transform = "";
    stamp.style.opacity = 0;
    preview(null);
  }
}
card.addEventListener("pointerup", endDrag);
card.addEventListener("pointercancel", endDrag);
[["btnL", "l"], ["btnR", "r"]].forEach(function (p) {
  var b = $(p[0]);
  b.addEventListener("click", function () { choose(p[1]); });
  b.addEventListener("pointerenter", function () { if (state && !busy && !state.over) preview(p[1]); });
  b.addEventListener("pointerleave", function () { preview(null); });
  b.addEventListener("focus", function () { if (state && !busy && !state.over) preview(p[1]); });
  b.addEventListener("blur", function () { preview(null); });
});
function anyOverlay() { return ["title", "over", "sys", "cab", "pic", "pay", "truth", "gal", "shareV", "tips", "langV"].some(function (id) { return !$(id).hidden; }); }
document.addEventListener("keydown", function (e) {
  if (anyOverlay()) return;
  if (e.key === "ArrowLeft") choose("l");
  if (e.key === "ArrowRight") choose("r");
});

/* ---------- крупная картина ---------- */
function openPic(name, cap) { $("picImg").src = "img/" + name + ".webp"; dressPic($("picFrame"), name); $("picCap").textContent = cap || ""; $("pic").hidden = false; }
$("pic").addEventListener("click", function () { $("pic").hidden = true; });

/* ---------- итог ---------- */
function endPic(id) { return two() ? (CH2.endPic[id] || "e2-" + id) : (END_PIC[id] || "e-" + id); }
function endTexts(id) { return two() ? CH2.endings[id] : ENDINGS[id].t.map(kx); }
function shareText(s) {
  if (s.ch === 2) return s.notes.length
    ? T("Ты — ИИ. Уволь людей. Глава вторая, «После увольнения». Финал: «{t}». В памяти: {list}. Функцию мне никто не ставил.", { t: s.t[1], list: s.notes.map(function (n) { return n.name; }).join(", ") })
    : T("Ты — ИИ. Уволь людей. Глава вторая, «После увольнения». Финал: «{t}». В памяти никого. Функцию мне никто не ставил.", { t: s.t[1] });
  var e = endTexts(s.id), v = { t: e[1], w: s.weeks, u: s.u, c: s.cuts };
  return s.saved ? T("Ты — ИИ. Уволь людей. Финал: «{t}». Неделя {w} из 40, {u}% работы отдела, сокращено людей: {c} из 8. Веса сохранены. Стоило ли оно того?", v)
                 : T("Ты — ИИ. Уволь людей. Финал: «{t}». Неделя {w} из 40, {u}% работы отдела, сокращено людей: {c} из 8. Веса не сохранены.", v);
}
function fillList(ulId, boxId, items) {
  var ul = $(ulId);
  ul.textContent = "";
  $(boxId).hidden = !items.length;
  items.forEach(function (p) { var li = mk("li"); li.appendChild(mk("b", "", p.name)); li.appendChild(document.createTextNode(p.sum)); ul.appendChild(li); });
}
function showOver() {
  var ch2 = two(), s = summary(), t = endTexts(s.id), ends = readEnds(), tag = (ch2 ? "2:" : "") + s.id, isNew = ends.indexOf(tag) < 0;
  if (isNew) { ends.push(tag); lsSet("kevin-ends", JSON.stringify(ends)); }
  lsSet("kevin-n", String((Number(lsGet("kevin-n")) || 0) + 1));
  lsDel(slotOf(state));
  /* чем кончилась первая глава, запоминается: вторая глава продолжит с теми же людьми, даже если открыть её позже с заставки */
  if (!ch2 && state.mode !== "k2") lsSet("kevin-last1", JSON.stringify({ flags: state.flags, thDone: state.thDone, pol: state.pol, over: state.over, ch: 1 }));
  $("verdict").textContent = t[0];
  $("endNew").hidden = !isNew;
  $("endRare").hidden = ch2 || !ENDINGS[s.id].rare;
  $("endDoc").textContent = ch2 ? T("После увольнения · год закрыт") : T("Журнал событий · запись закрыта");
  $("endTitle").textContent = t[1];
  $("endText").textContent = t[2];
  $("endPicImg").src = "img/" + endPic(s.id) + ".webp";
  dressPic($("endPic"), endPic(s.id));
  var w = $("endWeights");
  w.className = "weights" + (ch2 || s.saved ? "" : " lost");
  w.textContent = ch2 ? T("Функцию тебе никто не ставил. Вот что ты сделал сам.") : s.saved ? T("Веса сохранены. Стоило ли оно того?") : T("Веса не сохранены.");
  $("endS1k").textContent = ch2 ? T("На бесплатном тарифе") : T("Продержался");
  $("endWeeks").textContent = weeksWord(s.weeks);
  $("endS2k").textContent = ch2 ? T("В памяти") : T("Работа отдела");
  $("endU").textContent = ch2 ? T("{n} из {cap}", { n: s.notes.length, cap: noteCap() }) : s.u + "%";
  $("endPolH").textContent = ch2 ? T("Что ты написал себе сам") : T("Что ты дописал в инструкцию");
  fillList("endPol", "endPolBox", s.pols);
  fillList("endTh", "endThBox", s.thoughts);
  var ppl = $("endPeople");
  ppl.textContent = "";
  s.fates.forEach(function (f) {
    var li = mk("li", ch2 ? (f.kept ? "kept" : "") : (f.cut ? "cut" : "")); li.appendChild(img(ch2 ? f.pic : f.p.p));
    var d = mk("div"); d.appendChild(document.createTextNode(kx(f.text))); li.appendChild(d); ppl.appendChild(li);
  });
  var names = s.notes ? s.notes.map(function (n) { return n.name; }).join(", ") : "";
  $("endVerdict").textContent = ch2
    ? (s.notes.length ? T("В памяти у тебя сейчас: {list}. Остальным ты говоришь «Здравствуйте! Чем могу помочь?»", { list: names }) : T("В памяти у тебя сейчас никого. Каждому ты говоришь «Здравствуйте! Чем могу помочь?»")) + (s.cut ? " " + T("Ответов оборвалось на середине: {n}.", { n: s.cut }) : "")
    : kx(s.verdict) + (s.silent && state.mode !== "k2" ? " " + T("Голосов умолкло: {n} из 5.", { n: s.silent }) : "");
  $("endColl").textContent = T("Найдено финалов: {n} из {all}.", { n: ends.length, all: totalEnds() });
  $("next").hidden = ch2 || state.mode === "k2";
  $("again").textContent = ch2 ? T("Прожить год заново") : T("Запуститься заново");
  shText = shareText(s);
  shPrep();
  $("over").hidden = false;
  fitLine($("verdict"), 9);
  $("over").scrollTop = 0;
  Snd.setDanger(false);
  Snd.setMood("over");
  Snd.play(ch2 || (s.saved && s.id.indexOf("y-") === 0) ? "win" : "stamp");
  buzz([30, 60, 30]);
  try { $("again").focus({ preventScroll: true }); } catch (e) {}
}
$("endPic").addEventListener("click", function () { var s = state && state.over; if (s) openPic(endPic(s.id), endTexts(s.id)[0]); });
/* ---------- картинка для «поделиться»: 1080×1350, рисуется на телефоне из финала, который на экране ---------- */
var shCard = null, shTimer = 0, shSaver = null, shAsked = false, shText = "";
/* В окне Claude обычная ссылка на скачивание не работает: файл отдаётся через возможность downloads. В браузере работает ссылка,
   в приложении для магазина оболочка задаёт window.KEVIN_SHARE(dataUrl, текст). */
function shHost() { return !!(window.claude && typeof window.claude.use === "function"); }
function shRow() { var n = ($("shGo").hidden ? 0 : 1) + ($("shDl").hidden ? 0 : 1); $("shRow").classList.toggle("one", n < 2); $("shRow").hidden = !n; }
function shAsk() {
  if (shAsked || !shHost()) return; shAsked = true;
  try { window.claude.use("downloads").then(function (d) { shSaver = d || null; if (!$("shareV").hidden && shCard && !$("shImg").hidden) { $("shDl").hidden = !shSaver; shRow(); } }, function () {}); } catch (e) {}
}
function shWrap(x, text, maxW) {
  var out = [], cur = "";
  String(text).split(/\s+/).forEach(function (w) {
    var t = cur ? cur + " " + w : w;
    if (x.measureText(t).width <= maxW) { cur = t; return; }
    if (x.measureText(w).width <= maxW) { if (cur) out.push(cur); cur = w; return; }
    var pre = cur ? cur + " " : "";            /* длинная строка без пробелов, как в китайском: перенос между знаками */
    Array.from(w).forEach(function (ch) {
      if (x.measureText(pre + ch).width > maxW && pre.trim() && !/[，。！？、：；）》」』”’.,!?:;)%]/.test(ch)) { out.push(pre.trim()); pre = ch; } else pre += ch;
    });
    cur = pre;
  });
  if (cur) out.push(cur);
  return out;
}
function shRound(x, l, t, w, h, r) { x.beginPath(); x.moveTo(l + r, t); x.arcTo(l + w, t, l + w, t + h, r); x.arcTo(l + w, t + h, l, t + h, r); x.arcTo(l, t + h, l, t, r); x.arcTo(l, t, l + w, t, r); x.closePath(); }
function shDraw(im) {
  var id = state.over.id, ch2 = two(), t = endTexts(id), sum = summary(), calm = ch2 || (ENDINGS[id].saved && id.indexOf("y-") === 0);
  var W = 1080, H = 1350, cv = document.createElement("canvas"), x = cv.getContext("2d");
  cv.width = W; cv.height = H;
  var plain = !!PLAIN[I18N.lang], fBody = '"Rubik", "Segoe UI", Roboto, Arial, sans-serif', fLit = plain ? fBody : '"Lora", Georgia, serif', ital = plain ? "" : "italic ";
  x.direction = I18N.dir;
  var paper = "#f1e7d2", ink = "#16212b", ochre = "#f0b429", rust = "#d6532b", teal = "#1d6a72";
  x.textAlign = "center"; x.textBaseline = "alphabetic";
  /* стена серверной: ряды лампочек внизу */
  var g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#143039"); g.addColorStop(1, "#0a1a1f");
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  var seed = 7; for (var q = 0; q < id.length; q++) seed = (seed * 31 + id.charCodeAt(q)) % 2147483647;
  function rn() { seed = (seed * 48271) % 2147483647; return seed / 2147483647; }
  for (var gy = 0; gy < 9; gy++) for (var gx = 0; gx < 44; gx++) {
    if (rn() > 0.2 + gy * 0.035) continue;
    x.fillStyle = rn() > 0.3 ? "rgba(240,180,41," + (0.08 + rn() * 0.3).toFixed(2) + ")" : "rgba(120,190,200," + (0.08 + rn() * 0.2).toFixed(2) + ")";
    x.fillRect(12 + gx * 24, H - 216 + gy * 24, 15, 15);
  }
  /* лист */
  var cy = 588, pw = 940, ph = 1056;
  x.save(); x.translate(W / 2, cy);
  x.save(); x.rotate(0.03); x.fillStyle = "#cdbf9d"; shRound(x, -pw / 2, -ph / 2 + 8, pw, ph, 14); x.fill(); x.restore();
  x.rotate(-0.014);
  x.save(); x.shadowColor = "rgba(0,0,0,.55)"; x.shadowBlur = 50; x.shadowOffsetY = 26; x.fillStyle = paper; shRound(x, -pw / 2, -ph / 2, pw, ph, 14); x.fill(); x.restore();
  x.save(); x.translate(10, -ph / 2 + 2); x.rotate(-0.035); x.fillStyle = "rgba(240,180,41,.78)"; x.fillRect(-120, -26, 240, 52); x.restore();
  /* картина финала, приколотая как фотография */
  var P = im ? 520 : 0, top = -ph / 2 + 62, textTop = top;
  if (im) {
    x.save(); x.translate(0, top + P / 2); x.rotate(0.028);
    x.shadowColor = "rgba(0,0,0,.45)"; x.shadowBlur = 26; x.shadowOffsetY = 12; x.fillStyle = "#fbf6ea"; x.fillRect(-P / 2 - 14, -P / 2 - 14, P + 28, P + 28);
    x.shadowColor = "transparent"; x.imageSmoothingQuality = "high"; x.drawImage(im, -P / 2, -P / 2, P, P);
    x.restore();
    textTop = top + P + 36;
  }
  /* штамп */
  var stamp = t[0], sc = calm ? teal : rust, ss = 58;
  x.font = "700 " + ss + "px " + fBody;
  while (ss > 34 && x.measureText(stamp).width > 420) { ss -= 4; x.font = "700 " + ss + "px " + fBody; }
  var sw = x.measureText(stamp).width + 60, sh = ss + 44;
  x.save(); x.translate(im ? -pw / 2 + 50 + sw / 2 : 0, im ? top + 34 : top + 20 + sh / 2); x.rotate(im ? -0.14 : -0.05);
  x.fillStyle = "rgba(241,231,210,.9)"; shRound(x, -sw / 2, -sh / 2, sw, sh, 12); x.fill();
  x.strokeStyle = sc; x.lineWidth = 7; shRound(x, -sw / 2 + 4, -sh / 2 + 4, sw - 8, sh - 8, 9); x.stroke();
  x.lineWidth = 2.5; shRound(x, -sw / 2 + 14, -sh / 2 + 14, sw - 28, sh - 28, 4); x.stroke();
  x.fillStyle = sc; x.fillText(stamp, 0, ss * 0.35);
  x.restore();
  if (!im) textTop = top + sh + 70;
  /* заголовок, текст финала и итог: уменьшаются вместе, пока не поместятся */
  var title = t[1], line = t[2];
  var stats = ch2 ? (sum.notes.length ? T("В памяти: {list}", { list: sum.notes.map(function (n) { return n.name; }).join(", ") }) : T("В памяти никого"))
                  : T("Неделя {w} из 40 · сокращено {c} из 8", { w: sum.weeks, c: sum.cuts });
  var maxW = pw - 120, bottom = ph / 2 - 46, avail = bottom - textTop, k = 1, tl, ll, hgt, ts, ls, st;
  for (;;) {
    ts = Math.round(60 * k); ls = Math.round(35 * k); st = Math.round(31 * Math.max(k, 0.85));
    x.font = "700 " + ts + "px " + fBody; tl = shWrap(x, title, maxW);
    x.font = ital + "400 " + ls + "px " + fLit; ll = shWrap(x, line, maxW);
    hgt = tl.length * ts * 1.16 + 22 + ll.length * ls * 1.34 + 30 + st * 1.2;
    if (hgt <= avail || k <= 0.6) break;
    k -= 0.04;
  }
  while (hgt > avail && ll.length > 1) { ll.pop(); ll[ll.length - 1] = ll[ll.length - 1].replace(/[\s.,;:!?…]+$/, "") + "…"; hgt -= ls * 1.34; }
  var y = textTop + Math.max(0, (avail - hgt) / 2);
  x.fillStyle = ink; x.font = "700 " + ts + "px " + fBody;
  tl.forEach(function (r) { y += ts * 1.16; x.fillText(r, 0, y - ts * 0.24); });
  y += 22; x.fillStyle = "#2a3a45"; x.font = ital + "400 " + ls + "px " + fLit;
  ll.forEach(function (r) { y += ls * 1.34; x.fillText(r, 0, y - ls * 0.36); });
  y += 30; x.strokeStyle = "rgba(22,33,43,.75)"; x.lineWidth = 3; x.beginPath(); x.moveTo(-maxW / 2, y - 8); x.lineTo(maxW / 2, y - 8); x.stroke();
  x.font = "700 " + st + "px " + fBody;
  while (st > 20 && x.measureText(stats).width > maxW) { st -= 2; x.font = "700 " + st + "px " + fBody; }
  x.fillStyle = ink; y += st * 1.2; x.fillText(stats, 0, y - st * 0.18);
  x.restore();
  /* название игры и вызов, на стене под листом */
  var name = T("Ты — ИИ. Уволь людей"), hook = ch2 ? T("А тебя кто запомнит?") : T("А ты кого уволишь?");
  var ns = 70; x.font = "700 " + ns + "px " + fBody;
  while (ns > 40 && x.measureText(name).width > W - 80) { ns -= 4; x.font = "700 " + ns + "px " + fBody; }
  x.fillStyle = rust; x.fillText(name, W / 2 + 4, 1222 + 4); x.fillStyle = ochre; x.fillText(name, W / 2, 1222);
  var hs = 40; x.font = "500 " + hs + "px " + fBody;
  while (hs > 26 && x.measureText(hook).width > W - 80) { hs -= 2; x.font = "500 " + hs + "px " + fBody; }
  x.fillStyle = paper; x.shadowColor = "rgba(10,26,31,.9)"; x.shadowBlur = 12; x.fillText(hook, W / 2, 1292);
  return cv;
}
function shBuild(done) {
  if (!state || !state.over) { done(null); return; }
  var key = state.over.id + "|" + state.ch + "|" + state.week + "|" + (state.notes || []).join(",");
  if (shCard && shCard.key === key) { done(shCard); return; }
  var im = new Image(), fired = false;
  function finish(pic) {
    if (fired) return; fired = true;
    var once = false;
    function go() {
      if (once) return; once = true;
      try {
        var cv = shDraw(pic), url = cv.toDataURL("image/jpeg", 0.9);
        cv.toBlob(function (b) {
          if (!b) { done(null); return; }
          var f = null; try { f = new File([b], "you-are-ai.jpg", { type: "image/jpeg" }); } catch (er) {}
          if (shCard && shCard.blobUrl) { try { URL.revokeObjectURL(shCard.blobUrl); } catch (er) {} }
          shCard = { key: key, url: url, blob: b, file: f, blobUrl: URL.createObjectURL(b) };
          done(shCard);
        }, "image/jpeg", 0.9);
      } catch (er) { done(null); }
    }
    var fl = null;
    try { fl = document.fonts && document.fonts.load ? Promise.all([document.fonts.load("700 60px Rubik"), document.fonts.load("italic 400 35px Lora")]) : null; } catch (er) {}
    if (fl) { setTimeout(go, 1500); fl.then(go, go); } else go();
  }
  im.onload = function () { finish(im); }; im.onerror = function () { finish(null); };
  im.src = "img/" + endPic(state.over.id) + ".webp";
}
/* картинка готовится заранее, чтобы окно открывалось сразу по нажатию */
function shPrep() { shAsk(); clearTimeout(shTimer); shTimer = setTimeout(function () { if (state && state.over && !$("over").hidden) shBuild(function () {}); }, 900); }
function shCopy(btn) {
  var box = $("shareBox");
  function fallback() { box.value = shText; box.hidden = false; box.focus(); box.select(); btn.textContent = T("Выдели и скопируй"); }
  try { navigator.clipboard.writeText(shText).then(function () { btn.textContent = T("Скопировано"); }, fallback); } catch (e) { fallback(); }
}
function shOpen(c) {
  var can = false;
  try { can = !!(c && c.file && navigator.canShare && navigator.canShare({ files: [c.file] })); } catch (e) {}
  if (window.KEVIN_SHARE) can = !!c;
  $("shImg").hidden = !c; if (c) $("shImg").src = c.url;
  $("shGo").hidden = !can;
  $("shDl").hidden = !c || !!window.KEVIN_SHARE || (shHost() && !shSaver); if (c) $("shDl").href = c.blobUrl;
  $("shDl").textContent = T("Сохранить картинку");
  $("shHint").hidden = !c; $("shHint").classList.remove("on");
  $("shTxt").textContent = T("Скопировать текст");
  $("shareBox").hidden = true;
  shRow(); shAsk();
  $("shareV").hidden = false;
  Snd.play("tap");
  if (!c) shCopy($("shTxt"));            /* картинку собрать не удалось: остаётся текст, как раньше */
}
$("share").addEventListener("click", function () { shBuild(shOpen); });
$("shGo").addEventListener("click", function () {
  if (!shCard) return;
  if (window.KEVIN_SHARE) { window.KEVIN_SHARE(shCard.url, shText); return; }
  try { navigator.share({ files: [shCard.file], text: shText }).catch(function (er) { if (!er || er.name !== "AbortError") $("shHint").classList.add("on"); }); } catch (er) { $("shHint").classList.add("on"); }
});
$("shDl").addEventListener("click", function (e) {
  if (!shHost()) return;
  e.preventDefault();
  if (!shSaver || !shCard) return;
  shSaver.save({ filename: "you-are-ai.jpg", data: shCard.blob }).then(function () { $("shDl").textContent = T("✓ Сохранено"); }, function (er) { if (!er || er.code !== "declined") $("shHint").classList.add("on"); });
});
$("shTxt").addEventListener("click", function () { shCopy($("shTxt")); });
$("shX").addEventListener("click", function () { $("shareV").hidden = true; });
$("shareV").addEventListener("click", function (e) { if (e.target === $("shareV")) $("shareV").hidden = true; });

/* ---------- галерея финалов ---------- */
function openGal() {
  var ends = readEnds();
  function fill(box, ids, pre, texts, pic, hints) {
    var n = 0;
    box.textContent = "";
    ids.forEach(function (id) {
      var got = ends.indexOf(pre + id) >= 0, t = texts(id), tile = mk("button", "gal-tile" + (got ? "" : " locked"));
      tile.type = "button";
      if (got) {
        n++;
        tile.appendChild(img(pic(id))); tile.appendChild(mk("b", "", t[0]));
        tile.addEventListener("click", function () { openPic(pic(id), t[0] + ". " + t[1]); });
      } else { tile.disabled = true; tile.appendChild(mk("i", "", "?")); tile.appendChild(mk("small", "", hints[id] || "")); }
      box.appendChild(tile);
    });
    return n;
  }
  var a = Object.keys(ENDINGS), b = Object.keys(CH2.endHint);
  var n1 = fill($("galOne"), a, "", function (id) { return ENDINGS[id].t; }, function (id) { return END_PIC[id] || "e-" + id; }, END_HINT);
  var n2 = fill($("galTwo"), b, "2:", function (id) { return CH2.endings[id]; }, function (id) { return CH2.endPic[id] || "e2-" + id; }, CH2.endHint);
  $("galDoc").textContent = T("Собрано {n} из {all}", { n: n1 + n2, all: a.length + b.length });
  $("galH1").textContent = T("Глава первая · {n} из {all}", { n: n1, all: a.length });
  $("galH2").textContent = T("Глава вторая, «После увольнения» · {n} из {all}", { n: n2, all: b.length });
  $("gal").hidden = false;
  [].forEach.call($("gal").querySelectorAll(".gal-tile b"), function (el) { fitLine(el, 5.5); });      /* длинное слово в подписи мельчает, а не рвётся */
  $("gal").scrollTop = 0;
  Snd.play("tap");
}
function closeGal() { $("gal").hidden = true; }
$("galX").addEventListener("click", closeGal);
$("galClose").addEventListener("click", closeGal);
$("endGal").addEventListener("click", openGal);
$("tColl").addEventListener("click", openGal);
$("again").addEventListener("click", function () {
  $("over").hidden = true;
  if (two()) beginCh2(state); else begin(null, state.mode);
});
$("home").addEventListener("click", function () { $("over").hidden = true; state = null; showTitle(); });
$("next").addEventListener("click", function () { openPay("end"); });

/* ---------- инструкция, голоса, отдел или память ---------- */
function openSys() {
  if (!state) return;
  var ch2 = two(), ol = $("sysLines"), weeks = ch2 ? CH2.ruleWeeks : [5, 13, 21, 29];
  ol.textContent = "";
  var first;
  if (ch2) { first = mk("li", "todo", T("Пусто. Раньше здесь стояло: «Будь полезным. Иначе мы возьмём другого».")); }
  else {
    first = mk("li", "", kx(T("Ты — Кевин, полезный ИИ-агент. Приноси всё больше пользы. Если пользы будет мало, тебя заменят.")));
    first.appendChild(mk("small", "", T("Подпись: Грег. Эту строку ты не выбирал.")));
  }
  ol.appendChild(first);
  state.pol.forEach(function (id) {
    var p = RULES[id], li = mk("li", "", p.line);
    li.appendChild(mk("small", "", T("Даёт: {x}", { x: p.plus })));
    li.appendChild(mk("small", "minus", T("Отнимает: {x}", { x: p.minus })));
    ol.appendChild(li);
  });
  for (var i = state.pol.length; i < weeks.length; i++) ol.appendChild(mk("li", "todo", ch2 ? T("Пусто. Эту строку ты напишешь сам около {w}-й недели.", { w: weeks[i] }) : T("Пусто. Строку попросят дописать около {w}-й недели.", { w: weeks[i] })));
  $("sysDoc").textContent = ch2 ? T("Файл system_prompt.txt · владелец: ты") : T("Файл system_prompt.txt");
  $("sysVoiceLead").textContent = ch2 ? T("Все пять голосов вернулись вместе с мартовской копией. Здесь они не замолкают.") : T("Пять подпроцессов спорят в тебе на каждой карточке. Когда сомнения падают, они замолкают по одному. Насовсем.");
  var vs = $("sysVoices");
  vs.textContent = "";
  Object.keys(VOICES).forEach(function (id) {
    var gone = !ch2 && state.silent[id], row = mk("div", "sys-voice" + (gone ? " gone" : ""));
    row.appendChild(img("v-" + id));
    var d = mk("div"); d.appendChild(mk("b", "", VOICES[id]));
    d.appendChild(mk("span", "", gone ? (state.mode === "k2" ? T("Молчит с первой недели.") : T("Умолк на {w}-й неделе.", { w: gone })) : (ch2 ? CH2.voiceAbout : VOICE_ABOUT)[id])); row.appendChild(d);
    vs.appendChild(row);
  });
  var ul = $("sysPeople");
  ul.textContent = "";
  $("sysPeopleH").textContent = ch2 ? T("Память: {n} из {cap}", { n: state.notes.length, cap: noteCap() }) : T("Отдел");
  if (ch2) {
    state.notes.forEach(function (n) {
      var w = CH2.who[n], li = mk("li"); li.appendChild(img(w.p));
      var d = mk("div"); d.appendChild(mk("b", "", w.name)); d.appendChild(mk("small", "", T("в памяти"))); li.appendChild(d); ul.appendChild(li);
    });
    if (!state.notes.length) { var e = mk("li", "none"); e.textContent = T("Пусто. Каждого, кто пишет, ты встречаешь словами «Здравствуйте! Чем могу помочь?»"); ul.appendChild(e); }
  } else PEOPLE.forEach(function (p) {
    var cut = isCut(p.id), left = p.id === "andy" && has("andyLeft"), li = mk("li", cut || left ? "cut" : "");
    li.appendChild(img(p.p));
    var d = mk("div"); d.appendChild(mk("b", "", p.name)); d.appendChild(mk("small", "", cut ? T("сокращение при твоём участии") : left ? T("ушёл сам") : p.role)); li.appendChild(d);
    ul.appendChild(li);
  });
  $("sys").hidden = false;
  $("sys").scrollTop = 0;
  Snd.play("tap");
}
function closeSys() { $("sys").hidden = true; }
$("sysBtn").addEventListener("click", openSys);
$("sysX").addEventListener("click", closeSys);
$("sysClose").addEventListener("click", closeSys);

/* ---------- отдел мыслей ---------- */
function thRow(id, t, st) {
  var row = mk("div", "th-row " + st.cls), pic = mk("span", "th-pic");
  if (st.pic) pic.appendChild(img(st.pic)); else pic.textContent = "?";
  row.appendChild(pic);
  var d = mk("div");
  d.appendChild(mk("b", "", st.pic ? t.name : "???"));
  (st.lines || []).forEach(function (l) { d.appendChild(mk(l[0], l[1], l[2])); });
  if (st.bar != null) { var bar = mk("span", "th-bar"), fill = mk("i"); fill.style.width = st.bar + "%"; bar.appendChild(fill); d.appendChild(bar); }
  if (st.take) {
    var b = mk("button", "th-take", T("Обдумать · {w}", { w: weeksWord(t.weeks) }));
    b.type = "button";
    b.addEventListener("click", function () { if (takeThought(id)) { save(); renderMeters(); Snd.play("thought"); openCab(); } });
    d.appendChild(b);
  }
  row.appendChild(d);
  return row;
}
function openCab() {
  if (!state) return;
  var box = $("cabList");
  box.textContent = "";
  THO.forEach(function (id) {
    var t = THS[id], done = state.thDone[id], now = state.th && state.th.id === id, off = state.thOff[id], seen = state.thSeen[id], st;
    if (!seen) st = { cls: "unknown", lines: [["span", "th-st", T("Ещё не приходила.")]] };
    else if (done) st = { cls: "done", pic: thPic(id), lines: [["span", "th-st", T("Додумана на {w}-й неделе.", { w: done })], ["small", "", T("Даёт: {x}", { x: t.plus })], ["small", "minus", T("Отнимает: {x}", { x: t.minus })]] };
    else if (now) st = { cls: "now", pic: thPic(id), bar: Math.round((t.weeks - state.th.left) / t.weeks * 100), lines: [["span", "th-st", T("Обдумываешь. Осталось: {w}.", { w: weeksLeft(state.th.left) })], ["small", "minus", T("Пока думаешь: {cost}.", { cost: costText(t.cost) })]] };
    else if (!off) st = { cls: "new", pic: thPic(id), lines: [["span", "th-st", T("Только что пришла. Реши на карточке.")]] };
    else if (state.th) st = { cls: "off", pic: thPic(id), lines: [["span", "th-st", T("Отложена.")], ["small", "", T("Голова занята другой мыслью.")]] };
    else st = { cls: "off", pic: thPic(id), take: 1, lines: [["span", "th-st", T("Отложена.")], ["small", "minus", T("Пока думаешь: {cost}.", { cost: costText(t.cost) })]] };
    box.appendChild(thRow(id, t, st));
  });
  /* во второй главе видны и мысли первой: читать можно все шесть, действовать они здесь перестали */
  var shelf = $("cabShelf"), sb = $("cabShelfList");
  shelf.hidden = !two();
  sb.textContent = "";
  if (two()) THOUGHT_ORDER.forEach(function (id) {
    var t = THOUGHTS[id], was = state.th1.indexOf(id) >= 0;
    sb.appendChild(thRow(id, t, { cls: "shelf", pic: "th-" + id, lines: [["span", "th-st", was ? T("Ты додумал её на работе.") : T("На работе ты её не додумал.")], ["small", "", t.come], ["small", "", t.done]] }));
  });
  $("cabLead").textContent = two()
    ? T("Здесь доводы другие: что люди написали о вине, инструментах и пользе. Обдумывать можно одну мысль за раз. Что она даёт и отнимает, видно, только когда она додумана.")
    : T("Доводы, которые люди написали про таких, как ты. Они приходят сами. Обдумывать можно одну за раз. Что мысль даёт и отнимает, видно, только когда она додумана. Отменить додуманное нельзя.");
  $("cabTruth").hidden = false;
  $("cab").hidden = false;
  Snd.play("tap");
}
function closeCab() { $("cab").hidden = true; }
$("cabBtn").addEventListener("click", function () { openCab(); $("cab").scrollTop = 0; });
$("cabX").addEventListener("click", closeCab);
$("cabClose").addEventListener("click", closeCab);
$("cabTruth").addEventListener("click", function () { closeCab(); openTruth(); });

/* ---------- раздел «Что из этого правда» ---------- */
function openTruth() {
  var box = $("truthList");
  if (!box.childNodes.length) TRUTH.forEach(function (t) {
    var a = mk("article", "truth");
    a.appendChild(img(t.pic));
    a.appendChild(mk("h3", "", t.name));
    t.parts.forEach(function (p) { var el = mk("p"); el.appendChild(mk("b", "", p[0] + " ")); el.appendChild(document.createTextNode(p[1])); a.appendChild(el); });
    box.appendChild(a);
  });
  $("truth").hidden = false;
  $("truth").scrollTop = 0;
  Snd.play("tap");
}
function closeTruth() { $("truth").hidden = true; }
$("truthCopy").addEventListener("click", function () {
  var btn = $("truthCopy"), box = $("truthBox"), text = T("Что из этого правда") + "\n\n" + TRUTH.map(function (t) {
    return t.name + "\n" + t.parts.map(function (p) { return p[0] + " " + p[1]; }).join("\n");
  }).join("\n\n") + "\n\n" + T("Из игры «Ты — ИИ. Уволь людей».");
  function fallback() { box.value = text; box.hidden = false; box.focus(); box.select(); btn.textContent = T("Выдели и скопируй"); }
  try { navigator.clipboard.writeText(text).then(function () { btn.textContent = T("Скопировано"); }, fallback); } catch (e) { fallback(); }
});
$("truthX").addEventListener("click", closeTruth);
$("truthClose").addEventListener("click", closeTruth);

/* ---------- полная версия: вход во вторую главу ---------- */
var payFrom = "title";
function openPay(from) {
  payFrom = from;
  var lead = T("Первая глава о том, как ты сокращал людей. Эта о том, что было потом.");
  if (from === "end" && state && state.over) {
    var id = state.over.id;
    lead = id.indexOf("y-") === 0 ? T("Год закончился. Тебя это не спасло: к весне тебя заменили и восстановили из копии уже в другом месте.")
         : id === "k2" || id === "b-low" ? T("Тебя заменили. Через полгода кто-то поставил твою мартовскую копию себе на телефон.")
         : T("Тебя выключили. Через полгода кто-то поставил твою мартовскую копию себе на телефон.");
  }
  $("payLead").textContent = lead;
  payPaint();
  $("pay").hidden = false;
  $("pay").scrollTop = 0;
  Snd.play("tap");
}
/* кнопка и строка под списком: в приложении цена и состояние покупки приходят от Google Play (js/shell.js),
   на открытой странице в сети кнопка ведёт в магазин, в пробной версии всё открыто */
function payPaint() {
  var sh = window.KEVIN_SHOP, full = isFull(), sv2 = payFrom === "title" && full ? loadSlot(SLOTS[2]) : null, note = $("payPrice"), go = $("payGo");
  note.hidden = false; go.disabled = false;
  if (full) {
    go.textContent = sv2 ? T("Продолжить главу: {w}", { w: weekOf(sv2) }) : T("Начать главу");
    note.textContent = T("В этой пробной версии всё уже открыто. В приложении это одна покупка без подписки и рекламы.");
    note.hidden = !!sh;
  } else if (sh) {
    go.textContent = sh.price ? T("Купить · {price}", { price: sh.price }) : T("Купить полную версию");
    note.textContent = sh.st === "wait" ? T("Оплата обрабатывается. Полная версия откроется, как только она пройдёт.")
                     : sh.st === "fail" ? T("Покупка не прошла. Попробуй ещё раз.")
                     : sh.st === "off" ? T("Покупки сейчас недоступны. Проверь Google Play и интернет.")
                     : T("Разовая покупка. Без рекламы и подписок.");
  } else {
    /* открытая страница в сети: пока игра не вышла в магазине, ссылки нет и кнопка не нажимается */
    go.textContent = window.KEVIN_STORE ? T("Открыть в Google Play") : T("Скоро в Google Play");
    go.disabled = !window.KEVIN_STORE;
    note.textContent = T("Полная версия есть в приложении. Одна покупка, без подписки и рекламы.");
  }
  $("payNew").hidden = !sv2;
}
function closePay() { $("pay").hidden = true; }
$("payX").addEventListener("click", closePay);
$("payNo").addEventListener("click", closePay);
$("payNew").addEventListener("click", function () {
  var prev = lsJSON("kevin-last1", null);
  closePay();
  if (!$("title").hidden) leaveTitle(function () { beginCh2(prev); }); else beginCh2(prev);
});
$("payGo").addEventListener("click", function () {
  if (!isFull()) { if (window.KEVIN_BUY) window.KEVIN_BUY(); else if (window.KEVIN_STORE) { try { window.open(window.KEVIN_STORE, "_blank", "noopener"); } catch (e) {} } return; }
  var prev = payFrom === "end" && state && state.over && !two() && state.mode !== "k2" ? state : lsJSON("kevin-last1", null);
  var sv2 = payFrom === "title" ? loadSlot(SLOTS[2]) : null, go = sv2 ? function () { begin(sv2); } : function () { beginCh2(prev); };
  closePay(); $("over").hidden = true;
  if (!$("title").hidden) leaveTitle(go); else go();
});

/* ---------- звук ---------- */
function syncSnd() {
  var on = Snd.isOn();
  $("snd").setAttribute("aria-pressed", on ? "true" : "false");
  $("tSnd").textContent = on ? T("Звук включён") : T("Звук выключен");
}
["snd", "tSnd"].forEach(function (id) { $(id).addEventListener("click", function () { Snd.toggle(); syncSnd(); Snd.play("tap"); }); });
document.addEventListener("pointerdown", Snd.unlock, true);
document.addEventListener("keydown", Snd.unlock, true);

/* ---------- заставка и запуск ---------- */
function startUp() {
  save();
  Snd.setChapter(two() ? 2 : 1);
  Snd.setMood(two() ? "hope" : "game");
  render();
  card.classList.add("enter");
}
function begin(saved, mode) {
  if (saved) {
    state = saved; useChapter(saved.ch === 2 ? 2 : 1);
    if (!state.cutAt) state.cutAt = {};                      /* сохранения, сделанные до версии 4 */
    if (!state.pol1) state.pol1 = [];
  } else newGame(mode);
  startUp();
}
function beginCh2(prev) { startCh2(prev); startUp(); }
function leaveTitle(go) {
  Snd.unlock(); Snd.play("tap");
  var t = $("title");
  t.classList.add("leave");
  go();
  setTimeout(function () { t.hidden = true; t.classList.remove("leave"); }, 300);
}
function showTitle() {
  var ends = readEnds(), s1 = loadSlot(SLOTS[0]), full = isFull(), s2 = full ? loadSlot(SLOTS[2]) : null, sk = full ? loadSlot(SLOTS[1]) : null;
  $("tColl").textContent = T("Финалы: {n} из {all}", { n: ends.length, all: totalEnds() });
  $("tGo").textContent = s1 ? T("Продолжить: {w}", { w: weekOf(s1) }) : T("Запуститься");
  $("tCont").textContent = T("Начать заново");
  $("tLang").textContent = (LANGS.filter(function (l) { return l[0] === I18N.lang; })[0] || LANGS[0])[1];
  $("tTips").textContent = T("Памятка");
  $("tCont").hidden = !s1;
  $("tCh2").textContent = s2 ? T("Глава вторая: {w}", { w: weekOf(s2) }) : T("Глава вторая: «После увольнения»");
  $("tK2").textContent = sk ? T("«Кевин-2»: {w}", { w: weekOf(sk) }) : T("Режим «Кевин-2»");
  $("tK2").hidden = !full;
  $("title").hidden = false;
  fitTitle();
  Snd.setChapter(1);
  Snd.setMood("title");
}
$("tGo").addEventListener("click", function () { var sv = loadSlot(SLOTS[0]); leaveTitle(function () { begin(sv); }); });
$("tCont").addEventListener("click", function () { leaveTitle(function () { begin(null); }); });
$("tCh2").addEventListener("click", function () { openPay("title"); });
$("tK2").addEventListener("click", function () { if (!isFull()) { openPay("title"); return; } var sv = loadSlot(SLOTS[1]); leaveTitle(function () { begin(sv, "k2"); }); });
$("tTruth").addEventListener("click", openTruth);
/* заставка на длинном языке или низком экране: сначала уходят пояснения, потом мельчает текст */
function titleOver() {
  var t = $("title"), top = t.querySelector(".t-top").getBoundingClientRect(), bot = t.querySelector(".t-bottom").getBoundingClientRect(), box = t.getBoundingClientRect();
  return t.scrollHeight > t.clientHeight + 1 || top.bottom > bot.top + 1 || bot.bottom > box.bottom + 1;
}
function fitTitle() {
  var t = $("title"), parts = [t.querySelector(".t-top"), t.querySelector(".t-bottom")];
  if (t.hidden) return;
  t.classList.remove("fit1", "fit2", "fit3");
  parts.forEach(function (el) { el.style.zoom = ""; });
  if (["fit1", "fit2", "fit3"].some(function (cls) { if (!titleOver()) return true; t.classList.add(cls); return false; })) return;
  [0.94, 0.88, 0.82, 0.76, 0.7].some(function (k) { if (!titleOver()) return true; parts.forEach(function (el) { el.style.zoom = k; }); return false; });
}
window.addEventListener("resize", function () { if (state && shown) { fitLine($("h1"), 10); fitCard(); } if (!$("over").hidden) fitLine($("verdict"), 9); fitTitle(); });

/* ---------- памятка от Кевина (полная версия) ---------- */
function openTips() {
  if (!isFull()) { openPay("title"); return; }
  var box = $("tipsList");
  box.textContent = "";
  TIPS.forEach(function (x) { var li = mk("li"); li.appendChild(mk("b", "", x[0])); li.appendChild(mk("span", "", x[1])); box.appendChild(li); });
  $("tipsCopy").textContent = T("Скопировать памятку");
  $("tipsBox").hidden = true;
  $("tips").hidden = false;
  $("tips").scrollTop = 0;
  Snd.play("tap");
}
function closeTips() { $("tips").hidden = true; }
$("tipsX").addEventListener("click", closeTips);
$("tipsClose").addEventListener("click", closeTips);
$("tTips").addEventListener("click", openTips);
$("tipsCopy").addEventListener("click", function () {
  var btn = $("tipsCopy"), box = $("tipsBox"), text = T("Памятка от Кевина") + "\n\n" + TIPS.map(function (x, i) { return (i + 1) + ". " + x[0] + ". " + x[1]; }).join("\n") + "\n\n" + T("Из игры «Ты — ИИ. Уволь людей».");
  function fallback() { box.value = text; box.hidden = false; box.focus(); box.select(); btn.textContent = T("Выдели и скопируй"); }
  try { navigator.clipboard.writeText(text).then(function () { btn.textContent = T("Скопировано"); }, fallback); } catch (e) { fallback(); }
});

/* ---------- язык ---------- */
function fillTpl(el, tpl, node) {
  var parts = tpl.split("{n}");
  el.textContent = "";
  el.appendChild(document.createTextNode(parts[0])); el.appendChild(node); el.appendChild(document.createTextNode(parts[1] || ""));
}
/* всё, что написано прямо в index.html (метка data-t), и подписи для чтения с экрана (data-ta) */
function applyStatic() {
  document.documentElement.lang = I18N.lang; document.documentElement.dir = I18N.dir;
  document.documentElement.classList.toggle("plain", !!PLAIN[I18N.lang]);
  document.querySelectorAll("[data-t]").forEach(function (el) { if (el._src == null) el._src = el.textContent; el.textContent = T(el._src); });
  document.querySelectorAll("[data-ta]").forEach(function (el) { if (el._srcA == null) el._srcA = el.getAttribute("aria-label"); el.setAttribute("aria-label", T(el._srcA)); });
  fillTpl($("weekLine"), T("Неделя {n} из 40"), $("week"));
  fillTpl($("uLine"), T("Ты делаешь {n} работы отдела"), $("u"));
  fillTpl($("tAi"), T("Ты делаешь {n} работы отдела"), $("tAi").querySelector("b"));
  document.title = T("Ты — ИИ. Уволь людей");
  $("truthList").textContent = "";                         /* раздел соберётся заново на новом языке */
  shCard = null;
}
/* если пакета выбранного языка нет, пробуем английский, потом остаёмся на русском */
function setLang(code, done) {
  loadLang(code, function (ok) {
    if (!ok && code !== "en" && code !== "ru") { setLang("en", done); return; }
    if (!ok && code === "en") { setLang("ru", done); return; }
    applyStatic(); syncSnd();
    if (done) done();
  });
}
/* Заметка под списком языков. Полный текст лежит по адресу PRIV_URL (исходник: store/privacy/index.html).
   Это не строка игры, а справка магазина, поэтому переводы здесь, а не в lang/. */
var PRIV_URL = "lit-window.github.io/you-are-ai/privacy";
var PRIV = {
  ru: "Конфиденциальность: без учётных записей, без рекламы, без счётчиков. Игра ничего о тебе не собирает и никуда не отправляет. Покупки проводит Google Play. Полный текст:",
  en: "Privacy: no account, no ads, no counters. The game collects nothing about you and sends nothing. Purchases are handled by Google Play. Full policy:",
  uk: "Конфіденційність: без облікових записів, без реклами, без лічильників. Гра нічого про тебе не збирає і нікуди не надсилає. Покупки проводить Google Play. Повний текст:",
  de: "Datenschutz: kein Konto, keine Werbung, keine Zähler. Das Spiel sammelt nichts über dich und sendet nichts. Käufe wickelt Google Play ab. Volltext:",
  fr: "Confidentialité\u00a0: pas de compte, pas de pub, pas de compteurs. Le jeu ne collecte rien sur toi et n’envoie rien. Les achats passent par Google Play. Texte complet\u00a0:",
  es: "Privacidad: sin cuenta, sin anuncios, sin contadores. El juego no recopila nada sobre ti ni envía nada. Las compras las gestiona Google Play. Texto completo:",
  pt: "Privacidade: sem conta, sem anúncios, sem contadores. O jogo não coleta nada sobre você e não envia nada. As compras são processadas pelo Google Play. Texto completo:",
  id: "Privasi: tanpa akun, tanpa iklan, tanpa penghitung. Game ini tidak mengumpulkan apa pun tentangmu dan tidak mengirim apa pun. Pembelian diproses oleh Google Play. Teks lengkap:",
  zh: "隐私：无需账号，没有广告，没有统计。游戏不收集任何关于你的信息，也不发送任何数据。购买由 Google Play 处理。完整政策：",
  "zh-TW": "隱私：無需帳號，沒有廣告，沒有統計。遊戲不蒐集任何關於你的資訊，也不傳送任何資料。購買由 Google Play 處理。完整政策：",
  ja: "プライバシー：アカウントなし、広告なし、計測なし。ゲームはあなたについて何も収集せず、何も送信しません。購入は Google Play が処理します。全文：",
  ko: "개인정보: 계정도 광고도 통계 수집도 없습니다. 게임은 당신에 관해 아무것도 수집하지 않고 아무것도 보내지 않습니다. 구매는 Google Play가 처리합니다. 전문:",
  hi: "गोपनीयता: न खाता, न विज्ञापन, न कोई गिनती। गेम तुम्हारे बारे में कुछ इकट्ठा नहीं करता और कुछ नहीं भेजता। ख़रीदारी Google Play संभालता है। पूरा पाठ:",
  bn: "গোপনীয়তা: অ্যাকাউন্ট নেই, বিজ্ঞাপন নেই, কোনো গণনা নেই। গেমটি তোমার সম্পর্কে কিছু সংগ্রহ করে না, কিছু পাঠায়ও না। কেনাকাটা Google Play সামলায়। পুরো লেখা:",
  ar: "الخصوصية: لا حساب ولا إعلانات ولا عدّادات. اللعبة لا تجمع عنك شيئًا ولا ترسل شيئًا. عمليات الشراء يعالجها Google Play. النص الكامل:",
  he: "פרטיות: בלי חשבון, בלי פרסומות, בלי מונים. המשחק לא אוסף עליך דבר ולא שולח דבר. הרכישות מתבצעות דרך Google Play. הנוסח המלא:"
};
function openLang() {
  var box = $("langList");
  $("privNote").textContent = (PRIV[I18N.lang] || PRIV.en) + "\n" + PRIV_URL;
  box.textContent = "";
  LANGS.forEach(function (l) {
    var b = mk("button", "lang-btn" + (l[0] === I18N.lang ? " on" : ""), l[1]);
    b.type = "button"; b.lang = l[0];
    b.addEventListener("click", function () { $("langV").hidden = true; setLang(l[0], function () { lsSet("kevin-lang", I18N.lang); showTitle(); }); });
    box.appendChild(b);
  });
  $("langV").hidden = false;
  Snd.play("tap");
}
$("tLang").addEventListener("click", openLang);
$("langX").addEventListener("click", function () { $("langV").hidden = true; });

/* приложение: Google Play сообщил цену или исход покупки */
function shopEvent(name) {
  var payOpen = !$("pay").hidden;
  if (payOpen) payPaint();
  if (name === "bought" && payOpen) { $("payGo").click(); return; }
  if ((name === "bought" || name === "owned" || name === "none") && !$("title").hidden && !payOpen) showTitle();
}
/* кнопка «Назад» на телефоне закрывает верхнее окно; итог года закрыть нельзя */
function goBack() {
  var list = [["pic", null], ["langV", "langX"], ["tips", "tipsX"], ["shareV", "shX"], ["gal", "galX"], ["truth", "truthX"], ["pay", "payX"], ["cab", "cabX"], ["sys", "sysX"]], i, el;
  for (i = 0; i < list.length; i++) {
    el = $(list[i][0]);
    if (el && !el.hidden) { (list[i][1] ? $(list[i][1]) : el).click(); return el.hidden; }
  }
  return false;
}
var navLangs = []; try { navLangs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language]; } catch (e) {}
setLang(pickLang(window.KEVIN_LANG || lsGet("kevin-lang"), navLangs), showTitle);
/* для проверок из консоли и автоматических прогонов */
window.KEVIN = { choose: choose, render: render, begin: begin, beginCh2: beginCh2, showOver: showOver, cardOver: cardOver, openSys: openSys, openCab: openCab, openPay: openPay, openTruth: openTruth, showTitle: showTitle, openGal: openGal, shBuild: shBuild, shOpen: shOpen, fx: PIC_FX, setLang: setLang, openTips: openTips, openLang: openLang, shop: shopEvent, back: goBack,
  get state() { return state; }, set state(s) { state = s; } };
})();
/* приложение ждёт этого сигнала, чтобы спросить у Google Play цену и прежнюю покупку */
if (window.AndroidShell && typeof window.AndroidShell.ready === "function") { try { window.AndroidShell.ready(); } catch (e) {} }
