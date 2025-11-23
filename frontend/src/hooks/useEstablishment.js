import { useState, useEffect, useCallback } from 'react';
import { getApiBaseUrl } from '../apiConfig';

const API_BASE_URL = getApiBaseUrl();

function useEstablishment({
  authToken,
  isAuthenticated,
  setError,
  setSuccess,
  setIsAuthenticated,
  onSaveSuccess
}) {
  const [establishment, setEstablishment] = useState(null);
  const [establishmentLoaded, setEstablishmentLoaded] = useState(false);
  const [estName, setEstName] = useState('');
  const [estHasParking, setEstHasParking] = useState(false);
  const [estHasCarpas, setEstHasCarpas] = useState(false);
  const [estHasSombrillas, setEstHasSombrillas] = useState(false);
  const [estHasPileta, setEstHasPileta] = useState(false);
  const [estParkingCapacity, setEstParkingCapacity] = useState('');
  const [estCarpasCapacity, setEstCarpasCapacity] = useState('');
  const [estSombrillasCapacity, setEstSombrillasCapacity] = useState('');
  const [estPoolMaxOccupancy, setEstPoolMaxOccupancy] = useState('');
  const [estSaving, setEstSaving] = useState(false);

  const fetchEstablishment = useCallback(
    async (tokenFromParam) => {
      const token = tokenFromParam || authToken || sessionStorage.getItem('authToken');

      if (!token) {
        return;
      }

      try {
        setEstablishmentLoaded(false);
        const response = await fetch(`${API_BASE_URL}/api/establishment/me`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (response.status === 404) {
          setEstablishment(null);
          setEstablishmentLoaded(true);
          return;
        }

        const data = await response.json();

        if (!response.ok) {
          console.error('Error fetching establishment', data);
          setEstablishment(null);
          setEstablishmentLoaded(true);
          return;
        }

        const est = data.establishment;
        setEstablishment(est);
        setEstName(est.name || '');
        setEstHasParking(Boolean(est.hasParking));
        setEstHasCarpas(Boolean(est.hasCarpas));
        setEstHasSombrillas(Boolean(est.hasSombrillas));
        setEstHasPileta(Boolean(est.hasPileta));
        setEstParkingCapacity(
          est.parkingCapacity === null || est.parkingCapacity === undefined
            ? ''
            : String(est.parkingCapacity)
        );
        setEstCarpasCapacity(
          est.carpasCapacity === null || est.carpasCapacity === undefined
            ? ''
            : String(est.carpasCapacity)
        );
        setEstSombrillasCapacity(
          est.sombrillasCapacity === null || est.sombrillasCapacity === undefined
            ? ''
            : String(est.sombrillasCapacity)
        );
        setEstPoolMaxOccupancy(
          est.poolMaxOccupancy === null || est.poolMaxOccupancy === undefined
            ? ''
            : String(est.poolMaxOccupancy)
        );
        setEstablishmentLoaded(true);
      } catch (err) {
        console.error('[useEstablishment] Error fetching establishment', err);
        setEstablishment(null);
        setEstablishmentLoaded(true);
      }
    },
    [authToken]
  );

  const handleSaveEstablishment = useCallback(
    async (e) => {
      e.preventDefault();
      if (setError) setError('');
      if (setSuccess) setSuccess('');

      const token = authToken || sessionStorage.getItem('authToken');

      if (!token) {
        if (setError) setError('Sesión inválida. Volvé a iniciar sesión.');
        if (setIsAuthenticated) setIsAuthenticated(false);
        return;
      }

      if (!estName.trim()) {
        if (setError) setError('El nombre del establecimiento es obligatorio.');
        return;
      }

      try {
        setEstSaving(true);

        const response = await fetch(`${API_BASE_URL}/api/establishment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            name: estName.trim(),
            hasParking: estHasParking,
            hasCarpas: estHasCarpas,
            hasSombrillas: estHasSombrillas,
            hasPileta: estHasPileta,
            parkingCapacity: estParkingCapacity,
            carpasCapacity: estCarpasCapacity,
            sombrillasCapacity: estSombrillasCapacity,
            poolMaxOccupancy: estPoolMaxOccupancy
          })
        });

        const data = await response.json();

        if (!response.ok) {
          console.error('Error saving establishment', data);
          if (setError) setError('No se pudo guardar la configuración del establecimiento.');
          return;
        }

        setEstablishment(data.establishment);
        if (setSuccess) setSuccess('Establecimiento configurado correctamente.');
        if (typeof onSaveSuccess === 'function') {
          onSaveSuccess();
        }
      } catch (err) {
        console.error('Error saving establishment', err);
        if (setError) setError('No se pudo guardar la configuración del establecimiento.');
      } finally {
        setEstSaving(false);
      }
    },
    [
      authToken,
      estName,
      estHasParking,
      estHasCarpas,
      estHasSombrillas,
      estHasPileta,
      estParkingCapacity,
      estCarpasCapacity,
      estSombrillasCapacity,
      estPoolMaxOccupancy,
      setError,
      setSuccess,
      setIsAuthenticated,
      onSaveSuccess
    ]
  );

  useEffect(() => {
    if (!isAuthenticated) {
      setEstablishment(null);
      setEstablishmentLoaded(false);
      setEstName('');
      setEstHasParking(false);
      setEstHasCarpas(false);
      setEstHasSombrillas(false);
      setEstHasPileta(false);
      setEstParkingCapacity('');
      setEstCarpasCapacity('');
      setEstSombrillasCapacity('');
      setEstPoolMaxOccupancy('');
      setEstSaving(false);
    }
  }, [isAuthenticated]);

  return {
    establishment,
    establishmentLoaded,
    estName,
    setEstName,
    estHasParking,
    setEstHasParking,
    estHasCarpas,
    setEstHasCarpas,
    estHasSombrillas,
    setEstHasSombrillas,
    estHasPileta,
    setEstHasPileta,
    estParkingCapacity,
    setEstParkingCapacity,
    estCarpasCapacity,
    setEstCarpasCapacity,
    estSombrillasCapacity,
    setEstSombrillasCapacity,
    estPoolMaxOccupancy,
    setEstPoolMaxOccupancy,
    estSaving,
    fetchEstablishment,
    handleSaveEstablishment
  };
}

export default useEstablishment;
