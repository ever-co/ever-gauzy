import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Email } from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable({
	providedIn: 'root'
})
export class EmailService {
	constructor(private http: HttpClient) {}

	getAll(): Promise<{ items: Email[]; total: number }> {
		return this.http
			.get<{ items: Email[]; total: number }>(`/api/email`)
			.pipe(first())
			.toPromise();
	}
}
