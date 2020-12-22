import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IFeature, IFeatureOrganization } from '@gauzy/models';
import { toParams } from '@gauzy/utils';

@Injectable()
export class FeatureService {
	API_URL = '/api/feature/toggle';

	constructor(private http: HttpClient) {}

	getFeatureToggles() {
		return this.http.get(`${this.API_URL}`).toPromise();
	}

	getFeatures(
		relations?: string[]
	): Promise<{ items: IFeature[]; total: number }> {
		const data = { relations };
		return this.http
			.get<{ items: IFeature[]; total: number }>(`${this.API_URL}/all`, {
				params: toParams({ data })
			})
			.toPromise();
	}

	getFeatureOrganizations(): Promise<IFeatureOrganization[]> {
		return this.http
			.get<IFeatureOrganization[]>(`${this.API_URL}/organizations`)
			.toPromise();
	}
}
