const healthHandler = require('./_handlers/health');
const loginHandler = require('./_handlers/auth/login');
const registerHandler = require('./_handlers/auth/register');
const clientsHandler = require('./_handlers/clients');
const clientByIdHandler = require('./_handlers/clients/[id]');
const establishmentHandler = require('./_handlers/establishment');
const establishmentMeHandler = require('./_handlers/establishment/me');
const reservationsHandler = require('./_handlers/reservations');
const reservationGroupsHandler = require('./_handlers/reservation-groups');
const reservationGroupByIdHandler = require('./_handlers/reservation-groups/[id]');
const reservationGroupPaymentsHandler = require('./_handlers/reservation-groups/[id]/payments');
const reportPaymentsHandler = require('./_handlers/reports/payments');
const reportOccupancyHandler = require('./_handlers/reports/occupancy');

module.exports = async (req, res) => {
  try {
    const originalUrl = req.url || '/';
    const url = new URL(originalUrl, 'http://localhost');

    const routeParam = url.searchParams.get('route') || '';
    url.searchParams.delete('route');
    const remainingQuery = url.searchParams.toString();

    const normalizedRoute = routeParam.replace(/^\/+/, '').replace(/\/+$/, '');
    const path = normalizedRoute ? `/api/${normalizedRoute}` : '/api';
    req.url = remainingQuery ? `${path}?${remainingQuery}` : path;

    const segments = path.split('?')[0].split('/').filter(Boolean);
    const first = segments[1] || '';
    const second = segments[2] || '';
    const third = segments[3] || '';
    const method = (req.method || 'GET').toUpperCase();

    if (!first) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'not_found' }));
    }

    if (first === 'health') {
      return healthHandler(req, res);
    }

    if (first === 'auth') {
      if (second === 'login') {
        return loginHandler(req, res);
      }
      if (second === 'register') {
        return registerHandler(req, res);
      }
    }

    if (first === 'establishment') {
      if (second === 'me' && method === 'GET') {
        return establishmentMeHandler(req, res);
      }
      return establishmentHandler(req, res);
    }

    if (first === 'clients') {
      if (!second) {
        return clientsHandler(req, res);
      }
      return clientByIdHandler(req, res);
    }

    if (first === 'reservations') {
      return reservationsHandler(req, res);
    }

    if (first === 'reservation-groups') {
      if (!second) {
        return reservationGroupsHandler(req, res);
      }
      if (third === 'payments') {
        return reservationGroupPaymentsHandler(req, res);
      }
      return reservationGroupByIdHandler(req, res);
    }

    if (first === 'reports') {
      if (second === 'payments') {
        return reportPaymentsHandler(req, res);
      }
      if (second === 'occupancy') {
        return reportOccupancyHandler(req, res);
      }
    }

    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'not_found' }));
  } catch (error) {
    console.error('Error in unified /api router:', error);
    try {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'server_error' }));
    } catch (innerError) {
      // ignore
    }
  }
};
