import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	IFeature,
	IFeatureOrganization,
	IFeatureOrganizationUpdateInput,
	IFeatureOrganizationFindInput,
	IPagination
} from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';
import { firstValueFrom, Observable } from 'rxjs';

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
