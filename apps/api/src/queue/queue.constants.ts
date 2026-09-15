export const NOTIFICATIONS_QUEUE = "notifications";
export const DATA_EXPORT_QUEUE = "data-export";
export const DOCUMENT_SCAN_QUEUE = "document-scan";

export interface NotificationJobData {
  notificationId: string;
  clinicId: string;
  recipientUserId: string;
}

export interface DataExportJobData {
  requestId: string;
  clinicId: string;
}

export interface DocumentScanJobData {
  documentId: string;
  clinicId: string;
  quarantineKey: string;
}
