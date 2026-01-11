export interface getClassAttendanceDetail {
    isSuccess: boolean;
    errorCode: number;
    errorMsg: null;
    payload: Payload;
}

export interface Payload {
    course: Course;
    classes: Class[];
    isShowAttendanceRate: boolean;
    totalNumOfClass: number;
    lastUpdatedTimestamp: number;
    emptyMsg: EmptyMsg;
}

export interface Class {
    id: string;
    date: string;
    lessonTime: string;
    attendTime: string;
    roomName: string;
    status: number;
    orderNum: number;
}

export interface Course {
    id: string;
    name: EmptyMsg;
    courseCode: string;
    attendRate: number;
    passRate: number;
    orderNum: number;
}

export interface EmptyMsg {
    en: null | string;
    tc: null | string;
    sc: null | string;
}
