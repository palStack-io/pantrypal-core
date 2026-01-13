import React, { useState, useEffect } from 'react';
import { User, Mail, Lock, Users, Shield, Activity } from 'lucide-react';
import { getColors, spacing, borderRadius, getShadows } from './colors';
import { getDefaultLocations, getDefaultCategories, saveDefaultLocations, saveDefaultCategories, DEFAULT_LOCATIONS, DEFAULT_CATEGORIES } from './defaults';
import { getItems, addItemManual } from './api';

function SettingsPage({ onBack, currentUser, isDark }) {
  const colors = getColors(isDark);
  const shadows = getShadows(isDark);
  const [activeTab, setActiveTab] = useState('connection');
  
  // Connection settings
  const [apiUrl, setApiUrl] = useState('');
  const [savedUrl, setSavedUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [currentApiKey, setCurrentApiKey] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  
  // Profile state
  const [profile, setProfile] = useState({
    username: '',
    email: '',
    full_name: ''
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  
  // Password state
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  
  // Admin state
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [adminLoading, setAdminLoading] = useState(false);

  // Invite user state
  const [inviteData, setInviteData] = useState({
    username: '',
    email: '',
    full_name: '',
    send_welcome_email: true
  });
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMessage, setInviteMessage] = useState('');
  const [inviteFormExpanded, setInviteFormExpanded] = useState(false);
  
  // API Keys state
  const [apiKeys, setApiKeys] = useState([]);
  const [showNewKeyForm, setShowNewKeyForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyDescription, setNewKeyDescription] = useState('');
  const [generatedKey, setGeneratedKey] = useState(null);
  const [authEnabled, setAuthEnabled] = useState(false);
  const [loadingKeys, setLoadingKeys] = useState(false);
  
  // Preferences
  const [locations, setLocations] = useState(DEFAULT_LOCATIONS);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [newLocation, setNewLocation] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [editingLocation, setEditingLocation] = useState(null);
  const [editLocationValue, setEditLocationValue] = useState('');
  const [editingCategory, setEditingCategory] = useState(null);
  const [editCategoryValue, setEditCategoryValue] = useState('');
  
  // Import/Export
  const [exportFilter, setExportFilter] = useState('all');
  const [exportValue, setExportValue] = useState('');
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [importOptions, setImportOptions] = useState({
    skipDuplicates: true,
    updateExisting: false,
  });

  const isAdmin = currentUser?.is_admin;

  useEffect(() => {
    const stored = localStorage.getItem('API_BASE_URL') || 'http://localhost';
    setApiUrl(stored);
    setSavedUrl(stored);
    
    const savedApiKey = localStorage.getItem('API_KEY');
    setCurrentApiKey(savedApiKey || '');
    setShowApiKeyInput(!!savedApiKey);
    
    setLocations(getDefaultLocations());
    setCategories(getDefaultCategories());

    checkAuthStatus(stored);
    loadApiKeys(stored);
    
    if (currentUser) {
      loadProfile();
      if (isAdmin) {
        loadUsers();
        loadStats();
      }
    }
  }, [currentUser, isAdmin]);

  // Profile functions
  const loadProfile = async () => {
    try {
      const response = await fetch('/api/users/me', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setProfile({
          username: data.username || '',
          email: data.email || '',
          full_name: data.full_name || ''
        });
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileMessage('');

    const usernameChanged = profile.username !== currentUser.username;

    try {
      const response = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(profile)
      });

      const data = await response.json();

      if (response.ok) {
        if (usernameChanged) {
          setProfileMessage('✅ Profile updated successfully! Your username has been changed. Please refresh the page to see the changes.');
        } else {
          setProfileMessage('✅ Profile updated successfully');
        }
        // Reload the profile to get the latest data
        await loadProfile();
        setTimeout(() => setProfileMessage(''), 5000);
      } else {
        setProfileMessage(`❌ ${data.detail || 'Failed to update profile'}`);
      }
    } catch (error) {
      setProfileMessage('❌ Network error');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordMessage('');

    if (passwordData.new_password !== passwordData.confirm_password) {
      setPasswordMessage('❌ New passwords do not match');
      return;
    }

    if (passwordData.new_password.length < 8) {
      setPasswordMessage('❌ Password must be at least 8 characters');
      return;
    }

    setPasswordLoading(true);

    try {
      const response = await fetch('/api/users/me/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          current_password: passwordData.current_password,
          new_password: passwordData.new_password
        })
      });

      const data = await response.json();

      if (response.ok) {
        setPasswordMessage('✅ Password changed successfully');
        setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
        setTimeout(() => setPasswordMessage(''), 3000);
      } else {
        setPasswordMessage(`❌ ${data.detail || 'Failed to change password'}`);
      }
    } catch (error) {
      setPasswordMessage('❌ Network error');
    } finally {
      setPasswordLoading(false);
    }
  };

  // Admin functions
  const loadUsers = async () => {
    setAdminLoading(true);
    try {
      const response = await fetch('/api/admin/users', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setAdminLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch('/api/admin/stats', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const handleToggleUserStatus = async (userId, currentStatus) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ is_active: !currentStatus })
      });

      if (response.ok) {
        loadUsers();
        loadStats();
      }
    } catch (error) {
      console.error('Failed to toggle user status:', error);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        loadUsers();
        loadStats();
      }
    } catch (error) {
      console.error('Failed to delete user:', error);
    }
  };

  const handleInviteUser = async (e) => {
    e.preventDefault();
    setInviteMessage('');

    if (!inviteData.username || !inviteData.email) {
      setInviteMessage('❌ Please fill in all required fields');
      return;
    }

    setInviteLoading(true);

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(inviteData)
      });

      const data = await response.json();

      if (response.ok) {
        if (data.email_sent) {
          setInviteMessage(`✅ User ${inviteData.username} created! Welcome email sent with password reset link.`);
        } else {
          setInviteMessage(`✅ User ${inviteData.username} created successfully!`);
        }
        setInviteData({ username: '', email: '', full_name: '', send_welcome_email: true });
        loadUsers();
        loadStats();
        setTimeout(() => {
          setInviteMessage('');
          setInviteFormExpanded(false);
        }, 3000);
      } else {
        setInviteMessage(`❌ ${data.detail || 'Failed to create user'}`);
      }
    } catch (error) {
      setInviteMessage('❌ Network error');
    } finally {
      setInviteLoading(false);
    }
  };

  // Connection & API Key functions
  const checkAuthStatus = async (url) => {
    try {
      const response = await fetch(`${url}/api/items`);
      setAuthEnabled(response.status === 401);
    } catch (error) {
      console.log('Could not check auth status');
    }
  };

  const loadApiKeys = async (url) => {
    try {
      setLoadingKeys(true);
      const response = await fetch(`${url}/api/auth/keys`);
      if (response.ok) {
        const data = await response.json();
        setApiKeys(data.keys || []);
      }
    } catch (error) {
      console.log('Error loading API keys:', error);
    } finally {
      setLoadingKeys(false);
    }
  };

  const generateApiKey = async () => {
    if (!newKeyName.trim()) {
      alert('Please enter a name for the API key');
      return;
    }

    try {
      const response = await fetch(`${apiUrl}/api/auth/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newKeyName,
          description: newKeyDescription || null,
          expires_in_days: null
        })
      });

      if (response.ok) {
        const data = await response.json();
        setGeneratedKey(data.api_key);
        setNewKeyName('');
        setNewKeyDescription('');
        setShowNewKeyForm(false);
        await loadApiKeys(apiUrl);
        
        alert('⚠️ API Key Generated!\n\nYour API key has been generated. Copy it now - it won\'t be shown again!');
      } else {
        alert('Failed to generate API key');
      }
    } catch (error) {
      alert(`Failed to generate API key: ${error.message}`);
    }
  };

  const deleteApiKey = async (keyId, keyName) => {
    if (!window.confirm(`Are you sure you want to delete "${keyName}"? This cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`${apiUrl}/api/auth/keys/${keyId}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        await loadApiKeys(apiUrl);
        alert('API key deleted successfully');
      }
    } catch (error) {
      alert('Failed to delete API key');
    }
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      const testUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
      const response = await fetch(`${testUrl}/health`);
      const data = await response.json();
      
      if (data.status === 'healthy') {
        alert('✅ Connected successfully!\n\nBackend is healthy and responding.');
      } else {
        alert('⚠️ Backend responded but status is not healthy');
      }
    } catch (error) {
      alert('❌ Connection Failed\n\nCannot reach backend. Check the URL and make sure the backend is running.');
    } finally {
      setTesting(false);
    }
  };

  const saveConnectionSettings = () => {
    let cleanUrl = apiUrl.trim().replace(/\/+$/, '');

    // Remove any duplicate http:// or https:// prefixes
    cleanUrl = cleanUrl.replace(/^(https?:\/\/)+(https?:\/\/)+/gi, '$1');

    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      alert('Invalid URL\n\nURL must start with http:// or https://');
      return;
    }

    localStorage.setItem('API_BASE_URL', cleanUrl);
    setSavedUrl(cleanUrl);
    
    if (currentApiKey.trim()) {
      localStorage.setItem('API_KEY', currentApiKey.trim());
    } else {
      localStorage.removeItem('API_KEY');
    }
    
    alert('✅ Connection settings saved!\n\nPlease refresh the page for changes to take effect.');
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('✅ Copied to clipboard!');
    }).catch(() => {
      alert('Failed to copy to clipboard');
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString();
  };

  // Preferences functions
  const addLocation = () => {
    if (newLocation.trim() && !locations.includes(newLocation.trim())) {
      setLocations([...locations, newLocation.trim()]);
      setNewLocation('');
    }
  };

  const removeLocation = (location) => {
    setLocations(locations.filter(l => l !== location));
  };

  const startEditLocation = (location) => {
    setEditingLocation(location);
    setEditLocationValue(location);
  };

  const saveEditLocation = () => {
    if (editLocationValue.trim() && editLocationValue.trim() !== editingLocation) {
      const updatedLocations = locations.map(l =>
        l === editingLocation ? editLocationValue.trim() : l
      );
      setLocations(updatedLocations);
    }
    setEditingLocation(null);
    setEditLocationValue('');
  };

  const cancelEditLocation = () => {
    setEditingLocation(null);
    setEditLocationValue('');
  };

  const addCategory = () => {
    if (newCategory.trim() && !categories.includes(newCategory.trim())) {
      setCategories([...categories, newCategory.trim()]);
      setNewCategory('');
    }
  };

  const removeCategory = (category) => {
    setCategories(categories.filter(c => c !== category));
  };

  const startEditCategory = (category) => {
    setEditingCategory(category);
    setEditCategoryValue(category);
  };

  const saveEditCategory = () => {
    if (editCategoryValue.trim() && editCategoryValue.trim() !== editingCategory) {
      const updatedCategories = categories.map(c =>
        c === editingCategory ? editCategoryValue.trim() : c
      );
      setCategories(updatedCategories);
    }
    setEditingCategory(null);
    setEditCategoryValue('');
  };

  const cancelEditCategory = () => {
    setEditingCategory(null);
    setEditCategoryValue('');
  };

  const savePreferences = () => {
    saveDefaultLocations(locations);
    saveDefaultCategories(categories);
    alert('✅ Preferences saved!');
  };

  // Import/Export functions
  const exportToCSV = async () => {
    setExporting(true);
    try {
      const items = await getItems();
      
      let filteredItems = items;
      if (exportFilter === 'location' && exportValue) {
        filteredItems = items.filter(item => item.location === exportValue);
      } else if (exportFilter === 'category' && exportValue) {
        filteredItems = items.filter(item => item.category === exportValue);
      }

      if (filteredItems.length === 0) {
        alert('No items to export with the selected filter.');
        return;
      }

      const headers = ['ID', 'Name', 'Brand', 'Category', 'Location', 'Quantity', 'Expiry Date', 'Notes', 'Barcode', 'Added Date'];
      const rows = filteredItems.map(item => [
        item.id,
        `"${(item.name || '').replace(/"/g, '""')}"`,
        `"${(item.brand || '').replace(/"/g, '""')}"`,
        `"${(item.category || 'Uncategorized').replace(/"/g, '""')}"`,
        `"${(item.location || '').replace(/"/g, '""')}"`,
        item.quantity || 0,
        item.expiry_date || '',
        `"${(item.notes || '').replace(/"/g, '""')}"`,
        item.barcode || '',
        item.added_at || ''
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      const filterSuffix = exportFilter === 'all' ? 'all' : 
                          exportFilter === 'location' ? `location-${exportValue}` :
                          `category-${exportValue}`;
      const filename = `pantrypal-export-${filterSuffix}-${new Date().toISOString().split('T')[0]}.csv`;
      
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      alert(`✅ Exported ${filteredItems.length} items successfully!`);
    } catch (error) {
      console.error('Export failed:', error);
      alert('❌ Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleImportFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      alert('Please select a CSV file');
      return;
    }

    setImportFile(file);
    parseCSVPreview(file);
  };

  const parseCSVPreview = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        alert('CSV file is empty or invalid');
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const rows = lines.slice(1, 6).map(line => {
        const values = [];
        let current = '';
        let inQuotes = false;
        
        for (let char of line) {
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            values.push(current.trim().replace(/^"|"$/g, ''));
            current = '';
          } else {
            current += char;
          }
        }
        values.push(current.trim().replace(/^"|"$/g, ''));
        return values;
      });

      setImportPreview({
        headers,
        rows,
        totalRows: lines.length - 1,
      });
    };
    reader.readAsText(file);
  };

  const performImport = async () => {
    if (!importFile) return;

    setImporting(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = e.target.result;
        const lines = text.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        
        let successCount = 0;
        let skipCount = 0;
        let errorCount = 0;

        const existingItems = await getItems();
        const existingBarcodes = new Set(existingItems.map(item => item.barcode).filter(Boolean));

        for (let i = 1; i < lines.length; i++) {
          try {
            const values = [];
            let current = '';
            let inQuotes = false;
            
            for (let char of lines[i]) {
              if (char === '"') {
                inQuotes = !inQuotes;
              } else if (char === ',' && !inQuotes) {
                values.push(current.trim().replace(/^"|"$/g, ''));
                current = '';
              } else {
                current += char;
              }
            }
            values.push(current.trim().replace(/^"|"$/g, ''));

            const item = {};
            headers.forEach((header, index) => {
              item[header.toLowerCase().replace(/ /g, '_')] = values[index] || '';
            });

            if (importOptions.skipDuplicates && item.barcode && existingBarcodes.has(item.barcode)) {
              skipCount++;
              continue;
            }

            const itemData = {
              name: item.name || 'Unknown Item',
              brand: item.brand || null,
              category: item.category || 'Uncategorized',
              location: item.location || 'Basement Pantry',
              quantity: parseInt(item.quantity) || 1,
              expiry_date: item.expiry_date || null,
              notes: item.notes || '',
              barcode: item.barcode || null,
            };

            await addItemManual(itemData);
            successCount++;
          } catch (error) {
            console.error('Failed to import row:', error);
            errorCount++;
          }
        }

        alert(`✅ Import Complete!\n\n✓ ${successCount} items imported\n${skipCount > 0 ? `⊘ ${skipCount} duplicates skipped\n` : ''}${errorCount > 0 ? `✗ ${errorCount} errors` : ''}`);
        
        setImportFile(null);
        setImportPreview(null);
      };
      reader.readAsText(importFile);
    } catch (error) {
      console.error('Import failed:', error);
      alert('❌ Import failed. Please check the CSV format and try again.');
    } finally {
      setImporting(false);
    }
  };

  const cancelImport = () => {
    setImportFile(null);
    setImportPreview(null);
  };

  // Tabs configuration
  const tabs = [
    { id: 'connection', label: '🌐 Connection' },
    { id: 'apikeys', label: '🔑 API Keys' },
    ...(currentUser ? [
      { id: 'profile', label: '👤 Profile' },
      { id: 'security', label: '🔒 Security' },
    ] : []),
    { id: 'preferences', label: '⚙️ Preferences' },
    { id: 'notifications', label: '🔔 Notifications' },
    ...(isAdmin ? [
      { id: 'users', label: '👥 User Management' },
      { id: 'stats', label: '📊 Server Stats' },
    ] : []),
    { id: 'importexport', label: '📥 Import/Export' },
    { id: 'about', label: 'ℹ️ About' },
  ];

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: colors.background,
    }}>
      {/* Sticky Header + Tabs */}
      <div style={{
        position: 'sticky',
        top: 0,
        backgroundColor: colors.background,
        zIndex: 100,
        paddingTop: spacing.lg,
        paddingBottom: spacing.sm,
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
        marginBottom: spacing.lg,
      }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', paddingLeft: spacing.lg, paddingRight: spacing.lg }}>
          <div style={{ marginBottom: spacing.md }}>
            <button
              onClick={onBack}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '18px',
                color: colors.textPrimary,
                cursor: 'pointer',
                marginBottom: spacing.sm,
                fontWeight: '600',
              }}
            >
              ← Back
            </button>
            <h1 style={{ margin: 0, color: colors.textPrimary }}>⚙️ Settings</h1>
            {currentUser && (
              <p style={{ margin: `${spacing.xs} 0 0 0`, color: colors.textSecondary }}>
                {currentUser.username} {isAdmin && <span style={{ color: '#f59e0b' }}>(Admin)</span>}
              </p>
            )}
          </div>

          <div style={{
            display: 'flex',
            gap: spacing.xs,
            borderBottom: `2px solid ${colors.border}`,
            overflowX: 'auto',
          }}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: `${spacing.md} ${spacing.lg}`,
                  border: 'none',
                  background: activeTab === tab.id ? colors.primary : 'transparent',
                  color: colors.textPrimary,
                  fontWeight: activeTab === tab.id ? 'bold' : '500',
                  fontSize: '16px',
                  cursor: 'pointer',
                  borderBottom: activeTab === tab.id ? `3px solid ${colors.primary}` : '3px solid transparent',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div style={{ 
        maxWidth: '900px', 
        margin: '0 auto',
        padding: spacing.lg,
        paddingBottom: '200px',
      }}>
        {/* CONNECTION TAB */}
        {activeTab === 'connection' && (
          <div style={{
            background: colors.card,
            padding: spacing.xl,
            borderRadius: borderRadius.lg,
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          }}>
            <h2 style={{ marginTop: 0, color: colors.textPrimary }}>Server Connection</h2>
            <p style={{ color: colors.textSecondary, lineHeight: 1.6 }}>
              Configure the backend API URL. The server must be running and accessible.
            </p>

            <div style={{ marginTop: spacing.lg }}>
              <label style={{
                display: 'block',
                marginBottom: spacing.sm,
                fontWeight: '600',
                color: colors.textPrimary,
                fontSize: '16px',
              }}>
                Server URL
              </label>
              <input
                type="text"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="http://192.168.1.100:8000"
                style={{
                  width: '100%',
                  padding: spacing.md,
                  borderRadius: borderRadius.md,
                  border: `2px solid ${colors.border}`,
                  fontSize: '16px',
                  marginBottom: spacing.sm,
                  backgroundColor: colors.card,
                  color: colors.textPrimary,
                }}
              />
              <p style={{ 
                fontSize: '14px', 
                color: colors.textSecondary,
                margin: `${spacing.sm} 0`,
              }}>
                Examples: http://192.168.68.119, http://macmini.local
              </p>
            </div>

            {/* API Key Section */}
            <div style={{
              marginTop: spacing.xl,
              paddingTop: spacing.xl,
              borderTop: `2px solid ${colors.border}`,
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: spacing.md,
              }}>
                <label style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: colors.textPrimary,
                }}>
                  Use API Key (Optional)
                </label>
                <button
                  onClick={() => setShowApiKeyInput(!showApiKeyInput)}
                  style={{
                    padding: `${spacing.sm} ${spacing.md}`,
                    borderRadius: borderRadius.md,
                    border: 'none',
                    backgroundColor: showApiKeyInput ? colors.primary : colors.border,
                    color: showApiKeyInput ? colors.textPrimary : colors.textSecondary,
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                >
                  {showApiKeyInput ? '🔒 Enabled' : '🔓 Disabled'}
                </button>
              </div>

              {showApiKeyInput && (
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: spacing.sm,
                    fontWeight: '600',
                    color: colors.textPrimary,
                    fontSize: '16px',
                  }}>
                    API Key
                  </label>
                  <input
                    type="password"
                    value={currentApiKey}
                    onChange={(e) => setCurrentApiKey(e.target.value)}
                    placeholder="pp_xxxxxxxxxxxxxxxxxxxxxxxx"
                    style={{
                      width: '100%',
                      padding: spacing.md,
                      borderRadius: borderRadius.md,
                      border: `2px solid ${colors.border}`,
                      fontSize: '16px',
                      marginBottom: spacing.sm,
                      backgroundColor: colors.card,
                      color: colors.textPrimary,
                      fontFamily: 'monospace',
                    }}
                  />
                  <p style={{ 
                    fontSize: '14px', 
                    color: colors.textSecondary,
                    margin: `${spacing.sm} 0`,
                  }}>
                    💡 Required if server has AUTH_MODE=api_key_only or AUTH_MODE=full<br/>
                    Generate keys in Settings → API Keys tab
                  </p>
                </div>
              )}
            </div>

            <div style={{ 
              display: 'flex', 
              gap: spacing.md, 
              marginTop: spacing.lg,
              flexWrap: 'wrap',
            }}>
              <button
                onClick={testConnection}
                disabled={testing}
                style={{
                  flex: 1,
                  minWidth: '150px',
                  padding: spacing.md,
                  borderRadius: borderRadius.md,
                  border: 'none',
                  background: colors.primary,
                  color: '#ffffff',
                  fontWeight: 'bold',
                  cursor: testing ? 'not-allowed' : 'pointer',
                  opacity: testing ? 0.6 : 1,
                }}
              >
                {testing ? '🔄 Testing...' : '🔍 Test Connection'}
              </button>

              <button
                onClick={() => setApiUrl('http://localhost')}
                style={{
                  flex: 1,
                  minWidth: '150px',
                  padding: spacing.md,
                  borderRadius: borderRadius.md,
                  border: 'none',
                  background: colors.primary,
                  color: '#ffffff',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                ↺ Reset to Default
              </button>
            </div>

            <button
              onClick={saveConnectionSettings}
              style={{
                width: '100%',
                padding: spacing.lg,
                borderRadius: borderRadius.lg,
                border: 'none',
                background: colors.primary,
                color: colors.textPrimary,
                fontWeight: 'bold',
                cursor: 'pointer',
                fontSize: '18px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                marginTop: spacing.lg,
              }}
            >
              💾 Save Connection Settings
            </button>
          </div>
        )}

        {/* API KEYS TAB */}
        {activeTab === 'apikeys' && (
          <div>
            <div style={{
              background: colors.card,
              padding: spacing.xl,
              borderRadius: borderRadius.lg,
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              marginBottom: spacing.lg,
            }}>
              <h2 style={{ marginTop: 0, color: colors.textPrimary }}>🔐 API Keys Management</h2>
              <p style={{ color: colors.textSecondary }}>Manage API keys for accessing PantryPal</p>
              
              {/* Generated Key Display */}
              {generatedKey && (
                <div style={{
                  backgroundColor: '#FEF3C7',
                  padding: spacing.xl,
                  borderRadius: borderRadius.lg,
                  border: '2px solid #FCD34D',
                  marginTop: spacing.lg,
                }}>
                  <h3 style={{ marginTop: 0, fontSize: '18px', fontWeight: 'bold', color: colors.textPrimary }}>
                    ⚠️ Save This Key Now!
                  </h3>
                  <p style={{ fontSize: '14px', color: '#78350F', lineHeight: 1.5, marginBottom: spacing.md }}>
                    This is the only time you'll see this key. Copy it and store it securely.
                  </p>
                  <div style={{
                    backgroundColor: colors.card,
                    padding: spacing.md,
                    borderRadius: borderRadius.md,
                    border: '1px solid #FCD34D',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    wordBreak: 'break-all',
                    marginBottom: spacing.md,
                  }}>
                    {generatedKey}
                  </div>
                  <button
                    onClick={() => copyToClipboard(generatedKey)}
                    style={{
                      width: '100%',
                      padding: spacing.md,
                      borderRadius: borderRadius.md,
                      border: 'none',
                      backgroundColor: '#F59E0B',
                      color: colors.card,
                      fontWeight: '600',
                      fontSize: '16px',
                      cursor: 'pointer',
                      marginBottom: spacing.sm,
                    }}
                  >
                    📋 Copy to Clipboard
                  </button>
                  <button
                    onClick={() => setGeneratedKey(null)}
                    style={{
                      width: '100%',
                      padding: spacing.md,
                      borderRadius: borderRadius.md,
                      border: 'none',
                      backgroundColor: '#E5E7EB',
                      color: colors.textPrimary,
                      fontWeight: '600',
                      fontSize: '16px',
                      cursor: 'pointer',
                    }}
                  >
                    I've Saved It
                  </button>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.lg }}>
                <h3 style={{ margin: 0 }}>Your API Keys</h3>
                <button
                  onClick={() => setShowNewKeyForm(!showNewKeyForm)}
                  style={{
                    padding: `${spacing.sm} ${spacing.md}`,
                    borderRadius: borderRadius.md,
                    border: 'none',
                    backgroundColor: colors.primary,
                    color: colors.textPrimary,
                    fontWeight: '600',
                    fontSize: '14px',
                    cursor: 'pointer',
                  }}
                >
                  {showNewKeyForm ? '✕ Cancel' : '+ New Key'}
                </button>
              </div>

              {showNewKeyForm && (
                <div style={{
                  backgroundColor: colors.background,
                  padding: spacing.md,
                  borderRadius: borderRadius.md,
                  marginTop: spacing.md,
                }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md, marginTop: 0 }}>
                    Create New API Key
                  </h3>
                  <input
                    type="text"
                    placeholder="Name (e.g., Home Assistant)"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: spacing.md,
                      borderRadius: borderRadius.md,
                      border: `2px solid ${colors.border}`,
                      fontSize: '16px',
                      marginBottom: spacing.sm,
                      backgroundColor: colors.card,
                      color: colors.textPrimary,
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Description (optional)"
                    value={newKeyDescription}
                    onChange={(e) => setNewKeyDescription(e.target.value)}
                    style={{
                      width: '100%',
                      padding: spacing.md,
                      borderRadius: borderRadius.md,
                      border: `2px solid ${colors.border}`,
                      fontSize: '16px',
                      marginBottom: spacing.sm,
                      backgroundColor: colors.card,
                      color: colors.textPrimary,
                    }}
                  />
                  <button
                    onClick={generateApiKey}
                    style={{
                      width: '100%',
                      padding: spacing.md,
                      borderRadius: borderRadius.md,
                      border: 'none',
                      backgroundColor: '#10B981',
                      color: colors.card,
                      fontWeight: '600',
                      fontSize: '16px',
                      cursor: 'pointer',
                    }}
                  >
                    🔑 Generate Key
                  </button>
                </div>
              )}

              {loadingKeys ? (
                <div style={{ textAlign: 'center', padding: spacing.xl, color: colors.textSecondary }}>
                  Loading...
                </div>
              ) : apiKeys.length === 0 ? (
                <div style={{ textAlign: 'center', padding: spacing.xl }}>
                  <div style={{ fontSize: '18px', fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.xs }}>
                    No API keys yet
                  </div>
                  <div style={{ fontSize: '14px', color: colors.textSecondary }}>
                    Create your first key to get started
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: spacing.sm }}>
                  {apiKeys.map((key) => (
                    <div key={key.id} style={{
                      backgroundColor: colors.background,
                      padding: spacing.md,
                      borderRadius: borderRadius.md,
                      marginBottom: spacing.sm,
                      border: `1px solid ${colors.border}`,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '16px', fontWeight: 'bold', color: colors.textPrimary, marginBottom: spacing.xs }}>
                            {key.name}
                          </div>
                          {key.description && (
                            <div style={{ fontSize: '14px', color: colors.textSecondary }}>
                              {key.description}
                            </div>
                          )}
                        </div>
                        <div style={{
                          padding: `${spacing.sm} ${spacing.md}`,
                          borderRadius: '999px',
                          backgroundColor: key.is_active ? '#D1FAE5' : '#E5E7EB',
                          fontSize: '12px',
                          fontWeight: '600',
                          color: key.is_active ? '#065F46' : '#6B7280',
                        }}>
                          {key.is_active ? 'Active' : 'Revoked'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                        <div style={{ fontSize: '12px', color: colors.textSecondary }}>
                          Created: {formatDate(key.created_at)}
                        </div>
                        <div style={{ fontSize: '12px', color: colors.textSecondary }}>
                          Last used: {formatDate(key.last_used_at)}
                        </div>
                      </div>
                      <button
                        onClick={() => deleteApiKey(key.id, key.name)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: colors.error,
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* PROFILE TAB */}
        {activeTab === 'profile' && currentUser && (
          <div style={{
            background: colors.card,
            padding: spacing.xl,
            borderRadius: borderRadius.lg,
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          }}>
            <h2 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: spacing.sm }}>
              <User size={24} />
              Profile Information
            </h2>
              
              <form onSubmit={handleUpdateProfile} style={{ marginTop: spacing.lg }}>
                <div style={{ marginBottom: spacing.md }}>
                  <label style={{
                    display: 'block',
                    marginBottom: spacing.sm,
                    fontWeight: '600',
                    color: colors.textPrimary,
                  }}>
                    Username
                  </label>
                  <input
                    type="text"
                    value={profile.username}
                    onChange={(e) => setProfile({ ...profile, username: e.target.value })}
                    placeholder="username"
                    minLength="3"
                    style={{
                      width: '100%',
                      padding: spacing.md,
                      borderRadius: borderRadius.md,
                      border: `2px solid ${colors.border}`,
                      backgroundColor: colors.background,
                      color: colors.textPrimary,
                    }}
                  />
                  <p style={{ marginTop: spacing.xs, fontSize: '0.875rem', color: colors.textSecondary }}>
                    Minimum 3 characters
                  </p>
                </div>

                <div style={{ marginBottom: spacing.md }}>
                  <label style={{
                    display: 'block',
                    marginBottom: spacing.sm,
                    fontWeight: '600',
                    color: colors.textPrimary,
                  }}>
                    <Mail size={16} style={{ display: 'inline', marginRight: spacing.xs }} />
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    placeholder="your.email@example.com"
                    style={{
                      width: '100%',
                      padding: spacing.md,
                      borderRadius: borderRadius.md,
                      border: `2px solid ${colors.border}`,
                      backgroundColor: colors.card,
                    }}
                  />
                </div>

                <div style={{ marginBottom: spacing.md }}>
                  <label style={{
                    display: 'block',
                    marginBottom: spacing.sm,
                    fontWeight: '600',
                    color: colors.textPrimary,
                  }}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={profile.full_name}
                    onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                    placeholder="John Doe"
                    style={{
                      width: '100%',
                      padding: spacing.md,
                      borderRadius: borderRadius.md,
                      border: `2px solid ${colors.border}`,
                      backgroundColor: colors.card,
                    }}
                  />
                </div>

                {profileMessage && (
                  <div style={{ marginBottom: spacing.md, fontSize: '14px' }}>
                    {profileMessage}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={profileLoading}
                  style={{
                    width: '100%',
                    padding: spacing.lg,
                    borderRadius: borderRadius.lg,
                    border: 'none',
                    background: colors.primary,
                    color: colors.textPrimary,
                    fontWeight: 'bold',
                    cursor: profileLoading ? 'not-allowed' : 'pointer',
                    opacity: profileLoading ? 0.6 : 1,
                  }}
                >
                  {profileLoading ? 'Updating...' : 'Save Changes'}
                </button>
              </form>
          </div>
        )}

        {/* SECURITY TAB */}
        {activeTab === 'security' && currentUser && (
          <div style={{
            background: colors.card,
            padding: spacing.xl,
            borderRadius: borderRadius.lg,
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          }}>
            <h2 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: spacing.sm }}>
              <Lock size={24} />
              Change Password
            </h2>

            <form onSubmit={handleChangePassword} style={{ marginTop: spacing.lg }}>
              <div style={{ marginBottom: spacing.md }}>
                <label style={{
                  display: 'block',
                  marginBottom: spacing.sm,
                  fontWeight: '600',
                  color: colors.textPrimary,
                }}>
                  Current Password
                </label>
                <input
                  type="password"
                  value={passwordData.current_password}
                  onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
                  placeholder="Enter current password"
                  style={{
                    width: '100%',
                    padding: spacing.md,
                    borderRadius: borderRadius.md,
                    border: `2px solid ${colors.border}`,
                    backgroundColor: colors.card,
                    color: colors.textPrimary,
                  }}
                />
              </div>

              <div style={{ marginBottom: spacing.md }}>
                <label style={{
                  display: 'block',
                  marginBottom: spacing.sm,
                  fontWeight: '600',
                  color: colors.textPrimary,
                }}>
                  New Password
                </label>
                <input
                  type="password"
                  value={passwordData.new_password}
                  onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                  placeholder="Enter new password (min 8 chars)"
                  style={{
                    width: '100%',
                    padding: spacing.md,
                    borderRadius: borderRadius.md,
                    border: `2px solid ${colors.border}`,
                    backgroundColor: colors.card,
                    color: colors.textPrimary,
                  }}
                />
              </div>

              <div style={{ marginBottom: spacing.md }}>
                <label style={{
                  display: 'block',
                  marginBottom: spacing.sm,
                  fontWeight: '600',
                  color: colors.textPrimary,
                }}>
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={passwordData.confirm_password}
                  onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                  placeholder="Confirm new password"
                  style={{
                    width: '100%',
                    padding: spacing.md,
                    borderRadius: borderRadius.md,
                    border: `2px solid ${colors.border}`,
                    backgroundColor: colors.card,
                    color: colors.textPrimary,
                  }}
                />
              </div>

              {passwordMessage && (
                <div style={{ marginBottom: spacing.md, fontSize: '14px', color: passwordMessage.includes('success') ? colors.success : colors.error }}>
                  {passwordMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={passwordLoading}
                style={{
                  width: '100%',
                  padding: spacing.lg,
                  borderRadius: borderRadius.lg,
                  border: 'none',
                  background: colors.primary,
                  color: colors.textPrimary,
                  fontWeight: 'bold',
                  cursor: passwordLoading ? 'not-allowed' : 'pointer',
                  opacity: passwordLoading ? 0.6 : 1,
                }}
              >
                {passwordLoading ? 'Changing Password...' : 'Change Password'}
              </button>
            </form>

            <div style={{
              marginTop: spacing.xl,
              paddingTop: spacing.xl,
              borderTop: `1px solid ${colors.border}`,
            }}>
              <div style={{
                padding: spacing.md,
                background: colors.background,
                borderRadius: borderRadius.md,
                color: colors.textSecondary,
                fontSize: '14px',
              }}>
                📱 <strong>Biometric Authentication</strong> is available on the mobile app. Download the PantryPal mobile app to enable Face ID or Touch ID for quick, secure access.
              </div>
            </div>
          </div>
        )}

        {/* NOTIFICATIONS TAB */}
        {activeTab === 'notifications' && (
          <div style={{
            background: colors.card,
            padding: spacing.xl,
            borderRadius: borderRadius.lg,
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          }}>
            <h2 style={{ marginTop: 0, color: colors.textPrimary }}>🔔 Notifications</h2>

            <div style={{
              padding: spacing.lg,
              background: colors.background,
              borderRadius: borderRadius.md,
              marginTop: spacing.lg,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md }}>
                <div style={{ fontSize: '32px' }}>📱</div>
                <div>
                  <h3 style={{ margin: 0, color: colors.textPrimary }}>Mobile App Notifications</h3>
                  <p style={{ margin: 0, marginTop: spacing.xs, color: colors.textSecondary, fontSize: '14px' }}>
                    Push notifications for expiring items are available on the PantryPal mobile app
                  </p>
                </div>
              </div>
            </div>

            <div style={{ marginTop: spacing.lg }}>
              <h3 style={{ color: colors.textPrimary, marginBottom: spacing.md }}>Features</h3>
              <div style={{ display: 'grid', gap: spacing.md }}>
                <div style={{
                  padding: spacing.md,
                  borderLeft: `4px solid ${colors.primary}`,
                  background: colors.background,
                  borderRadius: borderRadius.sm,
                }}>
                  <div style={{ fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.xs }}>
                    📅 Daily Expiry Alerts
                  </div>
                  <div style={{ fontSize: '14px', color: colors.textSecondary }}>
                    Receive daily notifications at 9 AM for items expiring within 7 days
                  </div>
                </div>

                <div style={{
                  padding: spacing.md,
                  borderLeft: `4px solid ${colors.primary}`,
                  background: colors.background,
                  borderRadius: borderRadius.sm,
                }}>
                  <div style={{ fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.xs }}>
                    ⚠️ Smart Urgency Levels
                  </div>
                  <div style={{ fontSize: '14px', color: colors.textSecondary }}>
                    Different notification types based on urgency: expired, tomorrow, soon, or reminder
                  </div>
                </div>

                <div style={{
                  padding: spacing.md,
                  borderLeft: `4px solid ${colors.primary}`,
                  background: colors.background,
                  borderRadius: borderRadius.sm,
                }}>
                  <div style={{ fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.xs }}>
                    🔄 Automatic Updates
                  </div>
                  <div style={{ fontSize: '14px', color: colors.textSecondary }}>
                    Notifications automatically sync when you refresh your pantry inventory
                  </div>
                </div>

                <div style={{
                  padding: spacing.md,
                  borderLeft: `4px solid ${colors.primary}`,
                  background: colors.background,
                  borderRadius: borderRadius.sm,
                }}>
                  <div style={{ fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.xs }}>
                    👆 Tap to View
                  </div>
                  <div style={{ fontSize: '14px', color: colors.textSecondary }}>
                    Tapping a notification takes you directly to the item details
                  </div>
                </div>
              </div>
            </div>

            <div style={{
              marginTop: spacing.xl,
              padding: spacing.lg,
              background: colors.background,
              borderRadius: borderRadius.md,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '14px', color: colors.textSecondary }}>
                💡 Note: Browser notifications for the web dashboard are not currently supported. Please use the mobile app for push notifications.
              </div>
            </div>
          </div>
        )}

        {/* USER MANAGEMENT TAB */}
        {activeTab === 'users' && isAdmin && (
          <div style={{
            background: colors.card,
            padding: spacing.xl,
            borderRadius: borderRadius.lg,
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          }}>
            {/* User Management Header */}
            <div style={{
              background: colors.card,
              padding: spacing.xl,
              borderRadius: borderRadius.lg,
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: spacing.lg,
              }}>
                <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                  <Users size={24} />
                  User Management
                </h2>
                <button
                  onClick={() => setInviteFormExpanded(!inviteFormExpanded)}
                  style={{
                    padding: `${spacing.sm}px ${spacing.md}px`,
                    borderRadius: borderRadius.md,
                    border: `2px solid ${colors.primary}`,
                    background: inviteFormExpanded ? colors.primary : 'transparent',
                    color: inviteFormExpanded ? colors.textPrimary : colors.primary,
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing.xs,
                    fontSize: '14px',
                  }}
                >
                  {inviteFormExpanded ? '✕ Close' : '➕ Invite User'}
                </button>
              </div>

              {/* Collapsible Invite User Form */}
              {inviteFormExpanded && (
                <div style={{
                  marginBottom: spacing.lg,
                  padding: spacing.lg,
                  background: colors.background,
                  borderRadius: borderRadius.md,
                  border: `1px solid ${colors.border}`,
                }}>
                  <h3 style={{ marginTop: 0, color: colors.textPrimary }}>Create New User</h3>
                  <p style={{ color: colors.textSecondary, fontSize: '14px', marginBottom: spacing.md }}>
                    Create a new user account for your household
                  </p>

                  <form onSubmit={handleInviteUser}>
                    <div style={{ marginBottom: spacing.md }}>
                      <label style={{
                        display: 'block',
                        marginBottom: spacing.sm,
                        fontWeight: '600',
                        color: colors.textPrimary,
                        fontSize: '14px',
                      }}>
                        Username *
                      </label>
                      <input
                        type="text"
                        value={inviteData.username}
                        onChange={(e) => setInviteData({ ...inviteData, username: e.target.value })}
                        placeholder="username"
                        autoCapitalize="none"
                        style={{
                          width: '100%',
                          padding: spacing.md,
                          borderRadius: borderRadius.md,
                          border: `2px solid ${colors.border}`,
                          backgroundColor: colors.card,
                          color: colors.textPrimary,
                        }}
                      />
                    </div>

                    <div style={{ marginBottom: spacing.md }}>
                      <label style={{
                        display: 'block',
                        marginBottom: spacing.sm,
                        fontWeight: '600',
                        color: colors.textPrimary,
                        fontSize: '14px',
                      }}>
                        Email *
                      </label>
                      <input
                        type="email"
                        value={inviteData.email}
                        onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                        placeholder="user@example.com"
                        style={{
                          width: '100%',
                          padding: spacing.md,
                          borderRadius: borderRadius.md,
                          border: `2px solid ${colors.border}`,
                          backgroundColor: colors.card,
                          color: colors.textPrimary,
                        }}
                      />
                    </div>

                    <div style={{ marginBottom: spacing.md }}>
                      <label style={{
                        display: 'block',
                        marginBottom: spacing.sm,
                        fontWeight: '600',
                        color: colors.textPrimary,
                        fontSize: '14px',
                      }}>
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={inviteData.full_name}
                        onChange={(e) => setInviteData({ ...inviteData, full_name: e.target.value })}
                        placeholder="John Doe"
                        style={{
                          width: '100%',
                          padding: spacing.md,
                          borderRadius: borderRadius.md,
                          border: `2px solid ${colors.border}`,
                          backgroundColor: colors.card,
                          color: colors.textPrimary,
                        }}
                      />
                    </div>

                    <div style={{ marginBottom: spacing.md }}>
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: spacing.sm,
                        cursor: 'pointer',
                        padding: spacing.md,
                        borderRadius: borderRadius.md,
                        border: `2px solid ${colors.border}`,
                        backgroundColor: colors.card,
                      }}>
                        <input
                          type="checkbox"
                          checked={inviteData.send_welcome_email}
                          onChange={(e) => setInviteData({ ...inviteData, send_welcome_email: e.target.checked })}
                          style={{
                            width: '18px',
                            height: '18px',
                            cursor: 'pointer',
                          }}
                        />
                        <div>
                          <div style={{
                            fontWeight: '600',
                            color: colors.textPrimary,
                            fontSize: '14px',
                          }}>
                            Send Welcome Email
                          </div>
                          <div style={{
                            fontSize: '12px',
                            color: colors.textSecondary,
                            marginTop: '2px',
                          }}>
                            User will receive a welcome email with a link to set their password
                          </div>
                        </div>
                      </label>
                    </div>

                    {inviteMessage && (
                      <div style={{
                        marginBottom: spacing.md,
                        fontSize: '14px',
                        padding: spacing.sm,
                        borderRadius: borderRadius.sm,
                        background: inviteMessage.includes('✅') ? '#d1fae5' : '#fee2e2',
                        color: inviteMessage.includes('✅') ? '#065f46' : '#991b1b',
                      }}>
                        {inviteMessage}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: spacing.sm }}>
                      <button
                        type="submit"
                        disabled={inviteLoading}
                        style={{
                          flex: 1,
                          padding: spacing.md,
                          borderRadius: borderRadius.md,
                          border: 'none',
                          background: colors.primary,
                          color: colors.textPrimary,
                          fontWeight: 'bold',
                          cursor: inviteLoading ? 'not-allowed' : 'pointer',
                          opacity: inviteLoading ? 0.6 : 1,
                          fontSize: '14px',
                        }}
                      >
                        {inviteLoading ? '⏳ Creating...' : '✉️ Create User'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setInviteFormExpanded(false);
                          setInviteData({ username: '', email: '', full_name: '', password: '' });
                          setInviteMessage('');
                        }}
                        style={{
                          padding: spacing.md,
                          borderRadius: borderRadius.md,
                          border: `2px solid ${colors.border}`,
                          background: 'transparent',
                          color: colors.textSecondary,
                          fontWeight: '600',
                          cursor: 'pointer',
                          fontSize: '14px',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {adminLoading ? (
                <div style={{ textAlign: 'center', padding: spacing.xl, color: colors.textSecondary }}>
                  Loading users...
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${colors.border}` }}>
                        <th style={{ textAlign: 'left', padding: spacing.md }}>Username</th>
                        <th style={{ textAlign: 'left', padding: spacing.md }}>Email</th>
                        <th style={{ textAlign: 'left', padding: spacing.md }}>Full Name</th>
                        <th style={{ textAlign: 'left', padding: spacing.md }}>Role</th>
                        <th style={{ textAlign: 'left', padding: spacing.md }}>Status</th>
                        <th style={{ textAlign: 'left', padding: spacing.md }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={user.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                          <td style={{ padding: spacing.md, fontWeight: '500' }}>{user.username}</td>
                          <td style={{ padding: spacing.md, color: colors.textSecondary }}>{user.email || '-'}</td>
                          <td style={{ padding: spacing.md, color: colors.textSecondary }}>{user.full_name || '-'}</td>
                          <td style={{ padding: spacing.md }}>
                            {user.is_admin ? (
                              <span style={{
                                padding: '4px 12px',
                                background: '#fef3c7',
                                color: '#92400e',
                                borderRadius: '9999px',
                                fontSize: '12px',
                                fontWeight: '600',
                              }}>
                                Admin
                              </span>
                            ) : (
                              <span style={{
                                padding: '4px 12px',
                                background: '#f3f4f6',
                                color: colors.textPrimary,
                                borderRadius: '9999px',
                                fontSize: '12px',
                                fontWeight: '600',
                              }}>
                                User
                              </span>
                            )}
                          </td>
                          <td style={{ padding: spacing.md }}>
                            {user.is_active ? (
                              <span style={{
                                padding: '4px 12px',
                                background: '#d1fae5',
                                color: '#065f46',
                                borderRadius: '9999px',
                                fontSize: '12px',
                                fontWeight: '600',
                              }}>
                                Active
                              </span>
                            ) : (
                              <span style={{
                                padding: '4px 12px',
                                background: '#fee2e2',
                                color: '#991b1b',
                                borderRadius: '9999px',
                                fontSize: '12px',
                                fontWeight: '600',
                              }}>
                                Disabled
                              </span>
                            )}
                          </td>
                          <td style={{ padding: spacing.md }}>
                            {user.id !== currentUser?.id && (
                              <div style={{ display: 'flex', gap: spacing.sm }}>
                                <button
                                  onClick={() => handleToggleUserStatus(user.id, user.is_active)}
                                  style={{
                                    padding: '6px 12px',
                                    background: '#3b82f6',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: borderRadius.sm,
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                  }}
                                >
                                  {user.is_active ? 'Disable' : 'Enable'}
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(user.id)}
                                  style={{
                                    padding: '6px 12px',
                                    background: '#ef4444',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: borderRadius.sm,
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                  }}
                                >
                                  Delete
                                </button>
                              </div>
                            )}
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

        {/* SERVER STATS TAB */}
        {activeTab === 'stats' && isAdmin && (
          <div>
            <h2 style={{ marginTop: 0, marginBottom: spacing.lg, color: colors.textPrimary }}>
              📊 Server Statistics
            </h2>

            {/* Statistics Grid */}
            {stats && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: spacing.md,
                marginBottom: spacing.lg,
              }}>
                <div style={{
                  background: colors.card,
                  padding: spacing.xl,
                  borderRadius: borderRadius.lg,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ margin: 0, fontSize: '14px', color: colors.textSecondary }}>Total Users</p>
                      <p style={{ margin: '8px 0 0 0', fontSize: '32px', fontWeight: 'bold', color: colors.textPrimary }}>
                        {stats.total_users}
                      </p>
                    </div>
                    <Users size={48} color={colors.primary} />
                  </div>
                </div>

                <div style={{
                  background: colors.card,
                  padding: spacing.xl,
                  borderRadius: borderRadius.lg,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ margin: 0, fontSize: '14px', color: colors.textSecondary }}>Active Users</p>
                      <p style={{ margin: '8px 0 0 0', fontSize: '32px', fontWeight: 'bold', color: '#10b981' }}>
                        {stats.active_users}
                      </p>
                    </div>
                    <Activity size={48} color="#10b981" />
                  </div>
                </div>

                <div style={{
                  background: colors.card,
                  padding: spacing.xl,
                  borderRadius: borderRadius.lg,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ margin: 0, fontSize: '14px', color: colors.textSecondary }}>Inactive Users</p>
                      <p style={{ margin: '8px 0 0 0', fontSize: '32px', fontWeight: 'bold', color: '#ef4444' }}>
                        {stats.inactive_users}
                      </p>
                    </div>
                    <Activity size={48} color="#ef4444" />
                  </div>
                </div>

                <div style={{
                  background: colors.card,
                  padding: spacing.xl,
                  borderRadius: borderRadius.lg,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ margin: 0, fontSize: '14px', color: colors.textSecondary }}>Admins</p>
                      <p style={{ margin: '8px 0 0 0', fontSize: '32px', fontWeight: 'bold', color: colors.primary }}>
                        {stats.admin_users}
                      </p>
                    </div>
                    <Shield size={48} color={colors.primary} />
                  </div>
                </div>
              </div>
            )}

            {/* Load Stats Button */}
            {!stats && (
              <div style={{
                background: colors.card,
                padding: spacing.xl,
                borderRadius: borderRadius.lg,
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                textAlign: 'center',
              }}>
                <p style={{ color: colors.textSecondary, marginBottom: spacing.md }}>
                  No statistics loaded yet
                </p>
                <button
                  onClick={loadAdminData}
                  disabled={adminLoading}
                  style={{
                    padding: `${spacing.md}px ${spacing.lg}px`,
                    borderRadius: borderRadius.md,
                    border: 'none',
                    background: colors.primary,
                    color: colors.textPrimary,
                    fontWeight: 'bold',
                    cursor: adminLoading ? 'not-allowed' : 'pointer',
                    opacity: adminLoading ? 0.6 : 1,
                  }}
                >
                  {adminLoading ? 'Loading...' : 'Load Statistics'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* IMPORT/EXPORT TAB */}
        {activeTab === 'importexport' && (
          <div>
            {/* Import Section */}
            <div style={{
              background: colors.card,
              padding: spacing.xl,
              borderRadius: borderRadius.lg,
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              marginBottom: spacing.lg,
            }}>
              <h2 style={{ marginTop: 0, color: colors.textPrimary }}>📤 Import from CSV</h2>
              <p style={{ color: colors.textSecondary, lineHeight: 1.6 }}>
                Import items in bulk from a CSV file.
              </p>

              {!importPreview ? (
                <div>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleImportFileSelect}
                    style={{ display: 'none' }}
                    id="csv-upload"
                  />
                  <label
                    htmlFor="csv-upload"
                    style={{
                      display: 'inline-block',
                      padding: spacing.lg,
                      borderRadius: borderRadius.lg,
                      border: `2px dashed ${colors.border}`,
                      background: colors.background,
                      color: colors.textPrimary,
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      textAlign: 'center',
                      width: '100%',
                      marginTop: spacing.md,
                    }}
                  >
                    📁 Choose CSV File
                  </label>

                  <div style={{ marginTop: spacing.lg }}>
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: spacing.sm,
                      cursor: 'pointer',
                    }}>
                      <input
                        type="checkbox"
                        checked={importOptions.skipDuplicates}
                        onChange={(e) => setImportOptions({...importOptions, skipDuplicates: e.target.checked})}
                      />
                      <span style={{ color: colors.textPrimary }}>Skip duplicate barcodes</span>
                    </label>
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: spacing.lg }}>
                  <h3 style={{ color: colors.textPrimary }}>Preview ({importPreview.totalRows} items)</h3>
                  <div style={{
                    overflowX: 'auto',
                    marginTop: spacing.md,
                    marginBottom: spacing.lg,
                  }}>
                    <table style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '14px',
                    }}>
                      <thead>
                        <tr style={{ background: colors.background }}>
                          {importPreview.headers.map((header, i) => (
                            <th key={i} style={{
                              padding: spacing.sm,
                              textAlign: 'left',
                              borderBottom: `2px solid ${colors.border}`,
                              fontWeight: 'bold',
                            }}>
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.rows.map((row, i) => (
                          <tr key={i}>
                            {row.map((cell, j) => (
                              <td key={j} style={{
                                padding: spacing.sm,
                                borderBottom: `1px solid ${colors.border}`,
                              }}>
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ display: 'flex', gap: spacing.md }}>
                    <button
                      onClick={performImport}
                      disabled={importing}
                      style={{
                        flex: 1,
                        padding: spacing.lg,
                        borderRadius: borderRadius.lg,
                        border: 'none',
                        background: colors.primary,
                        color: colors.textPrimary,
                        fontWeight: 'bold',
                        cursor: importing ? 'not-allowed' : 'pointer',
                        opacity: importing ? 0.6 : 1,
                      }}
                    >
                      {importing ? '⏳ Importing...' : `📤 Import ${importPreview.totalRows} Items`}
                    </button>
                    <button
                      onClick={cancelImport}
                      disabled={importing}
                      style={{
                        padding: spacing.lg,
                        borderRadius: borderRadius.lg,
                        border: 'none',
                        background: colors.textSecondary,
                        color: colors.card,
                        fontWeight: 'bold',
                        cursor: importing ? 'not-allowed' : 'pointer',
                        opacity: importing ? 0.6 : 1,
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Export Section */}
            <div style={{
              background: colors.card,
              padding: spacing.xl,
              borderRadius: borderRadius.lg,
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            }}>
              <h2 style={{ marginTop: 0, color: colors.textPrimary }}>📥 Export to CSV</h2>
              <p style={{ color: colors.textSecondary, lineHeight: 1.6 }}>
                Export your pantry inventory to a CSV file.
              </p>

              <div style={{ marginTop: spacing.lg }}>
                <label style={{
                  display: 'block',
                  marginBottom: spacing.sm,
                  fontWeight: '600',
                  color: colors.textPrimary,
                  fontSize: '16px',
                }}>
                  Export Filter
                </label>
                <select
                  value={exportFilter}
                  onChange={(e) => {
                    setExportFilter(e.target.value);
                    setExportValue('');
                  }}
                  style={{
                    width: '100%',
                    padding: spacing.md,
                    borderRadius: borderRadius.md,
                    border: `2px solid ${colors.border}`,
                    fontSize: '16px',
                    marginBottom: spacing.md,
                    backgroundColor: colors.background,
                  }}
                >
                  <option value="all">All Items</option>
                  <option value="location">Filter by Location</option>
                  <option value="category">Filter by Category</option>
                </select>

                {exportFilter === 'location' && (
                  <select
                    value={exportValue}
                    onChange={(e) => setExportValue(e.target.value)}
                    style={{
                      width: '100%',
                      padding: spacing.md,
                      borderRadius: borderRadius.md,
                      border: `2px solid ${colors.border}`,
                      fontSize: '16px',
                      marginBottom: spacing.md,
                      backgroundColor: colors.background,
                    }}
                  >
                    <option value="">Select Location</option>
                    {locations.map(loc => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                )}

                {exportFilter === 'category' && (
                  <select
                    value={exportValue}
                    onChange={(e) => setExportValue(e.target.value)}
                    style={{
                      width: '100%',
                      padding: spacing.md,
                      borderRadius: borderRadius.md,
                      border: `2px solid ${colors.border}`,
                      fontSize: '16px',
                      marginBottom: spacing.md,
                      backgroundColor: colors.background,
                    }}
                  >
                    <option value="">Select Category</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                )}

                <button
                  onClick={exportToCSV}
                  disabled={exporting || (exportFilter !== 'all' && !exportValue)}
                  style={{
                    width: '100%',
                    padding: spacing.lg,
                    borderRadius: borderRadius.lg,
                    border: 'none',
                    background: exportFilter !== 'all' && !exportValue ? colors.border : colors.primary,
                    color: '#ffffff',
                    fontWeight: 'bold',
                    cursor: exportFilter !== 'all' && !exportValue ? 'not-allowed' : 'pointer',
                    fontSize: '18px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    opacity: exportFilter !== 'all' && !exportValue ? 0.5 : 1,
                  }}
                >
                  {exporting ? '⏳ Exporting...' : '📥 Export to CSV'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PREFERENCES TAB */}
        {activeTab === 'preferences' && (
          <div style={{ paddingBottom: '100px' }}>
            <div style={{
              background: colors.card,
              padding: spacing.xl,
              borderRadius: borderRadius.lg,
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              marginBottom: spacing.lg,
            }}>
              <h2 style={{ marginTop: 0, color: colors.textPrimary }}>📍 Default Locations</h2>
              <p style={{ color: colors.textSecondary, lineHeight: 1.6 }}>
                Manage your storage locations.
              </p>

              {locations.map((location, index) => (
                <div key={index} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: spacing.md,
                  backgroundColor: colors.background,
                  borderRadius: borderRadius.sm,
                  marginBottom: spacing.xs,
                }}>
                  {editingLocation === location ? (
                    <>
                      <input
                        type="text"
                        value={editLocationValue}
                        onChange={(e) => setEditLocationValue(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') saveEditLocation();
                          if (e.key === 'Escape') cancelEditLocation();
                        }}
                        autoFocus
                        style={{
                          flex: 1,
                          padding: spacing.sm,
                          borderRadius: borderRadius.sm,
                          border: `2px solid ${colors.primary}`,
                          fontSize: '16px',
                          backgroundColor: colors.card,
                          color: colors.textPrimary,
                          marginRight: spacing.sm,
                        }}
                      />
                      <div style={{ display: 'flex', gap: spacing.xs }}>
                        <button
                          onClick={saveEditLocation}
                          style={{
                            background: colors.primary,
                            border: 'none',
                            fontSize: '14px',
                            color: '#ffffff',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            padding: `${spacing.xs} ${spacing.sm}`,
                            borderRadius: borderRadius.sm,
                          }}
                        >
                          ✓
                        </button>
                        <button
                          onClick={cancelEditLocation}
                          style={{
                            background: colors.border,
                            border: 'none',
                            fontSize: '14px',
                            color: colors.textPrimary,
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            padding: `${spacing.xs} ${spacing.sm}`,
                            borderRadius: borderRadius.sm,
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: '16px', color: colors.textPrimary }}>{location}</span>
                      <div style={{ display: 'flex', gap: spacing.xs }}>
                        <button
                          onClick={() => startEditLocation(location)}
                          style={{
                            background: 'none',
                            border: 'none',
                            fontSize: '18px',
                            color: colors.textSecondary,
                            cursor: 'pointer',
                            padding: spacing.xs,
                          }}
                          title="Edit location"
                        >
                          ✎
                        </button>
                        <button
                          onClick={() => removeLocation(location)}
                          style={{
                            background: 'none',
                            border: 'none',
                            fontSize: '20px',
                            color: colors.danger,
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            padding: spacing.xs,
                          }}
                          title="Delete location"
                        >
                          ✕
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}

              <div style={{ display: 'flex', gap: spacing.sm, marginTop: spacing.md }}>
                <input
                  type="text"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addLocation()}
                  placeholder="New location name"
                  style={{
                    flex: 1,
                    padding: spacing.md,
                    borderRadius: borderRadius.md,
                    border: `2px solid ${colors.border}`,
                    fontSize: '16px',
                    backgroundColor: colors.card,
                    color: colors.textPrimary,
                  }}
                />
                <button
                  onClick={addLocation}
                  style={{
                    padding: `${spacing.sm} ${spacing.lg}`,
                    borderRadius: borderRadius.md,
                    border: 'none',
                    background: colors.primary,
                    color: '#ffffff',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                  }}
                >
                  + Add
                </button>
              </div>
            </div>

            <div style={{
              background: colors.card,
              padding: spacing.xl,
              borderRadius: borderRadius.lg,
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              marginBottom: spacing.lg,
            }}>
              <h2 style={{ marginTop: 0, color: colors.textPrimary }}>🏷️ Default Categories</h2>
              <p style={{ color: colors.textSecondary, lineHeight: 1.6 }}>
                Manage product categories.
              </p>

              {categories.map((category, index) => (
                <div key={index} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: spacing.md,
                  backgroundColor: colors.background,
                  borderRadius: borderRadius.sm,
                  marginBottom: spacing.xs,
                }}>
                  {editingCategory === category ? (
                    <>
                      <input
                        type="text"
                        value={editCategoryValue}
                        onChange={(e) => setEditCategoryValue(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') saveEditCategory();
                          if (e.key === 'Escape') cancelEditCategory();
                        }}
                        autoFocus
                        style={{
                          flex: 1,
                          padding: spacing.sm,
                          borderRadius: borderRadius.sm,
                          border: `2px solid ${colors.primary}`,
                          fontSize: '16px',
                          backgroundColor: colors.card,
                          color: colors.textPrimary,
                          marginRight: spacing.sm,
                        }}
                      />
                      <div style={{ display: 'flex', gap: spacing.xs }}>
                        <button
                          onClick={saveEditCategory}
                          style={{
                            background: colors.primary,
                            border: 'none',
                            fontSize: '14px',
                            color: '#ffffff',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            padding: `${spacing.xs} ${spacing.sm}`,
                            borderRadius: borderRadius.sm,
                          }}
                        >
                          ✓
                        </button>
                        <button
                          onClick={cancelEditCategory}
                          style={{
                            background: colors.border,
                            border: 'none',
                            fontSize: '14px',
                            color: colors.textPrimary,
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            padding: `${spacing.xs} ${spacing.sm}`,
                            borderRadius: borderRadius.sm,
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: '16px', color: colors.textPrimary }}>{category}</span>
                      <div style={{ display: 'flex', gap: spacing.xs }}>
                        <button
                          onClick={() => startEditCategory(category)}
                          style={{
                            background: 'none',
                            border: 'none',
                            fontSize: '18px',
                            color: colors.textSecondary,
                            cursor: 'pointer',
                            padding: spacing.xs,
                          }}
                          title="Edit category"
                        >
                          ✎
                        </button>
                        <button
                          onClick={() => removeCategory(category)}
                          style={{
                            background: 'none',
                            border: 'none',
                            fontSize: '20px',
                            color: colors.danger,
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            padding: spacing.xs,
                          }}
                          title="Delete category"
                        >
                          ✕
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}

              <div style={{ display: 'flex', gap: spacing.sm, marginTop: spacing.md }}>
                <input
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addCategory()}
                  placeholder="New category name"
                  style={{
                    flex: 1,
                    padding: spacing.md,
                    borderRadius: borderRadius.md,
                    border: `2px solid ${colors.border}`,
                    fontSize: '16px',
                    backgroundColor: colors.card,
                    color: colors.textPrimary,
                  }}
                />
                <button
                  onClick={addCategory}
                  style={{
                    padding: `${spacing.sm} ${spacing.lg}`,
                    borderRadius: borderRadius.md,
                    border: 'none',
                    background: colors.primary,
                    color: '#ffffff',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                  }}
                >
                  + Add
                </button>
              </div>
            </div>

            <button
              onClick={savePreferences}
              style={{
                width: '100%',
                padding: spacing.lg,
                borderRadius: borderRadius.lg,
                border: 'none',
                background: colors.primary,
                color: colors.textPrimary,
                fontWeight: 'bold',
                cursor: 'pointer',
                fontSize: '18px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                marginBottom: '50px',
              }}
            >
              💾 Save Preferences
            </button>
          </div>
        )}

        {/* ABOUT TAB */}
        {activeTab === 'about' && (
          <div style={{
            background: colors.card,
            padding: spacing.xl,
            borderRadius: borderRadius.lg,
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          }}>
            <h2 style={{ marginTop: 0, color: colors.textPrimary }}>About PantryPal</h2>
            <div style={{ display: 'grid', gap: spacing.md }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                paddingBottom: spacing.sm,
                borderBottom: `1px solid ${colors.border}`,
              }}>
                <span style={{ color: colors.textSecondary }}>App Version</span>
                <span style={{ color: colors.textPrimary, fontWeight: '600' }}>2.0.0</span>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                paddingBottom: spacing.sm,
                borderBottom: `1px solid ${colors.border}`,
              }}>
                <span style={{ color: colors.textSecondary }}>Current Server</span>
                <span style={{ 
                  color: colors.textPrimary, 
                  fontWeight: '500',
                  wordBreak: 'break-all',
                  textAlign: 'right',
                  maxWidth: '60%',
                }}>
                  {savedUrl}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: colors.textSecondary }}>Platform</span>
                <span style={{ color: colors.textPrimary, fontWeight: '600' }}>Web Dashboard</span>
              </div>
            </div>

            <div style={{
              textAlign: 'center',
              marginTop: spacing.xl,
              paddingTop: spacing.xl,
              borderTop: `1px solid ${colors.border}`,
            }}>
              <div style={{ fontSize: '32px', marginBottom: spacing.sm }}>🥫</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: colors.textPrimary }}>
                PantryPal
              </div>
              <div style={{ fontSize: '14px', color: colors.textSecondary, marginTop: spacing.xs }}>
                Self-hosted pantry management
              </div>
            </div>

            <div style={{
              marginTop: spacing.xl,
              paddingTop: spacing.xl,
              borderTop: `1px solid ${colors.border}`,
            }}>
              <h3 style={{
                marginTop: 0,
                marginBottom: spacing.md,
                color: colors.textPrimary,
                fontSize: '18px',
              }}>
                Part of PalStack
              </h3>
              <p style={{
                color: colors.textSecondary,
                lineHeight: 1.6,
                marginBottom: spacing.md,
              }}>
                PantryPal is part of the <strong style={{ color: colors.textPrimary }}>PalStack</strong> family of self-hosted applications designed to simplify everyday life.
              </p>
              <p style={{
                color: colors.textSecondary,
                lineHeight: 1.6,
                fontStyle: 'italic',
                marginBottom: spacing.md,
              }}>
                "That's what pals do – they show up and help with the everyday stuff."
              </p>
              <p style={{
                color: colors.textSecondary,
                lineHeight: 1.6,
                fontSize: '14px',
              }}>
                PalStack is a collection of practical, privacy-focused tools that help you manage your home, track your inventory, and organize your life – all on your own terms, hosted wherever you choose.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SettingsPage;