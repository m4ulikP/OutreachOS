export interface CalendarMeeting {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  meetUrl?: string;
  attendeeEmail: string;
}

export interface CalendarProvider {
  readonly name: string;
  isConfigured(): boolean;
  getUpcomingMeetings(userId: string): Promise<CalendarMeeting[]>;
  createMeetingLink(userId: string, durationMinutes: number): Promise<string>;
}
