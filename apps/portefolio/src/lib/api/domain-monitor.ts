// src/lib/api/domain-monitor.ts

// Default API configuration using environment variables
const DEFAULT_API_URL = '/api/domain-monitor';
// Create WebSocket URL using environment variable or fallback
const DEFAULT_WS_URL = typeof window !== 'undefined' 
  ? (process.env.NEXT_PUBLIC_DOMAIN_WS_URL || `ws://${window.location.hostname}:3002`) 
  : 'ws://localhost:3002';

// Set API URLs based on environment or defaults
export const API_URL = process.env.NEXT_PUBLIC_DOMAIN_API_URL || DEFAULT_API_URL;
export const WS_URL = DEFAULT_WS_URL;

/**
 * Domain status interface
 */
export interface DomainStatus {
  isWebsiteUp: boolean;
  isRegistered: boolean;
  registrar: string | null;
  expirationDate: string | null;
  metadata: Record<string, unknown>;
  timestamp: string;
}

/**
 * Domain interface
 */
export interface Domain {
  name: string;
  preferredRegistrar: string;
  lastChecked: string | null;
  lastStatus: DomainStatus | null;
  isActive: boolean;
  history: {
    timestamp: string;
    status: DomainStatus;
  }[];
}

/**
 * API response interfaces
 */
interface ApiResponse {
  success: boolean;
  message?: string;
}

interface DomainsResponse extends ApiResponse {
  domains: Domain[];
}

interface DomainResponse extends ApiResponse {
  domain: Domain;
}

/**
 * Domain Monitor API client
 */
export class DomainMonitorApi {
  private baseUrl: string;

  constructor(baseUrl = API_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Get all domains
   * @returns Promise<Domain[]>
   */
  async getDomains(): Promise<Domain[]> {
    try {
      const response = await fetch(`${this.baseUrl}/domains`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data: DomainsResponse = await response.json();
      return data.domains || [];
    } catch (error) {
      console.error('Error fetching domains:', error);
      throw error;
    }
  }

  /**
   * Add a new domain
   * @param name Domain name
   * @param preferredRegistrar Preferred registrar
   * @returns Promise<Domain>
   */
  async addDomain(name: string, preferredRegistrar = 'Default'): Promise<Domain> {
    try {
      const response = await fetch(`${this.baseUrl}/domains`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          preferredRegistrar,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! Status: ${response.status}`);
      }
      
      const data: DomainResponse = await response.json();
      return data.domain;
    } catch (error) {
      console.error('Error adding domain:', error);
      throw error;
    }
  }

  /**
   * Delete a domain
   * @param domainName Domain name
   * @returns Promise<void>
   */
  async deleteDomain(domainName: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/domains/${encodeURIComponent(domainName)}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      return;
    } catch (error) {
      console.error('Error deleting domain:', error);
      throw error;
    }
  }

  /**
   * Force check a domain
   * @param domainName Domain name
   * @returns Promise<Domain>
   */
  async checkDomain(domainName: string): Promise<Domain> {
    try {
      const response = await fetch(`${this.baseUrl}/domains/${encodeURIComponent(domainName)}/check`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data: DomainResponse = await response.json();
      return data.domain;
    } catch (error) {
      console.error('Error checking domain:', error);
      throw error;
    }
  }

  /**
   * Create a WebSocket connection for real-time updates
   * Note: Simplified version that connects directly to the backend WebSocket
   */
  createWebSocketConnection(
    onMessage: (data: Record<string, unknown>) => void,
    onOpen?: () => void,
    onClose?: () => void,
    onError?: (error: Event) => void
  ): WebSocket {
    // Only run on client side
    if (typeof window === 'undefined') {
      throw new Error('WebSocket can only be created on the client side');
    }

    try {
      // Log the WS URL for debugging
      console.log(`Attempting to connect to WebSocket at: ${WS_URL}`);
      
      const socket = new WebSocket(WS_URL);
      
      socket.onopen = () => {
        console.log('WebSocket connection established');
        if (onOpen) onOpen();
      };
      
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as Record<string, unknown>;
          onMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      socket.onclose = (event) => {
        console.log(`WebSocket connection closed: Code: ${event.code}, Reason: ${event.reason}`);
        if (onClose) onClose();
      };
      
      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        if (onError) onError(error);
      };
      
      return socket;
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      throw error;
    }
  }
}

// Export a singleton instance
export const domainApi = new DomainMonitorApi();