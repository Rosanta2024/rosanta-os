/**
 * La pantalla del pipeline en vivo: EventosVista.html real, armada como render_ de la intranet, con el
 * traductor de google.script.run y la barra de Clientes. A diferencia de la sombra, aca SI se guarda
 * (si quien entra puede editar y el interruptor esta en base).
 */
const fs = require('fs');
const path = require('path');
const P = require('../pantalla-pagos');
const F = require('../sombra2/pantallas-f2');

const leer = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'intranet', f), 'utf8');

function armarEventosVivo(o) {
  const u = o.usuario;
  const vars = {
    usuario: { email: u.email, rol: u.rol, nombre: u.nombre, modulos: u.modulos || [], puedeEditar: !!(o.vivo && u.puede_editar) },
    urlBase: '/clientes', authToken: F.tokenLimpio(o.authToken),
    paletaCss_: () => P.paleta(), include: (n) => leer(n + '.html'),
    rolSinAcento_: (r) => String(r || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
  };
  const h = F.plantilla(leer('EventosVista.html'), vars);
  if (h.split('<body>').length !== 2) throw new Error('EventosVista.html cambio de forma: no encontre una sola vez <body>');
  const aviso = o.vivo
    ? '<b>Servidor nuevo · Clientes › Eventos.</b> Lo que guardás acá queda en la base y se copia a la hoja.'
    : '<b>Servidor nuevo · Clientes › Eventos.</b> Por ahora el pipeline se guarda en la intranet de siempre: acá solo se ve.';
  return h.replace('<body>', () => '<body>' + F.NAV('eventos') + '<script>' + P.TRADUCTOR + '</script>' +
    '<style>.nb-aviso{background:var(--rosanta-lila-tint);border-radius:12px;padding:10px 14px;margin:12px auto;max-width:1100px;font-size:.9rem}</style>' +
    '<div class="nb-aviso">' + aviso + '</div>');
}

module.exports = { armarEventosVivo };
