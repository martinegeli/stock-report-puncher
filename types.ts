export interface FinancialDataItem {
  period: string;
  lineItem: string;
  value: string;
  sourceDocument?: string;
}

export interface StockFolder {
  id: string;
  name: string;
  sheetId?: string;
  sheetUrl?: string;
}

export enum AppView {
  AUTHENTICATING,
  SELECTION_MENU,
  EXISTING_STOCK_LIST,
  NEW_STOCK_FORM,
  UPLOADING,
  PROCESSING,
  SUCCESS,
  ERROR,
}

export enum GoogleAuthStatus {
  LOADING,
  SIGNED_IN,
  SIGNED_OUT,
  ERROR,
}
