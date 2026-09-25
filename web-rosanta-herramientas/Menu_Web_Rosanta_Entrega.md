# Menú web Rosanta · Entrega

13 de agosto 2026

## Dónde está

**Menú en vivo:** https://rosanta2024.github.io/rosanta-menu/
**Versión en inglés:** la misma URL con `?lang=en` al final
**Repositorio:** github.com/Rosanta2024/rosanta-menu, público, rama `main`

## Qué contiene

Siete secciones, español e inglés, tomadas íntegras de los tres PDF finales.

| Sección | Contenido |
|---|---|
| Cocina con propósito | Apertura de 4 párrafos y la coordenada 14° N · 91° W |
| Para Empezar | 6 entradas |
| Opciones Saludables | 4 platos |
| Hamburguesas | 2 hamburguesas |
| Algo más fuerte | 10 platos fuertes más 4 guarniciones |
| Cócteles | 15 cócteles en 3 bloques con precio por bloque |
| Vinos | 13 etiquetas en tintos, blancos, rosados y cavas |
| Bebidas | 24 líneas en 7 grupos |

Cada plato lleva su descripción, su maridaje sugerido y sus notas de origen. Los 49 precios fueron verificados uno por uno contra los PDF.

## Diseño

- Fondo Crema #F2EEEB, bandas de sección en Verde Bosque #4E6D5A, texto en verde profundo #2F4438 con contraste 9:1
- Titulares en **Italiana**. Cuerpo en **Lato**, que es la misma tipografía de las cartas impresas
- Cuerpo a 16.5 px, nombres de plato a 23 px, botones de 44 px de alto. Pensado para leerse en teléfono y para vista cansada
- Barra fija que indica en qué sección vas, más un índice a pantalla completa con las siete secciones

## Cómo se cambia un precio

1. Entrar a github.com/Rosanta2024/rosanta-menu
2. Abrir `index.html` y darle al ícono del lápiz
3. Buscar el plato y cambiar el número en `q:`
4. Commit changes

Entre 30 y 60 segundos después ya está vivo. No se toca Wix.

Todos los textos y precios viven en el bloque `MENU` al inicio del archivo. Un plato es un bloque, un precio es un número.

## Lo que falta

### 1. Montar el iframe en Wix

En la página MENU > Español: Add → Embed Code → Embed a Site, pegar la URL. En la página English, la misma URL con `?lang=en`. Dejarlo debajo del menú viejo, revisar en móvil y solo entonces publicar y ocultar las páginas sueltas de secciones.

Para el alto automático, con Dev Mode activo, en el código de cada página:

```js
$w.onReady(() => {
  $w('#html1').onMessage((event) => {
    if (event.data && event.data.rosantaMenuHeight) {
      $w('#html1').height = event.data.rosantaMenuHeight;
    }
  });
});
```

### 2. Proteger el SEO

El contenido dentro de un iframe no cuenta como contenido de la página de Wix. Tres acciones: dejar un H1 y dos párrafos de la introducción fuera del iframe, enlazar la URL del menú desde el footer, y agregar el marcado `Menu` de schema.org.

### 3. Quitar el logo de la barra

Cuando el menú viva dentro de Wix, el encabezado verde del sitio ya trae ROSANTA. Ese logo se quita y el ancho se le da al nombre de la sección.

## Decisiones que quedan abiertas

1. **Precio de cócteles de autor.** El sitio actual dice Q70, la carta nueva dice Q80. Está publicado con Q80.
2. **Un cóctel con dos nombres.** En la carta de comida aparece como "Alboroto Negroni", en la de cócteles como "Negroni de Remolacha".
3. **Typo en el PDF de comida:** "Gengibre-Lemongrass" debería ser "Jengibre". Se dejó igual que el documento.
4. **Texto de la sección de cócteles.** Se tomó de la página actual del sitio, no venía en el PDF.
