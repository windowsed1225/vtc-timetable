export interface TimetableEvent {
  id: string;
  courseCode: string;
  courseTitle: string;
  lessonType: string;
  campusCode: string;
  roomNum: string;
  weekNum: string;
  lecturerName: string;
  startTime: number;      // Unix timestamp (seconds)
  endTime: number;        // Unix timestamp (seconds)
}

export interface CalendarEvent {
  title: string;
  start: Date;
  end: Date;
  resource?: {
    courseCode: string;
    courseTitle: string;
    location?: string;
    lessonType?: string;
    lecturer?: string;
    colorIndex?: number;
  };
}

