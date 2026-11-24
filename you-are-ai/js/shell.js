/* Сборка для магазина. Оболочка приложения (android/app/src/main/java/app/youareai/shell/MainActivity.java) кладёт в страницу
   window.AndroidShell ещё до загрузки. Без неё этот файл ничего не делает, поэтому один и тот же index.html работает
   в браузере, в окне Claude и в приложении.
   В приложении полная версия — настоящая разовая покупка. Отметка "kevin-full" ставится, только когда Google Play сообщил
   о покупке ("bought", "owned"), и снимается, когда Google Play ответил, что покупки нет ("none", например после возврата денег).
   Сообщения от оболочки приходят через window.shellEvent(имя, значение):
     price   – цена товара строкой, как её показывает магазин
     bought  – покупка только что прошла                 owned – Google Play подтвердил прежнюю покупку
     none    – Google Play ответил: не куплено           pending – оплата начата, но не завершена
     cancel  – покупатель закрыл окно                    fail – покупка не прошла
     off     – магазин или товар недоступны */
(function () {
  var SH = window.AndroidShell;
  if (!SH || typeof SH.buy !== "function") return;
  var shop = { price: "", st: "idle" }, last = 0;
  function owned() { try { return localStorage.getItem("kevin-full") === "1"; } catch (e) { return false; } }
  function setFull(v) { try { if (v) localStorage.setItem("kevin-full", "1"); else localStorage.removeItem("kevin-full"); } catch (e) {} window.KEVIN_FULL = !!v; }
  function tell(name) { try { if (window.KEVIN && window.KEVIN.shop) window.KEVIN.shop(name); } catch (e) {} }
  window.KEVIN_FULL = owned();
  window.KEVIN_SHOP = shop;
  window.KEVIN_BUY = function () {
    var now = Date.now();
    if (now - last < 1500) return;             /* второе нажатие, пока открывается окно Google Play */
    last = now;
    if (shop.st === "fail" || shop.st === "off") { shop.st = "idle"; tell("idle"); }
    try { SH.buy(); } catch (e) { shop.st = "fail"; tell("fail"); }
  };
  window.KEVIN_SHARE = function (dataUrl, text) { try { SH.share(String(dataUrl).split(",")[1] || "", String(text || "")); } catch (e) {} };
  window.shellEvent = function (name, val) {
    try {
      if (name === "price") { shop.price = String(val || ""); tell(name); return; }
      if (name === "bought" || name === "owned") { var had = window.KEVIN_FULL; setFull(true); shop.st = "idle"; tell(name === "bought" && !had ? "bought" : "owned"); return; }
      if (name === "none") { if (shop.st !== "wait") { setFull(false); tell(name); } return; }
      shop.st = name === "pending" ? "wait" : name === "fail" ? "fail" : name === "off" ? "off" : "idle";
      tell(name);
    } catch (e) {}
  };
  /* кнопка «Назад» на телефоне: закрыть то, что открыто сверху; false велит оболочке свернуть приложение */
  window.shellBack = function () { try { return !!(window.KEVIN && window.KEVIN.back && window.KEVIN.back()); } catch (e) { return false; } };
})();
