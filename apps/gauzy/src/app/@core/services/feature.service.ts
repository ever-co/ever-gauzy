import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IFeature } from '@gauzy/models';

@Injectable()
export class FeatureService {
	API_URL = '/api/feature';

	constructor(private http: HttpClient) {}

	getFeatures(): Promise<{ items: IFeature[]; total: number }> {
		return this.http
			.get<{ items: IFeature[]; total: number }>(`${this.API_URL}/all`)
			.toPromise();
	}
}
