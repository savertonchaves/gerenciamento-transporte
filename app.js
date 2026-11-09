(function () {
  var L = window.OmniaLogic;
  var SIT = { movimentar: "A movimentar", entregue: "Entregue", semBaixa: "Sem baixa DRM" };
  var state = { ini: "", fim: "", transp: "todas", origem: "todas", situacao: "todas", chips: [], tab: "geral" };

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function pct(n, total) { return total ? Math.round((n / total) * 100) + "%" : "0%"; }

  function range() {
    var from = state.ini;
    var to = state.fim;
    if (from > to) { var s = from; from = to; to = s; }
    return { from: from, to: to };
  }

  function current() {
    var r = range();
    return L.filter(window.OMNIA_TRUCKS, {
      from: r.from, to: r.to, carrier: state.transp, origin: state.origem,
      status: state.situacao, chips: state.chips, today: L.todayIso(),
    });
  }

  function activeCarriers(list) {
    return L.ALL.filter(function (c) { return list.some(function (t) { return L.carrierOf(t) === c; }); });
  }

  function onDay(list, iso) {
    return list.filter(function (t) { return L.fullDate(t) === iso; });
  }

  function chartDays(list) {
    var r = range();
    var span = L.eachDay(r.from, r.to);
    var withCars = span.filter(function (d) { return onDay(list, d).length; });
    return span.length <= 16 ? span : withCars;
  }

  function legend(names) {
    return '<div class="legend">' + names.map(function (c) {
      return '<span><i class="sw" style="background:' + L.COLORS[c] + '"></i>' + esc(c) + "</span>";
    }).join("") + "</div>";
  }

  function bars(list) {
    var days = chartDays(list);
    var carriers = activeCarriers(list);
    var totals = days.map(function (d) { return onDay(list, d).length; });
    var max = Math.max(1, Math.max.apply(null, totals));
    var step = Math.max(1, Math.ceil(max / 4));
    var ticks = [];
    for (var v = 0; v <= max; v += step) ticks.push(v);
    if (ticks[ticks.length - 1] !== max) ticks.push(max);
    var W = Math.max(520, days.length * 64);
    var H = 250;
    var padL = 28, padR = 8, padT = 8, padB = 52;
    var iw = W - padL - padR;
    var ih = H - padT - padB;
    var gap = Math.min(18, iw / days.length * 0.35);
    var bw = Math.max(8, iw / days.length - gap);
    var parts = [];
    ticks.forEach(function (t) {
      var y = padT + ih - (t / max) * ih;
      parts.push('<line x1="' + padL + '" y1="' + y + '" x2="' + (W - padR) + '" y2="' + y + '" stroke="#e3eaf2"/>');
      parts.push('<text x="' + (padL - 4) + '" y="' + (y + 3) + '" text-anchor="end" font-size="10" fill="#8b9aab">' + t + "</text>");
    });
    days.forEach(function (d, i) {
      var x = padL + i * (iw / days.length) + gap / 2;
      var y = padT + ih;
      carriers.forEach(function (c) {
        var n = onDay(list, d).filter(function (t) { return L.carrierOf(t) === c; }).length;
        if (!n) return;
        var h = (n / max) * ih;
        y -= h;
        parts.push('<rect x="' + x + '" y="' + y + '" width="' + bw + '" height="' + h + '" fill="' + L.COLORS[c] + '"><title>' + esc(L.dayLabel(d) + " · " + c + ": " + n) + "</title></rect>");
      });
      var lx = x + bw / 2;
      var ly = padT + ih + 14;
      parts.push('<text x="' + lx + '" y="' + ly + '" text-anchor="end" font-size="10" fill="#6b7c90" transform="rotate(-40 ' + lx + " " + ly + ')">' + esc(L.dayLabel(d)) + "</text>");
    });
    var r = range();
    var cap = "Eixo X: dia · Eixo Y: carros · " + L.ddmm(r.from) + " a " + L.ddmm(r.to);
    if (L.eachDay(r.from, r.to).length > 16) cap += " · somente dias com carro";
    return '<section class="card panel"><h2>Carros por dia, por transportadora</h2><p class="cap">' + cap + '</p><svg viewBox="0 0 ' + W + " " + H + '" width="100%" height="250" role="img" aria-label="Carros por dia empilhados por transportadora">' + parts.join("") + "</svg>" + legend(carriers) + "</section>";
  }

  function donut(list) {
    var carriers = activeCarriers(list);
    var slices = carriers.map(function (c) {
      return { c: c, n: list.filter(function (t) { return L.carrierOf(t) === c; }).length };
    });
    var total = list.length || 1;
    var cx = 90, cy = 90, r1 = 78, r0 = 48;
    var a = -Math.PI / 2;
    var paths = slices.map(function (s) {
      var da = (s.n / total) * Math.PI * 2;
      var a0 = a;
      var a1 = a + da;
      a = a1;
      if (da >= Math.PI * 2 - 0.0001) a1 = a0 + Math.PI * 2 - 0.0001;
      var large = a1 - a0 > Math.PI ? 1 : 0;
      function pt(r, ang) { return [cx + r * Math.cos(ang), cy + r * Math.sin(ang)]; }
      var p0 = pt(r1, a0), p1 = pt(r1, a1), p2 = pt(r0, a1), p3 = pt(r0, a0);
      var d = "M " + p0[0] + " " + p0[1] + " A " + r1 + " " + r1 + " 0 " + large + " 1 " + p1[0] + " " + p1[1] + " L " + p2[0] + " " + p2[1] + " A " + r0 + " " + r0 + " 0 " + large + " 0 " + p3[0] + " " + p3[1] + " Z";
      return '<path d="' + d + '" fill="' + L.COLORS[s.c] + '"><title>' + esc(s.c + ": " + s.n) + "</title></path>";
    }).join("");
    var legendHtml = slices.map(function (s) {
      return '<div><span><i class="sw" style="background:' + L.COLORS[s.c] + '"></i> ' + esc(s.c) + '</span><b>' + s.n + " · " + pct(s.n, list.length) + "</b></div>";
    }).join("");
    var r = range();
    return '<section class="card panel"><h2>Distribuição por transportadora</h2><p class="cap">Carros no filtro · ' + L.ddmm(r.from) + " a " + L.ddmm(r.to) + '</p><div class="donut-wrap"><svg viewBox="0 0 180 180" width="180" height="180" role="img" aria-label="Distribuição de carros por transportadora">' + paths + '<text x="90" y="86" text-anchor="middle" font-size="22" font-weight="700" fill="#1a4f8b">' + list.length + '</text><text x="90" y="104" text-anchor="middle" font-size="11" fill="#8b9aab">carros</text></svg><div class="donut-legend">' + legendHtml + "</div></div></section>";
  }

  function table(headers, rows, opts) {
    opts = opts || {};
    var nums = opts.nums || [];
    var head = "<tr>" + headers.map(function (h, i) {
      return '<th class="' + (nums.indexOf(i) >= 0 ? "num" : "") + '">' + esc(h) + "</th>";
    }).join("") + "</tr>";
    var body = rows.map(function (row) {
      var cls = row.tone ? ' class="' + row.tone + '"' : "";
      return "<tr" + cls + ">" + row.cells.map(function (cell, i) {
        var prog = opts.prog && i === row.cells.length - 1;
        return '<td class="' + (nums.indexOf(i) >= 0 ? "num" : "") + (prog ? " prog" : "") + '">' + cell + "</td>";
      }).join("") + "</tr>";
    }).join("");
    return '<div class="scroll"' + (opts.tall ? ' style="max-height:70vh"' : "") + "><table>" + head + body + "</table></div>";
  }

  function dailyTable(list) {
    var carriers = activeCarriers(list);
    var days = chartDays(list).filter(function (d) { return onDay(list, d).length; });
    var headers = ["Dia"].concat(carriers, ["Total", "Programação"]);
    var rows = days.map(function (d) {
      var dl = onDay(list, d);
      var cells = ["<b>" + esc(L.dayLabel(d)) + "</b>"];
      carriers.forEach(function (c) {
        var n = dl.filter(function (t) { return L.carrierOf(t) === c; }).length;
        cells.push(n ? String(n) : "–");
      });
      cells.push("<b>" + dl.length + "</b>");
      cells.push(esc(L.oneLine(dl)));
      return { cells: cells, tone: dl.some(function (t) { return t[2] < 0; }) ? "warn" : "" };
    });
    var totalCells = ["Total"];
    carriers.forEach(function (c) {
      totalCells.push(String(list.filter(function (t) { return L.carrierOf(t) === c; }).length));
    });
    totalCells.push(String(list.length));
    totalCells.push(esc(L.oneLine(list)));
    rows.push({ tone: "total", cells: totalCells });
    var nums = carriers.map(function (_, i) { return i + 1; });
    nums.push(carriers.length + 1);
    return '<section class="card panel"><h2>Controle diário — carros × transportadora</h2><p class="cap">Linha em destaque: dia com carro sem transportadora</p>' + table(headers, rows, { nums: nums, prog: true }) + "</section>";
  }

  function kpi(label, value, hint, alert) {
    return '<article class="kpi' + (alert ? " alert" : "") + '"><div class="k">' + esc(label) + '</div><div class="v">' + esc(value) + '</div><div class="h">' + esc(hint) + "</div></article>";
  }

  function viewGeral(list) {
    var today = L.todayIso();
    var r = range();
    var nImp = list.filter(function (t) { return t[1] === "I"; }).length;
    var nNac = list.filter(function (t) { return t[1] === "N"; }).length;
    var nMov = list.filter(function (t) { return L.status(t, today) === "movimentar"; }).length;
    var nEnt = list.filter(function (t) { return L.status(t, today) === "entregue"; }).length;
    var nSem = list.filter(function (t) { return t[2] < 0; }).length;
    var nAtivas = activeCarriers(list).filter(function (c) { return c !== L.SEM; }).length;
    var days = [];
    list.forEach(function (t) { var d = L.fullDate(t); if (days.indexOf(d) < 0) days.push(d); });
    var pico = days.reduce(function (best, d) {
      var n = onDay(list, d).length;
      return n > best.n ? { d: d, n: n } : best;
    }, { d: "", n: 0 });
    var periodo = L.ddmm(r.from) + " a " + L.ddmm(r.to);
    var html = '<div class="section">Volume no período</div><div class="kpis">'
      + kpi("Total de carros", String(list.length), periodo)
      + kpi("Importado", String(nImp), pct(nImp, list.length) + " · contêineres")
      + kpi("Nacional", String(nNac), pct(nNac, list.length) + " · ordens de frete")
      + kpi("Dias com carro", String(days.length), pico.n ? "pico: " + L.carros(pico.n) + " em " + L.dayLabel(pico.d) : "nenhum dia no filtro")
      + "</div>"
      + '<div class="section">Situação</div><div class="kpis">'
      + kpi("A movimentar", String(nMov), "sem DRM, de hoje em diante")
      + kpi("Entregues", String(nEnt), "DATA ENTREGA (DRM) preenchida")
      + kpi("Sem transportadora", String(nSem), "precisam de contratação", nSem > 0)
      + kpi("Transportadoras ativas", String(nAtivas), "com carro no filtro")
      + "</div>";
    if (!list.length) return html + '<p class="empty">Nenhum carro neste período.</p>';
    html += '<div class="formula">' + esc(L.oneLine(list)) + "</div>";
    html += '<div class="charts">' + bars(list) + donut(list) + "</div>";
    html += dailyTable(list);
    return html;
  }

  function viewDia(list) {
    if (!list.length) return '<p class="empty">Nenhum carro neste período.</p>';
    var today = L.todayIso();
    var days = chartDays(list);
    if (L.eachDay(range().from, range().to).length > 16) days = days.filter(function (d) { return onDay(list, d).length; });
    return '<div class="days">' + days.map(function (d) {
      var dl = onDay(list, d);
      var alert = dl.some(function (t) { return t[2] < 0; });
      var lines = L.groups(dl).map(function (g) {
        return '<p class="' + (g.c === L.SEM ? "miss" : "") + '">' + esc(g.n + " " + L.NOME[g.o] + " – " + g.c) + "</p>";
      }).join("");
      return '<article class="day' + (alert ? " alert" : "") + '"><div class="dh"><span>' + esc(L.dayLabel(d)) + "</span>" + (d === today ? '<span class="hoje">hoje</span>' : "") + '</div><div class="big">' + esc(L.carros(dl.length)) + "</div>" + lines + "</article>";
    }).join("") + "</div>";
  }

  function viewTransp(list) {
    if (!list.length) return '<p class="empty">Nenhum carro neste período.</p>';
    var today = L.todayIso();
    var carriers = activeCarriers(list);
    var max = Math.max.apply(null, carriers.map(function (c) {
      return list.filter(function (t) { return L.carrierOf(t) === c; }).length;
    }));
    var barsHtml = carriers.map(function (c) {
      var cl = list.filter(function (t) { return L.carrierOf(t) === c; });
      var imp = cl.filter(function (t) { return t[1] === "I"; }).length;
      var nac = cl.length - imp;
      return '<div class="hbar"><div class="name">' + esc(c) + '</div><div class="track"><div class="seg imp" style="width:' + (imp / max * 100) + '%"></div><div class="seg nac" style="width:' + (nac / max * 100) + '%"></div></div><div class="n">' + cl.length + "</div></div>";
    }).join("");
    var r = range();
    var rows = carriers.map(function (c) {
      var cl = list.filter(function (t) { return L.carrierOf(t) === c; });
      var next = cl.map(L.fullDate).filter(function (d) { return d >= today; }).sort()[0];
      return {
        tone: c === L.SEM ? "warn" : "",
        cells: [esc(c), String(cl.filter(function (t) { return t[1] === "I"; }).length), String(cl.filter(function (t) { return t[1] === "N"; }).length), String(cl.length), pct(cl.length, list.length), next ? esc(L.dayLabel(next)) : "–"],
      };
    });
    var nImp = list.filter(function (t) { return t[1] === "I"; }).length;
    rows.push({ tone: "total", cells: ["Total", String(nImp), String(list.length - nImp), String(list.length), "100%", ""] });
    return '<div class="split"><section class="card panel"><h2>Carros por transportadora e origem</h2><p class="cap">Eixo: carros · ' + L.ddmm(r.from) + " a " + L.ddmm(r.to) + '</p>' + barsHtml + '<div class="legend"><span><i class="sw" style="background:#1a4f8b"></i>Importado</span><span><i class="sw" style="background:#8fb0d6"></i>Nacional</span></div></section><section class="card panel"><h2>Resumo por transportadora</h2><p class="cap">Próximo dia = primeira previsão de hoje em diante</p>' + table(["Transportadora", "Importado", "Nacional", "Total", "%", "Próximo dia"], rows, { nums: [1, 2, 3, 4] }) + "</section></div>";
  }

  function viewDetalhe(list) {
    if (!list.length) return '<p class="empty">Nenhum carro neste período.</p>';
    var today = L.todayIso();
    var sorted = list.slice().sort(function (a, b) {
      if (a[0] !== b[0]) return a[0] < b[0] ? -1 : 1;
      if (a[1] !== b[1]) return a[1] === "I" ? -1 : 1;
      return L.carrierOf(a).localeCompare(L.carrierOf(b), "pt");
    });
    var rows = sorted.map(function (t) {
      return {
        tone: t[2] < 0 ? "warn" : "",
        cells: [esc(L.dayLabel(L.fullDate(t))), esc(L.NOME[t[1]]), esc(L.carrierOf(t)), esc(t[3]), esc(SIT[L.status(t, today)])],
      };
    });
    return '<section class="card panel"><h2>Carros no filtro · ' + list.length + '</h2><p class="cap">Importado: contêiner (OF). Nacional: ordem de frete. Linha em destaque: sem transportadora.</p>' + table(["Dia", "Origem", "Transportadora", "Referência", "Situação"], rows, { tall: true }) + "</section>";
  }

  var VIEWS = { geral: viewGeral, dia: viewDia, transp: viewTransp, detalhe: viewDetalhe };

  function chipBadge() {
    var n = state.chips.length;
    $("chip-badge").textContent = !n || n === L.ALL.length ? "todas (" + L.ALL.length + ")" : n + " de " + L.ALL.length + " selecionadas";
  }

  function paintChips() {
    Array.prototype.forEach.call(document.querySelectorAll(".chip"), function (btn) {
      btn.classList.toggle("on", state.chips.indexOf(btn.getAttribute("data-c")) >= 0);
    });
    chipBadge();
  }

  function render() {
    var list = current();
    var r = range();
    var nImp = list.filter(function (t) { return t[1] === "I"; }).length;
    $("count").textContent = list.length + " de " + window.OMNIA_TRUCKS.length + " carros · " + nImp + " importado · " + (list.length - nImp) + " nacional · " + L.ddmm(r.from) + " a " + L.ddmm(r.to);
    Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (btn) {
      var on = btn.getAttribute("data-tab") === state.tab;
      btn.classList.toggle("on", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    $("view").innerHTML = VIEWS[state.tab](list);
  }

  function setWeek() {
    var w = L.weekRange(L.todayIso());
    state.ini = w.start;
    state.fim = w.end;
    $("ini").value = state.ini;
    $("fim").value = state.fim;
  }

  function boot() {
    var sel = $("transp");
    sel.innerHTML = '<option value="todas">Todas</option>' + L.ALL.map(function (c) {
      return '<option value="' + esc(c) + '">' + esc(c) + "</option>";
    }).join("");
    $("chips").innerHTML = L.ALL.map(function (c) {
      return '<button type="button" class="chip" data-c="' + esc(c) + '">' + esc(c) + "</button>";
    }).join("");
    setWeek();
    $("ini").addEventListener("change", function () { if ($("ini").value) { state.ini = $("ini").value; render(); } });
    $("fim").addEventListener("change", function () { if ($("fim").value) { state.fim = $("fim").value; render(); } });
    $("transp").addEventListener("change", function () { state.transp = $("transp").value; render(); });
    $("origem").addEventListener("change", function () { state.origem = $("origem").value; render(); });
    $("situacao").addEventListener("change", function () { state.situacao = $("situacao").value; render(); });
    $("chips").addEventListener("click", function (e) {
      var btn = e.target.closest(".chip");
      if (!btn) return;
      var c = btn.getAttribute("data-c");
      var i = state.chips.indexOf(c);
      if (i >= 0) state.chips.splice(i, 1);
      else state.chips.push(c);
      paintChips();
      render();
    });
    $("sel-all").addEventListener("click", function () { state.chips = L.ALL.slice(); paintChips(); render(); });
    $("clear-chips").addEventListener("click", function () { state.chips = []; paintChips(); render(); });
    $("reset").addEventListener("click", function () {
      setWeek();
      state.transp = "todas";
      state.origem = "todas";
      state.situacao = "todas";
      state.chips = [];
      $("transp").value = "todas";
      $("origem").value = "todas";
      $("situacao").value = "todas";
      paintChips();
      render();
    });
    document.querySelector(".tabs").addEventListener("click", function (e) {
      var btn = e.target.closest(".tab");
      if (!btn) return;
      state.tab = btn.getAttribute("data-tab");
      render();
    });
    paintChips();
    render();
  }

  boot();
})();
