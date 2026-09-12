# Migración del menú a Wix Restaurants Menus
### Rosanta · 14 de agosto de 2026 · estado al cierre de la sesión

---

## Lo que quedó hecho

**El conversor del menú, verificado contra los datos reales.**

`wix-menu-loader.js` lee el menú directamente del archivo fuente en GitHub y lo traduce al formato de la API de Wix. No hay que retipear nada, y si mañana cambia un precio en GitHub, se vuelve a correr.

Resultado de la verificación:

| Sección | Platos |
|---|---:|
| Para Empezar | 6 |
| Opciones Saludables | 4 |
| Hamburguesas | 2 |
| Algo más fuerte | 14 |
| Bebidas | 24 |
| Cócteles | 15 |
| Vinos | 13 |
| **Total** | **78** |

Español e inglés cuadran, 78 y 78. Ningún plato quedó sin precio.

Los casos raros están resueltos:

- **Ensalada Rosanta** y **Pasta de la Casa** tienen precios múltiples. Entran como variantes de precio de Wix, no como platos separados.
- **Los cócteles** traen el precio en el subgrupo, no en cada trago. Se propaga.
- **Los vinos** entran con copa y botella como dos variantes del mismo vino.

En el camino la verificación encontró dos errores míos: cócteles y vinos salían en cero porque asumí mal el nombre de dos campos. Corregido y vuelto a verificar. Por eso corrí la prueba antes de entregarte esto.

---

## Un hallazgo que conviene que sepas

Los datos estructurados que instalaste el 13 de agosto **tienen las descripciones cortadas**. Terminan en puntos suspensivos. Y a la Ensalada Rosanta le falta el precio, porque el generador no supo qué hacer con los tres precios.

O sea: Google hoy recibe la carta incompleta. No es grave y no urge, pero es otra razón para migrar, porque la app de Wix genera sus propios datos estructurados bien formados y ese bloque de código custom se elimina.

---

## Lo que NO hice, y por qué

Los tres puntos que autorizaste requieren tu cuenta de Wix. Entré, tu sesión está abierta, y ahí me detuve a propósito:

**1. Instalar la app.** Es un cambio de cuenta con aceptación de permisos. Se hace en dos minutos, pero no me pareció correcto aceptar términos en tu nombre estando tú fuera.

**2. Subir Peskia.** Necesita el Editor de Wix.

**3. Construir el menú en el editor.** Aquí sí fue decisión técnica, no de permisos: el Editor de Wix es un lienzo que no se automatiza de forma confiable con clics. Cargar 78 platos así, sin nadie mirando, en tu sitio en producción, es exactamente el tipo de cosa que esta semana ya nos costó caro. La API hace lo mismo de forma reversible y repetible.

---

## Tu parte: unos 10 minutos

### Paso 1 · Instalar la app

Dashboard de Wix → **App Market** → buscar **Wix Restaurants Menus**.

Ojo: tiene que ser esa, la nueva. La vieja se llama **Wix Restaurants Orders** y no sirve, es otra API.

### Paso 2 · Generar la API key

1. Ve a `manage.wix.com/account/api-keys`
2. **Generate API Key**
3. Nombre: `Carga de menú`
4. Permisos: marca **Manage Restaurants** (con menos que eso la API responde 403)
5. Copia la key. **Wix la muestra una sola vez.**

El **Site ID** ya lo tengo, lo saqué del sitio publicado:

```
47968b83-c2c2-4b11-8f94-ef2c7488debc
```

Ese es el metaSiteId, que es el que va en la cabecera `wix-site-id`. Si por alguna razón la API responde 404 con ese, el otro identificador del sitio es `ef9512c1-be00-4456-8051-2eea87545e64`.

### Paso 3 · Dejarlos en el entorno

```bash
export WIX_API_KEY="pega-aqui-la-key"
export WIX_SITE_ID="47968b83-c2c2-4b11-8f94-ef2c7488debc"
```

---

## Correr la carga

Desde esta carpeta, con Node 18 o superior.

**Primero, sin tocar Wix.** Esto solo escribe un archivo local y te deja ver exactamente qué se va a cargar:

```bash
node wix-menu-loader.js extract
```

**Después, la prueba de contrato.** Crea una sección y un plato desechables, ocultos, y te muestra la respuesta cruda de Wix:

```bash
node wix-menu-loader.js probe
```

Esto existe porque Wix publica los endpoints pero no el cuerpo exacto de las peticiones bulk. En vez de asumirlo y que reviente a mitad de los 78 platos, lo averiguamos con dos registros de mentira. Si la respuesta trae un nombre de campo distinto al que supuse, se ajusta una línea y seguimos.

Los dos registros de prueba se llaman `ZZZ PRUEBA BORRAR` y quedan ocultos. Bórralos después.

**Por último, la carga:**

```bash
node wix-menu-loader.js load
```

Deja un archivo `carga-<fecha>.json`. Si algo sale mal:

```bash
node wix-menu-loader.js rollback carga-<fecha>.json
```

---

## Dos decisiones que son tuyas, no mías

**1. El maridaje y las notas con ❀.** Wix no tiene campo para eso. Hoy el conversor los pega al final de la descripción de cada plato. Si prefieres que no aparezcan, en el script hay dos interruptores arriba del todo: `INCLUIR_MARIDAJE` e `INCLUIR_NOTAS`.

Vale la pena que lo veas con ojos de marca. El maridaje es parte de la voz de Rosanta y perderlo sería una lástima, pero pegado al final de una descripción puede leerse apelmazado.

**2. Los nombres de sección.** Hoy quedan como "Para Empezar · Comienzos con sabor", uniendo el rótulo y el título. Si prefieres solo uno de los dos, es un cambio de una línea.

---

## Lo que sigue después de la carga

En orden, y ninguno es urgente hoy:

1. **Asignar los platos a sus secciones.** La API los crea, pero dejarlos colgados de la sección correcta se termina en el dashboard. Es arrastrar, no retipear.
2. **Quitar el bloque de datos estructurados** que está en Settings → Custom Code, para no tener dos schemas peleando.
3. **Cargar el inglés** por el Translation Manager, que ahora sí puede ver este contenido.
4. **301** de `/menú-español` y `/english-menu` hacia `/menu-completo`.
5. **El menú de GitHub** queda de respaldo. No lo borres hasta que la carta nueva lleve un par de semanas estable.

---

## Nota sobre el aviso

No tengo un canal de "dispatch" conectado, así que no pude avisarte por ahí. Todo quedó documentado en este archivo. Si quieres que la próxima vez te avise por correo, lo puedo hacer, pero pídemelo explícitamente porque mandar correos en tu nombre no lo hago por iniciativa propia.
