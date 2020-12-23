import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	IFeature,
	IFeatureOrganization,
	IFeatureOrganizationCreateInput,
	IFeatureOrganizationFindInput
} from '@gauzy/models';
import { toParams } from '@gauzy/utils';
import { Observable } from 'rxjs';

@Injectable()
export class FeatureService {
	API_URL = '/api/feature/toggle';

	constructor(private http: HttpClient) {}

	getFeatureToggles() {
		return this.http.get(`${this.API_URL}`).toPromise();
	}

	getFeatures(
		relations?: string[]
	): Observable<{ items: IFeature[]; total: number }> {
		const data = { relations };
		return this.http.get<{ items: IFeature[]; total: number }>(
			`${this.API_URL}/all`,
			{
				params: toParams({ data })
			}
		);
	}

	getFeatureOrganizations(
		findInput?: IFeatureOrganizationFindInput,
		relations?: string[]
	): Observable<IFeatureOrganization[]> {
		const data = { relations, findInput };
		return this.http.get<IFeatureOrganization[]>(
			`${this.API_URL}/organizations`,
			{
				params: toParams({ data })
			}
		);
	}

	featureAction(payload: IFeatureOrganizationCreateInput) {
		return this.http.post(`${this.API_URL}/action`, payload);
	}
}
