import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import ReservaEtiqueta from './ReservaEtiqueta';

const RESERVA = {
  id: 1,
  customerName: 'Valentina Rios',
  startDate: '2026-09-23',
  endDate: '2026-09-29'
};

// La etiqueta vive dentro de un <td>; se la monta en una tabla real.
function montar(props) {
  return render(
    <table>
      <tbody>
        <tr>
          <td>
            <ReservaEtiqueta
              group={RESERVA}
              ultimoDiaVentana="2026-10-21"
              esPrimeraColumna={false}
              {...props}
            />
          </td>
        </tr>
      </tbody>
    </table>
  );
}

describe('ReservaEtiqueta', () => {
  it('muestra el nombre en la celda donde arranca la reserva', () => {
    const { getByText } = montar({ dateStr: '2026-09-23' });
    expect(getByText('Valentina Rios')).toBeInTheDocument();
  });

  it('no se repite en los dias siguientes de la misma reserva', () => {
    const { container } = montar({ dateStr: '2026-09-25' });
    expect(container.textContent).toBe('');
  });

  it('se estira sobre todos los dias de la reserva', () => {
    const { getByText } = montar({ dateStr: '2026-09-23' });
    // del 23 al 29 son 7 celdas
    expect(getByText('Valentina Rios').style.width).toBe('calc(700% - 4px)');
  });

  it('si la reserva arranco antes de la ventana, aparece en la primera columna', () => {
    const { getByText } = montar({ dateStr: '2026-09-25', esPrimeraColumna: true });
    // del 25 al 29 quedan 5 celdas visibles
    expect(getByText('Valentina Rios').style.width).toBe('calc(500% - 4px)');
  });

  it('se corta en el borde derecho si la reserva sigue despues de la ventana', () => {
    const { getByText } = montar({ dateStr: '2026-09-23', ultimoDiaVentana: '2026-09-26' });
    // la ventana termina el 26: solo 4 celdas visibles
    expect(getByText('Valentina Rios').style.width).toBe('calc(400% - 4px)');
  });

  it('no deja pasar el click: la celda de abajo sigue abriendo la reserva', () => {
    const { getByText } = montar({ dateStr: '2026-09-23' });
    expect(getByText('Valentina Rios').className).toContain('pointer-events-none');
  });

  it('sin nombre cargado no dibuja nada', () => {
    const { container } = montar({ dateStr: '2026-09-23', group: { ...RESERVA, customerName: '  ' } });
    expect(container.textContent).toBe('');
  });
});
