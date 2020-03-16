import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable()
export class InvoicesService {
	constructor(private http: HttpClient) {}
}
