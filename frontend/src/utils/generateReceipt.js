import { jsPDF } from 'jspdf';
import { format } from 'date-fns';

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
  
  doc.setFontSize(8);
  doc.text('Recibo de Pago', centerX, yPos, { align: 'center' });
  yPos += 5;
  
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
  doc.text('-', rightMargin, yPos, { align: 'right' });
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
  doc.text(`${reservation.startDate} - ${reservation.endDate}`, rightMargin, yPos, { align: 'right' });
  yPos += 5;

  if (isPoolPass) {
    const adults = Number.parseInt(String(reservation.poolAdultsCount ?? '0'), 10) || 0;
    const children = Number.parseInt(String(reservation.poolChildrenCount ?? '0'), 10) || 0;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...grayText);
    doc.text('Personas:', leftMargin, yPos);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...primaryColor);
    doc.text(`Adultos: ${adults}  ·  Niños: ${children}`, rightMargin, yPos, { align: 'right' });
    yPos += 4;
  }
  
  // Total Reserva
  const totalPrice = parseFloat(reservation.totalPrice || 0);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...grayText);
  doc.text('Total Reserva:', leftMargin, yPos);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...primaryColor);
  doc.text(`$${totalPrice.toFixed(2)}`, rightMargin, yPos, { align: 'right' });
  yPos += 4;
  
  // Estacionamiento asociado (si existe y no es una reserva de parking)
  if (reservation.serviceType !== 'parking' && reservation.linkedParkingResourceNumber) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...grayText);
    doc.text('Estacionamiento:', leftMargin, yPos);
    
    // Número de plaza en negro
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...primaryColor);
    const plazaText = `Plaza ${reservation.linkedParkingResourceNumber}`;
    const plazaWidth = doc.getTextWidth(plazaText);
    doc.text(plazaText, rightMargin, yPos, { align: 'right' });
    
    // Estado de pago con color si existe la información
    if (reservation.linkedParkingData) {
      const parkingTotal = parseFloat(reservation.linkedParkingData.totalPrice || 0);
      const parkingPaid = parseFloat(reservation.linkedParkingData.paidAmount || 0);
      const parkingBalance = parkingTotal - parkingPaid;
      
      let statusText = '';
      if (parkingBalance <= 0) {
        doc.setTextColor(...greenSuccess); // Verde
        statusText = ' (Pagado)';
      } else {
        doc.setTextColor(220, 38, 38); // Rojo
        statusText = ' (Pago pendiente)';
      }
      
      doc.text(statusText, rightMargin - plazaWidth, yPos, { align: 'right' });
    }
    
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
    doc.text(lastPayment.paymentDate, rightMargin, yPos, { align: 'right' });
    yPos += 4;
    
    // Método de Pago
    const methodLabel = lastPayment.method === 'cash' ? 'Efectivo' :
                       lastPayment.method === 'transfer' ? 'Transferencia' :
                       lastPayment.method === 'card' ? 'Tarjeta' : 'Otro';
    
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
  const paidAmount = parseFloat(reservation.paidAmount || 0);
  doc.text('MONTO PAGADO:', leftMargin + 5, yPos + 7);
  doc.setFontSize(12);
  doc.text(`$${paidAmount.toFixed(2)}`, rightMargin - 5, yPos + 7, { align: 'right' });
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
  doc.text(`$${totalPrice.toFixed(2)}`, rightMargin, yPos, { align: 'right' });
  yPos += 5;
  
  // Historial de Pagos
  if (reservation.payments && reservation.payments.length > 0) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('Historial de Pagos:', leftMargin, yPos);
    yPos += 4;
    
    reservation.payments.forEach((payment, index) => {
      const methodLabel = payment.method === 'cash' ? 'Efectivo' :
                         payment.method === 'transfer' ? 'Transferencia' :
                         payment.method === 'card' ? 'Tarjeta' : 'Otro';
      
      // Fondo amarillo claro para cada pago
      doc.setFillColor(255, 248, 220);
      doc.roundedRect(leftMargin + 2, yPos - 2, rightMargin - leftMargin - 4, 7, 2, 2, 'F');
      
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...primaryColor);
      doc.text(`${index + 1}. ${payment.paymentDate} - ${methodLabel}`, leftMargin + 4, yPos + 2);
      doc.setFont('helvetica', 'bold');
      doc.text(`$${parseFloat(payment.amount).toFixed(2)}`, rightMargin - 4, yPos + 2, { align: 'right' });
      yPos += 8;
    });
  }
  
  yPos += 1;
  
  // Total Pagado
  const balance = totalPrice - paidAmount;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...grayText);
  doc.text('Total Pagado:', leftMargin, yPos);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...primaryColor);
  doc.text(`$${paidAmount.toFixed(2)}`, rightMargin, yPos, { align: 'right' });
  yPos += 4;
  
  // Saldo Pendiente
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...grayText);
  doc.text('Saldo Pendiente:', leftMargin, yPos);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...primaryColor);
  doc.text(`$${balance.toFixed(2)}`, rightMargin, yPos, { align: 'right' });
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
    doc.text(`SALDO: $${balance.toFixed(2)}`, centerX, yPos + 6, { align: 'center' });
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
