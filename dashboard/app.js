(function () {
  var L = window.OmniaLogic;
  var SIT = { movimentar: "A movimentar", entregue: "Entregue", semBaixa: "Sem baixa DRM" };
  var state = { ini: "", fim: "", transp: "todas", origem: "todas", situacao: "todas", chips: [], tab: "geral", base: "reaj" };

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
      return '<span><i class="sw" style="background:' + L.color(c) + '"></i>' + esc(c) + "</span>";
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
        parts.push('<rect x="' + x + '" y="' + y + '" width="' + bw + '" height="' + h + '" fill="' + L.color(c) + '"><title>' + esc(L.dayLabel(d) + " · " + c + ": " + n) + "</title></rect>");
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
      return '<path d="' + d + '" fill="' + L.color(s.c) + '"><title>' + esc(s.c + ": " + s.n) + "</title></path>";
    }).join("");
    var legendHtml = slices.map(function (s) {
      return '<div><span><i class="sw" style="background:' + L.color(s.c) + '"></i> ' + esc(s.c) + '</span><b>' + s.n + " · " + pct(s.n, list.length) + "</b></div>";
    }).join("");
    var r = range();
    return '<section class="card panel"><h2>Distribuição por transportadora</h2><p class="cap">Carros no filtro · ' + L.ddmm(r.from) + " a " + L.ddmm(r.to) + '</p><div class="donut-wrap"><svg viewBox="0 0 180 180" width="180" height="180" role="img" aria-label="Distribuição de carros por transportadora">' + paths + '<text x="90" y="86" text-anchor="middle" font-size="22" font-weight="700" fill="#1a4f8b">' + list.length + '</text><text x="90" y="104" text-anchor="middle" font-size="11" fill="#8b9aab">carros</text></svg><div class="donut-legend">' + legendHtml + "</div></div></section>";
  }

  function table(headers, rows, opts) {
    opts = opts || {};
    var nums = opts.nums || [];
    var wrap = opts.wrap || [];
    var head = "<tr>" + headers.map(function (h, i) {
      return '<th class="' + (nums.indexOf(i) >= 0 ? "num" : "") + '">' + esc(h) + "</th>";
    }).join("") + "</tr>";
    var body = rows.map(function (row) {
      var cls = row.tone ? ' class="' + row.tone + '"' : "";
      return "<tr" + cls + ">" + row.cells.map(function (cell, i) {
        var prog = (opts.prog && i === row.cells.length - 1) || wrap.indexOf(i) >= 0;
        return '<td class="' + (nums.indexOf(i) >= 0 ? "num" : "") + (prog ? " mat" : "") + '">' + cell + "</td>";
      }).join("") + "</tr>";
    }).join("");
    return '<div class="scroll"' + (opts.tall ? ' style="max-height:70vh"' : "") + "><table>" + head + body + "</table></div>";
  }

  function carrierCounts(dl, carriers) {
    return carriers.map(function (c) {
      var n = dl.filter(function (t) { return L.carrierOf(t) === c; }).length;
      return n ? String(n) : "–";
    });
  }

  function ofNumber(t) {
    var m = String(t[3]).match(/OF\s+([0-9]+(?:\/[0-9]+)*)/);
    return m ? m[1] : String(t[3]);
  }

  function groupsByOf(dl) {
    var map = {};
    var order = [];
    dl.forEach(function (t) {
      var key = ofNumber(t);
      if (!map[key]) {
        map[key] = [];
        order.push(key);
      }
      map[key].push(t);
    });
    order.sort(function (a, b) {
      var na = parseInt(a, 10);
      var nb = parseInt(b, 10);
      if (na !== nb) return na - nb;
      return a < b ? -1 : a > b ? 1 : 0;
    });
    return order.map(function (key) { return map[key]; });
  }

  function materialLabel(group) {
    var mats = [];
    var seen = {};
    group.forEach(function (t) {
      String(t[5] || "").split(" · ").forEach(function (m) {
        if (!m || seen[m]) return;
        seen[m] = 1;
        mats.push(m);
      });
    });
    var line = "OF " + ofNumber(group[0]) + " — " + (mats.join(" · ") || "–");
    if (group[0][1] === "I" && group.length > 1) {
      var boxes = group.map(function (t) { return String(t[3]).replace(/\s*\(OF[^)]*\)/, ""); });
      line += " (" + group.length + " carros: " + boxes.join(", ") + ")";
    }
    return line;
  }

  function materialBlock(dl) {
    if (!dl.length) return "–";
    return groupsByOf(dl).map(function (g) { return esc(materialLabel(g)); }).join("<br>");
  }

  function originCells(dl, carriers, materialHtml) {
    var mat = '<td class="mat">' + (materialHtml == null ? materialBlock(dl) : materialHtml) + "</td>";
    var nums = carrierCounts(dl, carriers).map(function (n) { return '<td class="num">' + n + "</td>"; }).join("");
    var total = dl.length ? "<b>" + dl.length + "</b>" : "–";
    var prog = dl.length ? esc(L.oneLine(dl)) : "–";
    return mat + nums + '<td class="num">' + total + '</td><td class="prog">' + prog + "</td>";
  }

  function dailyTable(list) {
    var carriers = activeCarriers(list);
    var days = chartDays(list).filter(function (d) { return onDay(list, d).length; });
    var origins = ["I", "N"];
    var headers = ["Dia", "Tipo de material", "Material"].concat(carriers, ["Total", "Programação"]);
    var head = "<tr>" + headers.map(function (h, i) {
      return '<th class="' + (i >= 3 && i < headers.length - 1 ? "num" : "") + '">' + esc(h) + "</th>";
    }).join("") + "</tr>";
    var body = days.map(function (d) {
      var groups = [];
      origins.forEach(function (o) {
        groupsByOf(onDay(list, d).filter(function (t) { return t[1] === o; })).forEach(function (g) { groups.push(g); });
      });
      var dayList = onDay(list, d);
      var rows = groups.map(function (g, idx) {
        var warn = g.some(function (t) { return t[2] < 0; });
        var cls = (idx === 0 ? "pair-start" : "pair-mid") + (warn ? " warn" : "");
        var day = idx === 0 ? '<td class="daycell" rowspan="' + (groups.length + 1) + '"><b>' + esc(L.dayLabel(d)) + "</b></td>" : "";
        return '<tr class="' + cls + '">' + day + "<td>" + esc(L.NOME[g[0][1]]) + "</td>" + originCells(g, carriers, esc(materialLabel(g))) + "</tr>";
      });
      rows.push('<tr class="subtotal"><td>Subtotal</td>' + originCells(dayList, carriers, dayList.length + " carros no dia") + "</tr>");
      return rows.join("");
    }).join("");
    var totals = origins.map(function (o, idx) {
      var dl = list.filter(function (t) { return t[1] === o; });
      var warn = dl.some(function (t) { return t[2] < 0; });
      var day = idx === 0 ? '<td class="daycell" rowspan="2">Total</td>' : "";
      return '<tr class="total' + (warn ? " warn" : "") + '">' + day + "<td>" + esc(L.NOME[o]) + "</td>" + originCells(dl, carriers, groupsByOf(dl).length + " ordens de frete") + "</tr>";
    }).join("");
    var grandNums = carrierCounts(list, carriers).map(function (n) { return '<td class="num">' + n + "</td>"; }).join("");
    var grand = '<tr class="total"><td colspan="2">Total geral</td><td class="mat">' + groupsByOf(list).length + " ordens de frete</td>" + grandNums + '<td class="num">' + list.length + '</td><td class="prog">' + esc(L.oneLine(list)) + "</td></tr>";
    return '<section class="card panel"><h2>Controle diário — carros × transportadora</h2><p class="cap">Uma ordem de frete é um veículo. Se o número se repete na planilha, os materiais são do mesmo carro. A linha Subtotal soma os carros daquele dia. Linha em destaque: carro sem transportadora.</p><div class="scroll"><table class="daily">' + head + body + totals + grand + "</table></div></section>";
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
        cells: [esc(L.dayLabel(L.fullDate(t))), esc(L.NOME[t[1]]), esc(L.carrierOf(t)), esc(t[5] || "–"), esc(t[3]), esc(SIT[L.status(t, today)])],
      };
    });
    return '<section class="card panel"><h2>Carros no filtro · ' + list.length + '</h2><p class="cap">Importado: contêiner (OF). Nacional: ordem de frete. Linha em destaque: sem transportadora.</p>' + table(["Dia", "Origem", "Transportadora", "Material", "Referência", "Situação"], rows, { tall: true, wrap: [3] }) + "</section>";
  }

  var BASE_NOME = { reaj: "Data prevista reajustada", orig: "Previsão de entrega original" };
  var BASE_CURTO = { reaj: "Reajustada", orig: "Original" };

  function otherBase() { return state.base === "reaj" ? "orig" : "reaj"; }
  function signed(n) { return n > 0 ? "+" + n : String(n); }
  function dias(n) { return n + (Math.abs(n) === 1 ? " dia" : " dias"); }
  function avg(n) {
    var v = Math.round(n * 10) / 10;
    return (v > 0 ? "+" : "") + String(v).replace(".", ",");
  }
  function fullBr(iso) {
    return iso ? L.ddmm(iso) + "/" + iso.slice(0, 4) : "–";
  }

  function prevQuery() {
    var r = range();
    return {
      from: r.from, to: r.to, carrier: state.transp, origin: state.origem,
      chips: state.chips, today: L.todayIso(),
    };
  }

  function prevData(base) {
    var q = prevQuery();
    var done = L.delivered(window.OMNIA_TRUCKS, q, base);
    var pend = L.pending(window.OMNIA_TRUCKS, q, base);
    return { q: q, done: done, pend: pend, m: L.metrics(done, pend) };
  }

  function prevBars(series) {
    var r = range();
    var span = series.length <= 16 ? series : series.filter(function (s) { return s.previsto || s.realizado; });
    if (!span.length) return "";
    var max = Math.max(1, Math.max.apply(null, span.map(function (s) { return Math.max(s.previsto, s.realizado); })));
    var step = Math.max(1, Math.ceil(max / 4));
    var ticks = [];
    for (var v = 0; v <= max; v += step) ticks.push(v);
    if (ticks[ticks.length - 1] !== max) ticks.push(max);
    var W = Math.max(520, span.length * 64);
    var H = 250;
    var padL = 28, padR = 8, padT = 8, padB = 52;
    var iw = W - padL - padR;
    var ih = H - padT - padB;
    var slot = iw / span.length;
    var gap = Math.min(14, slot * 0.3);
    var bw = Math.max(6, (slot - gap) / 2);
    var parts = [];
    ticks.forEach(function (t) {
      var y = padT + ih - (t / max) * ih;
      parts.push('<line x1="' + padL + '" y1="' + y + '" x2="' + (W - padR) + '" y2="' + y + '" stroke="#e3eaf2"/>');
      parts.push('<text x="' + (padL - 4) + '" y="' + (y + 3) + '" text-anchor="end" font-size="10" fill="#8b9aab">' + t + "</text>");
    });
    span.forEach(function (s, i) {
      var x = padL + i * slot + gap / 2;
      var hp = (s.previsto / max) * ih;
      var hr = (s.realizado / max) * ih;
      parts.push('<rect x="' + x + '" y="' + (padT + ih - hp) + '" width="' + bw + '" height="' + hp + '" fill="#8fb0d6"><title>' + esc(L.dayLabel(s.d) + " · previsto: " + s.previsto) + "</title></rect>");
      parts.push('<rect x="' + (x + bw) + '" y="' + (padT + ih - hr) + '" width="' + bw + '" height="' + hr + '" fill="#1a4f8b"><title>' + esc(L.dayLabel(s.d) + " · realizado: " + s.realizado) + "</title></rect>");
      var lx = x + bw;
      var ly = padT + ih + 14;
      parts.push('<text x="' + lx + '" y="' + ly + '" text-anchor="end" font-size="10" fill="#6b7c90" transform="rotate(-40 ' + lx + " " + ly + ')">' + esc(L.dayLabel(s.d)) + "</text>");
    });
    var cap = "Eixo X: dia · Eixo Y: carros · " + L.ddmm(r.from) + " a " + L.ddmm(r.to) + " · previsto na " + BASE_CURTO[state.base].toLowerCase();
    if (series.length > 16) cap += " · somente dias com movimento";
    return '<section class="card panel"><h2>Previsto × realizado por dia</h2><p class="cap">' + cap + '</p><svg viewBox="0 0 ' + W + " " + H + '" width="100%" height="250" role="img" aria-label="Carros previstos e realizados por dia">' + parts.join("") + '</svg><div class="legend"><span><i class="sw" style="background:#8fb0d6"></i>Previsto no dia</span><span><i class="sw" style="background:#1a4f8b"></i>Entregue no dia</span></div></section>';
  }

  function desvioPanel(done) {
    var map = {};
    done.forEach(function (x) { map[x.dev] = (map[x.dev] || 0) + 1; });
    var keys = Object.keys(map).map(Number).sort(function (a, b) { return a - b; });
    var max = Math.max(1, Math.max.apply(null, keys.map(function (k) { return map[k]; })));
    var body = keys.length ? keys.map(function (k) {
      var color = k === 0 ? "#1f8a7a" : k < 0 ? "#8fb0d6" : "#e07b1a";
      var label = k === 0 ? "No prazo" : k < 0 ? "Adiantado " + dias(-k) : "Atrasado " + dias(k);
      return '<div class="hbar"><div class="name">' + esc(label) + '</div><div class="track"><div class="seg" style="width:' + (map[k] / max * 100) + "%;background:" + color + '"></div></div><div class="n">' + map[k] + "</div></div>";
    }).join("") : '<p class="empty">Nenhuma entrega no período.</p>';
    return '<section class="card panel"><h2>Desvio da entrega</h2><p class="cap">Dias entre a previsão (' + esc(BASE_CURTO[state.base].toLowerCase()) + ") e a entrega real</p>" + body + "</section>";
  }

  function compareTable(a, b) {
    function row(label, fa, fb, tone) { return { tone: tone || "", cells: [esc(label), fa, fb] }; }
    var rows = [
      row("Entregues no período", String(a.entregues), String(b.entregues)),
      row("No prazo", String(a.noPrazo), String(b.noPrazo)),
      row("Adiantadas", String(a.adiantadas), String(b.adiantadas)),
      row("Atrasadas", String(a.atrasadas), String(b.atrasadas), "warn"),
      row("Desvio médio (dias)", avg(a.media), avg(b.media)),
      row("% no prazo ou adiantadas", a.pctPrazo + "%", b.pctPrazo + "%"),
      row("Pendentes vencidos", String(a.vencidos), String(b.vencidos), "warn"),
    ];
    return '<section class="card panel"><h2>Comparar as duas previsões</h2><p class="cap">Mesmo período e mesmas entregas, medidas contra cada data</p>' + table(["Indicador", "Reajustada", "Original"], rows, { nums: [1, 2] }) + "</section>";
  }

  function carrierPrazo(done, pend) {
    var names = L.ALL.filter(function (c) {
      return done.some(function (x) { return L.carrierOf(x.t) === c; }) || pend.some(function (x) { return L.carrierOf(x.t) === c; });
    });
    var rows = names.map(function (c) {
      var d = done.filter(function (x) { return L.carrierOf(x.t) === c; });
      var p = pend.filter(function (x) { return L.carrierOf(x.t) === c; });
      var m = L.metrics(d, p);
      return {
        tone: c === L.SEM ? "warn" : "",
        cells: [esc(c), String(m.entregues), String(m.noPrazo), String(m.adiantadas), String(m.atrasadas), m.entregues ? m.pctPrazo + "%" : "–", m.entregues ? avg(m.media) : "–", String(m.vencidos), String(m.aVencer)],
      };
    });
    var t = L.metrics(done, pend);
    rows.push({ tone: "total", cells: ["Total", String(t.entregues), String(t.noPrazo), String(t.adiantadas), String(t.atrasadas), t.entregues ? t.pctPrazo + "%" : "–", t.entregues ? avg(t.media) : "–", String(t.vencidos), String(t.aVencer)] });
    return '<section class="card panel"><h2>Por transportadora</h2><p class="cap">% no prazo = no prazo + adiantadas, sobre as entregues · pendentes: sem DRM com previsão até o fim do período</p>' + table(["Transportadora", "Entregues", "No prazo", "Adiantadas", "Atrasadas", "% no prazo", "Desvio médio", "Pend. vencidos", "A vencer"], rows, { nums: [1, 2, 3, 4, 5, 6, 7, 8] }) + "</section>";
  }

  function dayPrazo(series) {
    var rows = series.filter(function (s) { return s.previsto || s.realizado; }).map(function (s) {
      var diff = s.realizado - s.previsto;
      return { cells: [esc(L.dayLabel(s.d)), String(s.previsto), String(s.realizado), diff === 0 ? "0" : signed(diff), String(s.noPrazo), String(s.adiantadas), String(s.atrasadas)] };
    });
    var tot = series.reduce(function (a, s) {
      return { p: a.p + s.previsto, r: a.r + s.realizado, n: a.n + s.noPrazo, d: a.d + s.adiantadas, t: a.t + s.atrasadas };
    }, { p: 0, r: 0, n: 0, d: 0, t: 0 });
    rows.push({ tone: "total", cells: ["Total", String(tot.p), String(tot.r), signed(tot.r - tot.p), String(tot.n), String(tot.d), String(tot.t)] });
    return '<section class="card panel"><h2>Por dia</h2><p class="cap">Previsto = carros com previsão no dia · Realizado = carros entregues no dia (DRM) · prazo medido sobre os entregues do dia</p>' + table(["Dia", "Previsto", "Realizado", "Realizado − previsto", "No prazo", "Adiantadas", "Atrasadas"], rows, { nums: [1, 2, 3, 4, 5, 6], tall: true }) + "</section>";
  }

  function lateList(done, pend) {
    var other = otherBase();
    var items = [];
    done.forEach(function (x) { if (x.dev > 0) items.push({ x: x, days: x.dev, pend: false }); });
    pend.forEach(function (x) { if (x.vencido) items.push({ x: x, days: x.atraso, pend: true }); });
    items.sort(function (a, b) { return b.days - a.days || (L.plannedDate(a.x.t, state.base) < L.plannedDate(b.x.t, state.base) ? -1 : 1); });
    if (!items.length) return '<section class="card panel"><h2>Carros atrasados</h2><p class="empty">Nenhum carro atrasado neste período.</p></section>';
    var rows = items.map(function (it) {
      var t = it.x.t;
      return {
        tone: it.pend ? "warn" : "",
        cells: [
          it.pend ? "Pendente" : "Entregue com atraso",
          esc(t[3]), esc(L.NOME[t[1]]), esc(L.carrierOf(t)), esc(t[5] || "–"),
          esc(fullBr(L.plannedDate(t, state.base))), esc(fullBr(L.plannedDate(t, other))),
          it.pend ? "–" : esc(fullBr(L.realDate(t))),
          it.pend ? "há " + dias(it.days) : "+" + dias(it.days),
        ],
      };
    });
    return '<section class="card panel"><h2>Carros atrasados · ' + items.length + '</h2><p class="cap">Entregues depois do previsto e pendentes já vencidos, do maior atraso para o menor. Linha em destaque: ainda sem entrega.</p>' + table(["Situação", "Referência", "Origem", "Transportadora", "Material", "Previsto (" + BASE_CURTO[state.base].toLowerCase() + ")", "Previsto (" + BASE_CURTO[other].toLowerCase() + ")", "Entregue em", "Atraso"], rows, { tall: true, wrap: [4] }) + "</section>";
  }

  function viewPrev() {
    var cur = prevData(state.base);
    var alt = prevData(otherBase());
    var m = cur.m;
    var r = range();
    var periodo = L.ddmm(r.from) + " a " + L.ddmm(r.to);
    var series = L.daySeries(window.OMNIA_TRUCKS, cur.q, state.base);
    var control = '<section class="card panel basebar"><div><label class="fld" for="base">Previsto = </label><select id="base"><option value="reaj"' + (state.base === "reaj" ? " selected" : "") + '>Data prevista reajustada</option><option value="orig"' + (state.base === "orig" ? " selected" : "") + '>Previsão de entrega original</option></select></div>'
      + '<p class="rule-text"><b>Regra.</b> Realizado = DATA ENTREGA (DRM) preenchida. O período filtra a data de entrega real. Desvio = entrega real menos o previsto escolhido: 0 no prazo, negativo adiantado, positivo atrasado. Pendente = sem DRM e com previsão até o fim do período; vencido se a previsão é anterior a hoje. % entregue = entregues ÷ (entregues + pendentes vencidos).</p></section>';
    var html = control + '<div class="section">Entregas no período · ' + periodo + '</div><div class="kpis">'
      + kpi("Entregues", String(m.entregues), "DRM no período")
      + kpi("Pendentes vencidos", String(m.vencidos), "sem DRM, previsão antes de hoje", m.vencidos > 0)
      + kpi("% entregue", m.pctEntregue + "%", m.entregues + " de " + m.base + " carros")
      + kpi("A vencer", String(m.aVencer), "sem DRM, previsão de hoje até " + L.ddmm(r.to))
      + "</div>"
      + '<div class="section">Prazo · base ' + esc(BASE_CURTO[state.base].toLowerCase()) + '</div><div class="kpis">'
      + kpi("No prazo", String(m.noPrazo), pct(m.noPrazo, m.entregues) + " das entregues")
      + kpi("Adiantadas", String(m.adiantadas), pct(m.adiantadas, m.entregues) + " das entregues")
      + kpi("Atrasadas", String(m.atrasadas), pct(m.atrasadas, m.entregues) + " das entregues", m.atrasadas > 0)
      + kpi("Desvio médio", m.entregues ? avg(m.media) + " d" : "–", "dias, entregues no período")
      + "</div>";
    if (!m.entregues && !cur.pend.length) return html + '<p class="empty">Nenhuma entrega nem pendência neste período.</p>';
    html += '<div class="charts">' + prevBars(series) + desvioPanel(cur.done) + "</div>";
    html += '<div class="split">' + compareTable(m, alt.m) + carrierPrazo(cur.done, cur.pend) + "</div>";
    html += dayPrazo(series);
    html += lateList(cur.done, cur.pend);
    return html;
  }

  var VIEWS = { geral: viewGeral, dia: viewDia, transp: viewTransp, detalhe: viewDetalhe, prev: viewPrev };

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
    var r = range();
    var list = state.tab === "prev" ? [] : current();
    if (state.tab === "prev") {
      var pd = prevData(state.base);
      $("count").textContent = pd.m.entregues + " entregues e " + pd.m.vencidos + " pendentes vencidos · filtro pela data de entrega real · " + L.ddmm(r.from) + " a " + L.ddmm(r.to);
    } else {
      var nImp = list.filter(function (t) { return t[1] === "I"; }).length;
      $("count").textContent = list.length + " de " + window.OMNIA_TRUCKS.length + " carros · " + nImp + " importado · " + (list.length - nImp) + " nacional · " + L.ddmm(r.from) + " a " + L.ddmm(r.to);
    }
    $("situacao").disabled = state.tab === "prev";
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
    $("view").addEventListener("change", function (e) {
      if (e.target && e.target.id === "base") { state.base = e.target.value; render(); }
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
