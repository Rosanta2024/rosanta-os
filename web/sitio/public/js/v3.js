/* Web v3 (rediseño, 24-oct-2026): videos que no frenan la carga, encabezado, menú a pantalla completa,
   idioma, pestañas de la carta, fotos de los platos y la reserva rápida de la portada. Sin dependencias. */
(function () {
  var d = document, w = window;
  var ahorro = (w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches) || !!(navigator.connection && navigator.connection.saveData);

  // ---- Videos: se cargan cerca de la pantalla y solo se reproducen mientras se ven ----
  var vids = [].slice.call(d.querySelectorAll('video[data-v3video]'));
  function cargar(v) {
    var fuentes = v.querySelectorAll('source[data-src]');
    if (!fuentes.length) return;
    for (var i = 0; i < fuentes.length; i++) { fuentes[i].src = fuentes[i].getAttribute('data-src'); fuentes[i].removeAttribute('data-src'); }
    v.load();
  }
  function jugar(v) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
  if (!ahorro && 'IntersectionObserver' in w) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting) { cargar(v); jugar(v); } else if (!v.paused) v.pause();
      });
    }, { rootMargin: '200px 0px' });
    vids.forEach(function (v) { io.observe(v); });
  } else if (ahorro) {
    // Ahorro de datos o menos movimiento: solo el póster. Un toque reproduce el video.
    vids.forEach(function (v) {
      v.removeAttribute('data-prioridad');
      v.parentNode.classList.add('v3-video-quieto');
      v.addEventListener('click', function () { cargar(v); if (v.paused) jugar(v); else v.pause(); });
    });
  }

  // ---- Encabezado: transparente sobre el video de la portada, sólido al bajar ----
  var enc = d.querySelector('[data-v3enc]');
  if (enc && d.body.classList.contains('v3-sobre-video')) {
    var marcar = function () { enc.classList.toggle('v3-enc-solido', w.scrollY > 40); };
    w.addEventListener('scroll', marcar, { passive: true }); marcar();
  }

  // ---- Menú a pantalla completa ----
  var menu = d.getElementById('v3-menu'), abrir = d.querySelector('[data-v3abrir]');
  if (menu && abrir) {
    var cerrarBtn = menu.querySelector('[data-v3cerrar]');
    var abrirMenu = function (e) {
      if (e) e.preventDefault();
      menu.hidden = false; d.body.classList.add('v3-menu-abierto'); abrir.setAttribute('aria-expanded', 'true');
      cerrarBtn.focus();
    };
    var cerrarMenu = function () {
      menu.hidden = true; d.body.classList.remove('v3-menu-abierto'); abrir.setAttribute('aria-expanded', 'false'); abrir.focus();
    };
    abrir.addEventListener('click', abrirMenu);
    cerrarBtn.addEventListener('click', cerrarMenu);
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) { menu.hidden = true; d.body.classList.remove('v3-menu-abierto'); } });
    d.addEventListener('keydown', function (e) {
      if (menu.hidden) return;
      if (e.key === 'Escape') cerrarMenu();
      if (e.key === 'Tab') { // el foco no sale del menú
        var f = menu.querySelectorAll('a[href], button'); var a = f[0], z = f[f.length - 1];
        if (e.shiftKey && d.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && d.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    });
  }

  // ---- Idioma: el del navegador elige el inicial en la portada; después manda lo que la persona elija ----
  var guardar = function (l) { try { localStorage.setItem('rosanta-idioma', l); } catch (e) {} };
  d.querySelectorAll('[data-v3idioma]').forEach(function (a) { a.addEventListener('click', function () { guardar(a.getAttribute('data-v3idioma')); }); });
  try {
    var pref = localStorage.getItem('rosanta-idioma');
    var ruta = location.pathname.replace(/\/$/, '') || '/';
    var interno = d.referrer && d.referrer.indexOf(location.origin) === 0;
    if (!pref && !interno && (ruta === '/' || ruta === '/es') && !/[?&]idioma=/.test(location.search)) {
      var nav = ((navigator.languages && navigator.languages[0]) || navigator.language || '').toLowerCase();
      var quiere = nav.indexOf('es') === 0 ? 'es' : 'en';
      guardar(quiere);
      if (quiere === 'es' && ruta === '/') location.replace('/es' + location.hash);
      else if (quiere === 'en' && ruta === '/es') location.replace('/' + location.hash);
    }
  } catch (e) {}

  // ---- Carta: pestañas (Para compartir · Del fuego · Del jardín · La barra) ----
  var carta = d.querySelector('[data-v3carta]');
  if (carta) {
    var lista = carta.querySelector('[data-v3tabs]'), tabs = [].slice.call(lista.querySelectorAll('[role=tab]'));
    var paneles = [].slice.call(carta.querySelectorAll('[data-v3panel]'));
    lista.hidden = false; carta.classList.add('v3-con-tabs');
    var elegir = function (id, foco) {
      tabs.forEach(function (t) {
        var si = t.getAttribute('aria-controls') === id;
        t.setAttribute('aria-selected', si ? 'true' : 'false'); t.tabIndex = si ? 0 : -1;
        if (si) { if (foco) t.focus(); t.scrollIntoView({ block: 'nearest', inline: 'center' }); }
      });
      paneles.forEach(function (p) { p.hidden = p.id !== id; });
    };
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () {
        elegir(t.getAttribute('aria-controls'));
        history.replaceState(null, '', '#' + t.getAttribute('aria-controls'));
        var top = carta.getBoundingClientRect().top + w.scrollY - 70;
        if (w.scrollY > top) w.scrollTo({ top: top, behavior: 'smooth' });
      });
      t.addEventListener('keydown', function (e) {
        var n = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : null;
        if (n === null) return; e.preventDefault(); n = (n + tabs.length) % tabs.length; elegir(tabs[n].getAttribute('aria-controls'), true);
      });
    });
    var desdeHash = function () {
      var h = decodeURIComponent(location.hash.slice(1)), el = h && d.getElementById(h);
      var p = el && (el.matches('[data-v3panel]') ? el : el.closest('[data-v3panel]'));
      elegir(p ? p.id : paneles[0].id);
      if (el && !el.matches('[data-v3panel]')) setTimeout(function () { el.scrollIntoView({ block: 'center' }); el.classList.add('v3-resaltado'); }, 50);
    };
    desdeHash(); w.addEventListener('hashchange', desdeHash);
    d.querySelectorAll('[data-v3tab]').forEach(function (a) {
      a.addEventListener('click', function () { elegir(a.getAttribute('data-v3tab')); });
    });
    // Foto del plato: al tocar la miniatura se abre debajo del plato
    carta.querySelectorAll('.v3-plato-mini').forEach(function (b) {
      b.addEventListener('click', function () {
        var li = b.closest('.v3-plato'), abierta = li.classList.toggle('v3-abierta');
        b.setAttribute('aria-expanded', abierta ? 'true' : 'false');
      });
    });
  }

  // ---- Reserva: llega desde la reserva rápida de la portada (?dia=hoy&personas=2) y deja el formulario lleno ----
  var q = new URLSearchParams(location.search), rsv = d.querySelector('.rsv');
  if (rsv && (q.get('dia') || q.get('personas'))) {
    var party = rsv.querySelector('#party'), n = parseInt(q.get('personas'), 10);
    if (party && n >= 1 && n <= 10) { party.value = String(n); party.dispatchEvent(new Event('change')); }
    var ahoraGT = new Date(Date.now() + (new Date().getTimezoneOffset() - 360) * 60000); // Guatemala: UTC-6, sin horario de verano
    var f = new Date(ahoraGT.getFullYear(), ahoraGT.getMonth(), ahoraGT.getDate()), dia = q.get('dia');
    if (dia === 'manana') f.setDate(f.getDate() + 1);
    if (dia === 'sabado') f.setDate(f.getDate() + ((6 - f.getDay() + 7) % 7));
    var iso = f.getFullYear() + '-' + String(f.getMonth() + 1).padStart(2, '0') + '-' + String(f.getDate()).padStart(2, '0');
    var btn = rsv.querySelector('#dateBtn');
    if (btn) {
      btn.click(); // abre el calendario (en "Otra fecha" se queda abierto para elegir)
      if (dia && dia !== 'otra') { var b = rsv.querySelector('#calGrid [data-v="' + iso + '"]'); if (b) b.click(); }
    }
    setTimeout(function () { rsv.scrollIntoView({ block: 'start' }); }, 30);
  }
})();
