export interface TimetableEvent {
  id: string;
  courseCode: string;
  courseTitle: string;
  lessonType: string;
  campusCode: string;
  roomNum: string;
  weekNum: string;
  lecturerName: string;
  startTime: number;
  endTime: number;
}

import type { SemesterType } from "@/lib/semester";
export type { SemesterType };
export type EventStatusType = "UPCOMING" | "FINISHED" | "CANCELED" | "RESCHEDULED" | "ABSENT";
/** Display tag written as `SEM ${n}` in the calendar UI. */
export type SemesterTag = `SEM ${SemesterType}` | string;

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
    semester?: string;
    status?: EventStatusType;
    vtc_id?: string;
    actualDuration?: number;
    scheduledDuration?: number;
    isAdjusted?: boolean;
    attendanceStatusCode?: number | null;
    eventType?: "class" | "deadline";
    actionUrl?: string;
    courseUrl?: string;
  };
}
