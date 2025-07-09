import React, { useState, useEffect } from "react";
import "./App.css";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Utility functions
const getSubdomain = () => {
  const hostname = window.location.hostname;
  const parts = hostname.split('.');
  
  // Handle preview domains like e7ac2d55-3a43-4368-bb35-863c6593dcf7.preview.emergentagent.com
  if (hostname.includes('emergentagent.com') || hostname.includes('localhost')) {
    // This is the main domain or localhost
    return null;
  }
  
  if (parts.length > 2) {
    return parts[0];
  }
  return null;
};

const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem('token', token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
  }
};

const getAuthToken = () => {
  return localStorage.getItem('token');
};

// Initialize axios with token
const initializeAuth = () => {
  const token = getAuthToken();
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }
};

// Components
const VereinRegistration = ({ onRegistrationSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    subdomain: '',
    description: '',
    admin_email: '',
    admin_password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API}/vereine`, formData);
      onRegistrationSuccess(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Fehler bei der Registrierung');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">
          Verein Registrierung
        </h1>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Verein Name
            </label>
            <input
              type="text"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Subdomain
            </label>
            <input
              type="text"
              required
              placeholder="z.B. sv-muenchen"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.subdomain}
              onChange={(e) => setFormData({...formData, subdomain: e.target.value})}
            />
            <p className="text-xs text-gray-500 mt-1">
              Ihre URL wird {formData.subdomain}.platform.com
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Beschreibung (optional)
            </label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows="3"
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Admin E-Mail
            </label>
            <input
              type="email"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.admin_email}
              onChange={(e) => setFormData({...formData, admin_email: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Admin Passwort
            </label>
            <input
              type="password"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.admin_password}
              onChange={(e) => setFormData({...formData, admin_password: e.target.value})}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? 'Registriere...' : 'Verein Registrieren'}
          </button>
        </form>
      </div>
    </div>
  );
};

const AdminLogin = ({ subdomain, onLogin }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    subdomain: subdomain || ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!formData.subdomain) {
      setError('Bitte geben Sie eine Subdomain ein');
      setLoading(false);
      return;
    }

    try {
      const response = await axios.post(`${API}/admin/login`, {
        email: formData.email,
        password: formData.password,
        subdomain: formData.subdomain
      });
      setAuthToken(response.data.token);
      onLogin(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Fehler beim Anmelden');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">
          Admin Anmeldung
        </h1>
        {subdomain && (
          <p className="text-center text-gray-600 mb-6">
            Verein: <strong>{subdomain}</strong>
          </p>
        )}
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!subdomain && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Verein Subdomain
              </label>
              <input
                type="text"
                required
                placeholder="z.B. sv-muenchen"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                value={formData.subdomain}
                onChange={(e) => setFormData({...formData, subdomain: e.target.value})}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              E-Mail
            </label>
            <input
              type="email"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Passwort
            </label>
            <input
              type="password"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
          >
            {loading ? 'Anmelden...' : 'Anmelden'}
          </button>
        </form>

        <div className="mt-6 text-center space-y-2">
          <a href="/member" className="block text-blue-600 hover:text-blue-800 text-sm">
            Mitglieder-Portal →
          </a>
          <a href="/" className="block text-gray-600 hover:text-gray-800 text-sm">
            ← Zurück zur Registrierung
          </a>
        </div>
      </div>
    </div>
  );
};

const MemberLogin = ({ subdomain, onLogin }) => {
  const [formData, setFormData] = useState({
    email: '',
    membership_number: '',
    subdomain: subdomain || ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!formData.subdomain) {
      setError('Bitte geben Sie eine Subdomain ein');
      setLoading(false);
      return;
    }

    try {
      const response = await axios.post(`${API}/member/login`, {
        email: formData.email,
        membership_number: formData.membership_number,
        subdomain: formData.subdomain
      });
      setAuthToken(response.data.token);
      onLogin(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Fehler beim Anmelden');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">
          Mitglieder-Portal
        </h1>
        {subdomain && (
          <p className="text-center text-gray-600 mb-6">
            Verein: <strong>{subdomain}</strong>
          </p>
        )}
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!subdomain && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Verein Subdomain
              </label>
              <input
                type="text"
                required
                placeholder="z.B. sv-muenchen"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                value={formData.subdomain}
                onChange={(e) => setFormData({...formData, subdomain: e.target.value})}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              E-Mail
            </label>
            <input
              type="email"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mitgliedsnummer
            </label>
            <input
              type="text"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              value={formData.membership_number}
              onChange={(e) => setFormData({...formData, membership_number: e.target.value})}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
          >
            {loading ? 'Anmelden...' : 'Anmelden'}
          </button>
        </form>

        <div className="mt-6 text-center space-y-2">
          <a href="/admin" className="block text-blue-600 hover:text-blue-800 text-sm">
            ← Admin-Bereich
          </a>
          <a href="/" className="block text-gray-600 hover:text-gray-800 text-sm">
            ← Zurück zur Registrierung
          </a>
        </div>
      </div>
    </div>
  );
};

const AdminDashboard = ({ verein, onLogout }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [members, setMembers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [events, setEvents] = useState([]);
  const [eventRegistrations, setEventRegistrations] = useState({});
  const [calendarIntegrations, setCalendarIntegrations] = useState([]);
  const [dashboardWidgets, setDashboardWidgets] = useState([]);
  const [widgetData, setWidgetData] = useState({});
  const [financialReport, setFinancialReport] = useState(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [showAddCalendar, setShowAddCalendar] = useState(false);
  const [showEventRegistrations, setShowEventRegistrations] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedMember, setSelectedMember] = useState(null);

  const [memberForm, setMemberForm] = useState({
    name: '',
    email: '',
    membership_number: '',
    membership_type: 'Standard',
    phone: '',
    address: '',
    fees_status: 'Offen'
  });

  const [paymentForm, setPaymentForm] = useState({
    member_id: '',
    amount: '',
    payment_type: 'Mitgliedsbeitrag',
    description: '',
    due_date: ''
  });

  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    event_type: 'Training',
    start_datetime: '',
    end_datetime: '',
    location: '',
    max_participants: '',
    registration_required: true,
    cost: '0'
  });

  const [calendarForm, setCalendarForm] = useState({
    calendar_type: 'google',
    calendar_name: '',
    access_token: '',
    calendar_id: '',
    sync_events: true
  });

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      await fetchMembers(); // Always fetch members as we need them for payment display
      
      if (activeTab === 'dashboard') {
        await fetchDashboardWidgets();
      } else if (activeTab === 'payments') {
        await fetchPayments();
      } else if (activeTab === 'events') {
        await fetchEvents();
      } else if (activeTab === 'calendar') {
        await fetchCalendarIntegrations();
      } else if (activeTab === 'reports') {
        await fetchFinancialReport();
      }
    } catch (err) {
      setError('Fehler beim Laden der Daten');
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    const response = await axios.get(`${API}/admin/members`);
    setMembers(response.data);
  };

  const fetchPayments = async () => {
    const response = await axios.get(`${API}/admin/payments`);
    setPayments(response.data);
  };

  const fetchEvents = async () => {
    const response = await axios.get(`${API}/admin/events`);
    setEvents(response.data);
  };

  const fetchCalendarIntegrations = async () => {
    const response = await axios.get(`${API}/admin/calendar/integrations`);
    setCalendarIntegrations(response.data);
  };

  const fetchEventRegistrations = async (eventId) => {
    const response = await axios.get(`${API}/admin/events/${eventId}/registrations`);
    setEventRegistrations(prev => ({
      ...prev,
      [eventId]: response.data
    }));
  };

  const fetchFinancialReport = async () => {
    const response = await axios.get(`${API}/admin/reports/financial`);
    setFinancialReport(response.data);
  };

  const fetchDashboardWidgets = async () => {
    const response = await axios.get(`${API}/admin/dashboard/widgets`);
    setDashboardWidgets(response.data);
    
    // Fetch data for each widget type
    const widgetTypes = [...new Set(response.data.map(w => w.widget_type))];
    const dataPromises = widgetTypes.map(async (type) => {
      try {
        const dataResponse = await axios.get(`${API}/admin/dashboard/widget-data/${type}`);
        return { type, data: dataResponse.data };
      } catch (err) {
        console.error(`Error fetching data for widget type ${type}:`, err);
        return { type, data: {} };
      }
    });
    
    const widgetDataResults = await Promise.all(dataPromises);
    const newWidgetData = {};
    widgetDataResults.forEach(({ type, data }) => {
      newWidgetData[type] = data;
    });
    setWidgetData(newWidgetData);
  };

  const resetDefaultDashboard = async () => {
    if (window.confirm('Möchten Sie das Dashboard auf die Standardkonfiguration zurücksetzen?')) {
      try {
        await axios.post(`${API}/admin/dashboard/reset-default`);
        await fetchDashboardWidgets();
        alert('Dashboard erfolgreich zurückgesetzt!');
      } catch (err) {
        setError('Fehler beim Zurücksetzen des Dashboards');
      }
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/admin/members`, memberForm);
      setMemberForm({
        name: '',
        email: '',
        membership_number: '',
        membership_type: 'Standard',
        phone: '',
        address: '',
        fees_status: 'Offen'
      });
      setShowAddMember(false);
      fetchMembers();
    } catch (err) {
      setError(err.response?.data?.detail || 'Fehler beim Hinzufügen des Mitglieds');
    }
  };

  const handleAddCalendar = async (e) => {
    e.preventDefault();
    try {
      const calendarData = {
        calendar_type: calendarForm.calendar_type,
        calendar_name: calendarForm.calendar_name,
        access_token: calendarForm.access_token,
        calendar_id: calendarForm.calendar_id,
        sync_events: calendarForm.sync_events
      };
      
      console.log('Submitting calendar integration:', calendarData);
      const response = await axios.post(`${API}/admin/calendar/integrations`, calendarData);
      console.log('Calendar integration created:', response.data);
      
      setCalendarForm({
        calendar_type: 'google',
        calendar_name: '',
        access_token: '',
        calendar_id: '',
        sync_events: true
      });
      setShowAddCalendar(false);
      
      await fetchCalendarIntegrations();
    } catch (err) {
      console.error('Error creating calendar integration:', err);
      setError(err.response?.data?.detail || 'Fehler beim Erstellen der Kalender-Integration');
    }
  };

  const handleDeleteCalendar = async (calendarId) => {
    if (window.confirm('Sind Sie sicher, dass Sie diese Kalender-Integration löschen möchten?')) {
      try {
        await axios.delete(`${API}/admin/calendar/integrations/${calendarId}`);
        fetchCalendarIntegrations();
      } catch (err) {
        setError('Fehler beim Löschen der Kalender-Integration');
      }
    }
  };

  const syncEventsToCalendar = async () => {
    try {
      setLoading(true);
      const response = await axios.post(`${API}/admin/calendar/sync`);
      alert('Veranstaltungen erfolgreich synchronisiert!');
      console.log('Sync results:', response.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Fehler bei der Kalender-Synchronisation');
    } finally {
      setLoading(false);
    }
  };

  const exportCalendar = async () => {
    try {
      const response = await axios.get(`${API}/admin/calendar/export`, {
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `vereinskalender_${Date.now()}.ics`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError('Fehler beim Exportieren des Kalenders');
    }
  };

  const exportEvent = async (eventId, eventTitle) => {
    try {
      const response = await axios.get(`${API}/admin/calendar/export/event/${eventId}`, {
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${eventTitle.replace(/\s+/g, '_')}.ics`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError('Fehler beim Exportieren der Veranstaltung');
    }
  };

  const handleDeleteCalendar = async (calendarId) => {
    if (window.confirm('Sind Sie sicher, dass Sie diese Kalender-Integration löschen möchten?')) {
      try {
        await axios.delete(`${API}/admin/calendar/integrations/${calendarId}`);
        fetchCalendarIntegrations();
      } catch (err) {
        setError('Fehler beim Löschen der Kalender-Integration');
      }
    }
  };

  const syncEventsToCalendar = async () => {
    try {
      setLoading(true);
      const response = await axios.post(`${API}/admin/calendar/sync`);
      alert('Veranstaltungen erfolgreich synchronisiert!');
      console.log('Sync results:', response.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Fehler bei der Kalender-Synchronisation');
    } finally {
      setLoading(false);
    }
  };

  const exportCalendar = async () => {
    try {
      const response = await axios.get(`${API}/admin/calendar/export`, {
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `vereinskalender_${Date.now()}.ics`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError('Fehler beim Exportieren des Kalenders');
    }
  };

  const exportEvent = async (eventId, eventTitle) => {
    try {
      const response = await axios.get(`${API}/admin/calendar/export/event/${eventId}`, {
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${eventTitle.replace(/\s+/g, '_')}.ics`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError('Fehler beim Exportieren der Veranstaltung');
    }
  };
    e.preventDefault();
    try {
      const eventData = {
        title: eventForm.title,
        description: eventForm.description,
        event_type: eventForm.event_type,
        start_datetime: new Date(eventForm.start_datetime).toISOString(),
        end_datetime: new Date(eventForm.end_datetime).toISOString(),
        location: eventForm.location,
        max_participants: eventForm.max_participants ? parseInt(eventForm.max_participants) : null,
        registration_required: eventForm.registration_required,
        cost: parseFloat(eventForm.cost) || 0
      };
      
      console.log('Submitting event:', eventData);
      const response = await axios.post(`${API}/admin/events`, eventData);
      console.log('Event created:', response.data);
      
      setEventForm({
        title: '',
        description: '',
        event_type: 'Training',
        start_datetime: '',
        end_datetime: '',
        location: '',
        max_participants: '',
        registration_required: true,
        cost: '0'
      });
      setShowAddEvent(false);
      
      await fetchEvents();
    } catch (err) {
      console.error('Error creating event:', err);
      setError(err.response?.data?.detail || 'Fehler beim Erstellen der Veranstaltung');
    }
  };

  const handleDeleteEvent = async (eventId) => {
    if (window.confirm('Sind Sie sicher, dass Sie diese Veranstaltung löschen möchten?')) {
      try {
        await axios.delete(`${API}/admin/events/${eventId}`);
        fetchEvents();
      } catch (err) {
        setError('Fehler beim Löschen der Veranstaltung');
      }
    }
  };

  const updateEventStatus = async (eventId, newStatus) => {
    try {
      await axios.put(`${API}/admin/events/${eventId}`, {
        status: newStatus
      });
      fetchEvents();
    } catch (err) {
      setError('Fehler beim Aktualisieren des Veranstaltungsstatus');
    }
  };

  const viewEventRegistrations = async (event) => {
    setSelectedEvent(event);
    await fetchEventRegistrations(event.id);
    setShowEventRegistrations(true);
  };

  const updateRegistrationStatus = async (eventId, registrationId, newStatus) => {
    try {
      await axios.put(`${API}/admin/events/${eventId}/registrations/${registrationId}`, {
        status: newStatus
      });
      await fetchEventRegistrations(eventId);
    } catch (err) {
      setError('Fehler beim Aktualisieren des Anmeldestatus');
    }
  };
  const handleAddPayment = async (e) => {
    e.preventDefault();
    try {
      const paymentData = {
        member_id: paymentForm.member_id,
        amount: parseFloat(paymentForm.amount),
        payment_type: paymentForm.payment_type,
        description: paymentForm.description,
        due_date: new Date(paymentForm.due_date).toISOString()
      };
      
      console.log('Submitting payment:', paymentData);
      const response = await axios.post(`${API}/admin/payments`, paymentData);
      console.log('Payment created:', response.data);
      
      setPaymentForm({
        member_id: '',
        amount: '',
        payment_type: 'Mitgliedsbeitrag',
        description: '',
        due_date: ''
      });
      setShowAddPayment(false);
      setSelectedMember(null);
      
      // Refresh both payments and members data
      await fetchPayments();
      if (activeTab === 'members') {
        await fetchMembers();
      }
    } catch (err) {
      console.error('Error creating payment:', err);
      setError(err.response?.data?.detail || 'Fehler beim Hinzufügen der Zahlung');
    }
  };

  const handleDeleteMember = async (memberId) => {
    if (window.confirm('Sind Sie sicher, dass Sie dieses Mitglied löschen möchten?')) {
      try {
        await axios.delete(`${API}/admin/members/${memberId}`);
        fetchMembers();
      } catch (err) {
        setError('Fehler beim Löschen des Mitglieds');
      }
    }
  };

  const updatePaymentStatus = async (paymentId, newStatus) => {
    try {
      await axios.put(`${API}/admin/payments/${paymentId}`, {
        status: newStatus
      });
      fetchPayments();
    } catch (err) {
      setError('Fehler beim Aktualisieren des Zahlungsstatus');
    }
  };

  const generateInvoice = async (memberId, paymentIds) => {
    try {
      const response = await axios.post(`${API}/admin/invoices/generate`, {
        member_id: memberId,
        payment_ids: paymentIds
      }, { 
        responseType: 'blob' 
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Rechnung_${Date.now()}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError('Fehler beim Generieren der Rechnung');
    }
  };

  const updateFeesStatus = async (memberId, newStatus) => {
    try {
      await axios.put(`${API}/admin/members/${memberId}`, {
        fees_status: newStatus
      });
      fetchMembers();
    } catch (err) {
      setError('Fehler beim Aktualisieren des Beitragsstatus');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Bezahlt': return 'text-green-600';
      case 'Überfällig': return 'text-red-600';
      default: return 'text-yellow-600';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('de-AT');
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('de-AT', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  // ... rest of the component

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                {verein.verein_name} - Admin Dashboard
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={onLogout}
                className="text-gray-500 hover:text-gray-700"
              >
                Abmelden
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Tab Navigation */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'dashboard'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('members')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'members'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Mitgliederverwaltung
            </button>
            <button
              onClick={() => setActiveTab('payments')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'payments'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Zahlungsverwaltung
            </button>
            <button
              onClick={() => setActiveTab('events')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'events'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Veranstaltungen
            </button>
            <button
              onClick={() => setActiveTab('calendar')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'calendar'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Kalender-Integration
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'reports'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Finanzberichte
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Members Tab */}
        {activeTab === 'members' && (
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-medium text-gray-900">Mitgliederverwaltung</h2>
                <button
                  onClick={() => setShowAddMember(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                  Mitglied hinzufügen
                </button>
              </div>

              {loading ? (
                <div className="text-center py-4">Lade Mitglieder...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          E-Mail
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Mitgliedsnummer
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Typ
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Beitragsstatus
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Aktionen
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {members.map((member) => (
                        <tr key={member.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {member.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {member.email}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {member.membership_number}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {member.membership_type}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <select
                              value={member.fees_status}
                              onChange={(e) => updateFeesStatus(member.id, e.target.value)}
                              className="text-sm border-gray-300 rounded-md"
                            >
                              <option value="Offen">Offen</option>
                              <option value="Bezahlt">Bezahlt</option>
                              <option value="Überfällig">Überfällig</option>
                            </select>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                            <button
                              onClick={() => {
                                setSelectedMember(member);
                                setPaymentForm({...paymentForm, member_id: member.id});
                                setShowAddPayment(true);
                              }}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              Zahlung
                            </button>
                            <button
                              onClick={() => handleDeleteMember(member.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              Löschen
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Payments Tab */}
        {activeTab === 'payments' && (
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-medium text-gray-900">Zahlungsverwaltung</h2>
                <button
                  onClick={() => setShowAddPayment(true)}
                  className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
                >
                  Zahlung hinzufügen
                </button>
              </div>

              {loading ? (
                <div className="text-center py-4">Lade Zahlungen...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Mitglied
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Beschreibung
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Art
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Betrag
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Fällig
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Aktionen
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {payments.map((payment) => {
                        const member = members.find(m => m.id === payment.member_id);
                        return (
                          <tr key={payment.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {member?.name || 'Unbekannt'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {payment.description}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {payment.payment_type}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatCurrency(payment.amount)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatDate(payment.due_date)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <select
                                value={payment.status}
                                onChange={(e) => updatePaymentStatus(payment.id, e.target.value)}
                                className={`text-sm border-gray-300 rounded-md ${getStatusColor(payment.status)}`}
                              >
                                <option value="Ausstehend">Ausstehend</option>
                                <option value="Bezahlt">Bezahlt</option>
                                <option value="Überfällig">Überfällig</option>
                              </select>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <button
                                onClick={() => generateInvoice(payment.member_id, [payment.id])}
                                className="text-purple-600 hover:text-purple-900"
                              >
                                Rechnung
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Events Tab */}
        {activeTab === 'events' && (
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-medium text-gray-900">Veranstaltungsmanagement</h2>
                <button
                  onClick={() => setShowAddEvent(true)}
                  className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700"
                >
                  Veranstaltung erstellen
                </button>
              </div>

              {loading ? (
                <div className="text-center py-4">Lade Veranstaltungen...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Titel
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Art
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Datum
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Ort
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Teilnehmer
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Aktionen
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {events.map((event) => (
                        <tr key={event.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {event.title}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {event.event_type}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(event.start_datetime)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {event.location}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {event.max_participants ? `0/${event.max_participants}` : 'Unbegrenzt'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <select
                              value={event.status}
                              onChange={(e) => updateEventStatus(event.id, e.target.value)}
                              className="text-sm border-gray-300 rounded-md"
                            >
                              <option value="Geplant">Geplant</option>
                              <option value="Bestätigt">Bestätigt</option>
                              <option value="Abgeschlossen">Abgeschlossen</option>
                              <option value="Abgesagt">Abgesagt</option>
                            </select>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                            <button
                              onClick={() => viewEventRegistrations(event)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              Anmeldungen
                            </button>
                            <button
                              onClick={() => handleDeleteEvent(event.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              Löschen
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Calendar Integration Tab */}
        {activeTab === 'calendar' && (
          <div className="space-y-6">
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-medium text-gray-900">Kalender-Integrationen</h2>
                  <div className="flex space-x-3">
                    <button
                      onClick={exportCalendar}
                      className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
                    >
                      Kalender exportieren
                    </button>
                    <button
                      onClick={syncEventsToCalendar}
                      className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                    >
                      Synchronisieren
                    </button>
                    <button
                      onClick={() => setShowAddCalendar(true)}
                      className="bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700"
                    >
                      Integration hinzufügen
                    </button>
                  </div>
                </div>

                {loading ? (
                  <div className="text-center py-4">Lade Kalender-Integrationen...</div>
                ) : (
                  <div className="space-y-4">
                    {calendarIntegrations.length === 0 ? (
                      <div className="text-center py-8">
                        <div className="text-gray-500 mb-4">Noch keine Kalender-Integrationen konfiguriert</div>
                        <p className="text-sm text-gray-400">
                          Verbinden Sie Ihre Veranstaltungen mit Google Calendar oder Outlook für automatische Synchronisation.
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Kalender Name
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Typ
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Status
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Synchronisation
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Erstellt
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Aktionen
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {calendarIntegrations.map((integration) => (
                              <tr key={integration.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                  {integration.calendar_name}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                    integration.calendar_type === 'google' 
                                      ? 'bg-blue-100 text-blue-800' 
                                      : 'bg-orange-100 text-orange-800'
                                  }`}>
                                    {integration.calendar_type === 'google' ? 'Google Calendar' : 'Outlook'}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                    integration.is_active 
                                      ? 'bg-green-100 text-green-800' 
                                      : 'bg-red-100 text-red-800'
                                  }`}>
                                    {integration.is_active ? 'Aktiv' : 'Inaktiv'}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                    integration.sync_events 
                                      ? 'bg-purple-100 text-purple-800' 
                                      : 'bg-gray-100 text-gray-800'
                                  }`}>
                                    {integration.sync_events ? 'Ein' : 'Aus'}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {formatDate(integration.created_at)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                  <button
                                    onClick={() => handleDeleteCalendar(integration.id)}
                                    className="text-red-600 hover:text-red-900"
                                  >
                                    Löschen
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Calendar Help Section */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-medium text-blue-900 mb-4">Kalender-Integration Hilfe</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-blue-800 mb-2">Google Calendar</h4>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Besuchen Sie die Google Calendar API Konsole</li>
                    <li>• Erstellen Sie OAuth 2.0 Anmeldedaten</li>
                    <li>• Kopieren Sie den Access Token hierher</li>
                    <li>• Automatische Synchronisation aller Veranstaltungen</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-blue-800 mb-2">Outlook Calendar</h4>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Registrieren Sie Ihre App in Azure AD</li>
                    <li>• Verwenden Sie Microsoft Graph API</li>
                    <li>• Konfigurieren Sie Calendar.ReadWrite Berechtigung</li>
                    <li>• Zwei-Wege-Synchronisation verfügbar</li>
                  </ul>
                </div>
              </div>
              
              <div className="mt-4 p-4 bg-white rounded border border-blue-200">
                <h4 className="font-medium text-blue-800 mb-2">iCal Export</h4>
                <p className="text-sm text-blue-700 mb-3">
                  Exportieren Sie Ihren Vereinskalender als .ics Datei für die Verwendung in jedem Kalender-Programm.
                </p>
                <div className="text-xs text-blue-600 bg-blue-100 p-2 rounded">
                  <strong>Öffentlicher Kalender-Link:</strong><br/>
                  {`${BACKEND_URL}/api/calendar/{subdomain}/public.ics`}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Calendar Integration Tab */}
        {activeTab === 'calendar' && (
          <div className="space-y-6">
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-medium text-gray-900">Kalender-Integrationen</h2>
                  <div className="flex space-x-3">
                    <button
                      onClick={exportCalendar}
                      className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
                    >
                      Kalender exportieren
                    </button>
                    <button
                      onClick={syncEventsToCalendar}
                      className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                    >
                      Synchronisieren
                    </button>
                    <button
                      onClick={() => setShowAddCalendar(true)}
                      className="bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700"
                    >
                      Integration hinzufügen
                    </button>
                  </div>
                </div>

                {loading ? (
                  <div className="text-center py-4">Lade Kalender-Integrationen...</div>
                ) : (
                  <div className="space-y-4">
                    {calendarIntegrations.length === 0 ? (
                      <div className="text-center py-8">
                        <div className="text-gray-500 mb-4">Noch keine Kalender-Integrationen konfiguriert</div>
                        <p className="text-sm text-gray-400">
                          Verbinden Sie Ihre Veranstaltungen mit Google Calendar oder Outlook für automatische Synchronisation.
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Kalender Name
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Typ
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Status
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Synchronisation
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Erstellt
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Aktionen
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {calendarIntegrations.map((integration) => (
                              <tr key={integration.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                  {integration.calendar_name}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                    integration.calendar_type === 'google' 
                                      ? 'bg-blue-100 text-blue-800' 
                                      : 'bg-orange-100 text-orange-800'
                                  }`}>
                                    {integration.calendar_type === 'google' ? 'Google Calendar' : 'Outlook'}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                    integration.is_active 
                                      ? 'bg-green-100 text-green-800' 
                                      : 'bg-red-100 text-red-800'
                                  }`}>
                                    {integration.is_active ? 'Aktiv' : 'Inaktiv'}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                    integration.sync_events 
                                      ? 'bg-purple-100 text-purple-800' 
                                      : 'bg-gray-100 text-gray-800'
                                  }`}>
                                    {integration.sync_events ? 'Ein' : 'Aus'}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {formatDate(integration.created_at)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                  <button
                                    onClick={() => handleDeleteCalendar(integration.id)}
                                    className="text-red-600 hover:text-red-900"
                                  >
                                    Löschen
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Calendar Help Section */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-medium text-blue-900 mb-4">Kalender-Integration Hilfe</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-blue-800 mb-2">Google Calendar</h4>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Besuchen Sie die Google Calendar API Konsole</li>
                    <li>• Erstellen Sie OAuth 2.0 Anmeldedaten</li>
                    <li>• Kopieren Sie den Access Token hierher</li>
                    <li>• Automatische Synchronisation aller Veranstaltungen</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-blue-800 mb-2">Outlook Calendar</h4>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Registrieren Sie Ihre App in Azure AD</li>
                    <li>• Verwenden Sie Microsoft Graph API</li>
                    <li>• Konfigurieren Sie Calendar.ReadWrite Berechtigung</li>
                    <li>• Zwei-Wege-Synchronisation verfügbar</li>
                  </ul>
                </div>
              </div>
              
              <div className="mt-4 p-4 bg-white rounded border border-blue-200">
                <h4 className="font-medium text-blue-800 mb-2">iCal Export</h4>
                <p className="text-sm text-blue-700 mb-3">
                  Exportieren Sie Ihren Vereinskalender als .ics Datei für die Verwendung in jedem Kalender-Programm.
                </p>
                <div className="text-xs text-blue-600 bg-blue-100 p-2 rounded">
                  <strong>Öffentlicher Kalender-Link:</strong><br/>
                  {`${BACKEND_URL}/api/calendar/{subdomain}/public.ics`}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            {loading ? (
              <div className="text-center py-4">Lade Finanzberichte...</div>
            ) : financialReport && (
              <>
                <div className="bg-white shadow rounded-lg p-6">
                  <h2 className="text-lg font-medium text-gray-900 mb-4">Finanzübersicht</h2>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-green-100 p-4 rounded-lg">
                      <h3 className="text-sm font-medium text-green-800">Bezahlt</h3>
                      <p className="text-2xl font-bold text-green-900">
                        {formatCurrency(financialReport.summary.total_paid)}
                      </p>
                    </div>
                    <div className="bg-yellow-100 p-4 rounded-lg">
                      <h3 className="text-sm font-medium text-yellow-800">Ausstehend</h3>
                      <p className="text-2xl font-bold text-yellow-900">
                        {formatCurrency(financialReport.summary.total_outstanding)}
                      </p>
                    </div>
                    <div className="bg-red-100 p-4 rounded-lg">
                      <h3 className="text-sm font-medium text-red-800">Überfällig</h3>
                      <p className="text-2xl font-bold text-red-900">
                        {formatCurrency(financialReport.summary.total_overdue)}
                      </p>
                    </div>
                    <div className="bg-blue-100 p-4 rounded-lg">
                      <h3 className="text-sm font-medium text-blue-800">Zahlungen</h3>
                      <p className="text-2xl font-bold text-blue-900">
                        {financialReport.total_payments}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white shadow rounded-lg p-6">
                  <h2 className="text-lg font-medium text-gray-900 mb-4">Nach Zahlungsart</h2>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Art
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Gesamt
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Bezahlt
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Ausstehend
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Überfällig
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {Object.entries(financialReport.by_payment_type).map(([type, data]) => (
                          <tr key={type}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {type}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatCurrency(data.total)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                              {formatCurrency(data.paid)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-yellow-600">
                              {formatCurrency(data.outstanding)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                              {formatCurrency(data.overdue)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Add Member Modal */}
      {showAddMember && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Neues Mitglied hinzufügen
              </h3>
              <form onSubmit={handleAddMember} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <input
                    type="text"
                    required
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    value={memberForm.name}
                    onChange={(e) => setMemberForm({...memberForm, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">E-Mail</label>
                  <input
                    type="email"
                    required
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    value={memberForm.email}
                    onChange={(e) => setMemberForm({...memberForm, email: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Mitgliedsnummer</label>
                  <input
                    type="text"
                    required
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    value={memberForm.membership_number}
                    onChange={(e) => setMemberForm({...memberForm, membership_number: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Mitgliedstyp</label>
                  <select
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    value={memberForm.membership_type}
                    onChange={(e) => setMemberForm({...memberForm, membership_type: e.target.value})}
                  >
                    <option value="Standard">Standard</option>
                    <option value="Premium">Premium</option>
                    <option value="Ehrenmitglied">Ehrenmitglied</option>
                    <option value="Jugend">Jugend</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Telefon</label>
                  <input
                    type="text"
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    value={memberForm.phone}
                    onChange={(e) => setMemberForm({...memberForm, phone: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Adresse</label>
                  <textarea
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    rows="2"
                    value={memberForm.address}
                    onChange={(e) => setMemberForm({...memberForm, address: e.target.value})}
                  />
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddMember(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                  >
                    Hinzufügen
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Add Payment Modal */}
      {showAddPayment && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Neue Zahlung hinzufügen
                {selectedMember && <span className="text-sm text-gray-500"> - {selectedMember.name}</span>}
              </h3>
              <form onSubmit={handleAddPayment} className="space-y-4">
                {!selectedMember && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Mitglied</label>
                    <select
                      required
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                      value={paymentForm.member_id}
                      onChange={(e) => setPaymentForm({...paymentForm, member_id: e.target.value})}
                    >
                      <option value="">Mitglied auswählen</option>
                      {members.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name} ({member.membership_number})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Zahlungsart</label>
                  <select
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                    value={paymentForm.payment_type}
                    onChange={(e) => setPaymentForm({...paymentForm, payment_type: e.target.value})}
                  >
                    <option value="Mitgliedsbeitrag">Mitgliedsbeitrag</option>
                    <option value="Zusatzgebühr">Zusatzgebühr</option>
                    <option value="Strafe">Strafe</option>
                    <option value="Sondergebühr">Sondergebühr</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Beschreibung</label>
                  <input
                    type="text"
                    required
                    placeholder="z.B. Jahresbeitrag 2024"
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                    value={paymentForm.description}
                    onChange={(e) => setPaymentForm({...paymentForm, description: e.target.value})}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Betrag (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({...paymentForm, amount: e.target.value})}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Fälligkeitsdatum</label>
                  <input
                    type="date"
                    required
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                    value={paymentForm.due_date}
                    onChange={(e) => setPaymentForm({...paymentForm, due_date: e.target.value})}
                  />
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddPayment(false);
                      setSelectedMember(null);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                  >
                    Hinzufügen
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Add Event Modal */}
      {showAddEvent && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Neue Veranstaltung erstellen
              </h3>
              <form onSubmit={handleAddEvent} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Titel</label>
                  <input
                    type="text"
                    required
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                    value={eventForm.title}
                    onChange={(e) => setEventForm({...eventForm, title: e.target.value})}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Art der Veranstaltung</label>
                  <select
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                    value={eventForm.event_type}
                    onChange={(e) => setEventForm({...eventForm, event_type: e.target.value})}
                  >
                    <option value="Training">Training</option>
                    <option value="Wettkampf">Wettkampf</option>
                    <option value="Vereinsfeier">Vereinsfeier</option>
                    <option value="Mitgliederversammlung">Mitgliederversammlung</option>
                    <option value="Sonstiges">Sonstiges</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Beschreibung</label>
                  <textarea
                    required
                    rows="3"
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                    value={eventForm.description}
                    onChange={(e) => setEventForm({...eventForm, description: e.target.value})}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Startdatum</label>
                    <input
                      type="datetime-local"
                      required
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                      value={eventForm.start_datetime}
                      onChange={(e) => setEventForm({...eventForm, start_datetime: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Enddatum</label>
                    <input
                      type="datetime-local"
                      required
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                      value={eventForm.end_datetime}
                      onChange={(e) => setEventForm({...eventForm, end_datetime: e.target.value})}
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Ort</label>
                  <input
                    type="text"
                    required
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                    value={eventForm.location}
                    onChange={(e) => setEventForm({...eventForm, location: e.target.value})}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Max. Teilnehmer</label>
                    <input
                      type="number"
                      min="1"
                      placeholder="Unbegrenzt"
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                      value={eventForm.max_participants}
                      onChange={(e) => setEventForm({...eventForm, max_participants: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Kosten (€)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                      value={eventForm.cost}
                      onChange={(e) => setEventForm({...eventForm, cost: e.target.value})}
                    />
                  </div>
                </div>
                
                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-purple-600 shadow-sm focus:border-purple-300 focus:ring focus:ring-purple-200"
                      checked={eventForm.registration_required}
                      onChange={(e) => setEventForm({...eventForm, registration_required: e.target.checked})}
                    />
                    <span className="ml-2 text-sm text-gray-700">Anmeldung erforderlich</span>
                  </label>
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddEvent(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700"
                  >
                    Erstellen
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const MemberDashboard = ({ member, onLogout }) => {
  const [profile, setProfile] = useState(null);
  const [vereinInfo, setVereinInfo] = useState(null);
  const [events, setEvents] = useState([]);
  const [myRegistrations, setMyRegistrations] = useState([]);
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(true);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('de-AT');
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('de-AT', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  useEffect(() => {
    fetchMemberData();
  }, []);

  useEffect(() => {
    if (activeTab === 'events') {
      fetchEvents();
    } else if (activeTab === 'registrations') {
      fetchMyRegistrations();
    }
  }, [activeTab]);

  const fetchMemberData = async () => {
    try {
      const [profileResponse, vereinResponse] = await Promise.all([
        axios.get(`${API}/member/profile`),
        axios.get(`${API}/member/verein`)
      ]);
      setProfile(profileResponse.data);
      setVereinInfo(vereinResponse.data);
    } catch (err) {
      console.error('Fehler beim Laden der Mitgliederdaten:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEvents = async () => {
    try {
      const response = await axios.get(`${API}/member/events`);
      setEvents(response.data);
    } catch (err) {
      console.error('Fehler beim Laden der Veranstaltungen:', err);
    }
  };

  const fetchMyRegistrations = async () => {
    try {
      const response = await axios.get(`${API}/member/events/my-registrations`);
      setMyRegistrations(response.data);
    } catch (err) {
      console.error('Fehler beim Laden der Anmeldungen:', err);
    }
  };

  const registerForEvent = async (eventId) => {
    try {
      await axios.post(`${API}/member/events/${eventId}/register`);
      fetchEvents();
      alert('Erfolgreich für Veranstaltung angemeldet!');
    } catch (err) {
      alert(err.response?.data?.detail || 'Fehler bei der Anmeldung');
    }
  };

  const unregisterFromEvent = async (eventId) => {
    if (window.confirm('Möchten Sie sich wirklich von dieser Veranstaltung abmelden?')) {
      try {
        await axios.delete(`${API}/member/events/${eventId}/register`);
        fetchEvents();
        fetchMyRegistrations();
        alert('Erfolgreich von Veranstaltung abgemeldet!');
      } catch (err) {
        alert(err.response?.data?.detail || 'Fehler bei der Abmeldung');
      }
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Bezahlt': return 'text-green-600';
      case 'Überfällig': return 'text-red-600';
      default: return 'text-yellow-600';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Lade Mitgliederdaten...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                {vereinInfo?.name} - Mitglieder-Portal
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-500">Willkommen, {member.member_name}</span>
              <button
                onClick={onLogout}
                className="text-gray-500 hover:text-gray-700"
              >
                Abmelden
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Tab Navigation */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('profile')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'profile'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Mein Profil
            </button>
            <button
              onClick={() => setActiveTab('events')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'events'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Veranstaltungen
            </button>
            <button
              onClick={() => setActiveTab('registrations')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'registrations'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Meine Anmeldungen
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Profile Tab */}
        {activeTab === 'profile' && profile && (
          <>
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-6">Mein Profil</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Persönliche Daten</h3>
                  <div className="space-y-3">
                    <div>
                      <span className="block text-sm text-gray-500">Name</span>
                      <span className="block text-sm font-medium text-gray-900">{profile.name}</span>
                    </div>
                    <div>
                      <span className="block text-sm text-gray-500">E-Mail</span>
                      <span className="block text-sm font-medium text-gray-900">{profile.email}</span>
                    </div>
                    <div>
                      <span className="block text-sm text-gray-500">Telefon</span>
                      <span className="block text-sm font-medium text-gray-900">{profile.phone || 'Nicht angegeben'}</span>
                    </div>
                    <div>
                      <span className="block text-sm text-gray-500">Adresse</span>
                      <span className="block text-sm font-medium text-gray-900">{profile.address || 'Nicht angegeben'}</span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Mitgliedschaft</h3>
                  <div className="space-y-3">
                    <div>
                      <span className="block text-sm text-gray-500">Mitgliedsnummer</span>
                      <span className="block text-sm font-medium text-gray-900">{profile.membership_number}</span>
                    </div>
                    <div>
                      <span className="block text-sm text-gray-500">Mitgliedstyp</span>
                      <span className="block text-sm font-medium text-gray-900">{profile.membership_type}</span>
                    </div>
                    <div>
                      <span className="block text-sm text-gray-500">Beitragsstatus</span>
                      <span className={`block text-sm font-medium ${getStatusColor(profile.fees_status)}`}>
                        {profile.fees_status}
                      </span>
                    </div>
                    <div>
                      <span className="block text-sm text-gray-500">Mitglied seit</span>
                      <span className="block text-sm font-medium text-gray-900">
                        {new Date(profile.join_date).toLocaleDateString('de-AT')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {vereinInfo && (
              <div className="mt-6 bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Über {vereinInfo.name}</h2>
                <p className="text-gray-600">{vereinInfo.description || 'Keine Beschreibung verfügbar.'}</p>
              </div>
            )}
          </>
        )}

        {/* Events Tab */}
        {activeTab === 'events' && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-6">Verfügbare Veranstaltungen</h2>
            
            {events.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Keine Veranstaltungen verfügbar.</p>
            ) : (
              <div className="space-y-4">
                {events.map((event) => (
                  <div key={event.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="text-lg font-medium text-gray-900">{event.title}</h3>
                        <p className="text-sm text-gray-600 mt-1">{event.description}</p>
                        
                        <div className="mt-2 grid grid-cols-2 gap-4 text-sm text-gray-500">
                          <div>
                            <span className="font-medium">Art:</span> {event.event_type}
                          </div>
                          <div>
                            <span className="font-medium">Ort:</span> {event.location}
                          </div>
                          <div>
                            <span className="font-medium">Datum:</span> {formatDate(event.start_datetime)}
                          </div>
                          <div>
                            <span className="font-medium">Teilnehmer:</span> 
                            {event.max_participants 
                              ? ` ${event.registration_count}/${event.max_participants}`
                              : ` ${event.registration_count} (unbegrenzt)`
                            }
                          </div>
                          {event.cost > 0 && (
                            <div>
                              <span className="font-medium">Kosten:</span> {formatCurrency(event.cost)}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="ml-4 flex flex-col items-end">
                        {event.is_registered ? (
                          <div className="text-center">
                            <span className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full mb-2">
                              Angemeldet
                            </span>
                            <button
                              onClick={() => unregisterFromEvent(event.id)}
                              className="block w-full bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                            >
                              Abmelden
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => registerForEvent(event.id)}
                            disabled={event.is_full}
                            className={`px-4 py-2 rounded text-sm font-medium ${
                              event.is_full
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                : 'bg-purple-600 text-white hover:bg-purple-700'
                            }`}
                          >
                            {event.is_full ? 'Ausgebucht' : 'Anmelden'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* My Registrations Tab */}
        {activeTab === 'registrations' && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-6">Meine Anmeldungen</h2>
            
            {myRegistrations.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Sie sind für keine Veranstaltungen angemeldet.</p>
            ) : (
              <div className="space-y-4">
                {myRegistrations.map((registration) => (
                  <div key={registration.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">{registration.event_title}</h3>
                        <div className="mt-2 grid grid-cols-2 gap-4 text-sm text-gray-500">
                          <div>
                            <span className="font-medium">Art:</span> {registration.event_type}
                          </div>
                          <div>
                            <span className="font-medium">Ort:</span> {registration.event_location}
                          </div>
                          <div>
                            <span className="font-medium">Datum:</span> {formatDate(registration.event_start)}
                          </div>
                          <div>
                            <span className="font-medium">Angemeldet am:</span> {formatDate(registration.registration_date)}
                          </div>
                        </div>
                      </div>
                      
                      <div className="ml-4">
                        <span className={`inline-block px-2 py-1 rounded-full text-xs ${
                          registration.status === 'Angemeldet' 
                            ? 'bg-green-100 text-green-800'
                            : registration.status === 'Teilgenommen'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {registration.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Main App Component
function App() {
  const [userType, setUserType] = useState(null);
  const [userData, setUserData] = useState(null);
  const [currentView, setCurrentView] = useState('loading');

  useEffect(() => {
    initializeAuth();
    determineView();
    
    // Listen for route changes
    const handleRouteChange = () => {
      determineView();
    };
    
    window.addEventListener('popstate', handleRouteChange);
    return () => window.removeEventListener('popstate', handleRouteChange);
  }, []);

  const determineView = () => {
    const token = getAuthToken();
    const subdomain = getSubdomain();
    const path = window.location.pathname;

    console.log('Route determination:', { hostname: window.location.hostname, subdomain, path });

    if (token) {
      // User is logged in, determine type from token
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.type === 'admin') {
          setUserType('admin');
          setUserData({ verein_name: 'Admin' }); // Will be updated by component
          setCurrentView('admin-dashboard');
          return;
        } else if (payload.type === 'member') {
          setUserType('member');
          setUserData({ member_name: 'Mitglied' }); // Will be updated by component
          setCurrentView('member-dashboard');
          return;
        }
      } catch (err) {
        // Invalid token
        setAuthToken(null);
        // Continue to determine view without token
      }
    }

    // No valid token - determine view based on domain and path
    if (subdomain) {
      // We have a subdomain - this is a tenant's domain
      if (path === '/member') {
        console.log('Tenant member login:', subdomain);
        setCurrentView('member-login');
      } else {
        console.log('Tenant admin login:', subdomain);
        setCurrentView('admin-login');
      }
    } else {
      // Main domain - check path
      if (path === '/admin') {
        console.log('Main domain admin login');
        setCurrentView('admin-login');
      } else if (path === '/member') {
        console.log('Main domain member login');
        setCurrentView('member-login');
      } else {
        console.log('Main domain registration');
        setCurrentView('registration');
      }
    }
  };

  const handleRegistrationSuccess = (data) => {
    alert(`Verein erfolgreich registriert! Sie können sich jetzt unter ${data.subdomain}.platform.com anmelden.`);
  };

  const handleAdminLogin = (data) => {
    setUserType('admin');
    setUserData(data);
    setCurrentView('admin-dashboard');
  };

  const handleMemberLogin = (data) => {
    setUserType('member');
    setUserData(data);
    setCurrentView('member-dashboard');
  };

  const handleLogout = () => {
    setAuthToken(null);
    setUserType(null);
    setUserData(null);
    window.location.reload();
  };

  const subdomain = getSubdomain();

  switch (currentView) {
    case 'registration':
      return <VereinRegistration onRegistrationSuccess={handleRegistrationSuccess} />;
    
    case 'admin-login':
      return <AdminLogin subdomain={subdomain} onLogin={handleAdminLogin} />;
    
    case 'member-login':
      return <MemberLogin subdomain={subdomain} onLogin={handleMemberLogin} />;
    
    case 'admin-dashboard':
      return <AdminDashboard verein={userData} onLogout={handleLogout} />;
    
    case 'member-dashboard':
      return <MemberDashboard member={userData} onLogout={handleLogout} />;
    
    default:
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-gray-500">Lade...</div>
        </div>
      );
  }
}

export default App;