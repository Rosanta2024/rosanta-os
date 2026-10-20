-- 054 · Gift cards y pagos en linea (20-oct-2026, ajustada el 21-oct: pasarela intercambiable; rama claude/web-contenido-giftcards, AYUDANTE 4).
-- Rango 050-059 "Web y reservas". La aplica el Estudio con migrar.js: primero rosanta_ensayo, despues rosanta
-- con respaldo. Solo aditiva: tablas nuevas. No toca ninguna tabla existente. Va despues de la 053.
--
-- Estudio "Web propia sin Wix" §3.5 y §8.3. El patron es el de Pagos: una fila por movimiento que nunca se
-- borra. La pasarela no esta decidida (Recurrente, BAC o NeoNet: PASARELA en el servidor, ver cloud/app/src/pasarela.js);
-- cada fila dice de que proveedor es. Lo que cambia de estado (el saldo de la tarjeta, el estado de un pago) se cambia con UPDATE y el
-- movimiento que lo explica queda en su tabla de movimientos.
--
-- Dinero: numeric(12,2), en la moneda de la fila. Las gift cards valen en QUETZALES (lo que se canjea en el
-- restaurante); si el comprador paga en US$, el cobro y su tipo de cambio quedan en pagos_en_linea.

-- Liquidaciones: cada deposito de la pasarela a la cuenta de CORSAGA. Se cruza con el banco
-- del maestro (BI o BAC) y con la suma de los pagos netos que incluye (conciliar-pagos-linea.js).
CREATE TABLE pagos_liquidaciones (
  id               bigserial PRIMARY KEY,
  proveedor        text NOT NULL CHECK (proveedor IN ('recurrente', 'bac', 'neonet')),
  referencia       text NOT NULL,                  -- id del retiro o deposito en la pasarela
  fecha            date NOT NULL,                  -- dia en que llego al banco
  monto            numeric(12,2) NOT NULL CHECK (monto > 0),
  moneda           text NOT NULL CHECK (moneda IN ('GTQ', 'USD')),
  banco            text CHECK (banco IN ('BI', 'BAC')),
  banco_referencia text,                           -- el movimiento del banco en el maestro (fecha|docto|monto)
  estado           text NOT NULL DEFAULT 'sin_conciliar' CHECK (estado IN ('sin_conciliar', 'cuadra', 'diferencia')),
  diferencia       numeric(12,2),
  conciliada       timestamptz,
  nota             text NOT NULL DEFAULT '',
  creada           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (proveedor, referencia)
);

-- Cada cobro, reembolso o contracargo en linea. Un reembolso es una fila NUEVA (tipo reembolso) que apunta al
-- cobro; el cobro cambia de estado. Se llena con el webhook de la pasarela.
CREATE TABLE pagos_en_linea (
  id               bigserial PRIMARY KEY,
  proveedor        text NOT NULL CHECK (proveedor IN ('recurrente', 'bac', 'neonet')),
  tipo             text NOT NULL DEFAULT 'cobro' CHECK (tipo IN ('cobro', 'reembolso', 'contracargo')),
  proveedor_id     text NOT NULL,                  -- cobro: id del pago en la pasarela; reembolso: id del reembolso
  cobro_id         text,                           -- el checkout o enlace de pago (Recurrente: ch_...)
  pago_original_id bigint REFERENCES pagos_en_linea(id),   -- reembolso o contracargo: el cobro
  fecha            timestamptz NOT NULL,
  moneda           text NOT NULL CHECK (moneda IN ('GTQ', 'USD')),
  bruto            numeric(12,2) NOT NULL CHECK (bruto >= 0),
  comision         numeric(12,2) NOT NULL DEFAULT 0 CHECK (comision >= 0),   -- la comision de la pasarela
  otros_cargos     numeric(12,2) NOT NULL DEFAULT 0 CHECK (otros_cargos >= 0), -- otros cargos (p. ej. FEL de la pasarela, IVA retenido)
  neto             numeric(12,2) NOT NULL,         -- bruto - comision - otros_cargos (reembolso: lo que se desconto)
  tipo_cambio      numeric(10,4) CHECK (tipo_cambio IS NULL OR tipo_cambio > 0),   -- Q por US$, si moneda = USD
  bruto_q          numeric(12,2) NOT NULL,         -- el bruto en quetzales (= bruto si GTQ)
  concepto         text NOT NULL CHECK (concepto IN ('gift_card', 'anticipo_evento', 'experiencia', 'garantia')),
  concepto_id      text,                           -- gift card: el codigo; evento: la cotizacion; reserva: su id
  estado           text NOT NULL CHECK (estado IN ('pagado', 'reembolsado', 'reembolso_parcial', 'contracargo', 'reembolso')),
  fel_serie        text,                           -- FEL que emite Rosanta con su certificador
  fel_numero       text,
  fel_fecha        date,
  fel_url          text,                           -- la factura que mande la pasarela, si manda una
  fel_estado       text NOT NULL DEFAULT 'pendiente' CHECK (fel_estado IN ('pendiente', 'no_aplica', 'emitida', 'error')),
  liquidacion_id   bigint REFERENCES pagos_liquidaciones(id),
  crudo            jsonb NOT NULL,                 -- el evento tal cual (sin la tarjeta: Recurrente no la manda)
  creado           timestamptz NOT NULL DEFAULT now(),
  actualizado      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (proveedor, tipo, proveedor_id)
);
CREATE INDEX pagos_en_linea_fecha ON pagos_en_linea (fecha);
CREATE INDEX pagos_en_linea_liquidacion ON pagos_en_linea (liquidacion_id);
CREATE INDEX pagos_en_linea_concepto ON pagos_en_linea (concepto, concepto_id);

-- Webhooks de la pasarela recibidos CON FIRMA VALIDA (los de firma mala no se guardan: si no, un tercero podria "gastar" el
-- id de un evento real antes de que llegue). La llave es el id del mensaje (svix-id), que no cambia entre
-- reintentos: el mismo evento dos veces se procesa una sola vez.
CREATE TABLE pagos_webhooks (
  id               bigserial PRIMARY KEY,
  proveedor        text NOT NULL CHECK (proveedor IN ('recurrente', 'bac', 'neonet')),
  evento_id        text NOT NULL,                  -- el id del mensaje (Recurrente: svix-id)
  tipo             text NOT NULL,                  -- el tipo de evento del proveedor
  recibido         timestamptz NOT NULL DEFAULT now(),
  procesado        timestamptz,
  resultado        text,                           -- creada RSNT-..., ignorado, ya_procesado, error: ...
  cuerpo           jsonb NOT NULL,
  UNIQUE (proveedor, evento_id)
);

-- Pedido de gift card: lo que el comprador lleno en el sitio, mientras paga. El cobro en la pasarela lleva solo la
-- referencia del pedido (no datos personales).
CREATE TABLE gift_cards_pedidos (
  id               bigserial PRIMARY KEY,
  ref              text NOT NULL UNIQUE,           -- aleatorio, va en el cobro como referencia
  proveedor        text NOT NULL CHECK (proveedor IN ('recurrente', 'bac', 'neonet')),
  cobro_id         text,
  valor_q          numeric(12,2) NOT NULL CHECK (valor_q >= 200),   -- lo que vale la tarjeta (minimo Q200)
  moneda_cobro     text NOT NULL CHECK (moneda_cobro IN ('GTQ', 'USD')),
  monto_cobro      numeric(12,2) NOT NULL CHECK (monto_cobro > 0),  -- lo que se cobra en esa moneda
  tipo_cambio      numeric(10,4),
  comprador_nombre text NOT NULL,
  comprador_email  text NOT NULL,
  comprador_telefono text,
  destinatario_nombre text NOT NULL,
  destinatario_email text,                         -- vacio = se manda al comprador para imprimir
  mensaje          text NOT NULL DEFAULT '',
  enviar_el        date,                           -- vacio = apenas se pague
  idioma           text NOT NULL DEFAULT 'es' CHECK (idioma IN ('es', 'en')),
  origen_trafico   jsonb NOT NULL DEFAULT '{}',    -- utm y fuente (como las reservas)
  estado           text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'pagado', 'fallido', 'vencido', 'revisar')),
  nota             text NOT NULL DEFAULT '',
  creado           timestamptz NOT NULL DEFAULT now(),
  actualizado      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (proveedor, cobro_id)
);

CREATE TABLE gift_cards (
  id               bigserial PRIMARY KEY,
  codigo           text NOT NULL UNIQUE CHECK (codigo ~ '^RSNT-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$'),
  monto            numeric(12,2) NOT NULL CHECK (monto > 0),
  moneda           text NOT NULL DEFAULT 'GTQ' CHECK (moneda IN ('GTQ')),
  saldo            numeric(12,2) NOT NULL CHECK (saldo >= 0),
  estado           text NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa', 'agotada', 'vencida', 'anulada')),
  emitida          timestamptz NOT NULL DEFAULT now(),
  vence            date NOT NULL,                  -- por defecto, 12 meses despues de emitida
  comprador_nombre text NOT NULL,
  comprador_email  text,
  comprador_telefono text,
  destinatario_nombre text NOT NULL,
  destinatario_email text,
  mensaje          text NOT NULL DEFAULT '',
  idioma           text NOT NULL DEFAULT 'es' CHECK (idioma IN ('es', 'en')),
  enviar_el        date,
  aviso_estado     text NOT NULL DEFAULT 'pendiente' CHECK (aviso_estado IN ('pendiente', 'programado', 'enviado', 'error', 'no_aplica')),
  aviso_enviado    timestamptz,
  aviso_detalle    text,
  origen           text NOT NULL CHECK (origen IN ('web', 'intranet')),
  pedido_id        bigint REFERENCES gift_cards_pedidos(id),
  pago_id          bigint REFERENCES pagos_en_linea(id),
  creada_por       text NOT NULL,                  -- 'webhook' o el correo de quien la emitio a mano
  CHECK (saldo <= monto)
);
CREATE INDEX gift_cards_vence ON gift_cards (vence) WHERE estado = 'activa';

-- Cada movimiento de una gift card. Nunca se edita ni se borra. saldo_despues = saldo de la tarjeta.
CREATE TABLE gift_cards_movimientos (
  id               bigserial PRIMARY KEY,
  gift_card_id     bigint NOT NULL REFERENCES gift_cards(id),
  cuando           timestamptz NOT NULL DEFAULT now(),
  tipo             text NOT NULL CHECK (tipo IN ('venta', 'canje', 'reverso_canje', 'anulacion', 'vencimiento')),
  monto            numeric(12,2) NOT NULL CHECK (monto >= 0),   -- siempre positivo; el tipo dice si suma o resta
  saldo_antes      numeric(12,2) NOT NULL CHECK (saldo_antes >= 0),
  saldo_despues    numeric(12,2) NOT NULL CHECK (saldo_despues >= 0),
  quien            text NOT NULL,
  rol              text NOT NULL,
  donde            text NOT NULL CHECK (donde IN ('web', 'sala', 'caja', 'sistema', 'oficina')),
  referencia       text NOT NULL DEFAULT '',       -- canje: mesa o numero de cuenta del POS; venta: id del pago
  movimiento_ref   bigint REFERENCES gift_cards_movimientos(id),   -- reverso_canje: el canje que deshace
  pago_id          bigint REFERENCES pagos_en_linea(id),
  nota             text NOT NULL DEFAULT '',
  CHECK (
    (tipo IN ('venta', 'reverso_canje') AND saldo_despues = saldo_antes + monto) OR
    (tipo IN ('canje', 'anulacion', 'vencimiento') AND saldo_despues = saldo_antes - monto)
  )
);
CREATE INDEX gift_cards_movimientos_tarjeta ON gift_cards_movimientos (gift_card_id, id);
CREATE INDEX gift_cards_movimientos_cuando ON gift_cards_movimientos (cuando);

-- app: lee, agrega y cambia lo que cambia de estado; NUNCA borra. Movimientos y webhooks: solo agregar.
GRANT SELECT, INSERT, UPDATE ON pagos_liquidaciones, pagos_en_linea, gift_cards_pedidos, gift_cards TO app;
GRANT SELECT, INSERT ON gift_cards_movimientos TO app;
GRANT SELECT, INSERT ON pagos_webhooks TO app;
GRANT UPDATE (procesado, resultado) ON pagos_webhooks TO app;
GRANT USAGE ON SEQUENCE pagos_liquidaciones_id_seq, pagos_en_linea_id_seq, pagos_webhooks_id_seq,
  gift_cards_pedidos_id_seq, gift_cards_id_seq, gift_cards_movimientos_id_seq TO app;
