import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	IFeature,
	IFeatureOrganization,
	IFeatureOrganizationUpdateInput,
	IFeatureOrganizationFindInput,
	IPagination
} from '@gauzy/contracts';
import { toParams } from '@gauzy/ui-sdk/common';
import { firstValueFrom, Observable } from 'rxjs';
import { API_PREFIX } from '../../constants/app.constants';

@Injectable()
export class FeatureService {
	API_URL = `${API_PREFIX}/feature/toggle`;

	constructor(private http: HttpClient) {}

	getFeatureToggleDefinition() {
		return firstValueFrom(this.http.get(`${this.API_URL}/definition`));
	}

	getParentFeatures(relations?: string[]): Observable<IPagination<IFeature>> {
		return this.http.get<IPagination<IFeature>>(`${this.API_URL}/parent`, {
			params: toParams({ relations })
		});
	}

	getAllFeatures(): Observable<IPagination<IFeature>> {
		return this.http.get<IPagination<IFeature>>(`${this.API_URL}`);
	}

	getFeatureOrganizations(
		where?: IFeatureOrganizationFindInput,
		relations?: string[]
	): Observable<IPagination<IFeatureOrganization>> {
		return this.http.get<IPagination<IFeatureOrganization>>(`${this.API_URL}/organizations`, {
			params: toParams({ relations, ...where })
		});
	}

	featureToggle(payload: IFeatureOrganizationUpdateInput) {
		return this.http.post(`${this.API_URL}`, payload);
	}
}
