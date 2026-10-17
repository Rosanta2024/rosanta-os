// ---- de Code.js
function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}


// ---- de Code.js
/** Correr UNA vez desde el editor para autorizar el permiso de Drive. */
function autorizarDrive() {
  Logger.log('Carpeta de fotos: ' + carpetaFotos_().getUrl());
}


