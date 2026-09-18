export interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface EmailProvider {
  readonly name: string;
  readonly isConfigured: boolean;
  sendEmail(options: SendEmailOptions): Promise<SendEmailResult>;
}
