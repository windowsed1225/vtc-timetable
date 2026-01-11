export interface getTimeTableAndReminderList {
    isSuccess: boolean;
    errorCode: number;
    errorMsg: null;
    payload: Payload;
}

export interface Payload {
    timetable: Exam;
    exam: Exam;
    currentTimestamp: number;
    lastUpdatedTimestamp: number;
    isDropDB: boolean;
    holiday: Exam;
    personal: Exam;
}

export interface Exam {
    add: Add[];
    delete: any[];
    update: any[];
}

export interface Add {
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
