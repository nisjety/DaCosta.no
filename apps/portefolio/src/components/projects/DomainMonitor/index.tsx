// src/components/projects/DomainMonitor/index.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Domain, domainApi } from '@/lib/api/domain-monitor';

// Add type declaration for the window object to include WebSocket property
declare global {
  interface Window {
    domainMonitorWebSocket?: WebSocket;
  }
}

const DomainMonitor: React.FC = () => {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newDomainName, setNewDomainName] = useState('');
  const [newRegistrar, setNewRegistrar] = useState('Default');
  const [isConnected, setIsConnected] = useState(false);
  const [latestEvent, setLatestEvent] = useState<string | null>(null);
  const socketRef = React.useRef<WebSocket | null>(null);

  // Fetch domains from API
  const fetchDomains = useCallback(async () => {
    try {
      setLoading(true);
      const domainList = await domainApi.getDomains();
      setDomains(domainList);
      setError(null);
    } catch (error: unknown) {
      console.error('Error fetching domains:', error);
      setError('Failed to load domains. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Setup WebSocket connection for real-time updates
  const setupWebSocket = useCallback(() => {
    try {
      // Create socket connection using our API
      const socket = domainApi.createWebSocketConnection(
        // Message handler
        (data) => {
          const eventType = data.type as string;
          setLatestEvent(`Event: ${eventType} - ${new Date().toLocaleTimeString()}`);
          
          // Refresh domains list when certain events are received
          if (['domain.added', 'domain.updated', 'domain.status.changed', 
               'domain.deleted', 'domain.became.available', 'monitoring.completed'].includes(eventType)) {
            fetchDomains();
          }
        },
        // Open handler
        () => setIsConnected(true),
        // Close handler
        () => {
          setIsConnected(false);
          // Try to reconnect after 5 seconds
          setTimeout(setupWebSocket, 5000);
        },
        // Error handler
        () => setIsConnected(false)
      );
      
      // Store the socket in our ref for cleanup
      socketRef.current = socket;
    } catch (error: unknown) {
      console.error('Failed to create WebSocket connection:', error);
    }
  }, [fetchDomains]);

  // Fetch domains on component mount
  useEffect(() => {
    fetchDomains();
    setupWebSocket();
    
    return () => {
      // Cleanup WebSocket connection when component unmounts
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [fetchDomains, setupWebSocket]);

  // Add a new domain
  const addDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newDomainName.trim()) {
      setError('Please enter a domain name');
      return;
    }
    
    try {
      setLoading(true);
      await domainApi.addDomain(newDomainName, newRegistrar);
      
      // Clear form and refresh domains
      setNewDomainName('');
      setNewRegistrar('Default');
      fetchDomains();
    } catch (error: unknown) {
      console.error('Error adding domain:', error);
      setError(error instanceof Error ? error.message : 'Failed to add domain. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Delete a domain
  const deleteDomain = async (domainName: string) => {
    if (!confirm(`Are you sure you want to delete ${domainName}?`)) {
      return;
    }
    
    try {
      setLoading(true);
      await domainApi.deleteDomain(domainName);
      fetchDomains();
    } catch (error: unknown) {
      console.error('Error deleting domain:', error);
      setError('Failed to delete domain. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Force check a domain
  const checkDomain = async (domainName: string) => {
    try {
      setLoading(true);
      await domainApi.checkDomain(domainName);
      fetchDomains();
    } catch (error: unknown) {
      console.error('Error checking domain:', error);
      setError('Failed to check domain. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Get status badge color
  const getStatusColor = (domain: Domain) => {
    if (!domain.lastStatus) return 'bg-gray-500';
    
    // Determine status directly from properties instead of using getStatusDescription method
    const status = domain.lastStatus.isRegistered 
      ? (domain.lastStatus.isWebsiteUp ? 'active' : 'registered-down') 
      : 'available';
        
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'registered-down': return 'bg-yellow-500';
      case 'available': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  // Format date
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-100 py-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-800">Add Domain</h2>
                <div className={`h-3 w-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} 
                     title={isConnected ? 'Connected' : 'Disconnected'}></div>
              </div>
              
              {error && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4 text-red-700">
                  <p>{error}</p>
                </div>
              )}
              
              <form onSubmit={addDomain} className="space-y-4">
                <div>
                  <label htmlFor="domainName" className="block text-sm font-medium text-gray-700 mb-1">
                    Domain Name
                  </label>
                  <input
                    type="text"
                    id="domainName"
                    value={newDomainName}
                    onChange={(e) => setNewDomainName(e.target.value)}
                    placeholder="example.com"
                    className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="registrar" className="block text-sm font-medium text-gray-700 mb-1">
                    Preferred Registrar
                  </label>
                  <select
                    id="registrar"
                    value={newRegistrar}
                    onChange={(e) => setNewRegistrar(e.target.value)}
                    className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="Default">Default</option>
                    <option value="Namecheap">Namecheap</option>
                    <option value="GoDaddy">GoDaddy</option>
                    <option value="Google Domains">Google Domains</option>
                    <option value="Domeneshop">Domeneshop</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {loading ? 'Adding...' : 'Add Domain'}
                </button>
              </form>
              
              {latestEvent && (
                <div className="mt-4 p-2 bg-gray-50 rounded-md text-xs text-gray-600">
                  {latestEvent}
                </div>
              )}
            </div>
            
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Statistics</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-blue-600">Total Domains</p>
                  <p className="text-2xl font-bold text-blue-800">{domains.length}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-green-600">Active Domains</p>
                  <p className="text-2xl font-bold text-green-800">
                    {domains.filter(d => d.isActive).length}
                  </p>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <p className="text-sm text-yellow-600">Registered</p>
                  <p className="text-2xl font-bold text-yellow-800">
                    {domains.filter(d => d.lastStatus?.isRegistered).length}
                  </p>
                </div>
                <div className="bg-indigo-50 p-4 rounded-lg">
                  <p className="text-sm text-indigo-600">Available</p>
                  <p className="text-2xl font-bold text-indigo-800">
                    {domains.filter(d => d.lastStatus && !d.lastStatus.isRegistered).length}
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Main content */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Domain Monitor</h1>
                <button
                  onClick={() => fetchDomains()}
                  disabled={loading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-md transition duration-200 flex items-center space-x-2 disabled:opacity-70"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Refresh</span>
                </button>
              </div>
              
              {loading && domains.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="mx-auto h-12 w-12 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <p className="mt-4 text-gray-500">Loading domains...</p>
                </div>
              ) : domains.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="mt-4 text-gray-500">No domains found. Add your first domain to start monitoring!</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Domain
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Registrar
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Last Checked
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {domains.map((domain) => (
                        <tr key={domain.name} className="hover:bg-gray-50">
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div>
                                <div className="text-sm font-medium text-gray-900">{domain.name}</div>
                                <div className="text-xs text-gray-500">
                                  Preferred: {domain.preferredRegistrar}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(domain)} text-white`}>
                              {domain.lastStatus 
                                ? (domain.lastStatus.isRegistered 
                                   ? (domain.lastStatus.isWebsiteUp ? 'Active' : 'Down') 
                                   : 'Available')
                                : 'Unknown'}
                            </span>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {domain.lastStatus?.registrar || 'N/A'}
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(domain.lastChecked)}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex space-x-2">
                              <button
                                onClick={() => checkDomain(domain.name)}
                                className="text-indigo-600 hover:text-indigo-900 transition duration-200"
                              >
                                Check
                              </button>
                              <button
                                onClick={() => deleteDomain(domain.name)}
                                className="text-red-600 hover:text-red-900 transition duration-200"
                              >
                                Delete
                              </button>
                            </div>
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
      </div>
    </div>
  );
};

export default DomainMonitor;