// La casa amueblada por defecto (data/escena-inicial.json): que carga entera,
// cada objeto exactamente donde dice el archivo (si no cupiera, la app lo
// movería), sin solapes ni paredes, con soporte válido y en las cantidades de las fotos.

import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';

vi.mock('../src/catalogo/modelos', () => ({
  crearModelo: async (item: { dimensiones: { ancho: number; fondo: number; alto: number } }) => {
    const { ancho, fondo, alto } = item.dimensiones;
    const m = new THREE.Mesh(new THREE.BoxGeometry(ancho, alto, fondo));
    m.position.y = alto / 2;
    const raiz = new THREE.Group();
    raiz.add(m);
    return raiz;
  },
}));

import datos from '../data/vivienda.json';
import inicial from '../data/escena-inicial.json';
import { leerCatalogo } from '../src/catalogo/catalogo';
import { GestorObjetos } from '../src/escena/objetos';
import { colocarObjetos, migrar, serializar, type EscenaGuardada, type EstadoEscena, AJUSTES_POR_DEFECTO } from '../src/escena/persistencia';
import { carasColgables, distanciaACara, problemaEnPared } from '../src/vivienda/colgar';
import { EspacioLibre } from '../src/vivienda/espacio';
import type { Vivienda } from '../src/vivienda/modelo';

const vivienda = datos as Vivienda;
const espacio = new EspacioLibre(vivienda);
const catalogo = leerCatalogo();
const escena = inicial as unknown as EscenaGuardada;

async function cargar() {
  const gestor = new GestorObjetos(new THREE.Scene(), espacio, carasColgables(vivienda), vivienda.fijos ?? []);
  const omitidos = await colocarObjetos(gestor, migrar(structuredClone(escena), { x: 0, z: 0 }).objetos, catalogo);
  return { gestor, omitidos };
}

/** Cantidades de las fotos (lotes 1 y 2 y la del lado izquierdo de la cama). */
const ESPERADOS: Record<string, number> = {
  'sofas/sofa-3-plazas': 1, 'sofas/sillon': 1, 'mesas/mesa-centro': 1, 'almacenaje/libreria': 1,
  'almacenaje/mueble-tv': 1, 'electronica/television': 1, 'mesas/mesa-comedor-cristal': 1, 'sillas/silla-comedor': 4,
  'iluminacion/lampara-pie-semiesfera': 1, 'iluminacion/lampara-tripode': 1, 'mesas/mesita-alambre': 1,
  'mesas/mesita-bandeja': 1, 'pared/espejo-marco-negro': 1, 'pared/cuadro-marco-blanco': 5, 'pared/perchero-pared': 1,
  'pared/espejo-marco-plateado': 1,
  'dormitorio/cama': 1, 'dormitorio/mesita-noche': 2, 'iluminacion/lampara-sobremesa': 3, 'dormitorio/comoda-alta': 1,
  'pared/cuadro-marco-gris': 1, 'pared/cuadro-marco-plateado': 1, 'dormitorio/puf': 1, 'pared/marco-madera': 4, 'exterior/mesa-balcon': 1, 'exterior/silla-balcon': 2,
  'decoracion/planta-pequena': 2, 'tendedero/lavadora': 1,
};

describe('escena inicial (la casa amueblada como en las fotos)', () => {
  it('está en el formato vigente y solo usa objetos reales del catálogo (ninguno de ejemplo)', () => {
    expect(escena.version).toBe(5);
    const ids = new Set(catalogo.map((i) => i.id));
    for (const o of escena.objetos) expect(ids.has(o.catalogo), o.catalogo).toBe(true);
    for (const ejemplo of ['mesa', 'armario', 'cuadro', 'espejo', 'jarron', 'planta']) {
      expect(escena.objetos.some((o) => o.catalogo === ejemplo), ejemplo).toBe(false);
    }
  });

  it('están todos los objetos de las fotos en sus cantidades', () => {
    const cuenta: Record<string, number> = {};
    for (const o of escena.objetos) cuenta[o.catalogo] = (cuenta[o.catalogo] ?? 0) + 1;
    expect(cuenta).toEqual(ESPERADOS);
  });

  it('carga entera y cada objeto queda exactamente donde dice el archivo', async () => {
    const { gestor, omitidos } = await cargar();
    expect(omitidos).toEqual([]);
    expect(gestor.objetos).toHaveLength(escena.objetos.length);
    // Guardar lo cargado da las mismas posiciones (nada se ha tenido que apartar)
    const estado = {
      objetos: gestor, suelos: { cambios: () => ({}) }, paredes: { cambios: () => ({}) },
      ajustes: { leer: () => AJUSTES_POR_DEFECTO, aplicar: () => {} },
    } as unknown as EstadoEscena;
    const otra = serializar(estado).objetos;
    escena.objetos.forEach((o, i) => {
      const g = otra[i];
      expect(g.catalogo, `${i}`).toBe(o.catalogo);
      expect(g.colocacion, `${i} ${o.catalogo}`).toBe(o.colocacion);
      if (o.colocacion !== 'pared') {
        expect(Math.hypot(g.posicion.x - o.posicion.x, g.posicion.z - o.posicion.z), `${i} ${o.catalogo} se ha movido`).toBeLessThan(0.003);
        expect(g.rotacion, `${i} ${o.catalogo}`).toBeCloseTo(o.rotacion ?? 0, 1);
      } else {
        expect(g.pared, `${i}`).toBe(o.pared);
        expect(g.altura, `${i} ${o.catalogo}`).toBe(o.altura);
        // A lo largo de la pared, en el mismo sitio que el punto del archivo
        const { cara, u } = gestor.objetos[i].pared!;
        expect(Math.abs(u - distanciaACara(cara, o.posicion.x, o.posicion.z).u), `${i} ${o.catalogo} se ha movido en la pared`).toBeLessThan(0.003);
      }
      if (o.colocacion === 'superficie') expect(g.soporte, `${i}`).toBe(o.soporte);
    });
  });

  it('ningún mueble solapa a otro ni atraviesa paredes, pilares, puertas o ventanas', async () => {
    const { gestor } = await cargar();
    for (const o of gestor.objetos.filter((x) => x.colocacion === 'suelo')) {
      expect(espacio.esValida(gestor.huella(o), false, gestor.obstaculos(o)), o.item.id).toBe(true);
    }
  });

  it('cada objeto de pared está en una pared válida (sin tapar huecos ni solaparse) y cada apoyado en un soporte válido', async () => {
    const { gestor } = await cargar();
    for (const o of gestor.objetos) {
      if (o.colocacion === 'pared') {
        const { cara, u, y } = o.pared!;
        const r = { cara, u, y, ancho: o.item.dimensiones.ancho, alto: o.item.dimensiones.alto };
        expect(problemaEnPared(r, gestor.rectsPared(o)), o.item.id).toBeNull();
      }
      if (o.colocacion === 'superficie') {
        const a = o.apoyo!;
        expect(gestor.esSoporte(a.soporte), o.item.id).toBe(true);
        const sitio = gestor.sitioEnSoporte(o.item, a.soporte, a.nivel, a.x, a.z, a.giro, o, 0);
        expect(sitio, o.item.id).not.toBeNull();
      }
    }
  });

  it('cada cosa en su estancia', async () => {
    const { gestor } = await cargar();
    const estancia = (id: string) => gestor.objetos.filter((o) => o.item.id === id)
      .map((o) => (o.colocacion === 'pared' ? o.pared!.cara.estancia : espacio.estanciaEn(o.raiz.position.x, o.raiz.position.z)));
    expect(estancia('sofas/sofa-3-plazas')).toEqual(['salon']);
    expect(estancia('sillas/silla-comedor')).toEqual(['salon', 'salon', 'salon', 'salon']);
    expect(estancia('pared/perchero-pared')).toEqual(['distribuidor']);
    expect(estancia('pared/cuadro-marco-blanco').sort()).toEqual(['distribuidor', 'distribuidor', 'salon', 'salon', 'salon']);
    expect(estancia('dormitorio/cama')).toEqual(['dormitorio']);
    expect(estancia('pared/marco-madera')).toEqual(['dormitorio', 'dormitorio', 'dormitorio', 'dormitorio']);
    expect(estancia('exterior/silla-balcon')).toEqual(['balcon', 'balcon']);
    expect(estancia('tendedero/lavadora')).toEqual(['tendedero']);
    // La tele, sobre el mueble de TV; la lámpara foco, sobre la mesita de alambre
    const sobre = (id: string) => gestor.objetos.filter((o) => o.item.id === id).map((o) => o.apoyo?.soporte.item.id);
    expect(sobre('electronica/television')).toEqual(['almacenaje/mueble-tv']);
    expect(sobre('iluminacion/lampara-tripode')).toEqual(['mesas/mesita-alambre']);
    expect(sobre('iluminacion/lampara-sobremesa').sort()).toEqual(['dormitorio/comoda-alta', 'dormitorio/mesita-noche', 'dormitorio/mesita-noche']);
    expect(estancia('dormitorio/puf')).toEqual(['dormitorio']);
    expect(estancia('pared/cuadro-marco-plateado')).toEqual(['dormitorio']);
    expect(sobre('decoracion/planta-pequena').sort()).toEqual(['exterior/mesa-balcon', 'mesas/mesita-bandeja']);
  });

  it('dormitorio: una mesita a cada lado de la cama, pegadas a ella, con un cuadro encima de cada una', async () => {
    const { gestor } = await cargar();
    const de = (id: string) => gestor.objetos.filter((o) => o.item.id === id);
    const cama = de('dormitorio/cama')[0];
    const bc = new THREE.Box3().setFromObject(cama.raiz);
    const mesitas = de('dormitorio/mesita-noche').map((o) => new THREE.Box3().setFromObject(o.raiz)).sort((a, b) => a.min.x - b.min.x);
    expect(mesitas).toHaveLength(2);
    expect(bc.min.x - mesitas[0].max.x).toBeGreaterThanOrEqual(0);
    expect(bc.min.x - mesitas[0].max.x).toBeLessThan(0.02);
    expect(mesitas[1].min.x - bc.max.x).toBeGreaterThanOrEqual(0);
    expect(mesitas[1].min.x - bc.max.x).toBeLessThan(0.02);
    // Mesitas y cabecero contra la pared norte
    for (const b of [bc, ...mesitas]) expect(b.min.z).toBeCloseTo(0.23, 1);
    // Cada cuadro (gris y plateado) cuelga en la pared norte sobre una de las mesitas
    for (const id of ['pared/cuadro-marco-gris', 'pared/cuadro-marco-plateado']) {
      const c = de(id)[0];
      expect(c.pared!.cara.elemento, id).toBe('pared:fachada-norte');
      const x = c.raiz.position.x;
      expect(mesitas.some((m) => x > m.min.x - 0.15 && x < m.max.x + 0.15), id).toBe(true);
    }
  });

  it('dormitorio: la cómoda y los 4 marcos miran hacia las mesitas (norte), no hacia la puerta', async () => {
    const { gestor } = await cargar();
    const comoda = gestor.objetos.find((o) => o.item.id === 'dormitorio/comoda-alta')!;
    // Giro 180: el frente mira al norte, con la espalda contra la pared del armario (sur, z = 2,93)
    expect(Math.round(THREE.MathUtils.radToDeg(comoda.raiz.rotation.y) + 360) % 360).toBe(180);
    expect(new THREE.Box3().setFromObject(comoda.raiz).max.z).toBeCloseTo(2.93, 2);
    const marcos = gestor.objetos.filter((o) => o.item.id === 'pared/marco-madera');
    expect(marcos).toHaveLength(4);
    for (const m of marcos) {
      expect(m.pared!.cara.elemento).toBe('pared:dormitorio-sur');
      expect(m.pared!.cara.n[1]).toBeLessThan(0); // la cara mira hacia −z (norte)
      // Encima de la cómoda
      expect(Math.abs(m.raiz.position.x - comoda.raiz.position.x)).toBeLessThan(0.3);
      expect(m.pared!.y - m.item.dimensiones.alto / 2).toBeGreaterThan(1.15);
    }
  });

  it('dormitorio: el puf, contra la pared de la puerta, sin tapar la puerta', async () => {
    const { gestor } = await cargar();
    const puf = new THREE.Box3().setFromObject(gestor.objetos.find((o) => o.item.id === 'dormitorio/puf')!.raiz);
    expect(puf.min.x).toBeCloseTo(8.75, 2);
    const pared = vivienda.paredes.find((p) => p.id === 'dormitorio-oeste')!;
    const puerta = pared.huecos!.find((h) => h.tipo === 'puerta')!;
    // La puerta va de z = desde + distancia a desde + distancia + ancho (y su hoja barre otro tanto)
    expect(puf.max.z).toBeLessThan(pared.desde[1] + puerta.distancia - 0.3);
  });
});
