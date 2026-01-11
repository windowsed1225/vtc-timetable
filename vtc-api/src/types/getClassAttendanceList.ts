export interface getClassAttendanceList {
    isSuccess: boolean;
    errorCode: number;
    errorMsg: null;
    payload: Payload;
}

export interface Payload {
    courses: Course[];
    isShowAttendanceRate: boolean;
    totalNumOfCourse: number;
    emptyMsg: EmptyMsg;
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
