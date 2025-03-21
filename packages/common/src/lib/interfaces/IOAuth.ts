
// OAuth user email
export interface IOAuthEmail {
    value: string;
    verified: boolean;
}

// OAuth info to create a new user
export interface IOAuthCreateUser {
    emails: IOAuthEmail[];
    firstName?: string;
    lastName?: string;
    provider: string;
    picture?: string;
}

// OAuth validate response with login information
export interface IOAuthValidateResponse {
    success: boolean;
    authData: { jwt: string; userId: string };
}