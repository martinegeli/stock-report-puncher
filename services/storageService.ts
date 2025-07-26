import type { 
  FinancialDataStorage, 
  ParsedFinancialDocument, 
  StorageOperationResult 
} from '../types';

/**
 * Storage service for managing intermediate financial data between file parsing and Gemini processing.
 * Supports both in-memory storage (for browser sessions) and integration with Google Drive for persistence.
 */
class FinancialDataStorageService {
  private sessions: Map<string, FinancialDataStorage> = new Map();
  private readonly STORAGE_PREFIX = 'financial_data_';
  
  /**
   * Creates a new storage session for a company's financial data
   */
  createSession(companyName: string, stockTicker?: string): string {
    const sessionId = this.generateSessionId();
    const session: FinancialDataStorage = {
      sessionId,
      companyName,
      stockTicker,
      documents: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'parsing'
    };
    
    this.sessions.set(sessionId, session);
    this.persistToLocalStorage(sessionId, session);
    
    return sessionId;
  }

  /**
   * Adds a parsed financial document to an existing session
   */
  addDocument(
    sessionId: string, 
    document: Omit<ParsedFinancialDocument, 'id' | 'parsedAt'>
  ): StorageOperationResult {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return {
        success: false,
        message: `Session ${sessionId} not found`
      };
    }

    const fullDocument: ParsedFinancialDocument = {
      ...document,
      id: this.generateDocumentId(),
      parsedAt: new Date()
    };

    session.documents.push(fullDocument);
    session.updatedAt = new Date();
    
    // Auto-update status based on document count
    if (session.documents.length > 0 && session.status === 'parsing') {
      session.status = 'ready_for_gemini';
    }

    this.sessions.set(sessionId, session);
    this.persistToLocalStorage(sessionId, session);

    return {
      success: true,
      message: 'Document added successfully',
      data: fullDocument
    };
  }

  /**
   * Sets the existing sheet data context for Gemini processing
   */
  setExistingSheetData(sessionId: string, sheetData: string[][]): StorageOperationResult {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return {
        success: false,
        message: `Session ${sessionId} not found`
      };
    }

    session.existingSheetData = sheetData;
    session.updatedAt = new Date();
    
    this.sessions.set(sessionId, session);
    this.persistToLocalStorage(sessionId, session);

    return {
      success: true,
      message: 'Existing sheet data updated'
    };
  }

  /**
   * Updates the session status
   */
  updateStatus(sessionId: string, status: FinancialDataStorage['status']): StorageOperationResult {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return {
        success: false,
        message: `Session ${sessionId} not found`
      };
    }

    session.status = status;
    session.updatedAt = new Date();
    
    this.sessions.set(sessionId, session);
    this.persistToLocalStorage(sessionId, session);

    return {
      success: true,
      message: `Status updated to ${status}`
    };
  }

  /**
   * Retrieves a storage session by ID
   */
  getSession(sessionId: string): FinancialDataStorage | null {
    const session = this.sessions.get(sessionId);
    if (session) {
      return session;
    }

    // Try to load from localStorage
    const stored = this.loadFromLocalStorage(sessionId);
    if (stored) {
      this.sessions.set(sessionId, stored);
      return stored;
    }

    return null;
  }

  /**
   * Gets all documents from a session, optionally filtered by type
   */
  getDocuments(
    sessionId: string, 
    documentType?: ParsedFinancialDocument['documentType']
  ): ParsedFinancialDocument[] {
    const session = this.getSession(sessionId);
    if (!session) {
      return [];
    }

    if (documentType) {
      return session.documents.filter(doc => doc.documentType === documentType);
    }

    return session.documents;
  }

  /**
   * Gets consolidated data ready for Gemini processing
   */
  getConsolidatedData(sessionId: string): {
    documents: ParsedFinancialDocument[];
    existingSheetData?: string[][];
    operationType: 'create' | 'update';
    allPeriods: string[];
  } | null {
    const session = this.getSession(sessionId);
    if (!session) {
      return null;
    }

    // Determine operation type based on existing sheet data
    const operationType = (session.existingSheetData && session.existingSheetData.length > 1) 
      ? 'update' 
      : 'create';

    // Collect all unique periods from documents
    const allPeriods = new Set<string>();
    session.documents.forEach(doc => {
      doc.periods.forEach(period => allPeriods.add(period));
    });

    return {
      documents: session.documents,
      existingSheetData: session.existingSheetData,
      operationType,
      allPeriods: Array.from(allPeriods).sort()
    };
  }

  /**
   * Removes a document from a session
   */
  removeDocument(sessionId: string, documentId: string): StorageOperationResult {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return {
        success: false,
        message: `Session ${sessionId} not found`
      };
    }

    const initialLength = session.documents.length;
    session.documents = session.documents.filter(doc => doc.id !== documentId);
    
    if (session.documents.length === initialLength) {
      return {
        success: false,
        message: `Document ${documentId} not found`
      };
    }

    session.updatedAt = new Date();
    this.sessions.set(sessionId, session);
    this.persistToLocalStorage(sessionId, session);

    return {
      success: true,
      message: 'Document removed successfully'
    };
  }

  /**
   * Clears a session
   */
  clearSession(sessionId: string): StorageOperationResult {
    const exists = this.sessions.has(sessionId);
    this.sessions.delete(sessionId);
    this.removeFromLocalStorage(sessionId);

    return {
      success: true,
      message: exists ? 'Session cleared' : 'Session did not exist'
    };
  }

  /**
   * Lists all active sessions
   */
  listSessions(): FinancialDataStorage[] {
    // Load any sessions from localStorage that aren't in memory
    this.loadAllFromLocalStorage();
    return Array.from(this.sessions.values()).sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
    );
  }

  /**
   * Saves session data to Google Drive (as JSON file)
   */
  async saveToGoogleDrive(sessionId: string): Promise<StorageOperationResult> {
    const session = this.getSession(sessionId);
    if (!session) {
      return {
        success: false,
        message: `Session ${sessionId} not found`
      };
    }

    try {
      const jsonData = JSON.stringify(session, null, 2);
      const fileName = `financial_data_${session.companyName}_${sessionId}.json`;
      
      // Create a blob and file for Google Drive upload
      const blob = new Blob([jsonData], { type: 'application/json' });
      const file = new File([blob], fileName, { type: 'application/json' });
      
      // Integration point: This would use your existing Google Drive API
      // to upload the session data to a specific folder (e.g., STORAGE folder)
      console.log(`Saving ${fileName} to Google Drive (${jsonData.length} bytes)`);
      
      // For full integration, you would call something like:
      // const driveFileId = await uploadFileToGoogleDrive(file, 'STORAGE');
      
      return {
        success: true,
        message: 'Session saved to Google Drive',
        data: { fileName, size: jsonData.length }
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to save to Google Drive: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Loads session data from Google Drive
   */
  async loadFromGoogleDrive(fileName: string): Promise<StorageOperationResult> {
    try {
      // TODO: Implement actual Google Drive download using existing googleService
      console.log(`Would load ${fileName} from Google Drive`);
      
      return {
        success: false,
        message: 'Google Drive integration not yet implemented'
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to load from Google Drive: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Private helper methods
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateDocumentId(): string {
    return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private persistToLocalStorage(sessionId: string, session: FinancialDataStorage): void {
    try {
      const key = `${this.STORAGE_PREFIX}${sessionId}`;
      localStorage.setItem(key, JSON.stringify({
        ...session,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
        documents: session.documents.map(doc => ({
          ...doc,
          parsedAt: doc.parsedAt.toISOString()
        }))
      }));
    } catch (error) {
      console.warn('Failed to persist session to localStorage:', error);
    }
  }

  private loadFromLocalStorage(sessionId: string): FinancialDataStorage | null {
    try {
      const key = `${this.STORAGE_PREFIX}${sessionId}`;
      const stored = localStorage.getItem(key);
      if (!stored) return null;

      const parsed = JSON.parse(stored);
      return {
        ...parsed,
        createdAt: new Date(parsed.createdAt),
        updatedAt: new Date(parsed.updatedAt),
        documents: parsed.documents.map((doc: any) => ({
          ...doc,
          parsedAt: new Date(doc.parsedAt)
        }))
      };
    } catch (error) {
      console.warn('Failed to load session from localStorage:', error);
      return null;
    }
  }

  private removeFromLocalStorage(sessionId: string): void {
    try {
      const key = `${this.STORAGE_PREFIX}${sessionId}`;
      localStorage.removeItem(key);
    } catch (error) {
      console.warn('Failed to remove session from localStorage:', error);
    }
  }

  private loadAllFromLocalStorage(): void {
    try {
      const keys = Object.keys(localStorage).filter(key => key.startsWith(this.STORAGE_PREFIX));
      keys.forEach(key => {
        const sessionId = key.replace(this.STORAGE_PREFIX, '');
        if (!this.sessions.has(sessionId)) {
          const session = this.loadFromLocalStorage(sessionId);
          if (session) {
            this.sessions.set(sessionId, session);
          }
        }
      });
    } catch (error) {
      console.warn('Failed to load sessions from localStorage:', error);
    }
  }
}

// Export singleton instance
export const storageService = new FinancialDataStorageService();
export default storageService;