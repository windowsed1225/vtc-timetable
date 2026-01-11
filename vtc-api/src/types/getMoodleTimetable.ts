export interface getMoodleTimetable {
    isSuccess: boolean;
    errorCode: number;
    errorMsg: null;
    payload: {
        id: number;
        name: string;
        timeStart: number;
        timeDuration: number;
        timeEnd: number;
        courseFullName: string;
        courseShortName: string;
        courseUrl: string;
        actionName: string;
        actionUrl: string;
    }[];
}
