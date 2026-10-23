# Avisos de reservas · español

Textos de los correos y WhatsApp que manda el motor de reservas propio (reemplazan a los de Wix).
Se pueden cambiar aquí sin tocar código: el sistema solo lee este archivo (y plantillas.en.md, en inglés).

Cómo se lee:
- Cada aviso empieza con "## nombre". "Asunto:" es el asunto del correo; el cuerpo va después de la línea en blanco.
- Lo que va entre llaves lo llena el sistema. Si falta un dato, ese aviso NO sale (así nunca llega un
  "${guestFirstName}" como pasaba con Wix).
    {nombre}          solo el primer nombre del cliente
    {fecha}           "sábado 24 de octubre"           {fecha_corta}  "24/10"
    {hora}            "19:30" (en inglés "7:30 pm")    {personas}     "4 personas"
    {enlace}          la página "Mi reserva" (ver, cambiar o cancelar, sin cuenta ni contraseña)
    {enlace_reservar} la página para reservar          {antes} {ahora} la reserva antes y después de un cambio
    {motivo}          el motivo que escribió el equipo {sitio_resena} {enlace_resena}  Google o TripAdvisor
- Una línea que empieza con [si x] solo aparece si x existe; [no x], solo si NO existe.
- "[boton Texto] {enlace}" es un botón en el correo (en texto plano sale "Texto: enlace").
- La firma "Rosanta · Antigua Guatemala" la agrega el sistema al final de cada correo al cliente.
- No se mencionan pagos ni anticipos: los anticipos están en pausa.
- Las secciones "equipo_" son los avisos al equipo (solo en español).
- Las secciones "whatsapp." son las 3 plantillas de UTILIDAD que se mandan a aprobar a Meta, con el número
  del bot. {{1}}, {{2}}... son los datos en el orden de "Parametros". El botón abre "Mi reserva":
  en Meta se registra como botón de enlace https://www.rosanta.rest/r/{{1}} (el sistema pone el código).
  Mientras Meta no las apruebe, el recordatorio sale por correo.

## confirmacion
Asunto: Tu mesa queda confirmada · {fecha_corta}

[si nombre] Hola {nombre},
[no nombre] Hola,

Tu mesa queda confirmada.

Fecha: {fecha}
Hora: {hora}
Mesa para: {personas}

Va adjunto el evento para tu calendario.

Si necesitas cancelar, hazlo con al menos 24 horas de anticipación. Guardamos la mesa 20 minutos después de la hora de tu reserva.

[boton Ver, cambiar o cancelar mi reserva] {enlace}

## pendiente
Asunto: Recibimos tu solicitud · {fecha_corta}

[si nombre] Hola {nombre},
[no nombre] Hola,

Recibimos tu solicitud de mesa. Todavía no está confirmada: para grupos de este tamaño el equipo revisa la mesa a mano y te escribe en cuanto la tenga.

Fecha: {fecha}
Hora: {hora}
Mesa para: {personas}

Mientras tanto, puedes verla, cambiarla o cancelarla aquí:

[boton Ver mi solicitud] {enlace}

## aprobada
Asunto: Tu mesa queda confirmada · {fecha_corta}

[si nombre] Hola {nombre},
[no nombre] Hola,

El equipo revisó tu solicitud y tu mesa queda confirmada.

Fecha: {fecha}
Hora: {hora}
Mesa para: {personas}

Va adjunto el evento para tu calendario.

Si necesitas cancelar, hazlo con al menos 24 horas de anticipación. Guardamos la mesa 20 minutos después de la hora de tu reserva.

[boton Ver, cambiar o cancelar mi reserva] {enlace}

## rechazada
Asunto: Sobre tu solicitud del {fecha_corta}

[si nombre] Hola {nombre},
[no nombre] Hola,

Revisamos tu solicitud para el {fecha} a las {hora} ({personas}) y esta vez no tenemos mesa.
[si motivo] {motivo}

Si te sirve otra fecha u hora, reservas aquí:

[boton Buscar otra fecha] {enlace_reservar}

También puedes responder a este correo y buscamos una opción contigo.

## cambio
Asunto: Tu reserva cambió · {fecha_corta}

[si nombre] Hola {nombre},
[no nombre] Hola,

Tu reserva queda actualizada.

[si antes] Antes: {antes}
Ahora: {ahora}

Va adjunto el evento actualizado para tu calendario.

Si necesitas cancelar, hazlo con al menos 24 horas de anticipación. Guardamos la mesa 20 minutos después de la hora de tu reserva.

[boton Ver, cambiar o cancelar mi reserva] {enlace}

## cancelacion
Asunto: Tu reserva quedó cancelada

[si nombre] Hola {nombre},
[no nombre] Hola,

Tu reserva del {fecha} a las {hora} ({personas}) quedó cancelada. No queda nada pendiente de tu parte.

Cuando quieras volver, reservas aquí:

[boton Reservar otra fecha] {enlace_reservar}

## recordatorio_24h
Asunto: Te esperamos mañana a las {hora}

[si nombre] Hola {nombre},
[no nombre] Hola,

Te recordamos tu mesa de mañana:

Fecha: {fecha}
Hora: {hora}
Mesa para: {personas}

Guardamos la mesa 20 minutos después de la hora de tu reserva. Si algo cambió, avísanos aquí y se la damos a alguien más:

[boton Ver, cambiar o cancelar mi reserva] {enlace}

## recordatorio_dia
Asunto: Hoy te esperamos a las {hora}

[si nombre] Hola {nombre},
[no nombre] Hola,

Hoy a las {hora} tienes mesa para {personas}.

Guardamos la mesa 20 minutos después de la hora de tu reserva. Si no llegas, avísanos aquí y se la damos a alguien más:

[boton Ver, cambiar o cancelar mi reserva] {enlace}

## resena
Asunto: ¿Cómo estuvo tu visita a Rosanta?

[si nombre] Hola {nombre},
[no nombre] Hola,

Gracias por venir. Si la pasaste bien, una reseña en {sitio_resena} ayuda a que más gente nos encuentre:

[boton Dejar una reseña en {sitio_resena}] {enlace_resena}

Y si algo no estuvo bien, responde a este correo. Lo lee el equipo.

## espera_mesa_libre
Asunto: Se liberó una mesa · {fecha_corta} {hora}

[si nombre] Hola {nombre},
[no nombre] Hola,

Estabas en nuestra lista de espera y se liberó una mesa:

Fecha: {fecha}
Hora: {hora}
Mesa para: {personas}

No te la podemos apartar: es de quien reserve primero. Si todavía te sirve, resérvala aquí:

[boton Reservar esta mesa] {enlace_reservar}

Si ya no la necesitas, no tienes que hacer nada.

## equipo_nueva
Asunto: Reserva nueva · {nombre_completo} · {fecha_corta} {hora} · {personas}

Reserva nueva por {origen}. Estado: {estado}.

Nombre: {nombre_completo}
Fecha: {fecha} a las {hora}
Personas: {personas}
[si mesa] Mesa: {mesa}
[si telefono] Teléfono: {telefono}
[si correo] Correo: {correo}
Idioma: {idioma_cliente}
[si alergias] ALERGIAS: {alergias}
[si notas] Notas: {notas}

[si enlace_panel] [boton Abrir el panel de reservas] {enlace_panel}

## equipo_cancelada
Asunto: Reserva CANCELADA · {nombre_completo} · {fecha_corta} {hora} · {personas}

Se canceló una reserva ({quien_cancela}). La mesa queda libre.

Nombre: {nombre_completo}
Fecha: {fecha} a las {hora}
Personas: {personas}
[si mesa] Mesa: {mesa}
[si motivo] Motivo: {motivo}

[si enlace_panel] [boton Abrir el panel de reservas] {enlace_panel}

## equipo_grupo_grande
Asunto: Grupo grande por el bot · {personas} · {fecha_corta} {hora}

Alguien pidió por el bot ({canal}) una mesa para {personas}, más de lo que el bot puede reservar solo. Es un evento: hay que escribirle.

Nombre: {nombre_completo}
Fecha: {fecha} a las {hora}
[si telefono] Teléfono: {telefono}
[si correo] Correo: {correo}

## whatsapp.confirmacion
Meta: rosanta_reserva_confirmada
Categoria: Utility
Parametros: nombre, fecha, hora, personas
Boton: Mi reserva

Hola {{1}}, tu mesa en Rosanta queda confirmada: {{2}} a las {{3}}, para {{4}}. Te la guardamos hasta 20 minutos después de la hora. Para cambiar o cancelar, usa el botón Mi reserva con al menos 24 horas de anticipación.

## whatsapp.recordatorio
Meta: rosanta_reserva_recordatorio
Categoria: Utility
Parametros: nombre, fecha, hora, personas
Boton: Mi reserva

Hola {{1}}, te recordamos tu mesa en Rosanta: {{2}} a las {{3}}, para {{4}}. Te la guardamos hasta 20 minutos después de la hora. Si tus planes cambiaron, cámbiala o cancélala con el botón Mi reserva y así otra persona puede ocupar la mesa.

## whatsapp.cambio
Meta: rosanta_reserva_cambio
Categoria: Utility
Parametros: nombre, ahora
Boton: Mi reserva

Hola {{1}}, tu reserva en Rosanta quedó actualizada: {{2}}. Te guardamos la mesa hasta 20 minutos después de la hora. Para otro cambio o para cancelar, usa el botón Mi reserva con al menos 24 horas de anticipación.
