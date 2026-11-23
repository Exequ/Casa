// Fase 6, parte C: plegar y desplegar el catálogo.

import { describe, expect, it } from 'vitest';
import type { Almacen } from '../src/escena/modoCamara';
import { CLAVE_PLEGADO_CATALOGO, PlegadoCatalogo } from '../src/ui/plegado';

const CATS = ['Almacenaje', 'Balcón', 'Decoración', 'Dormitorio'];
function almacen(): Almacen & { datos: Record<string, string> } {
  const datos: Record<string, string> = {};
  return { datos, getItem: (k) => datos[k] ?? null, setItem: (k, v) => { datos[k] = v; } };
}
const abiertas = (p: PlegadoCatalogo) => CATS.filter((c) => p.vista(c).abierta);
const visibles = (p: PlegadoCatalogo) => CATS.filter((c) => p.vista(c).visible);

describe('plegado del catálogo', () => {
  it('por defecto: catálogo abierto y todas las categorías plegadas', () => {
    const p = new PlegadoCatalogo(CATS, almacen());
    expect(p.catalogoAbierto).toBe(true);
    expect(abiertas(p)).toEqual([]);
    expect(visibles(p)).toEqual(CATS);
  });

  it('la cabecera pliega y despliega todo el catálogo sin olvidar las categorías', () => {
    const p = new PlegadoCatalogo(CATS, almacen());
    p.ponerCategoria('Balcón', true);
    p.alternarCatalogo();
    expect(p.catalogoAbierto).toBe(false);
    p.alternarCatalogo();
    expect(p.catalogoAbierto).toBe(true);
    expect(abiertas(p)).toEqual(['Balcón']);
  });

  it('Desplegar todo y Plegar todo no cierran la cabecera; Desplegar todo la abre si estaba plegada', () => {
    const p = new PlegadoCatalogo(CATS, almacen());
    p.desplegarTodo();
    expect(abiertas(p)).toEqual(CATS);
    expect(p.catalogoAbierto).toBe(true);
    p.plegarTodo();
    expect(abiertas(p)).toEqual([]);
    expect(p.catalogoAbierto).toBe(true);
    p.ponerCatalogo(false);
    p.plegarTodo();
    expect(p.catalogoAbierto).toBe(false);
    p.desplegarTodo();
    expect(p.catalogoAbierto).toBe(true);
  });

  it('el buscador abre las categorías con resultados, oculta las vacías y luego restaura el estado', () => {
    const p = new PlegadoCatalogo(CATS, almacen());
    p.ponerCategoria('Almacenaje', true);
    p.buscar(['Balcón', 'Dormitorio']);
    expect(visibles(p)).toEqual(['Balcón', 'Dormitorio']);
    expect(abiertas(p)).toEqual(['Balcón', 'Dormitorio']);
    // Cerrar una a mano durante la búsqueda: dura mientras se busca, no se recuerda
    p.ponerCategoria('Balcón', false);
    p.buscar(['Balcón', 'Dormitorio', 'Decoración']); // se sigue escribiendo
    expect(abiertas(p)).toEqual(['Decoración', 'Dormitorio']);
    p.buscar(null);
    expect(visibles(p)).toEqual(CATS);
    expect(abiertas(p)).toEqual(['Almacenaje']);
    // Una búsqueda nueva empieza con todo lo encontrado abierto
    p.buscar(['Balcón']);
    expect(abiertas(p)).toEqual(['Balcón']);
  });

  it('se recuerda entre visitas (y no lo abierto por la búsqueda)', () => {
    const a = almacen();
    const p = new PlegadoCatalogo(CATS, a);
    p.ponerCategoria('Dormitorio', true);
    p.ponerCatalogo(false);
    p.buscar(['Balcón']);
    p.ponerCategoria('Balcón', true);
    const otra = new PlegadoCatalogo(CATS, a);
    expect(otra.catalogoAbierto).toBe(false);
    expect(abiertas(otra)).toEqual(['Dormitorio']);
    expect(JSON.parse(a.datos[CLAVE_PLEGADO_CATALOGO])).toEqual({ abierto: false, abiertas: ['Dormitorio'] });
  });

  it('un estado guardado roto o con categorías que ya no existen no estorba', () => {
    const a = almacen();
    a.setItem(CLAVE_PLEGADO_CATALOGO, '{roto');
    expect(abiertas(new PlegadoCatalogo(CATS, a))).toEqual([]);
    a.setItem(CLAVE_PLEGADO_CATALOGO, JSON.stringify({ abierto: true, abiertas: ['Vieja', 'Balcón'] }));
    expect(abiertas(new PlegadoCatalogo(CATS, a))).toEqual(['Balcón']);
    expect(new PlegadoCatalogo(CATS, null).catalogoAbierto).toBe(true);
  });
});
