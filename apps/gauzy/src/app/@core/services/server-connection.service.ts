import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import { ReportService } from '../../pages/reports/all-report/report.server';

@Injectable()
export class ServerConnectionService {
	constructor(
		private readonly httpClient: HttpClient,
		private readonly reportService: ReportService
	) {}

	load(endPoint: string, store: { serverConnection: string }) {
		return new Promise(async (resolve, reject) => {
			await this.checkServerConnection(endPoint, store);
			resolve(true);
		});
	}

	async checkServerConnection(
		endPoint: string,
		store: { serverConnection: string }
	) {
		try {
			await this.httpClient.get(endPoint).pipe(first()).toPromise();
		} catch (error) {
			store.serverConnection = error.status;
		}
	}
}
