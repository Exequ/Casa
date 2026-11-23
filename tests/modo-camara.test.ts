// Fase 6, parte A: Modo cámara (candado global).

import { describe, expect, it } from 'vitest';
import { accionDeTecla, CLAVE_MODO_CAMARA, ModoCamara, type Almacen } from '../src/escena/modoCamara';

/** Almacén en memoria que hace de localStorage. */
function almacen(inicial: Record<string, string> = {}): Almacen & { datos: Record<string, string> } {
  const datos = { ...inicial };
  return { datos, getItem: (k) => datos[k] ?? null, setItem: (k, v) => { datos[k] = v; } };
}

describe('Modo cámara: estado', () => {
  it('por defecto está apagado', () => {
    expect(new ModoCamara(almacen()).activo).toBe(false);
    expect(new ModoCamara(null).activo).toBe(false);
  });

  it('se recuerda entre visitas', () => {
    const a = almacen();
    const modo = new ModoCamara(a);
    modo.poner(true);
    expect(a.datos[CLAVE_MODO_CAMARA]).toBe('1');
    expect(new ModoCamara(a).activo).toBe(true); // "otra visita"
    modo.alternar();
    expect(modo.activo).toBe(false);
    expect(new ModoCamara(a).activo).toBe(false);
  });

  it('avisa solo cuando cambia', () => {
    const modo = new ModoCamara(almacen());
    const avisos: boolean[] = [];
    modo.alCambiar((v) => avisos.push(v));
    modo.poner(false);
    modo.poner(true);
    modo.poner(true);
    modo.alternar();
    expect(avisos).toEqual([true, false]);
  });

  it('funciona aunque el almacenamiento falle (modo privado)', () => {
    const roto: Almacen = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); } };
    const modo = new ModoCamara(roto);
    expect(modo.activo).toBe(false);
    modo.poner(true);
    expect(modo.activo).toBe(true);
  });
});

describe('Modo cámara: teclas', () => {
  const t = (key: string, extra: object = {}) => ({ key, ...extra });

  it('sin candado, las teclas de edición actúan sobre el seleccionado', () => {
    expect(accionDeTecla(t('Delete'), true, false)).toEqual({ tipo: 'borrar' });
    expect(accionDeTecla(t('Backspace'), true, false)).toEqual({ tipo: 'borrar' });
    expect(accionDeTecla(t('d'), true, false)).toEqual({ tipo: 'duplicar' });
    expect(accionDeTecla(t('q'), true, false)).toEqual({ tipo: 'girar', sentido: 1, fino: false });
    expect(accionDeTecla(t('E', { shiftKey: true }), true, false)).toEqual({ tipo: 'girar', sentido: -1, fino: true });
    expect(accionDeTecla(t('Escape'), true, false)).toEqual({ tipo: 'deseleccionar' });
    expect(accionDeTecla(t('z', { ctrlKey: true }), false, false)).toEqual({ tipo: 'deshacer' });
    expect(accionDeTecla(t('Z', { ctrlKey: true, shiftKey: true }), false, false)).toEqual({ tipo: 'rehacer' });
    expect(accionDeTecla(t('y', { metaKey: true }), false, false)).toEqual({ tipo: 'rehacer' });
  });

  it('sin nada seleccionado, las teclas de objeto no hacen nada', () => {
    for (const k of ['Delete', 'd', 'q', 'e', 'Escape']) expect(accionDeTecla(t(k), false, false)).toBeNull();
  });

  it('con el candado, Supr, D, Q/E, deshacer y rehacer quedan bloqueados', () => {
    for (const k of ['Delete', 'Backspace', 'd', 'q', 'e']) {
      expect(accionDeTecla(t(k), true, true)).toEqual({ tipo: 'bloqueada' });
      expect(accionDeTecla(t(k), false, true)).toEqual({ tipo: 'bloqueada' });
    }
    expect(accionDeTecla(t('z', { ctrlKey: true }), false, true)).toEqual({ tipo: 'bloqueada' });
    expect(accionDeTecla(t('y', { ctrlKey: true }), false, true)).toEqual({ tipo: 'bloqueada' });
  });

  it('las demás teclas no son atajos (ni con candado)', () => {
    for (const modo of [false, true]) {
      expect(accionDeTecla(t('a'), true, modo)).toBeNull();
      expect(accionDeTecla(t('c', { ctrlKey: true }), true, modo)).toBeNull();
      expect(accionDeTecla(t('d', { altKey: true }), true, modo)).toBeNull();
    }
  });
});
