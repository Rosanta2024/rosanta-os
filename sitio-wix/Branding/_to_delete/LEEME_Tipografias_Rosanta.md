# Tipografías Rosanta

Última revisión: 13 de agosto 2026

## Qué hay en esta carpeta

| Archivo | Qué es |
|---|---|
| `Peskia-Bold.otf` | Peskia Bold real, comprada en MyFonts, orden 7446753181866 |
| `PeskiaES.ttf` | Versión gratuita, uso personal únicamente. **No usar en nada de Rosanta** |
| `Monotype Font Software End User License Agreement.html` | El contrato que vino con la compra |
| `Comparativo_Peskia_vs_Playfair.png` | Referencia visual |

## Peskia Bold · lo que dice el archivo comprado

| Campo | Valor |
|---|---|
| Nombre | Peskia Bold |
| Versión | 1.200 |
| Peso | 700, Bold |
| Copyright | ©2023 Martin Katibi |
| Descripción de licencia | You may use this font to create, display, and print content |
| Glifos | 231 |
| Caracteres en español | Completos. Están Ü, ü, ¿, ¡, · y ° |

Es la fuente correcta y completa. El problema no es el archivo, es el tipo de licencia.

## Qué licencia se compró

El contrato que viene en la orden se titula **Font Software For Desktop End User License Agreement**. Es licencia de escritorio, no de web. La orden trae una sola licencia.

Dos cláusulas del contrato deciden el tema:

1. Autoriza usar la fuente para crear, editar, ver, imprimir y distribuir materiales **siempre que los materiales no contengan la fuente incrustada**.
2. Prohíbe expresamente **instalar la fuente en cualquier servidor o sistema de gestión de activos digitales**.

Publicar el menú web con `@font-face` es exactamente eso: subir el archivo a un servidor y entregarlo incrustado en la página. Queda fuera de lo comprado.

## Qué se puede hacer hoy con Peskia Bold

**Sí:** menú impreso, Canva, InDesign, Illustrator, piezas de redes exportadas como imagen, presentaciones, cualquier cosa que salga como imagen o papel.

**No:** el sitio de Wix, el menú web, correos en HTML. Nada donde el texto sea seleccionable en un navegador.

## Qué falta comprar

La **licencia Webfont de Peskia Bold**, en la misma ficha de MyFonts donde se compró la desktop. Se elige "Webfont" en lugar de "Desktop" al agregar al carrito. Es anual y se cotiza por visitas mensuales del sitio. Con Bold alcanza: todos los titulares del menú web van en un solo peso.

Al comprarla, MyFonts entrega un kit con `.woff2`. Con ese archivo el menú web queda idéntico al impreso: es subirlo al repositorio `rosanta-menu` y agregar la regla `@font-face`. Un commit.

## Mientras tanto

El menú web usa **Italiana** en titulares, de licencia abierta, que es la que más se parece a Peskia. El cuerpo va en **Lato**, que es la misma que usan las cartas impresas.

Playfair Display quedó descartada: es más ancha y clásica, no tiene el aire art déco de Peskia.

## Enlaces

- Ficha de Peskia en MyFonts: https://www.myfonts.com/collections/peskia-font-valentino-vergan
