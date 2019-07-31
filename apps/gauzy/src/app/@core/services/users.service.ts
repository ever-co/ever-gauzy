import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { User } from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable()
export class UsersService {

    constructor(
        private http: HttpClient
    ) { }

    getUserById(id: string): Promise<User> {
        return this.http.get<User>(`/api/user/${id}`).pipe(first()).toPromise()
    }

    update() { // TODO: Implement me!

    }
}