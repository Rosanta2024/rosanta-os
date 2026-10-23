# Booking notices · English

Emails and WhatsApp messages sent by Rosanta's own booking engine (they replace Wix's).
English is the main language for guests. Same rules as plantillas.es.md (read its header):

- "## name" starts a notice. "Asunto:" is the subject; the body starts after the blank line.
- {placeholders} are filled in by the system. If one is missing, that notice is NOT sent.
- A line that starts with [si x] only shows if x exists; [no x] only if it doesn't.
- A line "[boton Text] {link}" becomes a button in the email (in plain text: "Text: link").
- The signature (Rosanta · Antigua Guatemala) is added at the end of every guest email.
- No payments or deposits are mentioned: deposits are on hold.
- The team notices (equipo_*) only exist in Spanish (plantillas.es.md).
- "whatsapp." sections are the utility templates submitted to Meta for approval.

## confirmacion
Asunto: Your table is confirmed · {fecha_corta}

[si nombre] Hi {nombre},
[no nombre] Hi,

Your table is confirmed.

Date: {fecha}
Time: {hora}
Table for: {personas}

The calendar invite is attached.

If you need to cancel, please do it at least 24 hours ahead. We hold the table for 20 minutes after your booking time.

[boton View, change or cancel my booking] {enlace}

## pendiente
Asunto: We got your request · {fecha_corta}

[si nombre] Hi {nombre},
[no nombre] Hi,

We got your table request. It isn't confirmed yet: for groups this size the team checks the table by hand and writes back as soon as it's done.

Date: {fecha}
Time: {hora}
Table for: {personas}

In the meantime you can view, change or cancel it here:

[boton View my request] {enlace}

## aprobada
Asunto: Your table is confirmed · {fecha_corta}

[si nombre] Hi {nombre},
[no nombre] Hi,

The team checked your request and your table is confirmed.

Date: {fecha}
Time: {hora}
Table for: {personas}

The calendar invite is attached.

If you need to cancel, please do it at least 24 hours ahead. We hold the table for 20 minutes after your booking time.

[boton View, change or cancel my booking] {enlace}

## rechazada
Asunto: About your request for {fecha_corta}

[si nombre] Hi {nombre},
[no nombre] Hi,

We checked your request for {fecha} at {hora} ({personas}) and this time we don't have a table.
[si motivo] {motivo}

If another date or time works for you, you can book here:

[boton Find another date] {enlace_reservar}

You can also reply to this email and we'll look for an option with you.

## cambio
Asunto: Your booking has been updated · {fecha_corta}

[si nombre] Hi {nombre},
[no nombre] Hi,

Your booking is updated.

[si antes] Was: {antes}
Now: {ahora}

The updated calendar invite is attached.

If you need to cancel, please do it at least 24 hours ahead. We hold the table for 20 minutes after your booking time.

[boton View, change or cancel my booking] {enlace}

## cancelacion
Asunto: Your booking is cancelled

[si nombre] Hi {nombre},
[no nombre] Hi,

Your booking for {fecha} at {hora} ({personas}) is cancelled. Nothing is pending on your side.

Whenever you want to come back, you can book here:

[boton Book another date] {enlace_reservar}

## recordatorio_24h
Asunto: See you tomorrow at {hora}

[si nombre] Hi {nombre},
[no nombre] Hi,

A quick reminder of your table tomorrow:

Date: {fecha}
Time: {hora}
Table for: {personas}

We hold the table for 20 minutes after your booking time. If something changed, let us know here and we'll give the table to someone else:

[boton View, change or cancel my booking] {enlace}

## recordatorio_dia
Asunto: See you today at {hora}

[si nombre] Hi {nombre},
[no nombre] Hi,

Today at {hora} you have a table for {personas}.

We hold the table for 20 minutes after your booking time. If you can't make it, let us know here and we'll give the table to someone else:

[boton View, change or cancel my booking] {enlace}

## resena
Asunto: How was your visit to Rosanta?

[si nombre] Hi {nombre},
[no nombre] Hi,

Thanks for coming. If you had a good time, a review on {sitio_resena} helps more people find us:

[boton Leave a review on {sitio_resena}] {enlace_resena}

And if something wasn't right, just reply to this email. The team reads every one.

## espera_mesa_libre
Asunto: A table opened up · {fecha_corta} {hora}

[si nombre] Hi {nombre},
[no nombre] Hi,

You were on our waitlist and a table just opened up:

Date: {fecha}
Time: {hora}
Table for: {personas}

We can't hold it for you: it goes to whoever books first. If it still works for you, book it here:

[boton Book this table] {enlace_reservar}

If you no longer need it, you don't have to do anything.

## whatsapp.confirmacion
Meta: rosanta_reserva_confirmada
Categoria: Utility
Parametros: nombre, fecha, hora, personas
Boton: My booking

Hi {{1}}, your table at Rosanta is confirmed: {{2}} at {{3}}, for {{4}}. We hold it for 20 minutes after your booking time. To change or cancel, use the My booking button at least 24 hours in advance.

## whatsapp.recordatorio
Meta: rosanta_reserva_recordatorio
Categoria: Utility
Parametros: nombre, fecha, hora, personas
Boton: My booking

Hi {{1}}, a quick reminder about your table at Rosanta: {{2}} at {{3}}, for {{4}}. We hold it for 20 minutes after your booking time. If your plans changed, use the My booking button to change or cancel, so someone else can have the table.

## whatsapp.cambio
Meta: rosanta_reserva_cambio
Categoria: Utility
Parametros: nombre, ahora
Boton: My booking

Hi {{1}}, your booking at Rosanta has been updated: {{2}}. We hold the table for 20 minutes after your booking time. To make another change or to cancel, use the My booking button at least 24 hours in advance.
