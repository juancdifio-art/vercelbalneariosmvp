const healthHandler = require('./health');
const loginHandler = require('./auth/login');
const registerHandler = require('./auth/register');
const clientsHandler = require('./clients');
const clientByIdHandler = require('./clients/[id]');
const establishmentHandler = require('./establishment');
const establishmentMeHandler = require('./establishment/me');
const reservationsHandler = require('./reservations');
const reservationGroupsHandler = require('./reservation-groups');
const reservationGroupByIdHandler = require('./reservation-groups/[id]');
const reservationGroupPaymentsHandler = require('./reservation-groups/[id]/payments');
const reportPaymentsHandler = require('./reports/payments');
const reportOccupancyHandler = require('./reports/occupancy');

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
