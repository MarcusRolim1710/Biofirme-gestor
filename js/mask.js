(function (global) {
  'use strict';

  function onlyDigits(value) {
    return (value || '').replace(/\D+/g, '');
  }

  function maskCPF(raw) {
    const d = onlyDigits(raw).slice(0, 11);
    let out = '';
    if (d.length > 0) out = d.slice(0, 3);
    if (d.length >= 4) out += '.' + d.slice(3, 6);
    if (d.length >= 7) out += '.' + d.slice(6, 9);
    if (d.length >= 10) out += '-' + d.slice(9, 11);
    return out;
  }

  function maskRG(raw) {
    const d = onlyDigits(raw).slice(0, 13);
    let out = '';
    if (d.length > 0) out = d.slice(0, 2);
    if (d.length >= 3) out += '.' + d.slice(2, 5);
    if (d.length >= 6) out += '.' + d.slice(5, 8);
    if (d.length >= 9) out += '-' + d.slice(8, 13);
    return out;
  }

  function maskCNPJ(raw) {
    const d = onlyDigits(raw).slice(0, 14);
    let out = '';
    if (d.length > 0) out = d.slice(0, 2);
    if (d.length >= 3) out += '.' + d.slice(2, 5);
    if (d.length >= 6) out += '.' + d.slice(5, 8);
    if (d.length >= 9) out += '/' + d.slice(8, 12);
    if (d.length >= 13) out += '-' + d.slice(12, 14);
    return out;
  }

  function maskCEP(raw) {
    const d = onlyDigits(raw).slice(0, 8);
    let out = '';
    if (d.length > 0) out = d.slice(0, 5);
    if (d.length >= 6) out += '-' + d.slice(5, 8);
    return out;
  }

  function maskPhone(raw) {
    const d = onlyDigits(raw).slice(0, 11);
    if (d.length === 0) return '';
    if (d.length <= 2) return '(' + d;
    if (d.length <= 6) return '(' + d.slice(0, 2) + ') ' + d.slice(2);
    if (d.length <= 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6, 10);
    return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7, 11);
  }

  function maskPIS(raw) {
    const d = onlyDigits(raw).slice(0, 11);
    let out = '';
    if (d.length > 0) out = d.slice(0, 3);
    if (d.length >= 4) out += '.' + d.slice(3, 8);
    if (d.length >= 9) out += '.' + d.slice(8, 10);
    if (d.length >= 10) out += '-' + d.slice(10, 11);
    return out;
  }

  function maskCTPS(raw) {
    const d = onlyDigits(raw).slice(0, 10);
    let out = '';
    if (d.length > 0) out = d.slice(0, 6);
    if (d.length >= 7) out += '/' + d.slice(6, 9);
    if (d.length >= 10) out += '-' + d.slice(9, 10);
    return out;
  }

  function maskDate(raw) {
    const d = onlyDigits(raw).slice(0, 8);
    let out = '';
    if (d.length > 0) out = d.slice(0, 2);
    if (d.length >= 3) out += '/' + d.slice(2, 4);
    if (d.length >= 5) out += '/' + d.slice(4, 8);
    return out;
  }

  function maskMoney(raw) {
    let v = (raw || '').replace(/[^\d,]/g, '');
    const parts = v.split(',');
    if (parts.length > 2) v = parts[0] + ',' + parts.slice(1).join('');
    const [intPart, decPart] = v.split(',');
    const intFmt = (intPart || '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    if (decPart === undefined) return intFmt;
    return intFmt + ',' + decPart.slice(0, 2);
  }

  const MASKS = {
    cpf: maskCPF,
    rg: maskRG,
    cnpj: maskCNPJ,
    cep: maskCEP,
    phone: maskPhone,
    pis: maskPIS,
    ctps: maskCTPS,
    date: maskDate,
    money: maskMoney
  };

  function applyMask(input, type) {
    const fn = MASKS[type];
    if (!fn) return;
    input.value = fn(input.value);
  }

  function attach(input, type) {
    if (!input || input.dataset.maskBound === '1') return;
    input.dataset.maskBound = '1';
    input.setAttribute('inputmode', 'numeric');
    input.setAttribute('autocomplete', 'off');
    if (input.value) input.value = MASKS[type](input.value);
    input.addEventListener('input', function () {
      const before = input.value;
      const after = MASKS[type](before);
      if (before !== after) input.value = after;
    });
    input.addEventListener('paste', function (e) {
      const text = (e.clipboardData || window.clipboardData).getData('text');
      e.preventDefault();
      input.value = MASKS[type](text);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    input.addEventListener('blur', function () {
      input.value = MASKS[type](input.value);
    });
  }

  function autoBind(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-mask]').forEach(function (el) {
      attach(el, el.getAttribute('data-mask'));
    });
  }

  global.BiofirmMasks = {
    onlyDigits: onlyDigits,
    apply: applyMask,
    bind: attach,
    autoBind: autoBind,
    MASKS: MASKS
  };

  document.addEventListener('DOMContentLoaded', function () {
    autoBind();
  });
})(window);
