import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	IFeature,
	IFeatureOrganization,
	IFeatureOrganizationUpdateInput,
	IFeatureOrganizationFindInput
} from '@gauzy/contracts';
import { toParams } from '@gauzy/common-angular';
import { Observable } from 'rxjs';
import { API_PREFIX } from '../../constants/app.constants';

@Injectable()
export class FeatureService {
	API_URL = `${API_PREFIX}/feature/toggle`;

	constructor(private http: HttpClient) {}

	getFeatureToggles() {
		return this.http.get(`${this.API_URL}`).toPromise();
	}

	getParentFeatures(
		relations?: string[]
	): Observable<{ items: IFeature[]; total: number }> {
		const data = { relations };
		return this.http.get<{ items: IFeature[]; total: number }>(
			`${this.API_URL}/parent`,
			{
				params: toParams({ data })
			}
		);
	}

	getAllFeatures(): Observable<{ items: IFeature[]; total: number }> {
		return this.http.get<{ items: IFeature[]; total: number }>(
			`${this.API_URL}/all`
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

	featureToggle(payload: IFeatureOrganizationUpdateInput) {
		return this.http.post(`${this.API_URL}`, payload);
	}
}
