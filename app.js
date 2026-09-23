/* Gym Tracker: app personale per scheda, progressione e storico.
   Tutti i dati restano sul telefono (localStorage). */
'use strict';
(function () {

  var APP_VERSION = '1.0.0';
  var STORE_KEY = 'gymtracker.v1';
  var DAY_ORDER = ['lun', 'mer', 'ven'];
  var TARGET_STREAK = 3;

  // Manubri disponibili in palestra: da 1 a 10 kg tutti, poi di 2 in 2
  var DUMBBELLS = (function () {
    var a = [];
    for (var i = 1; i <= 10; i++) a.push(i);
    for (var j = 12; j <= 60; j += 2) a.push(j);
    return a;
  })();

  /* ---------------- scheda iniziale ---------------- */

  function ex(id, name, kind, inc, unit, sets, weight, warmups) {
    return {
      id: id, name: name, kind: kind, inc: inc, unit: unit,
      sets: sets, reps: 8, weight: weight,
      warmups: (warmups || []).map(function (p) { return { w: p[0], r: p[1] }; }),
      rest: 90, note: '', streak: 0, proposed: null
    };
  }

  function defaultConfig() {
    var M = 'manubri', F = 'fisso', PM = 'per manubrio', PC = 'per cavo';
    var list = [
      ex('panca_piana', 'Panca piana con manubri', M, 2, PM, 3, 20, [[12, 1], [16, 1], [20, 1]]),
      ex('panca_inclinata', 'Panca inclinata con manubri', M, 2, PM, 3, 18),
      ex('lat_machine', 'Lat machine', F, 5, '', 3, 45, [[35, 1], [40, 1], [45, 1]]),
      ex('pulley_una_mano', 'Pulley a una mano', F, 5, '', 3, 20, [[15, 1]]),
      ex('corda_trapezi', 'Corda alta trapezi', F, 2.5, '', 2, 20),
      ex('alzate_laterali', 'Alzate laterali', M, 1, PM, 3, 9, [[7, 1]]),
      ex('lento_avanti', 'Lento avanti con manubri', M, 2, PM, 3, 16),
      ex('curl_inclinata', 'Curl su panca inclinata', M, 2, PM, 3, 10, [[8, 6]]),
      ex('push_down', 'Push down', F, 2.5, '', 3, 20, [[15, 6]]),
      ex('leg_press', 'Leg press inclinata', F, 10, '', 3, 120, [[80, 8], [100, 8]]),
      ex('leg_extension', 'Leg extension a una gamba', F, 2.5, '', 3, 22.5, [[20, 8]]),
      ex('leg_curl', 'Leg curl', F, 2.5, '', 3, 35),
      ex('adductor', 'Adductor', F, 2.5, '', 2, 40, [[35, 8]]),
      ex('croci_cavi', 'Croci ai cavi', F, 2.5, PC, 3, 10),
      ex('pulley_centro', 'Pulley centro schiena', F, 2.5, '', 3, 60, [[50, 1]]),
      ex('spinte', 'Macchinario spinte', F, 2.5, '', 3, 45, [[35, 1], [40, 1], [45, 1]]),
      ex('pectoral', 'Macchinario pectoral', F, 2.5, '', 2, 40, [[35, 8]]),
      ex('croci_basse', 'Croci basse ai cavi', F, 2.5, PC, 3, 7.5),
      ex('alzate_posteriori', 'Alzate posteriori', M, 1, PM, 2, 7, [[6, 8]]),
      ex('hammer_curl', 'Cable hammer curl', F, 2.5, '', 3, 20, [[15, 6]]),
      ex('cable_overhead', 'Cable overhead', F, 2.5, '', 3, 15, [[12.5, 6]])
    ];
    var exercises = {};
    list.forEach(function (e) { exercises[e.id] = e; });
    return {
      warmupRest: 45,
      exercises: exercises,
      days: {
        lun: { name: 'Lunedì', sub: 'Petto, schiena, spalle, braccia', weekday: 1,
          ex: ['panca_piana', 'panca_inclinata', 'lat_machine', 'pulley_una_mano', 'corda_trapezi', 'alzate_laterali', 'lento_avanti', 'curl_inclinata', 'push_down'] },
        mer: { name: 'Mercoledì', sub: 'Gambe e richiami', weekday: 3,
          ex: ['leg_press', 'leg_extension', 'leg_curl', 'adductor', 'croci_cavi', 'pulley_centro'] },
        ven: { name: 'Venerdì', sub: 'Petto, schiena, spalle, braccia', weekday: 5,
          ex: ['spinte', 'pectoral', 'croci_basse', 'lat_machine', 'corda_trapezi', 'alzate_laterali', 'alzate_posteriori', 'hammer_curl', 'cable_overhead'] }
      }
    };
  }

  /* ---------------- salvataggio ---------------- */

  var S = null;

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var data = JSON.parse(raw);
        if (data && data.config && data.sessions) return normalize(data);
      }
    } catch (e) { /* dati illeggibili: si riparte */ }
    return { v: 1, config: defaultConfig(), sessions: [], active: null };
  }

  function normalize(data) {
    data.v = 1;
    if (typeof data.config.warmupRest !== 'number') data.config.warmupRest = 45;
    Object.keys(data.config.exercises).forEach(function (k) {
      var e = data.config.exercises[k];
      if (!Array.isArray(e.warmups)) e.warmups = [];
      if (typeof e.streak !== 'number') e.streak = 0;
      if (e.proposed === undefined) e.proposed = null;
      if (typeof e.note !== 'string') e.note = '';
      if (typeof e.rest !== 'number') e.rest = 90;
      if (typeof e.reps !== 'number') e.reps = 8;
    });
    if (!Array.isArray(data.sessions)) data.sessions = [];
    if (data.active === undefined) data.active = null;
    return data;
  }

  var saveError = false;
  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(S));
      saveError = false;
    } catch (e) {
      saveError = true;
    }
  }

  /* ---------------- utilità ---------------- */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(n) {
    if (n == null || isNaN(n)) return '';
    var r = Math.round(n * 100) / 100;
    return String(r).replace('.', ',');
  }
  function parseNum(v) {
    var n = parseFloat(String(v).replace(',', '.'));
    return isNaN(n) ? null : n;
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function E(id) { return S.config.exercises[id]; }
  function unitTxt(e) { return e.unit ? ' ' + e.unit : ''; }
  function nextWeight(e, w) {
    if (e.kind === 'manubri') {
      for (var i = 0; i < DUMBBELLS.length; i++) if (DUMBBELLS[i] > w + 1e-9) return DUMBBELLS[i];
      return w + 2;
    }
    return Math.round((w + (e.inc || 2.5)) * 100) / 100;
  }
  function prevWeight(e, w) {
    if (e.kind === 'manubri') {
      for (var i = DUMBBELLS.length - 1; i >= 0; i--) if (DUMBBELLS[i] < w - 1e-9) return DUMBBELLS[i];
      return Math.max(0, w - 1);
    }
    return Math.max(0, Math.round((w - (e.inc || 2.5)) * 100) / 100);
  }
  function dateTxt(ts) {
    return new Date(ts).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
  }
  function durTxt(ms) {
    var m = Math.max(1, Math.round(ms / 60000));
    if (m < 60) return m + ' min';
    var h = Math.floor(m / 60), mm = m % 60;
    return h + ' h ' + (mm < 10 ? '0' : '') + mm + ' min';
  }
  function clock(ms) {
    var s = Math.max(0, Math.ceil(ms / 1000));
    var m = Math.floor(s / 60), ss = s % 60;
    return m + ':' + (ss < 10 ? '0' : '') + ss;
  }
  function todayKey() {
    var wd = new Date().getDay();
    for (var i = 0; i < DAY_ORDER.length; i++) {
      var d = S.config.days[DAY_ORDER[i]];
      if (d && d.weekday === wd) return DAY_ORDER[i];
    }
    return null;
  }
  function nextDayKey() {
    var wd = new Date().getDay();
    for (var k = 1; k <= 7; k++) {
      var w = (wd + k) % 7;
      for (var i = 0; i < DAY_ORDER.length; i++) {
        if (S.config.days[DAY_ORDER[i]].weekday === w) return DAY_ORDER[i];
      }
    }
    return DAY_ORDER[0];
  }
  function daysWith(id) {
    return DAY_ORDER.filter(function (k) { return S.config.days[k].ex.indexOf(id) >= 0; });
  }
  function lastEntry(id) {
    for (var i = S.sessions.length - 1; i >= 0; i--) {
      var s = S.sessions[i];
      for (var j = 0; j < s.entries.length; j++) {
        var en = s.entries[j];
        if (en.id === id && !en.skipped) return { at: s.start, en: en };
      }
    }
    return null;
  }
  function historyOf(id) {
    var out = [];
    S.sessions.forEach(function (s) {
      s.entries.forEach(function (en) {
        if (en.id === id && !en.skipped) out.push({ at: s.start, en: en });
      });
    });
    return out;
  }
  function workReps(en) {
    return en.sets.filter(function (x) { return x.t === 's'; }).map(function (x) { return x.r; });
  }

  /* ---------------- icone ---------------- */

  function svg(d, size, sw) {
    return '<svg width="' + (size || 20) + '" height="' + (size || 20) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (sw || 2) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  }
  var IC = {
    back: svg('<path d="M15 18l-6-6 6-6"/>'),
    chev: svg('<path d="M9 18l6-6-6-6"/>', 18),
    check: svg('<path d="M20 6L9 17l-5-5"/>', 26, 3),
    checkS: svg('<path d="M20 6L9 17l-5-5"/>', 18, 3),
    arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>', 24, 2.5),
    home: svg('<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>', 24),
    chart: svg('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>', 24),
    sliders: svg('<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>', 24),
    trash: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', 20),
    up: svg('<path d="M12 19V5M6 11l6-6 6 6"/>', 20),
    down: svg('<path d="M12 5v14M6 13l6 6 6-6"/>', 20)
  };

  /* ---------------- stato dell'interfaccia ---------------- */

  var ui = { screen: 'home', histEx: null, editEx: null, editDay: null, draft: null, summary: null };
  var lastScreen = null;

  function go(screen, opts) {
    ui.screen = screen;
    if (opts) Object.keys(opts).forEach(function (k) { ui[k] = opts[k]; });
    closeSheet();
    render();
    window.scrollTo(0, 0);
  }

  function render() {
    var html;
    switch (ui.screen) {
      case 'workout': html = S.active ? viewWorkout() : viewHome(); break;
      case 'summary': html = viewSummary(); break;
      case 'storico': html = viewHistory(); break;
      case 'storico-ex': html = viewHistoryEx(); break;
      case 'scheda': html = viewPlan(); break;
      case 'edit-ex': html = viewEdit(); break;
      default: ui.screen = 'home'; html = viewHome();
    }
    var y = window.scrollY;
    document.getElementById('app').innerHTML = html;
    if (lastScreen === ui.screen) window.scrollTo(0, y);
    lastScreen = ui.screen;
  }

  function tabbar(active) {
    function t(key, label, icon) {
      return '<button type="button" class="tab' + (active === key ? ' on' : '') + '" data-a="tab" data-v="' + key + '"' + (active === key ? ' aria-current="page"' : '') + '>' + icon + label + '</button>';
    }
    return '<nav class="tabbar" aria-label="Menu principale"><div class="in">' +
      t('home', 'Home', IC.home) + t('storico', 'Storico', IC.chart) + t('scheda', 'Scheda', IC.sliders) +
      '</div></nav>';
  }

  /* ---------------- HOME ---------------- */

  function viewHome() {
    var h = '<main class="screen with-tabs">';
    if (saveError) h += '<div class="note-box mt-10">Attenzione: il telefono non riesce a salvare i dati. Fai un backup dalla sezione Scheda.</div>';

    if (S.active) {
      var d = S.config.days[S.active.day];
      var doneCount = S.active.entries.filter(function (e) { return e.status !== 'todo'; }).length;
      h += '<div class="stack gap-4" style="padding-top:18px">' +
        '<span class="label">Allenamento in corso</span>' +
        '<h1 class="title-xl">' + esc(d.name) + '</h1>' +
        '<span class="muted">' + doneCount + ' esercizi su ' + S.active.entries.length + ' · iniziato ' + durTxt(Date.now() - S.active.start) + ' fa</span></div>';
      h += '<div class="mt-24"><button type="button" class="cta" data-a="resume">Riprendi allenamento ' + IC.arrow + '</button></div>';
      h += '<div class="mt-10" style="text-align:center"><button type="button" class="text-btn danger" data-a="ask-cancel">Annulla allenamento</button></div>';
      h += '</main>' + tabbar('home');
      return h;
    }

    var tk = todayKey();
    var last = S.sessions[S.sessions.length - 1];

    if (tk) {
      var day = S.config.days[tk];
      h += '<div class="stack gap-4" style="padding-top:18px">' +
        '<span class="label">Oggi</span>' +
        '<h1 class="title-xl">' + esc(day.name) + '</h1>' +
        '<span class="muted">' + esc(day.sub) + ' · ' + day.ex.length + ' esercizi</span></div>';
      h += progressCard(tk);
      h += '<div class="mt-18"><button type="button" class="cta" data-a="start" data-v="' + tk + '">Inizia allenamento ' + IC.arrow + '</button></div>';
      var others = DAY_ORDER.filter(function (k) { return k !== tk; });
      h += '<div class="stack gap-10 mt-24"><span class="label">Oppure scegli un altro giorno</span><div class="day-grid">' +
        others.map(dayBtn).join('') + '</div></div>';
    } else {
      var nk = nextDayKey();
      h += '<div class="stack gap-4" style="padding-top:18px">' +
        '<span class="label">Oggi</span>' +
        '<h1 class="title-xl">Niente pesi</h1>' +
        '<span class="muted">Giorno di corsa o riposo. Il prossimo è ' + esc(S.config.days[nk].name.toLowerCase()) + '.</span></div>';
      h += '<div class="stack gap-10 mt-24"><span class="label">Vuoi allenarti lo stesso?</span><div class="day-grid">' +
        DAY_ORDER.map(dayBtn).join('') + '</div></div>';
      h += progressCard(nk, 'Il prossimo allenamento');
    }

    if (last) {
      h += '<p class="muted small mt-18">Ultimo allenamento: ' + esc(S.config.days[last.day] ? S.config.days[last.day].name : '') +
        ', fatto ' + esc(dateTxt(last.start)) + ' · ' + last.entries.filter(function (e) { return !e.skipped; }).length + ' esercizi su ' + last.entries.length + '</p>';
    }
    h += '</main>' + tabbar('home');
    return h;
  }

  function dayBtn(k) {
    var d = S.config.days[k];
    var ups = d.ex.filter(function (id) { return E(id) && E(id).proposed != null; }).length;
    return '<button type="button" class="day-btn" data-a="start" data-v="' + k + '"><span class="d">' + esc(d.name) + '</span><span class="xsmall muted">' + esc(d.sub) + ' · ' + d.ex.length + '</span>' +
      (ups ? '<span class="xsmall accent" style="font-weight:600">' + ups + (ups === 1 ? ' aumento pronto' : ' aumenti pronti') + '</span>' : '') + '</button>';
  }

  function progressCard(k, title) {
    var d = S.config.days[k];
    var ups = [], near = [];
    d.ex.forEach(function (id) {
      var e = E(id); if (!e) return;
      if (e.proposed != null) ups.push(e);
      else if (e.streak === TARGET_STREAK - 1) near.push(e);
    });
    if (!ups.length && !near.length) return '';
    var h = '<div class="card stack gap-12 mt-18">';
    if (title) h += '<span class="label">' + esc(title) + ': ' + esc(d.name.toLowerCase()) + '</span>';
    if (ups.length) {
      h += '<span class="label">' + (title ? 'Si sale' : 'Oggi si sale') + '</span>';
      ups.forEach(function (e) {
        h += '<div class="between"><span>' + esc(e.name) + '</span><span class="num" style="font-size:19px;white-space:nowrap">' + fmt(e.weight) + ' → <span class="accent">' + fmt(e.proposed) + ' kg</span></span></div>';
      });
    }
    if (ups.length && near.length) h += '<div class="divider"></div>';
    if (near.length) {
      h += '<span class="label">Manca una sessione</span>';
      near.forEach(function (e) {
        h += '<div class="between"><span>' + esc(e.name) + '</span><span class="small muted">2 su 3</span></div>';
      });
    }
    return h + '</div>';
  }

  /* ---------------- ALLENAMENTO ---------------- */

  function newEntry(id) {
    var e = E(id);
    var w = e.proposed != null ? e.proposed : e.weight;
    var sets = [];
    e.warmups.forEach(function (x) { sets.push({ t: 'w', w: x.w, r: x.r, done: false }); });
    for (var i = 0; i < e.sets; i++) sets.push({ t: 's', w: w, r: e.reps, done: false });
    return { id: id, status: 'todo', sets: sets, cur: 0, declined: false };
  }

  function startWorkout(k) {
    var d = S.config.days[k];
    var entries = d.ex.filter(function (id) { return !!E(id); }).map(newEntry);
    S.active = { id: uid(), day: k, start: Date.now(), idx: 0, entries: entries, rest: null };
    save();
    requestWake();
    go('workout');
  }

  function nextTodo(a, from) {
    var n = a.entries.length;
    for (var k = 1; k <= n; k++) {
      var i = (from + k) % n;
      if (a.entries[i].status === 'todo') return i;
    }
    return -1;
  }

  function viewWorkout() {
    var a = S.active;
    var d = S.config.days[a.day];
    var en = a.entries[a.idx];
    var e = E(en.id);
    var h = '<main class="screen">';

    h += '<div class="topbar"><button type="button" class="back" data-a="tab" data-v="home" aria-label="Torna alla Home">' + IC.back + esc(d.name) + ' · ' + (a.idx + 1) + ' di ' + a.entries.length + '</button>' +
      '<button type="button" class="pill-btn" data-a="list">Elenco</button></div>';

    // nome e ultima volta
    var le = lastEntry(en.id);
    var lastTxt = le ? 'Ultima volta ' + fmt(le.en.used) + ' kg × ' + workReps(le.en).join(', ') : 'Prima volta con questo esercizio';
    h += '<div class="stack gap-6 mt-10"><h1 class="title">' + esc(e.name) + '</h1><p class="muted">' + esc(lastTxt) + '</p></div>';
    if (e.note) h += '<div class="note-box mt-10">' + esc(e.note) + '</div>';

    // progressione
    if (e.proposed != null && !en.declined) {
      h += '<div class="propose mt-14"><span class="p">Oggi prova ' + fmt(e.proposed) + ' kg</span>' +
        '<button type="button" data-a="decline">Resto a ' + fmt(e.weight) + ' kg</button></div>';
    } else if (e.proposed != null && en.declined) {
      h += '<p class="muted xsmall mt-14">Aumento rimandato: la prossima volta ti riproporrà ' + fmt(e.proposed) + ' kg.</p>';
    } else {
      var segs = '';
      for (var i = 0; i < TARGET_STREAK; i++) segs += '<div class="seg' + (i < e.streak ? ' on' : '') + '"></div>';
      h += '<div class="stack gap-8 mt-14"><div class="segs" style="grid-template-columns:repeat(' + TARGET_STREAK + ',minmax(0,1fr))">' + segs + '</div>' +
        '<span class="xsmall muted">' + e.streak + (e.streak === 1 ? ' sessione' : ' sessioni') + ' su ' + TARGET_STREAK + ' a ' + e.reps + ' ripetizioni · poi si sale a ' + fmt(nextWeight(e, e.weight)) + ' kg</span></div>';
    }

    // pallini delle serie
    var dots = '', wi = 0, si = 0, hadW = false;
    en.sets.forEach(function (s, idx) {
      var cls = 'dot' + (s.t === 'w' ? ' w' : '') + (s.done ? ' done' : '') + (idx === en.cur ? ' cur' : '');
      if (s.t === 'w') { wi++; hadW = true; }
      else {
        if (si === 0 && hadW) dots += '<span class="sep"></span>';
        si++;
      }
      var label = s.t === 'w' ? 'I' : String(si);
      var aria = (s.t === 'w' ? 'Ingresso ' + wi : 'Serie ' + si) + (s.done ? ', fatta' : '');
      dots += '<button type="button" class="' + cls + '" data-a="pick" data-v="' + idx + '" aria-label="' + aria + '">' + (s.done && s.t === 's' && idx !== en.cur ? IC.checkS : label) + '</button>';
    });
    h += '<div class="dots mt-18">' + dots + (hadW ? '<span class="xsmall muted" style="margin-left:auto">I = ingresso</span>' : '') + '</div>';

    // timer
    if (a.rest) {
      h += '<div class="timer mt-18" id="timer"><div class="stack gap-2"><span class="xsmall" style="color:#CFC8B8">Recupero</span><span class="t" id="tt">' + clock(a.rest.end - Date.now()) + '</span></div>' +
        '<div class="row gap-8"><button type="button" class="tb" data-a="rest-add">+15 s</button><button type="button" class="tb light" data-a="rest-skip">Salta</button></div></div>';
    }

    if (en.status === 'skip') {
      h += '<div class="set-card mt-14"><span class="label">Esercizio saltato</span><p class="muted">Non conta né a favore né contro la progressione.</p></div>';
      h += '<div class="mt-14"><button type="button" class="cta" data-a="unskip">Fallo comunque</button></div>';
    } else {
      var s = en.sets[en.cur];
      var nW = en.sets.filter(function (x) { return x.t === 'w'; }).length;
      var nS = en.sets.length - nW;
      var head = s.t === 'w' ? 'Ingresso ' + (en.cur + 1) + ' di ' + nW : 'Serie ' + (en.cur - nW + 1) + ' di ' + nS;
      if (s.done) head += ' · fatta';
      h += '<div class="set-card mt-14"><span class="label">' + head + '</span>' +
        '<div class="stepper"><span class="lbl">Kg' + (e.unit ? '<br><span style="font-size:12px;white-space:nowrap">' + esc(e.unit) + '</span>' : '') + '</span>' +
        '<button type="button" class="step-btn" data-a="w-" aria-label="Diminuisci peso">−</button>' +
        '<button type="button" class="big-num" data-a="w-edit" aria-label="Scrivi il peso">' + fmt(s.w) + '</button>' +
        '<button type="button" class="step-btn" data-a="w+" aria-label="Aumenta peso">+</button></div>' +
        '<div class="divider"></div>' +
        '<div class="stepper"><span class="lbl">Ripetizioni</span>' +
        '<button type="button" class="step-btn" data-a="r-" aria-label="Diminuisci ripetizioni">−</button>' +
        '<button type="button" class="big-num" data-a="r-edit" aria-label="Scegli le ripetizioni">' + s.r + '</button>' +
        '<button type="button" class="step-btn" data-a="r+" aria-label="Aumenta ripetizioni">+</button></div></div>';

      // pulsante principale
      var cta;
      var firstOpen = en.sets.findIndex(function (x) { return !x.done; });
      if (!s.done) cta = '<button type="button" class="cta" data-a="done">' + IC.check + 'Fatto</button>';
      else if (firstOpen >= 0) cta = '<button type="button" class="cta" data-a="pick" data-v="' + firstOpen + '">Vai alla serie da fare</button>';
      else if (nextTodo(a, a.idx) >= 0) cta = '<button type="button" class="cta" data-a="next-ex">Prossimo esercizio ' + IC.arrow + '</button>';
      else cta = '<button type="button" class="cta dark" data-a="ask-finish">Termina allenamento</button>';
      h += '<div class="mt-14">' + cta + '</div>';
    }

    // piè di pagina
    var ni = nextTodo(a, a.idx);
    var nextName = ni >= 0 && ni !== a.idx ? E(a.entries[ni].id).name : null;
    h += '<div class="between mt-auto" style="padding-top:18px">' +
      '<div class="row gap-14"><button type="button" class="text-btn" data-a="note">' + (e.note ? 'Nota' : '+ Nota') + '</button>' +
      (en.status !== 'skip' ? '<button type="button" class="text-btn" data-a="skip">Salta</button>' : '') + '</div>' +
      (nextName ? '<button type="button" class="text-btn ink row gap-4" data-a="goto" data-v="' + ni + '" style="max-width:60%;min-width:0"><span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Dopo: ' + esc(nextName) + '</span>' + IC.chev + '</button>' : '') +
      '</div>';
    return h + '</main>';
  }

  function curSet() { var en = S.active.entries[S.active.idx]; return en.sets[en.cur]; }

  function setWeight(val) {
    var en = S.active.entries[S.active.idx];
    var s = en.sets[en.cur];
    s.w = val;
    if (s.t === 's') {
      // i pesi delle serie di lavoro successive non ancora fatte seguono
      for (var i = en.cur + 1; i < en.sets.length; i++) {
        if (en.sets[i].t === 's' && !en.sets[i].done) en.sets[i].w = val;
      }
    }
    save(); render();
  }

  function markDone() {
    var a = S.active, en = a.entries[a.idx], e = E(en.id);
    var s = en.sets[en.cur];
    if (s.done) return;
    s.done = true;
    startRest(s.t === 'w' ? S.config.warmupRest : e.rest);
    var open = en.sets.findIndex(function (x) { return !x.done; });
    if (open >= 0) en.cur = open;
    else {
      en.status = 'done';
      var ni = nextTodo(a, a.idx);
      if (ni >= 0) a.idx = ni;
    }
    save(); render();
    if (en.status === 'done') window.scrollTo(0, 0);
  }

  function startRest(sec) {
    if (!sec || sec <= 0) { S.active.rest = null; return; }
    S.active.rest = { end: Date.now() + sec * 1000 };
  }

  /* ---------------- fine allenamento e progressione ---------------- */

  function finishWorkout() {
    var a = S.active;
    var end = Date.now();
    var sum = { day: a.day, start: a.start, end: end, done: 0, total: a.entries.length, up: [], near: [], reset: [], skipped: [] };
    var sess = { id: a.id, day: a.day, start: a.start, end: end, entries: [] };
    a.entries.forEach(function (en) {
      var e = E(en.id);
      if (!e) return;
      var any = en.sets.some(function (x) { return x.done; });
      if (en.status === 'skip' || !any) {
        sum.skipped.push(e.name);
        sess.entries.push({ id: en.id, skipped: true });
        return;
      }
      sum.done++;
      var work = en.sets.filter(function (x) { return x.t === 's'; });
      var doneWork = work.filter(function (x) { return x.done; });
      var used = doneWork.length ? Math.min.apply(null, doneWork.map(function (x) { return x.w; })) : e.weight;
      var hit = work.length > 0 && work.every(function (x) { return x.done && x.r >= e.reps; });
      var why = '';
      if (!hit) {
        for (var i = 0; i < work.length; i++) {
          if (!work[i].done) { why = 'Serie ' + (i + 1) + ' non fatta'; break; }
          if (work[i].r < e.reps) { why = 'Serie ' + (i + 1) + ' a ' + work[i].r + ' ripetizioni'; break; }
        }
      }
      sess.entries.push({
        id: en.id, used: used, hit: hit,
        sets: en.sets.filter(function (x) { return x.done; }).map(function (x) { return { t: x.t, w: x.w, r: x.r }; })
      });
      applyProgression(e, used, hit, why, sum);
    });
    if (sum.done > 0) S.sessions.push(sess);
    S.active = null;
    save();
    releaseWake();
    ui.summary = sum;
    go(sum.done > 0 ? 'summary' : 'home');
  }

  // Regola: 3 sessioni consecutive con tutte le serie di lavoro a 8 ripetizioni = aumento.
  // Esercizio saltato: nessun effetto. Sessione non chiusa a 8: conteggio a zero.
  function applyProgression(e, used, hit, why, sum) {
    if (e.proposed != null) {
      if (used >= e.proposed - 1e-9) {
        e.weight = used; e.proposed = null; e.streak = hit ? 1 : 0;
      } else {
        e.weight = used; // aumento rifiutato: la proposta resta per la prossima volta
      }
    } else if (Math.abs(used - e.weight) > 1e-9) {
      e.weight = used; e.streak = hit ? 1 : 0; // peso cambiato a mano: si riparte da qui
    } else {
      e.streak = hit ? e.streak + 1 : 0;
    }
    if (e.proposed == null && e.streak >= TARGET_STREAK) {
      e.proposed = nextWeight(e, e.weight);
      e.streak = 0;
    }
    if (e.proposed != null) sum.up.push({ name: e.name, from: e.weight, to: e.proposed });
    else if (hit) sum.near.push({ name: e.name, streak: e.streak });
    else sum.reset.push({ name: e.name, why: why });
  }

  function viewSummary() {
    var s = ui.summary;
    if (!s) return viewHome();
    var d = S.config.days[s.day];
    var h = '<main class="screen">';
    h += '<div class="stack gap-10 center" style="padding-top:30px"><div class="ok-circle">' + svg('<path d="M20 6L9 17l-5-5"/>', 36, 3) + '</div>' +
      '<h1 class="title" style="font-size:32px">Allenamento finito</h1>' +
      '<span class="muted">' + esc(d ? d.name : '') + ' · ' + s.done + ' esercizi su ' + s.total + ' · ' + durTxt(s.end - s.start) + '</span></div>';
    if (s.up.length) {
      h += '<div class="card-dark stack gap-12 mt-24"><span class="label">La prossima volta si sale</span>' +
        s.up.map(function (u) { return '<div class="between"><span>' + esc(u.name) + '</span><span class="num" style="font-size:19px;white-space:nowrap">' + fmt(u.from) + ' → ' + fmt(u.to) + ' kg</span></div>'; }).join('') + '</div>';
    }
    if (s.near.length || s.reset.length) {
      h += '<div class="card stack gap-12 mt-14">';
      if (s.near.length) {
        h += '<span class="label">Verso l\'aumento</span>';
        s.near.forEach(function (n) {
          var ms = '';
          for (var i = 0; i < TARGET_STREAK; i++) ms += '<span' + (i < n.streak ? ' class="on"' : '') + '></span>';
          h += '<div class="between"><span>' + esc(n.name) + '</span><span class="row gap-8 small muted" style="white-space:nowrap"><span class="mini-segs">' + ms + '</span>' + n.streak + ' su 3</span></div>';
        });
      }
      if (s.near.length && s.reset.length) h += '<div class="divider"></div>';
      if (s.reset.length) {
        h += '<span class="label">Si riparte da 0</span>';
        s.reset.forEach(function (r) {
          h += '<div class="stack gap-2"><span>' + esc(r.name) + '</span><span class="xsmall muted">' + esc(r.why) + '</span></div>';
        });
      }
      h += '</div>';
    }
    h += '<div class="between mt-14" style="padding:14px 20px;border-radius:18px;border:1px dashed #CFC8B8"><span class="muted">Esercizi saltati</span><span style="font-weight:500;text-align:right">' +
      (s.skipped.length ? esc(s.skipped.join(', ')) : 'Nessuno') + '</span></div>';
    h += '<div class="mt-auto" style="padding-top:24px"><button type="button" class="cta" data-a="tab" data-v="home">Chiudi</button></div>';
    return h + '</main>';
  }

  /* ---------------- STORICO ---------------- */

  function viewHistory() {
    var h = '<main class="screen with-tabs"><div class="stack gap-4" style="padding-top:18px"><h1 class="title-xl" style="font-size:40px">Storico</h1>' +
      '<span class="muted">' + (S.sessions.length ? S.sessions.length + ' allenamenti salvati' : 'Ancora nessun allenamento salvato') + '</span></div>';
    var seen = {};
    DAY_ORDER.forEach(function (k) {
      var d = S.config.days[k];
      h += '<div class="stack mt-24"><span class="label" style="padding-bottom:4px">' + esc(d.name) + '</span><div class="list">';
      d.ex.forEach(function (id) {
        var e = E(id); if (!e) return;
        var n = historyOf(id).length;
        var sub = fmt(e.weight) + ' kg · ' + (e.proposed != null ? 'prossima volta ' + fmt(e.proposed) + ' kg' : e.streak + ' su 3') + ' · ' + n + (n === 1 ? ' sessione' : ' sessioni');
        h += '<button type="button" class="list-row" data-a="hist" data-v="' + id + '"><span class="stack gap-2"><span class="nm">' + esc(e.name) + '</span><span class="sb">' + esc(sub) + '</span></span><span class="chev">' + IC.chev + '</span></button>';
        seen[id] = 1;
      });
      h += '</div></div>';
    });
    return h + '</main>' + tabbar('storico');
  }

  function viewHistoryEx() {
    var e = E(ui.histEx);
    if (!e) return viewHistory();
    var hist = historyOf(e.id);
    var h = '<main class="screen with-tabs">';
    h += '<div class="topbar"><button type="button" class="back" data-a="tab" data-v="storico">' + IC.back + 'Storico</button></div>';
    h += '<div class="stack gap-4 mt-6"><h1 class="title">' + esc(e.name) + '</h1><span class="muted">' +
      esc(daysWith(e.id).map(function (k) { return S.config.days[k].name; }).join(' e ') || 'Non in scheda') + (e.unit ? ' · peso ' + esc(e.unit) : '') + '</span></div>';
    var nextW = e.proposed != null ? e.proposed : nextWeight(e, e.weight);
    h += '<div class="tiles mt-18">' +
      '<div class="tile"><span class="xsmall muted">Attuale</span><span class="v">' + fmt(e.weight) + ' kg</span></div>' +
      '<div class="tile"><span class="xsmall muted">' + (e.proposed != null ? 'Prossima volta' : 'Obiettivo') + '</span><span class="v accent">' + fmt(nextW) + ' kg</span></div>' +
      '<div class="tile"><span class="xsmall muted">Progressione</span><span class="v">' + (e.proposed != null ? 'Si sale' : e.streak + ' su 3') + '</span></div></div>';

    h += '<div class="card chart stack gap-6 mt-14" style="padding:16px 12px 10px 14px"><span class="label">Peso di lavoro</span>' + chartSvg(hist, nextW) + '</div>';

    h += '<div class="stack mt-18"><span class="label" style="padding-bottom:4px">Sessioni</span><div class="list">';
    if (!hist.length) h += '<div class="empty">Nessuna sessione ancora. Dopo il primo allenamento la trovi qui.</div>';
    hist.slice().reverse().slice(0, 40).forEach(function (x) {
      h += '<div class="list-row" style="min-height:52px"><span class="stack"><span style="font-weight:500">' + esc(dateTxt(x.at)) + '</span><span class="sb">' + fmt(x.en.used) + ' kg</span></span>' +
        '<span class="row gap-10"><span class="num" style="font-size:18px">' + workReps(x.en).join(' · ') + '</span><span class="status' + (x.en.hit ? ' done' : '') + '"></span></span></div>';
    });
    h += '</div></div>';
    return h + '</main>' + tabbar('storico');
  }

  function chartSvg(hist, target) {
    var pts = hist.slice(-12).map(function (x) { return x.en.used; });
    if (pts.length < 2) return '<p class="muted small" style="padding:18px 2px">Il grafico compare dopo almeno 2 sessioni.</p>';
    var W = 322, H = 170, padL = 10, padR = 36, padT = 16, padB = 14;
    var all = pts.concat([target]);
    var lo = Math.min.apply(null, all), hi = Math.max.apply(null, all);
    if (hi - lo < 1) { hi += 1; lo -= 1; }
    var span = hi - lo; lo -= span * 0.12; hi += span * 0.08;
    var n = pts.length + 1;
    function X(i) { return padL + i * (W - padL - padR) / (n - 1); }
    function Y(v) { return padT + (hi - v) * (H - padT - padB) / (hi - lo); }
    var ticks = [];
    var step = niceStep((hi - lo) / 3);
    for (var t = Math.ceil(lo / step) * step; t <= hi; t += step) ticks.push(Math.round(t * 100) / 100);
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Andamento del peso di lavoro">';
    ticks.forEach(function (t) {
      s += '<line x1="0" x2="' + (W - padR + 6) + '" y1="' + Y(t) + '" y2="' + Y(t) + '" stroke="#ECE7DC" stroke-width="1"/>' +
        '<text x="' + (W - padR + 10) + '" y="' + (Y(t) + 4) + '" font-size="11" fill="#5E5A52" font-family="IBM Plex Sans, sans-serif">' + fmt(t) + '</text>';
    });
    var line = pts.map(function (v, i) { return X(i) + ',' + Y(v); }).join(' ');
    s += '<polyline points="' + line + '" fill="none" stroke="#C8421A" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>';
    s += '<polyline points="' + X(pts.length - 1) + ',' + Y(pts[pts.length - 1]) + ' ' + X(n - 1) + ',' + Y(target) + '" fill="none" stroke="#C8421A" stroke-width="2" stroke-dasharray="4 5" stroke-linecap="round"/>';
    pts.forEach(function (v, i) { s += '<circle cx="' + X(i) + '" cy="' + Y(v) + '" r="4.5" fill="#C8421A"/>'; });
    s += '<circle cx="' + X(n - 1) + '" cy="' + Y(target) + '" r="4.5" fill="#fff" stroke="#C8421A" stroke-width="2" stroke-dasharray="3 3"/>';
    return s + '</svg>';
  }
  function niceStep(raw) {
    var opts = [0.5, 1, 2, 2.5, 5, 10, 20, 25, 50];
    for (var i = 0; i < opts.length; i++) if (opts[i] >= raw) return opts[i];
    return 100;
  }

  /* ---------------- SCHEDA ---------------- */

  function viewPlan() {
    var h = '<main class="screen with-tabs"><div class="stack gap-4" style="padding-top:18px"><h1 class="title-xl" style="font-size:40px">Scheda</h1>' +
      '<span class="muted">Tocca un esercizio per modificarlo.</span></div>';
    DAY_ORDER.forEach(function (k) {
      var d = S.config.days[k];
      h += '<div class="stack mt-24"><div class="between" style="padding-bottom:4px"><span class="label">' + esc(d.name) + ' · ' + esc(d.sub) + '</span></div><div class="list">';
      d.ex.forEach(function (id) {
        var e = E(id); if (!e) return;
        var sub = e.sets + ' × ' + e.reps + ' · ' + fmt(e.weight) + ' kg' + unitTxt(e) + (e.warmups.length ? ' · ' + e.warmups.length + ' di ingresso' : '');
        h += '<button type="button" class="list-row" data-a="edit" data-v="' + id + '" data-d="' + k + '"><span class="stack gap-2"><span class="nm">' + esc(e.name) + '</span><span class="sb">' + esc(sub) + '</span></span><span class="chev">' + IC.chev + '</span></button>';
      });
      h += '<button type="button" class="list-row" data-a="add-ex" data-v="' + k + '" style="color:var(--accent);font-weight:600">+ Aggiungi esercizio</button>';
      h += '</div></div>';
    });

    h += '<div class="card stack gap-12 mt-24"><span class="label">Impostazioni</span>' +
      '<label class="field"><span>Recupero dopo le serie di ingresso (secondi)</span><input class="input" id="set-wrest" type="number" inputmode="numeric" min="0" step="5" value="' + S.config.warmupRest + '"></label>' +
      '<p class="xsmall muted">Il recupero delle serie di lavoro si imposta in ogni esercizio.</p></div>';

    h += '<div class="card stack gap-12 mt-14"><span class="label">Backup</span>' +
      '<p class="small muted">I dati sono salvati solo su questo telefono. Salva ogni tanto una copia (ad esempio su iCloud Drive) per non perderli se cambi telefono.</p>' +
      '<button type="button" class="btn primary block" data-a="export">Salva backup</button>' +
      '<button type="button" class="btn block" data-a="import">Carica un backup</button>' +
      '<input type="file" id="import-file" accept="application/json,.json" style="display:none"></div>';
    h += '<p class="xsmall muted mt-18" style="text-align:center">Gym Tracker ' + APP_VERSION + '</p>';
    return h + '</main>' + tabbar('scheda');
  }

  function viewEdit() {
    var e = ui.draft;
    if (!e) return viewPlan();
    var isNew = !E(e.id);
    var h = '<main class="screen">';
    h += '<div class="topbar"><button type="button" class="back" data-a="tab" data-v="scheda">' + IC.back + 'Scheda</button></div>';
    h += '<h1 class="title mt-6">' + (isNew ? 'Nuovo esercizio' : esc(e.name)) + '</h1>';
    var shared = daysWith(e.id).filter(function (k) { return k !== ui.editDay; });
    if (shared.length) h += '<p class="note-box mt-10">Questo esercizio è anche nel giorno ' + esc(shared.map(function (k) { return S.config.days[k].name; }).join(' e ')) + ': le modifiche valgono per tutti e lo storico è unico.</p>';

    h += '<div class="stack gap-14 mt-18">' +
      '<label class="field"><span>Nome</span><input class="input" id="f-name" value="' + esc(e.name) + '" placeholder="Es. Panca piana"></label>' +
      '<label class="field"><span>Come sale il peso</span><select class="input" id="f-kind" data-change="kind">' +
      '<option value="manubri"' + (e.kind === 'manubri' ? ' selected' : '') + '>Manubrio successivo (1-10, poi 12, 14…)</option>' +
      '<option value="fisso"' + (e.kind === 'fisso' ? ' selected' : '') + '>Incremento fisso (macchine, cavi)</option></select></label>';
    if (e.kind === 'fisso') {
      h += '<label class="field"><span>Incremento (kg)</span><input class="input" id="f-inc" type="text" inputmode="decimal" value="' + fmt(e.inc) + '"></label>';
    }
    h += '<label class="field"><span>Il peso indicato è</span><select class="input" id="f-unit">' +
      '<option value=""' + (!e.unit ? ' selected' : '') + '>Il carico della macchina</option>' +
      '<option value="per manubrio"' + (e.unit === 'per manubrio' ? ' selected' : '') + '>Per singolo manubrio</option>' +
      '<option value="per cavo"' + (e.unit === 'per cavo' ? ' selected' : '') + '>Per singolo cavo</option></select></label>' +
      '<div class="grid-2"><label class="field"><span>Serie di lavoro</span><input class="input" id="f-sets" type="number" inputmode="numeric" min="1" max="10" value="' + e.sets + '"></label>' +
      '<label class="field"><span>Ripetizioni obiettivo</span><input class="input" id="f-reps" type="number" inputmode="numeric" min="1" max="50" value="' + e.reps + '"></label></div>' +
      '<div class="grid-2"><label class="field"><span>Peso attuale (kg)</span><input class="input" id="f-weight" type="text" inputmode="decimal" value="' + fmt(e.weight) + '"></label>' +
      '<label class="field"><span>Recupero (secondi)</span><input class="input" id="f-rest" type="number" inputmode="numeric" min="0" step="5" value="' + e.rest + '"></label></div>';

    h += '<div class="stack gap-8"><span class="small muted">Serie di ingresso (non contano per la progressione)</span>';
    if (e.warmups.length) h += '<div class="wu-row xsmall muted"><span>Kg</span><span>Ripetizioni</span><span></span></div>';
    e.warmups.forEach(function (w, i) {
      h += '<div class="wu-row"><input class="input" data-wu-w="' + i + '" type="text" inputmode="decimal" value="' + fmt(w.w) + '" aria-label="Peso ingresso ' + (i + 1) + '">' +
        '<input class="input" data-wu-r="' + i + '" type="number" inputmode="numeric" value="' + w.r + '" aria-label="Ripetizioni ingresso ' + (i + 1) + '">' +
        '<button type="button" class="icon-btn" data-a="wu-del" data-v="' + i + '" aria-label="Togli ingresso ' + (i + 1) + '">' + IC.trash + '</button></div>';
    });
    h += '<button type="button" class="btn" data-a="wu-add" style="align-self:flex-start">+ Aggiungi serie di ingresso</button></div>';

    h += '<label class="field"><span>Nota (es. posizione del sedile)</span><textarea class="input" id="f-note">' + esc(e.note) + '</textarea></label>';

    if (!isNew) {
      h += '<div class="card stack gap-10"><span class="label">Progressione</span><span>' +
        (e.proposed != null ? 'Aumento pronto: prossima volta ' + fmt(e.proposed) + ' kg' : e.streak + (e.streak === 1 ? ' sessione' : ' sessioni') + ' su 3 a ' + e.reps + ' ripetizioni') + '</span>' +
        '<button type="button" class="btn" data-a="reset-prog" style="align-self:flex-start">Azzera progressione</button></div>';
      var d = S.config.days[ui.editDay];
      if (d) {
        var pos = d.ex.indexOf(e.id);
        h += '<div class="card stack gap-10"><span class="label">Posizione in ' + esc(d.name) + '</span><div class="row gap-8">' +
          '<button type="button" class="btn" data-a="move" data-v="-1"' + (pos <= 0 ? ' disabled' : '') + '>' + '<span class="row gap-4">' + IC.up + 'Su</span></button>' +
          '<button type="button" class="btn" data-a="move" data-v="1"' + (pos >= d.ex.length - 1 ? ' disabled' : '') + '>' + '<span class="row gap-4">' + IC.down + 'Giù</span></button>' +
          '<span class="small muted">' + (pos + 1) + ' di ' + d.ex.length + '</span></div>' +
          '<button type="button" class="text-btn danger" data-a="remove-ex" style="align-self:flex-start">Togli da ' + esc(d.name) + '</button></div>';
      }
    }
    h += '</div>';
    h += '<div class="mt-24"><button type="button" class="cta small-cta" data-a="save-ex">Salva</button></div>';
    return h + '</main>';
  }

  function syncDraft() {
    var e = ui.draft; if (!e) return;
    var g = function (id) { var el = document.getElementById(id); return el ? el.value : null; };
    if (g('f-name') != null) e.name = g('f-name');
    if (g('f-kind') != null) e.kind = g('f-kind');
    if (g('f-inc') != null) e.inc = parseNum(g('f-inc'));
    if (g('f-unit') != null) e.unit = g('f-unit');
    if (g('f-sets') != null) e.sets = parseInt(g('f-sets'), 10);
    if (g('f-reps') != null) e.reps = parseInt(g('f-reps'), 10);
    if (g('f-weight') != null) e.weight = parseNum(g('f-weight'));
    if (g('f-rest') != null) e.rest = parseInt(g('f-rest'), 10);
    if (g('f-note') != null) e.note = g('f-note');
    e.warmups.forEach(function (w, i) {
      var ew = document.querySelector('[data-wu-w="' + i + '"]');
      var er = document.querySelector('[data-wu-r="' + i + '"]');
      if (ew) w.w = parseNum(ew.value);
      if (er) w.r = parseInt(er.value, 10);
    });
  }

  function saveDraft() {
    syncDraft();
    var e = ui.draft;
    var errs = [];
    e.name = (e.name || '').trim();
    if (!e.name) errs.push('il nome');
    if (!(e.sets >= 1)) errs.push('le serie');
    if (!(e.reps >= 1)) errs.push('le ripetizioni');
    if (e.weight == null || e.weight < 0) errs.push('il peso');
    if (e.kind === 'fisso' && !(e.inc > 0)) errs.push("l'incremento");
    if (!(e.rest >= 0)) e.rest = 90;
    e.warmups = e.warmups.filter(function (w) { return w.w != null && w.r > 0; });
    if (errs.length) { toastSheet('Controlla ' + errs.join(', ') + '.'); return; }
    if (e.kind === 'manubri') e.inc = e.inc || 2;
    var existing = E(e.id);
    if (existing && Math.abs(existing.weight - e.weight) > 1e-9) { e.streak = 0; e.proposed = null; }
    S.config.exercises[e.id] = e;
    var d = S.config.days[ui.editDay];
    if (d && d.ex.indexOf(e.id) < 0) d.ex.push(e.id);
    save();
    go('scheda');
  }

  /* ---------------- pannelli dal basso ---------------- */

  function openSheet(inner) {
    document.getElementById('sheet-root').innerHTML =
      '<div class="overlay" data-a="sheet-bg"><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>' + inner + '</div></div>';
  }
  function closeSheet() { var r = document.getElementById('sheet-root'); if (r) r.innerHTML = ''; }
  function toastSheet(msg) {
    openSheet('<div class="stack gap-14"><p>' + esc(msg) + '</p><button type="button" class="btn block" data-a="sheet-close">Ok</button></div>');
  }

  function sheetList() {
    var a = S.active;
    var rows = a.entries.map(function (en, i) {
      var e = E(en.id);
      var done = en.sets.filter(function (x) { return x.done && x.t === 's'; }).length;
      var tot = en.sets.filter(function (x) { return x.t === 's'; }).length;
      var st = en.status === 'skip' ? 'skip' : en.status === 'done' ? 'done' : i === a.idx ? 'cur' : '';
      var sub = en.status === 'skip' ? 'Saltato' : en.status === 'done' ? 'Fatto' : done ? done + ' serie su ' + tot : tot + ' × ' + e.reps + ' · ' + fmt(en.sets[en.sets.length - 1].w) + ' kg';
      return '<button type="button" class="list-row" data-a="goto" data-v="' + i + '"><span class="row gap-12"><span class="status ' + st + '"></span><span class="stack gap-2"><span class="nm">' + esc(e.name) + '</span><span class="sb">' + esc(sub) + '</span></span></span><span class="chev">' + IC.chev + '</span></button>';
    }).join('');
    openSheet('<div class="stack gap-10"><span class="label">' + esc(S.config.days[a.day].name) + '</span><div class="list">' + rows + '</div>' +
      '<button type="button" class="btn block mt-10" data-a="ask-finish">Termina allenamento</button></div>');
  }

  function sheetFinish() {
    var a = S.active;
    var done = a.entries.filter(function (en) { return en.status !== 'skip' && en.sets.some(function (x) { return x.done; }); }).length;
    if (!done) {
      openSheet('<div class="stack gap-12"><h2 class="title" style="font-size:24px">Nessuna serie segnata</h2><p class="muted">Non c\'è niente da salvare per questo allenamento.</p>' +
        '<button type="button" class="btn danger block" data-a="cancel-workout">Esci senza salvare</button><button type="button" class="btn block" data-a="sheet-close">Continua ad allenarmi</button></div>');
      return;
    }
    var missing = a.entries.length - done;
    openSheet('<div class="stack gap-12"><h2 class="title" style="font-size:24px">Terminare l\'allenamento?</h2>' +
      '<p class="muted">Hai fatto ' + done + ' esercizi su ' + a.entries.length + '.' + (missing ? ' Quelli non fatti contano come saltati: non cambiano la progressione.' : '') + '</p>' +
      '<button type="button" class="btn primary block" data-a="finish">Termina e salva</button><button type="button" class="btn block" data-a="sheet-close">Continua ad allenarmi</button></div>');
  }

  function sheetWeight() {
    var s = curSet();
    openSheet('<div class="stack gap-12"><label class="field"><span>Peso (kg)</span><input class="input" id="w-input" type="text" inputmode="decimal" value="' + fmt(s.w) + '" style="font-size:28px;font-weight:700"></label>' +
      '<button type="button" class="btn primary block" data-a="w-set">Conferma</button></div>');
    setTimeout(function () { var i = document.getElementById('w-input'); if (i) { i.focus(); i.select(); } }, 50);
  }

  function sheetReps() {
    var s = curSet();
    var b = '';
    for (var i = 0; i <= 20; i++) {
      b += '<button type="button" class="btn' + (i === s.r ? ' primary' : '') + '" data-a="r-set" data-v="' + i + '" style="padding:0">' + i + '</button>';
    }
    openSheet('<div class="stack gap-12"><span class="label">Ripetizioni fatte</span><div style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px">' + b + '</div></div>');
  }

  function sheetNote() {
    var e = E(S.active.entries[S.active.idx].id);
    openSheet('<div class="stack gap-12"><label class="field"><span>Nota per ' + esc(e.name) + '</span><textarea class="input" id="note-input" placeholder="Es. sedile posizione 4, presa stretta">' + esc(e.note) + '</textarea></label>' +
      '<p class="xsmall muted">La ritrovi ogni volta che fai questo esercizio.</p>' +
      '<button type="button" class="btn primary block" data-a="note-save">Salva nota</button></div>');
  }

  function sheetAddEx(dayKey) {
    var d = S.config.days[dayKey];
    var others = Object.keys(S.config.exercises).filter(function (id) { return d.ex.indexOf(id) < 0; })
      .sort(function (x, y) { return E(x).name.localeCompare(E(y).name, 'it'); });
    var rows = others.map(function (id) {
      return '<button type="button" class="list-row" data-a="add-existing" data-v="' + id + '" data-d="' + dayKey + '"><span class="nm">' + esc(E(id).name) + '</span><span class="chev">' + IC.chev + '</span></button>';
    }).join('');
    openSheet('<div class="stack gap-10"><span class="label">Aggiungi a ' + esc(d.name) + '</span>' +
      '<button type="button" class="btn primary block" data-a="new-ex" data-v="' + dayKey + '">Nuovo esercizio</button>' +
      (rows ? '<span class="small muted mt-10">Oppure uno che hai già (lo storico resta unico):</span><div class="list">' + rows + '</div>' : '') + '</div>');
  }

  /* ---------------- backup ---------------- */

  function exportBackup() {
    var data = JSON.stringify({ app: 'gym-tracker', version: 1, exportedAt: new Date().toISOString(), data: S }, null, 1);
    var name = 'gimmy-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    var blob = new Blob([data], { type: 'application/json' });
    try {
      var file = new File([blob], name, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: 'Backup Gimmy' }).catch(function () {});
        return;
      }
    } catch (e) { /* si usa il download classico */ }
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  var pendingImport = null;
  function onImportFile(file) {
    var r = new FileReader();
    r.onload = function () {
      try {
        var obj = JSON.parse(r.result);
        var data = obj && obj.data ? obj.data : obj;
        if (!data || !data.config || !data.config.exercises || !Array.isArray(data.sessions)) throw new Error('formato');
        pendingImport = normalize(data);
        var when = obj.exportedAt ? new Date(obj.exportedAt).toLocaleDateString('it-IT') : 'data sconosciuta';
        openSheet('<div class="stack gap-12"><h2 class="title" style="font-size:24px">Caricare il backup?</h2>' +
          '<p class="muted">Backup del ' + esc(when) + ' con ' + data.sessions.length + ' allenamenti. Sostituisce tutti i dati attuali su questo telefono.</p>' +
          '<button type="button" class="btn danger block" data-a="import-ok">Sostituisci i dati</button><button type="button" class="btn block" data-a="sheet-close">Annulla</button></div>');
      } catch (e) {
        toastSheet('Questo file non sembra un backup di Gimmy.');
      }
    };
    r.readAsText(file);
  }

  /* ---------------- timer, suono, schermo acceso ---------------- */

  var actx = null;
  function unlockAudio() {
    try {
      if (!actx) {
        var C = window.AudioContext || window.webkitAudioContext;
        if (C) actx = new C();
      }
      if (actx && actx.state === 'suspended') actx.resume();
    } catch (e) { /* niente audio */ }
  }
  function beep() {
    try {
      if (navigator.audioSession) navigator.audioSession.type = 'transient';
    } catch (e) { /* non supportato */ }
    if (!actx) return;
    try {
      if (actx.state === 'suspended') actx.resume();
      var t0 = actx.currentTime + 0.02;
      [0, 0.3, 0.6].forEach(function (d, i) {
        var o = actx.createOscillator(), g = actx.createGain();
        o.type = 'sine';
        o.frequency.value = i === 2 ? 1320 : 880;
        g.gain.setValueAtTime(0.0001, t0 + d);
        g.gain.exponentialRampToValueAtTime(0.6, t0 + d + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.25);
        o.connect(g); g.connect(actx.destination);
        o.start(t0 + d); o.stop(t0 + d + 0.28);
      });
    } catch (e) { /* niente audio */ }
  }
  function alarm() {
    beep();
    try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (e) { /* no */ }
    var f = document.getElementById('flash');
    if (f) { f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
  }

  function tick() {
    if (!S.active || !S.active.rest) return;
    var rem = S.active.rest.end - Date.now();
    if (rem <= 0) {
      S.active.rest = null;
      save();
      alarm();
      if (ui.screen === 'workout') render();
      return;
    }
    var el = document.getElementById('tt');
    if (el) el.textContent = clock(rem);
  }

  var wakeLock = null;
  function requestWake() {
    try {
      if ('wakeLock' in navigator && S.active && document.visibilityState === 'visible') {
        navigator.wakeLock.request('screen').then(function (l) { wakeLock = l; }).catch(function () {});
      }
    } catch (e) { /* non supportato */ }
  }
  function releaseWake() {
    try { if (wakeLock) wakeLock.release(); } catch (e) { /* no */ }
    wakeLock = null;
  }

  /* ---------------- azioni ---------------- */

  var actions = {
    'tab': function (v) { go(v); },
    'start': function (v) { unlockAudio(); startWorkout(v); },
    'resume': function () { unlockAudio(); requestWake(); go('workout'); },
    'ask-cancel': function () {
      openSheet('<div class="stack gap-12"><h2 class="title" style="font-size:24px">Annullare l\'allenamento?</h2><p class="muted">Le serie segnate oggi andranno perse. Scheda e progressione non cambiano.</p>' +
        '<button type="button" class="btn danger block" data-a="cancel-workout">Annulla allenamento</button><button type="button" class="btn block" data-a="sheet-close">Indietro</button></div>');
    },
    'cancel-workout': function () { S.active = null; save(); releaseWake(); go('home'); },
    'list': function () { sheetList(); },
    'goto': function (v) {
      var a = S.active; a.idx = parseInt(v, 10);
      var en = a.entries[a.idx];
      var open = en.sets.findIndex(function (x) { return !x.done; });
      if (open >= 0) en.cur = open;
      save(); closeSheet(); render(); window.scrollTo(0, 0);
    },
    'pick': function (v) { S.active.entries[S.active.idx].cur = parseInt(v, 10); save(); render(); },
    'w-': function () { var e = E(S.active.entries[S.active.idx].id); setWeight(prevWeight(e, curSet().w)); },
    'w+': function () { var e = E(S.active.entries[S.active.idx].id); setWeight(nextWeight(e, curSet().w)); },
    'w-edit': function () { sheetWeight(); },
    'w-set': function () {
      var v = parseNum(document.getElementById('w-input').value);
      closeSheet();
      if (v != null && v >= 0) setWeight(v);
    },
    'r-': function () { var s = curSet(); s.r = Math.max(0, s.r - 1); save(); render(); },
    'r+': function () { var s = curSet(); s.r = s.r + 1; save(); render(); },
    'r-edit': function () { sheetReps(); },
    'r-set': function (v) { curSet().r = parseInt(v, 10); save(); closeSheet(); render(); },
    'done': function () { unlockAudio(); markDone(); },
    'next-ex': function () {
      var ni = nextTodo(S.active, S.active.idx);
      if (ni >= 0) actions.goto(String(ni));
    },
    'decline': function () {
      var en = S.active.entries[S.active.idx], e = E(en.id);
      en.declined = true;
      en.sets.forEach(function (s) { if (s.t === 's' && !s.done) s.w = e.weight; });
      save(); render();
    },
    'skip': function () {
      var a = S.active, en = a.entries[a.idx];
      en.status = 'skip';
      var ni = nextTodo(a, a.idx);
      if (ni >= 0) a.idx = ni;
      save(); render(); window.scrollTo(0, 0);
    },
    'unskip': function () {
      var en = S.active.entries[S.active.idx];
      en.status = 'todo';
      var open = en.sets.findIndex(function (x) { return !x.done; });
      en.cur = open >= 0 ? open : 0;
      if (open < 0) en.status = 'done';
      save(); render();
    },
    'rest-add': function () { if (S.active.rest) { S.active.rest.end += 15000; save(); tick(); } },
    'rest-skip': function () { S.active.rest = null; save(); render(); },
    'note': function () { sheetNote(); },
    'note-save': function () {
      var e = E(S.active.entries[S.active.idx].id);
      e.note = document.getElementById('note-input').value.trim();
      save(); closeSheet(); render();
    },
    'ask-finish': function () { sheetFinish(); },
    'finish': function () { closeSheet(); finishWorkout(); },
    'hist': function (v) { go('storico-ex', { histEx: v }); },
    'edit': function (v, el) {
      ui.draft = JSON.parse(JSON.stringify(E(v)));
      go('edit-ex', { editEx: v, editDay: el.getAttribute('data-d') });
    },
    'add-ex': function (v) { sheetAddEx(v); },
    'add-existing': function (v, el) {
      var d = S.config.days[el.getAttribute('data-d')];
      if (d.ex.indexOf(v) < 0) d.ex.push(v);
      save(); closeSheet(); render();
    },
    'new-ex': function (v) {
      ui.draft = {
        id: 'ex_' + uid(), name: '', kind: 'fisso', inc: 2.5, unit: '', sets: 3, reps: 8, weight: 20,
        warmups: [], rest: 90, note: '', streak: 0, proposed: null
      };
      go('edit-ex', { editEx: ui.draft.id, editDay: v });
    },
    'wu-add': function () {
      syncDraft();
      var last = ui.draft.warmups[ui.draft.warmups.length - 1];
      ui.draft.warmups.push({ w: last ? last.w : Math.round(ui.draft.weight * 0.6 * 2) / 2, r: last ? last.r : 8 });
      render();
    },
    'wu-del': function (v) { syncDraft(); ui.draft.warmups.splice(parseInt(v, 10), 1); render(); },
    'reset-prog': function () {
      syncDraft(); ui.draft.streak = 0; ui.draft.proposed = null; render();
    },
    'move': function (v) {
      syncDraft();
      var d = S.config.days[ui.editDay];
      var i = d.ex.indexOf(ui.draft.id), j = i + parseInt(v, 10);
      if (i < 0 || j < 0 || j >= d.ex.length) return;
      d.ex.splice(i, 1); d.ex.splice(j, 0, ui.draft.id);
      save(); render();
    },
    'remove-ex': function () {
      var d = S.config.days[ui.editDay];
      openSheet('<div class="stack gap-12"><h2 class="title" style="font-size:24px">Togliere da ' + esc(d.name) + '?</h2><p class="muted">Lo storico di questo esercizio resta salvato.</p>' +
        '<button type="button" class="btn danger block" data-a="remove-ok">Togli</button><button type="button" class="btn block" data-a="sheet-close">Annulla</button></div>');
    },
    'remove-ok': function () {
      var d = S.config.days[ui.editDay];
      d.ex = d.ex.filter(function (x) { return x !== ui.draft.id; });
      save(); go('scheda');
    },
    'save-ex': function () { saveDraft(); },
    'export': function () { exportBackup(); },
    'import': function () { var f = document.getElementById('import-file'); if (f) { f.value = ''; f.click(); } },
    'import-ok': function () {
      if (pendingImport) { S = pendingImport; pendingImport = null; save(); }
      go('home');
    },
    'sheet-close': function () { closeSheet(); },
    'sheet-bg': function (v, el, ev) { if (ev.target === el) closeSheet(); }
  };

  document.addEventListener('click', function (ev) {
    var el = ev.target.closest('[data-a]');
    if (!el) return;
    var fn = actions[el.getAttribute('data-a')];
    if (!fn) return;
    fn(el.getAttribute('data-v'), el, ev);
  });

  document.addEventListener('change', function (ev) {
    var t = ev.target;
    if (t.id === 'set-wrest') {
      var v = parseInt(t.value, 10);
      if (v >= 0) { S.config.warmupRest = v; save(); }
    } else if (t.id === 'import-file' && t.files && t.files[0]) {
      onImportFile(t.files[0]);
    } else if (t.getAttribute('data-change') === 'kind') {
      syncDraft(); render();
    }
  });

  document.addEventListener('touchstart', unlockAudio, { passive: true, once: true });

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
      if (S.active) requestWake();
      tick();
    }
  });

  /* ---------------- avvio ---------------- */

  S = load();
  save();
  if (S.active) ui.screen = 'home';
  render();
  setInterval(tick, 250);

  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* no */ }
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }

  // per le prove automatiche
  window.__gt = { state: function () { return S; }, go: go };
})();
