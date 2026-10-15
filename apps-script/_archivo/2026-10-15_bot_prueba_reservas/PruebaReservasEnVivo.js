/**
 * ROSANTA · BOT — PRUEBA COMPLETA EN VIVO (15-oct-2026)
 * Crea, cambia, intenta un cambio sin lugar y cancela una reserva REAL de prueba
 * en Wix ("PRUEBA BOT", correo del restaurante), y le pregunta al modelo cómo
 * entiende un pedido de cambio. Sin avisos ni correos (RV_SILENCIO). Al final la
 * reserva queda cancelada. No envía nada a ningún cliente.
 */
function pruebaReservasEnVivo() {
  RV_SILENCIO = true;
  var ok = 0, fallas = 0;
  function chk(nombre, cond, detalle) {
    if (cond) ok++; else fallas++;
    console.log((cond ? 'OK    ' : 'FALLA ') + nombre + (detalle ? '\n      ' + detalle : ''));
  }
  // El próximo martes (el restaurante abre 17:00–21:00)
  var d = new Date(); d.setDate(d.getDate() + ((2 - d.getDay() + 7) % 7 || 7));
  var fecha = Utilities.formatDate(d, 'America/Guatemala', 'yyyy-MM-dd');
  var tel = '50229991515', email = 'prueba-bot@rosanta.rest', id = 'prueba-reservas-' + Date.now();
  function paso(lead) {
    lead.idioma = 'es'; lead.telefono = tel; lead.email = email; lead.tipo = 'reserva';
    return rvCerrar({ respuesta: '(espera)', lead: lead }, 'messenger', id);
  }
  console.log('Fecha de prueba: ' + fecha);
  // Limpieza: reservas de prueba que hayan quedado de una corrida anterior.
  var limpiezaFallo = false;
  for (var vuelta = 0; vuelta < 3; vuelta++) {          // puede haber varias a la misma hora
    ['18:00', '19:00', '20:00'].forEach(function (h) {
      [tel].forEach(function (tt) { var c = rvLlamarCancelar({ telefono: tt, email: '', fecha: fecha, hora: h, todas: true });
      if (c.ok || c.motivo === 'NO_ENCONTRADA' || c.motivo === 'SIN_COINCIDENCIA') {
        if (c.ok) console.log('Limpieza: cancelada una de prueba de las ' + h);
      } else {
        limpiezaFallo = true;
        console.log('Limpieza ' + h + ' FALLÓ: ' + JSON.stringify(c).substring(0, 500));
      }
      });
    });
  }
  if (limpiezaFallo) { console.log('Se detiene la prueba: no se pudo limpiar. No se crea nada nuevo.'); RV_SILENCIO = false; return; }

  var r1 = paso({ accion: 'crear_reserva', nombre: 'PRUEBA BOT', fecha: fecha, hora: '18:00', personas: 2 });
  chk('1. Crea la reserva 18:00', /queda confirmada/.test(r1.respuesta), r1.respuesta);

  var r2 = paso({ accion: 'cambiar_reserva', hora: '19:00', fecha_actual: fecha });
  chk('2. La cambia a las 19:00', /quedó cambiada[\s\S]*19:00/.test(r2.respuesta) && !/OJO/.test(r2.lead.resumen), r2.respuesta + ' · ' + r2.lead.resumen);

  var r3 = paso({ accion: 'cambiar_reserva', hora: '23:30', fecha_actual: fecha });
  chk('3. A las 23:30 no hay lugar: no toca nada', /sigue igual/.test(r3.respuesta), r3.respuesta);

  var r4 = paso({ accion: 'cambiar_reserva', personas: 4, fecha_actual: fecha });
  chk('4. Cambia solo las personas (4), misma hora', /quedó cambiada[\s\S]*19:00[\s\S]*4/.test(r4.respuesta), r4.respuesta);

  var r5 = paso({ accion: 'cancelar_reserva', fecha: fecha });
  chk('5. La cancela, y era la de las 19:00 (el paso 3 no la movió)', /queda cancelada/.test(r5.respuesta) && /19:00/.test(r5.respuesta), r5.respuesta);

  var r6 = paso({ accion: 'cancelar_reserva', fecha: fecha });
  chk('6. Ya no queda ninguna reserva de prueba', /No encuentro una reserva activa/.test(r6.respuesta), r6.respuesta);

  // El modelo: ¿entiende un pedido de cambio? (solo pregunta, no toca Wix)
  var m = askClaude('whatsapp', 'Prueba', 'Hola, tengo reserva el martes a las 7 pm, la puedo pasar a las 8?', 'prueba-modelo-cambio-' + Date.now());
  var lm = m.lead || {};
  chk('7. El modelo marca cambiar_reserva con la hora nueva 20:00', lm.accion === 'cambiar_reserva' && lm.hora === '20:00',
    'accion=' + lm.accion + ' hora=' + lm.hora + ' fecha=' + lm.fecha + ' fecha_actual=' + lm.fecha_actual + ' · "' + m.respuesta + '"');
  var m2 = askClaude('whatsapp', 'Prueba', 'Necesito cancelar mi reserva de mañana', 'prueba-modelo-cancel-' + Date.now());
  chk('8. El modelo sigue marcando cancelar_reserva para cancelar', (m2.lead || {}).accion === 'cancelar_reserva', 'accion=' + (m2.lead || {}).accion);

  RV_SILENCIO = false;
  console.log('RESULTADO: ' + ok + ' OK · ' + fallas + ' fallas');
}
