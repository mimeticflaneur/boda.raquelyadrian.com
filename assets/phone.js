(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BodaPhone = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function normalize(value, countryCode) {
    if (typeof value !== 'string' || value.length > 60) return { error: 'Introduce un teléfono válido con prefijo de país.' };
    let number = value.trim().replace(/[\s().-]/g, '');
    let prefix = typeof countryCode === 'string' ? countryCode.trim().replace(/^00/, '+') : '';
    if (prefix && !/^\+[1-9]\d{0,2}$/.test(prefix)) return { error: 'El prefijo debe empezar por + y tener de 1 a 3 cifras.' };
    number = number.replace(/^00/, '+');
    if (!number) return { error: 'Introduce tu número de teléfono.' };
    if (number.startsWith('+')) {
      if (prefix && !number.startsWith(prefix)) return { error: 'El prefijo del teléfono no coincide con el país seleccionado.' };
    } else {
      if (!prefix) return { error: 'Añade el prefijo del país al teléfono, por ejemplo +34 o +56.' };
      number = prefix + number;
    }
    if (!/^\+[1-9]\d{6,14}$/.test(number)) return { error: 'Revisa el teléfono: usa solo cifras y un prefijo internacional con +.' };
    if ((number.startsWith('+34') || number.startsWith('+56')) && number.length !== 12) {
      return { error: 'Los teléfonos de España y Chile deben tener 9 cifras después del prefijo.' };
    }
    return { value: number };
  }
  return { normalize: normalize };
});
