export interface SendEmailOptions {
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  trackingId?: string;
}

export interface SendEmailResult {
  messageId: string;
  status: "SENT" | "QUEUED" | "FAILED";
  error?: string;
}

export interface EmailProvider {
  readonly name: string;
  isConfigured(): boolean;
  sendEmail(options: SendEmailOptions): Promise<SendEmailResult>;
}
