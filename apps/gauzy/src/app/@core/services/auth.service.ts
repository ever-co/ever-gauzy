import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import { User, RolesEnum, UserRegistrationInput as IUserRegistrationInput } from '@gauzy/models';
import { Observable } from 'rxjs';

@Injectable()
export class AuthService {
    constructor(
        private http: HttpClient
    ) { }

    isAuthenticated(): Promise<boolean> {
        return this.http.get<boolean>('/api/auth/authenticated').pipe(first()).toPromise();
    }

    login(loginInput): Observable<{ user?: User, token?: string }> {
        return this.http.post<{ user?: User, token?: string }>('/api/auth/login', loginInput);
    }

    register(registerInput: IUserRegistrationInput): Observable<User> {
        return this.http.post<User>('/api/auth/register', registerInput);
    }

    hasRole(roles: RolesEnum[]): Observable<boolean> {
        return this.http.get<boolean>(`/api/auth/role`, { params: { roles } });
    }
}