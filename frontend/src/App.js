import React, { useState, useEffect } from "react";
import "./App.css";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Utility functions
const getSubdomain = () => {
  const hostname = window.location.hostname;
  const parts = hostname.split('.');
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
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API}/admin/login`, {
        ...formData,
        subdomain
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
        <p className="text-center text-gray-600 mb-6">
          Verein: <strong>{subdomain}</strong>
        </p>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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

        <div className="mt-6 text-center">
          <a href="/member" className="text-blue-600 hover:text-blue-800 text-sm">
            Mitglieder-Portal →
          </a>
        </div>
      </div>
    </div>
  );
};

const MemberLogin = ({ subdomain, onLogin }) => {
  const [formData, setFormData] = useState({
    email: '',
    membership_number: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API}/member/login`, {
        ...formData,
        subdomain
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
        <p className="text-center text-gray-600 mb-6">
          Verein: <strong>{subdomain}</strong>
        </p>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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

        <div className="mt-6 text-center">
          <a href="/admin" className="text-blue-600 hover:text-blue-800 text-sm">
            ← Admin-Bereich
          </a>
        </div>
      </div>
    </div>
  );
};

const AdminDashboard = ({ verein, onLogout }) => {
  const [members, setMembers] = useState([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [memberForm, setMemberForm] = useState({
    name: '',
    email: '',
    membership_number: '',
    membership_type: 'Standard',
    phone: '',
    address: '',
    fees_status: 'Offen'
  });

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      const response = await axios.get(`${API}/admin/members`);
      setMembers(response.data);
    } catch (err) {
      setError('Fehler beim Laden der Mitglieder');
    } finally {
      setLoading(false);
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

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

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
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
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
      </div>

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
    </div>
  );
};

const MemberDashboard = ({ member, onLogout }) => {
  const [profile, setProfile] = useState(null);
  const [vereinInfo, setVereinInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMemberData();
  }, []);

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

      <div className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-6">Mein Profil</h2>
          
          {profile && (
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
          )}
        </div>

        {vereinInfo && (
          <div className="mt-6 bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Über {vereinInfo.name}</h2>
            <p className="text-gray-600">{vereinInfo.description || 'Keine Beschreibung verfügbar.'}</p>
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
  }, []);

  const determineView = () => {
    const token = getAuthToken();
    const subdomain = getSubdomain();
    const path = window.location.pathname;

    if (token) {
      // User is logged in, determine type from token
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.type === 'admin') {
          setUserType('admin');
          setUserData({ verein_name: 'Admin' }); // Will be updated by component
          setCurrentView('admin-dashboard');
        } else if (payload.type === 'member') {
          setUserType('member');
          setUserData({ member_name: 'Mitglied' }); // Will be updated by component
          setCurrentView('member-dashboard');
        }
      } catch (err) {
        // Invalid token
        setAuthToken(null);
        setCurrentView('login');
      }
    } else if (!subdomain || subdomain === 'localhost' || subdomain.includes('emergentagent')) {
      // Main domain - show registration (no subdomain or localhost/preview domain)
      setCurrentView('registration');
    } else if (path === '/member') {
      // Member login
      setCurrentView('member-login');
    } else {
      // Admin login (default for subdomains)
      setCurrentView('admin-login');
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