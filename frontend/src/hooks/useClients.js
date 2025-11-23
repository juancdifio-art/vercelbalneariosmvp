import { useState } from 'react';
import { getApiBaseUrl } from '../apiConfig';

const API_BASE_URL = getApiBaseUrl();

function useClients({ authToken, setError, setSuccess, setIsAuthenticated }) {
  const [clients, setClients] = useState([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientForm, setClientForm] = useState({
    id: null,
    fullName: '',
    phone: '',
    email: '',
    notes: '',
    documentNumber: '',
    birthDate: '',
    nationality: '',
    addressStreet: '',
    addressNeighborhood: '',
    addressPostalCode: '',
    addressCity: '',
    addressState: '',
    addressCountry: '',
    vehicleBrand: '',
    vehicleModel: '',
    vehiclePlate: ''
  });
  const [clientSaving, setClientSaving] = useState(false);
  const [clientDeletingId, setClientDeletingId] = useState(null);
  const [clientFormOpen, setClientFormOpen] = useState(false);

  const handleClientFieldChange = (field, value) => {
    setClientForm((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleResetClientForm = () => {
    setClientForm({
      id: null,
      fullName: '',
      phone: '',
      email: '',
      notes: '',
      documentNumber: '',
      birthDate: '',
      nationality: '',
      addressStreet: '',
      addressNeighborhood: '',
      addressPostalCode: '',
      addressCity: '',
      addressState: '',
      addressCountry: '',
      vehicleBrand: '',
      vehicleModel: '',
      vehiclePlate: ''
    });
  };

  const handleEditClient = (client) => {
    if (!client) return;
    setClientForm({
      id: client.id,
      fullName: client.fullName || '',
      phone: client.phone || '',
      email: client.email || '',
      notes: client.notes || '',
      documentNumber: client.documentNumber || '',
      birthDate: client.birthDate || '',
      nationality: client.nationality || '',
      addressStreet: client.addressStreet || '',
      addressNeighborhood: client.addressNeighborhood || '',
      addressPostalCode: client.addressPostalCode || '',
      addressCity: client.addressCity || '',
      addressState: client.addressState || '',
      addressCountry: client.addressCountry || '',
      vehicleBrand: client.vehicleBrand || '',
      vehicleModel: client.vehicleModel || '',
      vehiclePlate: client.vehiclePlate || ''
    });
    setClientFormOpen(true);
  };

  const fetchClients = async (tokenFromParam) => {
    const token = tokenFromParam || authToken || sessionStorage.getItem('authToken');

    if (!token) {
      return;
    }

    try {
      setClientsLoading(true);

      const response = await fetch(`${API_BASE_URL}/api/clients`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        console.error('Error fetching clients');
        setClients([]);
        return;
      }

      const data = await response.json();
      setClients(Array.isArray(data.clients) ? data.clients : []);
    } catch (err) {
      console.error('Error fetching clients', err);
      setClients([]);
    } finally {
      setClientsLoading(false);
    }
  };

  const handleSubmitClientForm = async (e) => {
    e.preventDefault();
    if (setError) setError('');
    if (setSuccess) setSuccess('');

    const token = authToken || sessionStorage.getItem('authToken');

    if (!token) {
      if (setError) setError('Sesión inválida. Volvé a iniciar sesión.');
      if (setIsAuthenticated) setIsAuthenticated(false);
      return;
    }

    const fullNameTrimmed = (clientForm.fullName || '').trim();

    if (!fullNameTrimmed) {
      if (setError) setError('El nombre del cliente es obligatorio.');
      return;
    }

    const isEditing = Boolean(clientForm.id);

    try {
      setClientSaving(true);

      const payload = {
        fullName: fullNameTrimmed,
        phone: clientForm.phone || '',
        email: clientForm.email || '',
        notes: clientForm.notes || '',
        documentNumber: clientForm.documentNumber || '',
        birthDate: clientForm.birthDate || '',
        nationality: clientForm.nationality || '',
        addressStreet: clientForm.addressStreet || '',
        addressNeighborhood: clientForm.addressNeighborhood || '',
        addressPostalCode: clientForm.addressPostalCode || '',
        addressCity: clientForm.addressCity || '',
        addressState: clientForm.addressState || '',
        addressCountry: clientForm.addressCountry || '',
        vehicleBrand: clientForm.vehicleBrand || '',
        vehicleModel: clientForm.vehicleModel || '',
        vehiclePlate: clientForm.vehiclePlate || ''
      };

      const url = isEditing
        ? `${API_BASE_URL}/api/clients/${clientForm.id}`
        : `${API_BASE_URL}/api/clients`;

      const response = await fetch(url, {
        method: isEditing ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Error saving client', data);
        if (setError) setError('No se pudo guardar el cliente.');
        return;
      }

      if (!data.client) {
        return;
      }

      setClients((prev) => {
        const existing = prev.find((c) => c.id === data.client.id);
        let next;
        if (existing) {
          next = prev.map((c) => (c.id === data.client.id ? data.client : c));
        } else {
          next = [...prev, data.client];
        }
        return next.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
      });

      handleResetClientForm();
      setClientFormOpen(false);
      if (setSuccess) setSuccess('Cliente guardado correctamente.');
    } catch (err) {
      console.error('Error saving client', err);
      if (setError) setError('No se pudo guardar el cliente.');
    } finally {
      setClientSaving(false);
    }
  };

  const handleDeleteClient = async (clientId) => {
    if (!clientId) return;

    // eslint-disable-next-line no-alert
    const confirmed = window.confirm('¿Eliminar este cliente? Esta acción no se puede deshacer.');
    if (!confirmed) return;

    const token = authToken || sessionStorage.getItem('authToken');

    if (!token) {
      if (setError) setError('Sesión inválida. Volvé a iniciar sesión.');
      if (setIsAuthenticated) setIsAuthenticated(false);
      return;
    }

    try {
      setClientDeletingId(clientId);

      const response = await fetch(`${API_BASE_URL}/api/clients/${clientId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        console.error('Error deleting client');
        return;
      }

      setClients((prev) => prev.filter((c) => c.id !== clientId));
    } catch (err) {
      console.error('Error deleting client', err);
    } finally {
      setClientDeletingId(null);
    }
  };

  return {
    clients,
    clientsLoading,
    clientForm,
    clientSaving,
    clientDeletingId,
    clientFormOpen,
    setClientFormOpen,
    fetchClients,
    handleClientFieldChange,
    handleResetClientForm,
    handleEditClient,
    handleSubmitClientForm,
    handleDeleteClient
  };
}

export default useClients;
