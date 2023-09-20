import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
    providedIn: 'root',
})
export class GithubService {

    constructor(
        private readonly _http: HttpClient
    ) { }
}
