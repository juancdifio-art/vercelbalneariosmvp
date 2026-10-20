import { describe, it, expect, vi } from 'vitest';

// jsPDF simulado: registra los textos y las fuentes, y acepta cualquier otro metodo.
vi.mock('jspdf', () => {
  class JsPDF {
    constructor() {
      this.textos = [];
      this.fuentes = [];
      this.paginas = 1;
      globalThis.ultimoPdf = this;
      return new Proxy(this, {
        get(target, clave) {
          if (clave in target) return target[clave];
          if (clave === 'internal') {
            return { pageSize: { getWidth: () => 210, getHeight: () => 297 }, scaleFactor: 1 };
          }
          return () => 10;
        }
      });
    }

    text(texto) {
      this.textos.push({ texto: String(texto), fuente: this.fuentes.at(-1) });
    }

    setFont(familia, estilo) {
      this.fuentes.push(estilo);
    }

    splitTextToSize(texto) {
      return [String(texto)];
    }

    addPage() {
      this.paginas += 1;
    }

    getNumberOfPages() {
      return this.paginas;
    }

    save(nombre) {
      this.guardado = nombre;
    }
  }
  return { jsPDF: JsPDF, default: JsPDF };
});

const { generarContratoPdf, aTextoPdf } = await import('./generateContrato');
const { armarContrato } = await import('../lib/contrato');

const datos = () => armarContrato({
  establecimiento: { name: 'Zeus' },
  contrato: { titulo: 'CONTRATACIÓN DE UNIDAD DE SOMBRA 2026-2027', condiciones: '**CONDICIONES GENERALES**\n1 – La cantidad máxima de personas es de “seis”.\n\n**OBLIGATORIO**' },
  reserva: { id: 60, serviceType: 'carpa', resourceNumber: 50, startDate: '2026-12-15', endDate: '2027-03-15', customerName: 'Lucía Gómez' },
  personas: [{ fullName: 'Ana Gómez', documentNumber: '45111222' }],
  cocheras: [{ resourceNumber: 12, vehiclePlate: 'AB123CD' }]
});

const textos = () => globalThis.ultimoPdf.textos.map((t) => t.texto);

describe('contrato en PDF', () => {
  it('imprime encabezado, titular, unidad, nomina, condiciones y la firma', () => {
    generarContratoPdf(datos());
    const todo = textos().join(' | ');

    expect(todo).toContain('ZEUS');
    expect(todo).toContain('CONTRATACIÓN DE UNIDAD DE SOMBRA 2026-2027');
    expect(todo).toContain('Reserva N° 60');
    expect(textos()).toContain('Lucía Gómez');
    expect(textos()).toContain('Carpa 50');
    expect(textos()).toContain('Del 15/12/2026 al 15/03/2027 (91 días)');
    expect(textos()).toContain('N° 12 · patente AB 123 CD');
    expect(textos()).toContain('1)  Ana Gómez');
    expect(textos()).toContain('DNI: 45111222');
    expect(todo).toContain('Firma y aclaración del contratante');
    expect(globalThis.ultimoPdf.guardado).toMatch(/^Contrato Carpa 50 \d{8}\.pdf$/);
  });

  it('lo que falta queda con puntos para completar a mano', () => {
    generarContratoPdf(datos());
    // Ciudad, direccion y telefono no estan en la reserva.
    expect(textos().filter((t) => /^\.{20,}$/.test(t)).length).toBeGreaterThanOrEqual(3);
    // Las filas vacias de la nomina tambien.
    expect(textos().some((t) => /^2\) {2}\.{20,}/.test(t))).toBe(true);
  });

  it('las condiciones respetan la negrita y pasan los signos tipograficos a texto simple', () => {
    generarContratoPdf(datos());
    const fuenteDe = (t) => globalThis.ultimoPdf.textos.find((p) => p.texto === t)?.fuente;
    // Se escribe palabra por palabra: el guion largo y las comillas pasan a simples.
    expect(textos()).toContain('-');
    expect(fuenteDe('"seis".')).toBe('normal');
    expect(fuenteDe('cantidad')).toBe('normal');
    expect(fuenteDe('OBLIGATORIO')).toBe('bold');
  });

  it('el valor de cada dato sale en negrita en medio del texto, pegado a su puntuacion', () => {
    generarContratoPdf(armarContrato({
      establecimiento: { name: 'Zeus' },
      contrato: { condiciones: 'La pileta abre a las {Pileta abre}. Hasta {Máximo de personas} personas.', datos: [{ nombre: 'Pileta abre', valor: '13.30' }] },
      reserva: { serviceType: 'carpa', resourceNumber: 1 },
      maxPersonas: 6
    }));
    const escritos = globalThis.ultimoPdf.textos;
    const i = escritos.findIndex((p) => p.texto === '13.30');
    expect(escritos[i].fuente).toBe('bold');
    // El punto va pegado al valor, en letra normal.
    expect(escritos[i + 1]).toEqual({ texto: '.', fuente: 'normal' });
    expect(escritos.find((p) => p.texto === '6').fuente).toBe('bold');
    expect(escritos.find((p) => p.texto === 'pileta').fuente).toBe('normal');
  });

  it('sin condiciones no imprime la seccion', () => {
    const c = datos();
    c.condiciones = [];
    generarContratoPdf(c);
    expect(textos()).not.toContain('CONDICIONES GENERALES');
  });
});

describe('aTextoPdf', () => {
  it('conserva acentos y eñes, y quita lo que la fuente no tiene', () => {
    expect(aTextoPdf('Dirección – Nº “ñandú” … ✓')).toBe('Dirección - Nº "ñandú" ... ');
  });
});
