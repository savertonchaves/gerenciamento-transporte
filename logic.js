(function (root) {
  var CARRIERS = ["DANIEL TRANSPORTES", "FRACHT LOG", "IRAPURU", "TERMACO"];
  var SEM = "Sem transportadora";
  var ALL = CARRIERS.concat([SEM]);
  var TZ = "America/Sao_Paulo";
  var NOME = { N: "Nacional", I: "Importado" };
  var WD = { Sun: "dom", Mon: "seg", Tue: "ter", Wed: "qua", Thu: "qui", Fri: "sex", Sat: "sáb" };

  function fullDate(t) { return "2026-" + t[0]; }
  function carrierOf(t) { return t[2] < 0 ? SEM : CARRIERS[t[2]]; }
  function utc(iso) {
    var p = iso.split("-").map(Number);
    return new Date(Date.UTC(p[0], p[1] - 1, p[2], 15, 0, 0));
  }
  function addDays(iso, n) {
    var dt = utc(iso);
    dt.setUTCDate(dt.getUTCDate() + n);
    return dt.toISOString().slice(0, 10);
  }
  function todayIso() {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
  }
  function weekRange(iso) {
    var start = addDays(iso, -((utc(iso).getUTCDay() + 6) % 7));
    return { start: start, end: addDays(start, 6) };
  }
  function ddmm(iso) {
    return new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit" }).format(utc(iso));
  }
  function dayName(iso) {
    var wd = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(utc(iso));
    return WD[wd] || wd;
  }
  function dayLabel(iso) { return dayName(iso) + " " + ddmm(iso); }
  function carros(n) { return n + (n === 1 ? " carro" : " carros"); }
  function status(t, today) {
    if (t[4] === 1) return "entregue";
    return fullDate(t) >= today ? "movimentar" : "semBaixa";
  }
  function eachDay(from, to) {
    var out = [];
    if (from > to) { var s = from; from = to; to = s; }
    for (var d = from; d <= to && out.length < 400; d = addDays(d, 1)) out.push(d);
    return out;
  }
  function filter(list, q) {
    var from = q.from;
    var to = q.to;
    if (from > to) { var s = from; from = to; to = s; }
    var chips = q.chips || [];
    return list.filter(function (t) {
      var d = fullDate(t);
      if (d < from || d > to) return false;
      if (q.carrier && q.carrier !== "todas" && carrierOf(t) !== q.carrier) return false;
      if (q.origin && q.origin !== "todas" && t[1] !== q.origin) return false;
      if (q.status && q.status !== "todas" && status(t, q.today) !== q.status) return false;
      if (chips.length && chips.indexOf(carrierOf(t)) < 0) return false;
      return true;
    });
  }
  function groups(list) {
    var map = {};
    var order = [];
    list.forEach(function (t) {
      var key = t[1] + "|" + carrierOf(t);
      if (!map[key]) {
        map[key] = { o: t[1], c: carrierOf(t), n: 0 };
        order.push(key);
      }
      map[key].n += 1;
    });
    return order.map(function (k) { return map[k]; }).sort(function (a, b) {
      if (a.o !== b.o) return a.o === "I" ? -1 : 1;
      return b.n - a.n || a.c.localeCompare(b.c, "pt");
    });
  }
  function oneLine(list) {
    return groups(list).map(function (g) {
      return carros(g.n) + " " + NOME[g.o] + " – " + g.c;
    }).join(" + ");
  }

  root.OmniaLogic = {
    CARRIERS: CARRIERS,
    SEM: SEM,
    ALL: ALL,
    NOME: NOME,
    COLORS: {
      "IRAPURU": "#1a4f8b",
      "TERMACO": "#1f8a7a",
      "DANIEL TRANSPORTES": "#5b6cc0",
      "FRACHT LOG": "#8a6bb5",
      "Sem transportadora": "#e07b1a",
    },
    fullDate: fullDate,
    carrierOf: carrierOf,
    addDays: addDays,
    todayIso: todayIso,
    weekRange: weekRange,
    ddmm: ddmm,
    dayLabel: dayLabel,
    carros: carros,
    status: status,
    eachDay: eachDay,
    filter: filter,
    groups: groups,
    oneLine: oneLine,
  };
})(typeof window !== "undefined" ? window : globalThis);
