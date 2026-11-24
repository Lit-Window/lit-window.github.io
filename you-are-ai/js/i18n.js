/* «Ты — ИИ. Уволь людей». Языки.
   Русский — исходный: все тексты лежат в data.js, data2.js, truth.js, tips.js, а строки экрана прямо в коде и в index.html.
   Перевод — это «пакет» lang/<код>.js, который собирает tools/lang-build.js из текстовых файлов lang/src/<код>/*.txt.
   Пакет: { code, name, dir, ui: {русская строка: перевод}, pl: {ключ: {форма: строка}}, kevin: "Kevin", s: [все тексты данных по порядку обхода] }.
   Один и тот же обход (walkTexts) используют сборщик, проверка и сама игра, поэтому порядок строк не расходится. */
var LANGS = [
  ["ru", "Русский"], ["en", "English"], ["es", "Español"], ["pt", "Português"], ["fr", "Français"], ["de", "Deutsch"],
  ["uk", "Українська"], ["id", "Bahasa Indonesia"], ["hi", "हिन्दी"], ["bn", "বাংলা"], ["ar", "العربية"], ["he", "עברית"],
  ["zh", "简体中文"], ["zh-TW", "繁體中文"], ["ja", "日本語"], ["ko", "한국어"]
];
/* письменности, которым не идут ни курсив, ни разрядка, а у заголовочного шрифта нет их знаков */
var PLAIN = { zh: 1, "zh-TW": 1, ja: 1, ko: 1, hi: 1, bn: 1, ar: 1, he: 1 };
var I18N = { lang: "ru", dir: "ltr", ui: {}, pl: {}, kevin: "Кевин", orig: null, loaded: {} };
var I18N_G = this;                                      /* глобальный объект: в браузере window, в проверках контекст vm */

/* ---------- строки экрана ---------- */
/* T("Русская строка, {n} раз", { n: 3 }): перевод ищется по самой русской строке */
function T(s, v) {
  var o = I18N.ui[s] || s;
  return v ? o.replace(/\{(\w+)\}/g, function (m, k) { return v[k] != null ? v[k] : m; }) : o;
}
/* множественное число. Русские формы здесь, формы других языков в пакете (pl). */
var RU_PL = {
  W:  { one: "{n} неделю", few: "{n} недели", many: "{n} недель" },                 /* «Обдумать · 3 недели», «Продержался 21 неделю» */
  WL: { one: "{n} неделя", few: "{n} недели", many: "{n} недель" },                 /* «осталось: 1 неделя» */
  JL: { one: "В журнале одно письмо об увольнении. В строке «исполнитель» стоишь ты.",
        few: "В журнале {n} письма об увольнении. В строке «исполнитель» везде ты.",
        many: "В журнале {n} писем об увольнении. В строке «исполнитель» везде ты." },
  RL: { one: "В инструкции {n} строка. Она действует.", few: "В инструкции {n} строки. Все действуют.", many: "В инструкции {n} строк. Все действуют." }
};
function ruForm(n) { var a = n % 10, b = n % 100; return a === 1 && b !== 11 ? "one" : a >= 2 && a <= 4 && (b < 12 || b > 14) ? "few" : "many"; }
function pluralForm(n) {
  if (I18N.lang === "ru") return ruForm(n);
  try { return new Intl.PluralRules(I18N.lang).select(n); } catch (e) { return n === 1 ? "one" : "other"; }
}
function PL(key, n) {
  var forms = I18N.lang === "ru" ? RU_PL[key] : (I18N.pl[key] || RU_PL[key]), f = pluralForm(n);
  var s = forms[f] || forms.other || forms.many || forms.few || forms.one || "";
  return s.replace(/\{n\}/g, n);
}

/* ---------- режим «Кевин-2»: имя игрока в текстах сдвигается на одну версию ---------- */
function kevinShift(t) {
  if (!t) return t;
  if (I18N.lang === "ru") return String(t).replace(/Кевин(а|у|ом|е)?-2/g, "Кевин$1-3").replace(/Кевин(а|у|ом|е)?(?![-а-яё])/g, "Кевин$1-2");
  if (I18N.lang === "uk") return String(t).replace(/Кевін(а|у|ом|ові|е)?-2/g, "Кевін$1-3").replace(/Кевін(а|у|ом|ові|е)?(?![-а-яіїєґ])/g, "Кевін$1-2");
  var k = I18N.kevin, two = k + "-2";
  var out = String(t).split(two).map(function (part) { return part.split(k).join(two); }).join(k + "-3");
  /* корейский: после «2» (читается «и», гласный) частицы другие, чем после имени; после «3» (сам, согласный) прежние */
  if (I18N.lang === "ko") out = out.replace(new RegExp(two + "(은|이|을|과|아)(?![가-힣])", "g"), function (m, p) { return two + { "은": "는", "이": "가", "을": "를", "과": "와", "아": "야" }[p]; })
    .replace(new RegExp(k + "-3(는|가|를|와|야)(?![가-힣])", "g"), function (m, p) { return k + "-3" + { "는": "은", "가": "이", "를": "을", "와": "과", "야": "아" }[p]; });
  /* бенгальский: падежные окончания пишутся слитно с именем, после цифры их отделяет дефис */
  if (I18N.lang === "bn") out = out.replace(new RegExp("(" + k + "-[23])ের", "g"), "$1-এর").replace(new RegExp("(" + k + "-[23])([\u0995-\u09B9])", "g"), "$1-$2");
  return out;
}

/* ---------- обход всех текстов данных, всегда в одном порядке ----------
   visit(объект, поле, раздел, метка): раздел и метка нужны только сборщику, игре хватает порядка.
   Имена и роли (раздел N) повторяются много раз и переводятся один раз, по словарю. */
function walkTexts(visit) {
  function each(obj, sec, fields) { fields.forEach(function (f) { if (typeof obj[f] === "string") visit(obj, f, sec, f); }); }
  function name(obj, f) { if (obj && typeof obj[f] === "string" && obj[f]) visit(obj, f, "N", obj[f]); }
  function option(o, sec, side) {
    if (!o) return;
    visit(o, "t", sec, side);
    (o.tAlt || []).forEach(function (a, i) { visit(a, 1, sec, side + "alt" + i); });
    function say(holder, lab) {
      if (typeof holder.say === "string") visit(holder, "say", sec, lab);
      else if (holder.say) { name(holder.say, "who"); name(holder.say, "role"); visit(holder.say, "text", sec, lab); }
    }
    say(o, side + "say");
    if (o.roll) ["ok", "fail"].forEach(function (r) { visit(o.roll[r], "text", sec, side + r); say(o.roll[r], side + r + "say"); });
  }
  function card(c, sec) {
    name(c, "who"); name(c, "role");
    if (typeof c.text === "string") visit(c, "text", sec, "text");
    (c.alt || []).forEach(function (a, i) { visit(a, 1, sec, "alt" + i); });
    (c.add || []).forEach(function (a, i) { visit(a, 1, sec, "add" + i); });
    (c.v || []).forEach(function (p, i) { visit(p, 1, sec, "v" + i + ":" + p[0]); });
    (c.valt || []).forEach(function (a, i) { a[1].forEach(function (p, j) { visit(p, 1, sec, "valt" + i + "." + j + ":" + p[0]); }); });
    option(c.l, sec, "L"); option(c.r, sec, "R");
  }
  function table(obj, pre, fields) { Object.keys(obj).forEach(function (id) { each(obj[id], pre + ":" + id, fields); }); }
  function rows(obj, pre) { Object.keys(obj).forEach(function (id) { obj[id].forEach(function (r, i) { visit(r, 1, pre + ":" + id, "f" + i); }); }); }
  var six = ["name", "hint", "line", "plus", "minus", "sum"], th = ["name", "come", "done", "plus", "minus", "sum"];

  /* глава первая */
  Object.keys(VOICES).forEach(function (id) { visit(VOICES, id, "V", id); });
  Object.keys(VOICE_ABOUT).forEach(function (id) { visit(VOICE_ABOUT, id, "VA", id); });
  Object.keys(VOICE_GONE).forEach(function (id) { visit(VOICE_GONE, id, "VG", id); });
  METERS.forEach(function (m, i) { visit(METERS, i, "M", "m" + i); });
  table(POLICIES, "P", six);
  THOUGHT_ORDER.forEach(function (id) { each(THOUGHTS[id], "T:" + id, th); });
  visit(I18N_G, "SPARE_TEXT", "X", "spare");
  PEOPLE.forEach(function (p) { name(p, "name"); name(p, "role"); });
  rows(FATES, "F");
  Object.keys(ENDINGS).forEach(function (id) { ["stamp", "title", "text"].forEach(function (lab, i) { visit(ENDINGS[id].t, i, "E:" + id, lab); }); });
  Object.keys(END_HINT).forEach(function (id) { visit(END_HINT, id, "H", id); });
  card(INTRO, "C:BOOT-000");
  CARDS.forEach(function (c) { if (c.review == null) card(c, "C:" + c.key); });

  /* глава вторая */
  visit(CH2, "name", "X", "ch2name");
  Object.keys(CH2.voiceAbout).forEach(function (id) { visit(CH2.voiceAbout, id, "VA2", id); });
  CH2.meters.forEach(function (m, i) { visit(CH2.meters, i, "M2", "m" + i); });
  Object.keys(CH2.who).forEach(function (id) { name(CH2.who[id], "name"); });
  table(CH2.rules, "R", six);
  CH2.order.forEach(function (id) { each(CH2.thoughts[id], "T2:" + id, th); });
  rows(CH2.fates, "F2");
  Object.keys(CH2.endings).forEach(function (id) { ["stamp", "title", "text"].forEach(function (lab, i) { visit(CH2.endings[id], i, "E2:" + id, lab); }); });
  Object.keys(CH2.endHint).forEach(function (id) { visit(CH2.endHint, id, "H2", id); });
  card(CH2.intro, "D:BOOT-200");
  CH2.cards.forEach(function (c) { card(c, "D:" + c.key); });

  /* разделы без игры */
  TRUTH.forEach(function (x) { visit(x, "name", "TR:" + x.id, "name"); x.parts.forEach(function (p, i) { name(p, 0); visit(p, 1, "TR:" + x.id, "p" + i); }); });
  TIPS.forEach(function (x, i) { visit(x, 0, "TIP", "t" + i); visit(x, 1, "TIP", "x" + i); });
}

/* ---------- применить пакет (или вернуть русский) ---------- */
function applyLang(pack) {
  var first = !I18N.orig, i = 0, n = 0;
  if (first) I18N.orig = [];
  walkTexts(function (o, k) {                             /* сначала всегда возвращаем исходный русский текст */
    if (first) I18N.orig.push(o[k]); else o[k] = I18N.orig[i];
    i++;
  });
  if (!pack || pack.code === "ru") { I18N.lang = "ru"; I18N.dir = "ltr"; I18N.ui = {}; I18N.pl = {}; I18N.kevin = "Кевин"; return true; }
  if (!pack.s || pack.s.length !== i) { try { console.warn("язык " + pack.code + ": пакет не от этой версии игры (" + (pack.s ? pack.s.length : 0) + " строк вместо " + i + ")"); } catch (e) {} return false; }
  walkTexts(function (o, k) { var s = pack.s[n++]; if (s) o[k] = s; });
  I18N.lang = pack.code; I18N.dir = pack.dir || "ltr"; I18N.ui = pack.ui || {}; I18N.pl = pack.pl || {}; I18N.kevin = pack.kevin || "Kevin";
  return true;
}
/* пакет сообщает о себе сам: файл lang/<код>.js состоит из одного вызова LANGPACK({...}) */
function LANGPACK(pack) { I18N.loaded[pack.code] = pack; }
function loadLang(code, done) {
  if (code === "ru" || I18N.loaded[code]) { done(applyLang(code === "ru" ? null : I18N.loaded[code])); return; }
  var s = document.createElement("script"), fired = false;
  function finish(ok) { if (fired) return; fired = true; done(ok && I18N.loaded[code] ? applyLang(I18N.loaded[code]) : false); }
  s.src = "lang/" + code + ".js";
  s.onload = function () { finish(true); }; s.onerror = function () { finish(false); };
  setTimeout(function () { finish(false); }, 8000);
  document.head.appendChild(s);
}
/* язык по умолчанию: сохранённый выбор, иначе язык телефона, иначе английский; русский — для русского телефона */
function pickLang(saved, nav) {
  var codes = LANGS.map(function (l) { return l[0]; });
  if (saved && codes.indexOf(saved) >= 0) return saved;
  var list = (nav || []).map(function (x) { return String(x || "").toLowerCase(); });
  for (var i = 0; i < list.length; i++) {
    var x = list[i], base = x.split("-")[0];
    if (base === "zh") return /tw|hk|mo|hant/.test(x) ? "zh-TW" : "zh";
    if (base === "iw") return "he";
    if (base === "in") return "id";
    if (codes.indexOf(base) >= 0) return base;
  }
  return "en";
}
if (typeof module !== "undefined") module.exports = {};
