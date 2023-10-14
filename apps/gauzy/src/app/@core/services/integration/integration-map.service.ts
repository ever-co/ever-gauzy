import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
    providedIn: 'root'
})
export class IntegrationMapService {

    constructor(
        private readonly _http: HttpClient
    ) { }
}
