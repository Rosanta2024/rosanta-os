# en.rosanta.rest y es.rosanta.rest (subdominios de idioma del sitio de Wix)

Hasta el 30-oct apuntan a Wix (CNAME cdn3.wixdns.net en la zona rosanta-rest). Desde el 30 redirigen con 301 al sitio
nuevo, conservando la ruta, para que no queden apuntando a Wix cuando se cancele:

- en.rosanta.rest/<ruta>  →  https://www.rosanta.rest/<ruta>      (el inglés es la raíz)
- es.rosanta.rest/<ruta>  →  https://www.rosanta.rest/es/<ruta>

Cada uno es un sitio de Firebase Hosting aparte (multi-sitio, proyecto rosanta-apps-script) que solo tiene la redirección:
`firebase hosting:sites:create rosanta-en` y `rosanta-es`, luego `firebase deploy --only hosting:<sitio>` desde cada carpeta.
El dominio se agrega a cada sitio con la configuración avanzada (certificado por TXT antes de apuntar).
