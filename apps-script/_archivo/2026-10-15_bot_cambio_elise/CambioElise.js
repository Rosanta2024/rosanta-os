/** UNA SOLA VEZ (15-oct-2026): Elise Adreon pidió por correo pasar su reserva de 3 a 2 personas. Se archiva después. */
function cambioElise() {
  var r = rvLlamarCambiar({ email: 'eliseadreon@gmail.com', telefono: '', fecha_actual: '', hora_actual: '',
    fecha: '', hora: '', personas: 2, canal: 'correo' });
  console.log(JSON.stringify(r));
}
