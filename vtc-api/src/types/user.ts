export interface userResponse {
    isSuccess: boolean;
    errorCode: number;
    errorMsg: null;
    payload: Payload;
}

export interface Payload {
    id: string;
    name: string;
    email: string;
    vtcID: string;
    userImageID: null;
    userType: number;
    LanguagePreference: string;
    LastAccessTime: number;
    RegistrationDate: number;
    site: string;
}
