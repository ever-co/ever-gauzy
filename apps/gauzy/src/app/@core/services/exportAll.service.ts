import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';

@Injectable()
export class ExportAllService {
	constructor(private http: HttpClient) {}

	downloadAllData(): Promise<{}> {
		return this.http
			.get<{}>(`/api/download`, {})
			.pipe(first())
			.toPromise();
	}
}
