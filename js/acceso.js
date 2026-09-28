'use strict';

// Pantalla de acceso. La contraseña se guarda cifrada (hash SHA-256 con sal) solo en este
// navegador; sirve para que otras personas no usen la app en este computador. Los datos de
// los estudiantes nunca se guardan: al salir se borran de la memoria.

const Acceso = (() => {
  const CLAVE = 'saber11.acceso';
  const SESION = 'saber11.sesion';

  const leer = (almacen, clave) => { try { return JSON.parse(almacen.getItem(clave)); } catch { return null; } };
  const escribir = (almacen, clave, valor) => { try { almacen.setItem(clave, JSON.stringify(valor)); return true; } catch { return false; } };
  const borrar = (almacen, clave) => { try { almacen.removeItem(clave); } catch { /* sin almacenamiento */ } };

  async function resumen(texto) {
    if (window.crypto?.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    let h = 2166136261; // FNV-1a si el navegador no ofrece crypto.subtle
    for (let i = 0; i < texto.length; i++) { h ^= texto.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(16);
  }

  function modo() { return leer(localStorage, CLAVE) ? 'ingresar' : 'crear'; }

  function pintar() {
    const m = modo();
    const guardado = leer(localStorage, CLAVE);
    $('#acceso-titulo').textContent = m === 'crear' ? 'Crear acceso' : 'Ingresar';
    $('#acceso-desc').textContent = m === 'crear'
      ? 'Es la primera vez que usa la app en este navegador. Escriba sus datos y elija una contraseña.'
      : `Bienvenido${guardado?.nombre ? ', ' + guardado.nombre : ''}. Escriba su contraseña para continuar.`;
    $('#acc-confirmar-caja').hidden = m !== 'crear';
    $('#acc-confirmar').required = m === 'crear';
    $('#acc-boton').textContent = m === 'crear' ? 'Crear acceso e ingresar' : 'Ingresar';
    $('#acc-olvido').hidden = m === 'crear';
    if (guardado) {
      $('#acc-nombre').value = guardado.nombre || '';
      $('#acc-institucion').value = guardado.institucion || '';
    }
    $('#acc-error').hidden = true;
  }

  function error(texto) { const e = $('#acc-error'); e.textContent = texto; e.hidden = false; }

  function entrar(usuario) {
    estado.usuario = usuario;
    escribir(sessionStorage, SESION, usuario);
    $('#acceso').hidden = true;
    $('#app').hidden = false;
    $('#usuario-nombre').textContent = [usuario.nombre, usuario.institucion].filter(Boolean).join(' · ');
  }

  async function enviar(e) {
    e.preventDefault();
    const nombre = $('#acc-nombre').value.trim();
    const institucion = $('#acc-institucion').value.trim();
    const clave = $('#acc-clave').value;
    if (!nombre) return error('Escriba su nombre.');
    if (clave.length < 4) return error('La contraseña debe tener al menos 4 caracteres.');
    if (modo() === 'crear') {
      if (clave !== $('#acc-confirmar').value) return error('Las contraseñas no coinciden.');
      const sal = [...crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, '0')).join('');
      const ok = escribir(localStorage, CLAVE, { sal, hash: await resumen(sal + clave), nombre, institucion });
      if (!ok) avisar('Este navegador no permite guardar la contraseña; se ingresará solo por esta vez.');
    } else {
      const g = leer(localStorage, CLAVE);
      if (await resumen(g.sal + clave) !== g.hash) return error('Contraseña incorrecta.');
      escribir(localStorage, CLAVE, { ...g, nombre, institucion });
    }
    $('#acc-clave').value = ''; $('#acc-confirmar').value = '';
    entrar({ nombre, institucion });
  }

  function salir() {
    borrar(sessionStorage, SESION);
    location.reload(); // borra de la memoria los datos cargados
  }

  function olvido() {
    if (!confirm('Se borrará la contraseña guardada en este navegador para que pueda crear una nueva. Sus archivos no se ven afectados. ¿Continuar?')) return;
    borrar(localStorage, CLAVE);
    pintar();
  }

  function iniciar() {
    $('#form-acceso').addEventListener('submit', enviar);
    $('#acc-olvido').addEventListener('click', olvido);
    $('#btn-salir').addEventListener('click', salir);
    const sesion = leer(sessionStorage, SESION);
    if (sesion && leer(localStorage, CLAVE)) entrar(sesion);
    else pintar();
  }

  return { iniciar };
})();

document.addEventListener('DOMContentLoaded', Acceso.iniciar);
