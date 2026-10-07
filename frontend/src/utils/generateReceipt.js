import { jsPDF } from 'jspdf';
import { pasesIncluidosPara } from '../lib/incluidos';
import { formatearPatente } from '../lib/patente';
import { format } from '../lib/dates';
/** Formato argentino: $126.000,00. El resto de la app ya lo usa. */
function pesos(valor) {
  const n = Number.parseFloat(valor) || 0;
  return '$' + n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Las fechas llegan como yyyy-mm-dd desde la API y se muestran dd/MM/yyyy. */
function fecha(iso) {
  if (!iso) return '-';
  const [a, m, d] = String(iso).slice(0, 10).split('-');
  return d && m && a ? `${d}/${m}/${a}` : String(iso);
}

/** Local devuelve `method` y produccion `paymentMethod`; se aceptan los dos. */
function metodoDe(pago) {
  const m = pago && (pago.method || pago.paymentMethod);
  if (m === 'cash') return 'Efectivo';
  if (m === 'transfer') return 'Transferencia';
  if (m === 'card') return 'Tarjeta';
  return 'Otro';
}

export function generateReceipt(reservation, establishment) {
  const doc = new jsPDF();
  
  // Colores
  const primaryColor = [0, 0, 0]; // Negro
  const grayText = [100, 100, 100]; // Gris
  const greenSuccess = [16, 185, 129]; // Verde
  const tealBg = [20, 184, 166]; // Teal para botón
  
  // Márgenes para formato compacto (mitad de ancho)
  const leftMargin = 55;
  const rightMargin = 155;
  const centerX = 105;

  const isPoolPass = reservation?.serviceType === 'pileta';

  let yPos = 15;
  
  // Header - Nombre del establecimiento
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text(establishment?.name || 'BALNEARIO', centerX, yPos, { align: 'center' });
  yPos += 5;
  
  doc.setFontSize(isPoolPass ? 12 : 9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...grayText);
  const receiptTitle = isPoolPass ? 'Recibo Pase Pileta' : 'Recibo de Pago';
  doc.text(receiptTitle, centerX, yPos, { align: 'center' });
  yPos += 3;
  
  // El subtitulo solo tiene sentido en el pase de pileta, donde el titulo de
  // arriba dice otra cosa. En un recibo normal era la misma linea repetida.
  if (isPoolPass) {
    doc.setFontSize(8);
    doc.text('Recibo de Pago', centerX, yPos, { align: 'center' });
    yPos += 2;
  }
  yPos += 3;
  
  // Número de reserva
  doc.setFontSize(8);
  doc.setTextColor(...grayText);
  doc.text(`N° ${reservation.id}`, centerX, yPos, { align: 'center' });
  yPos += 6;
  
  // Línea separadora
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(leftMargin, yPos, rightMargin, yPos);
  yPos += 5;
  
  // DATOS DEL CLIENTE
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('DATOS DEL CLIENTE', leftMargin, yPos);
  yPos += 5;
  
  // Nombre y Apellido (RESALTADO)
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...grayText);
  doc.text('Nombre y Apellido:', leftMargin, yPos);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text(reservation.customerName || 'No especificado', rightMargin, yPos, { align: 'right' });
  yPos += 5;
  
  // DNI
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...grayText);
  doc.text('DNI:', leftMargin, yPos);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...primaryColor);
  doc.text(reservation.clientDocumentNumber || '-', rightMargin, yPos, { align: 'right' });
  yPos += 4;
  
  // Teléfono
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...grayText);
  doc.text('Telefono:', leftMargin, yPos);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...primaryColor);
  doc.text(reservation.customerPhone || 'No especificado', rightMargin, yPos, { align: 'right' });
  yPos += 6;
  
  // Línea separadora
  doc.line(leftMargin, yPos, rightMargin, yPos);
  yPos += 5;
  
  // RESERVA
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('RESERVA', leftMargin, yPos);
  yPos += 5;
  
  const serviceLabel =
    reservation.serviceType === 'carpa'
      ? 'Carpa'
      : reservation.serviceType === 'sombrilla'
        ? 'Sombrilla'
        : reservation.serviceType === 'parking'
          ? 'Estacionamiento'
          : reservation.serviceType === 'pileta'
            ? 'Pileta'
            : 'Servicio';

  const resourceText =
    reservation.serviceType === 'pileta'
      ? 'PILETA'
      : `${serviceLabel} ${reservation.resourceNumber}`;
  
  // Recurso
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...grayText);
  doc.text('Recurso:', leftMargin, yPos);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...primaryColor);
  doc.text(resourceText, rightMargin, yPos, { align: 'right' });
  yPos += 4;
  
  // Período (RESALTADO)
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...grayText);
  doc.text('Periodo:', leftMargin, yPos);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text(`${fecha(reservation.startDate)} - ${fecha(reservation.endDate)}`, rightMargin, yPos, { align: 'right' });
  yPos += 5;

  // La cantidad de personas vale para los cuatro servicios, no solo para el
  // pase de pileta. Si la reserva no la tiene cargada, la linea no sale.
  const adults = Number.parseInt(String(reservation.adultsCount ?? '0'), 10) || 0;
  const children = Number.parseInt(String(reservation.childrenCount ?? '0'), 10) || 0;

  if (adults + children > 0) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...grayText);
    doc.text('Personas:', leftMargin, yPos);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...primaryColor);
    const etiquetaMenores = isPoolPass ? 'Niños' : 'Menores';
    doc.text(`Adultos: ${adults}  ·  ${etiquetaMenores}: ${children}`, rightMargin, yPos, { align: 'right' });
    yPos += 4;
  }
  
  // Total Reserva
  const totalPrice = parseFloat(reservation.totalPrice || 0);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...grayText);
  doc.text('Total Reserva:', leftMargin, yPos);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...primaryColor);
  doc.text(pesos(totalPrice), rightMargin, yPos, { align: 'right' });
  yPos += 4;
  
  // Servicios incluidos en la carpa: la pileta (con quienes tienen pase) y
  // cada cochera. Vienen del vinculo real con la carpa (`vinculadas`).
  const vinculadas = Array.isArray(reservation.vinculadas) ? reservation.vinculadas : [];
  const lineaIncluido = (etiqueta, valor) => {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...grayText);
    doc.text(etiqueta, leftMargin, yPos);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...primaryColor);
    const texto = valor.length > 48 ? `${valor.slice(0, 47)}…` : valor;
    doc.text(texto, rightMargin, yPos, { align: 'right' });
    yPos += 4;
  };

  const paseIncluido = vinculadas.find((g) => g.serviceType === 'pileta' && g.vinculo === 'incluido');
  if (paseIncluido) {
    const pases = pasesIncluidosPara(establishment, reservation.serviceType) || 0;
    const nombres = Array.isArray(paseIncluido.paseNombres) ? paseIncluido.paseNombres : [];
    lineaIncluido('Pileta incluida:', `${pases} pases${nombres.length ? ` (${nombres.join(', ')})` : ''}`);
  }

  // La cuenta: la reserva y lo asociado que se cobra (cocheras incluidas y
  // pases de pileta pagos). El cliente paga todo junto, asi que los totales y
  // el saldo del comprobante son los de toda la cuenta.
  const cocheras = vinculadas.filter((g) => g.serviceType === 'parking' && g.vinculo === 'incluido');
  const pasesPagos = vinculadas.filter((g) => g.serviceType === 'pileta' && g.vinculo === 'adicional');
  const conMonto = [...cocheras, ...pasesPagos];
  const totalCuenta = totalPrice + conMonto.reduce((suma, g) => suma + parseFloat(g.totalPrice || 0), 0);
  const pagadoAsociado = conMonto.reduce((suma, g) => suma + parseFloat(g.paidAmount || 0), 0);

  cocheras.forEach((g) => {
    const patente = g.vehiclePlate ? `, ${formatearPatente(g.vehiclePlate)}` : '';
    lineaIncluido('Cochera incluida:', `Plaza ${g.resourceNumber}${patente} · ${pesos(parseFloat(g.totalPrice || 0))}`);
  });
  pasesPagos.forEach((g) => {
    const nombres = Array.isArray(g.paseNombres) && g.paseNombres.length ? `${g.paseNombres.join(', ')} · ` : '';
    lineaIncluido('Pileta paga:', `${nombres}${pesos(parseFloat(g.totalPrice || 0))}`);
  });
  if (conMonto.length > 0) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...grayText);
    doc.text('Total de la cuenta:', leftMargin, yPos);
    doc.setTextColor(...primaryColor);
    doc.text(pesos(totalCuenta), rightMargin, yPos, { align: 'right' });
    yPos += 4;
  }
  
  yPos += 2;
  
  // Línea separadora
  doc.line(leftMargin, yPos, rightMargin, yPos);
  yPos += 5;
  
  // DETALLE DEL PAGO (si hay pagos)
  if (reservation.payments && reservation.payments.length > 0) {
    const lastPayment = reservation.payments[reservation.payments.length - 1];
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('DETALLE DEL PAGO', leftMargin, yPos);
    yPos += 5;
    
    // Fecha de Pago
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...grayText);
    doc.text('Fecha de Pago:', leftMargin, yPos);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...primaryColor);
    doc.text(fecha(lastPayment.paymentDate), rightMargin, yPos, { align: 'right' });
    yPos += 4;
    
    // Método de Pago
    const methodLabel = metodoDe(lastPayment);
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...grayText);
    doc.text('Metodo de Pago:', leftMargin, yPos);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...primaryColor);
    doc.text(methodLabel, rightMargin, yPos, { align: 'right' });
    yPos += 4;
    
    // Concepto
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...grayText);
    doc.text('Concepto:', leftMargin, yPos);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...primaryColor);
    doc.text('Pago de reserva', rightMargin, yPos, { align: 'right' });
    yPos += 6;
  }
  
  // MONTO PAGADO (botón destacado)
  doc.setFillColor(...tealBg);
  doc.roundedRect(leftMargin, yPos, rightMargin - leftMargin, 12, 3, 3, 'F');
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  const paidAmount = parseFloat(reservation.paidAmount || 0) + pagadoAsociado;
  doc.text('MONTO PAGADO:', leftMargin + 5, yPos + 7);
  doc.setFontSize(12);
  doc.text(pesos(paidAmount), rightMargin - 5, yPos + 7, { align: 'right' });
  yPos += 14;
  
  // Línea separadora
  doc.setTextColor(...primaryColor);
  doc.line(leftMargin, yPos, rightMargin, yPos);
  yPos += 5;
  
  // ESTADO DE CUENTA
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('ESTADO DE CUENTA', leftMargin, yPos);
  yPos += 5;
  
  // Total a Pagar
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...grayText);
  doc.text('Total a Pagar:', leftMargin, yPos);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...primaryColor);
  doc.text(pesos(totalCuenta), rightMargin, yPos, { align: 'right' });
  yPos += 5;
  
  // Historial de Pagos
  if (reservation.payments && reservation.payments.length > 0) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('Historial de Pagos:', leftMargin, yPos);
    yPos += 4;
    
    reservation.payments.forEach((payment, index) => {
      const methodLabel = metodoDe(payment);
      
      // Fondo amarillo claro para cada pago
      doc.setFillColor(255, 248, 220);
      doc.roundedRect(leftMargin + 2, yPos - 2, rightMargin - leftMargin - 4, 7, 2, 2, 'F');
      
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...primaryColor);
      doc.text(`${index + 1}. ${fecha(payment.paymentDate)} - ${methodLabel}`, leftMargin + 4, yPos + 2);
      doc.setFont('helvetica', 'bold');
      doc.text(pesos(payment.amount), rightMargin - 4, yPos + 2, { align: 'right' });
      yPos += 8;
    });
  }
  
  yPos += 1;
  
  // Total Pagado
  const balance = totalCuenta - paidAmount;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...grayText);
  doc.text('Total Pagado:', leftMargin, yPos);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...primaryColor);
  doc.text(pesos(paidAmount), rightMargin, yPos, { align: 'right' });
  yPos += 4;
  
  // Saldo Pendiente
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...grayText);
  doc.text('Saldo Pendiente:', leftMargin, yPos);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...primaryColor);
  doc.text(pesos(balance), rightMargin, yPos, { align: 'right' });
  yPos += 6;
  
  // Estado final (botón verde o amarillo)
  if (balance <= 0) {
    doc.setFillColor(...greenSuccess);
    doc.roundedRect(leftMargin, yPos, rightMargin - leftMargin, 10, 3, 3, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('RESERVA PAGADA', centerX, yPos + 6, { align: 'center' });
  } else {
    doc.setFillColor(255, 193, 7);
    doc.roundedRect(leftMargin, yPos, rightMargin - leftMargin, 10, 3, 3, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(`SALDO: ${pesos(balance)}`, centerX, yPos + 6, { align: 'center' });
  }
  yPos += 12;
  
  // Footer
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...grayText);
  doc.text('Este comprobante certifica el pago recibido.', centerX, yPos, { align: 'center' });
  yPos += 3;
  doc.text('Gracias por su confianza', centerX, yPos, { align: 'center' });
  yPos += 3;
  doc.text(`Emitido: ${format(new Date(), 'dd/MM/yyyy, HH:mm')}`, centerX, yPos, { align: 'center' });
  
  // Guardar PDF
  const fileName = `Comprobante_Reserva_${reservation.id}_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf`;
  doc.save(fileName);
}
