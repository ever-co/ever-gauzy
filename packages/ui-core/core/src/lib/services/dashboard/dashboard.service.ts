import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ID, IDashboard, IDashboardCreateInput, IDashboardUpdateInput, IPagination } from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';

/**
 * API client for the `/api/dashboard` endpoints (custom user dashboards).
 */
@Injectable({
	providedIn: 'root'
})
export class DashboardService {
	DASHBOARD_URL = `${API_PREFIX}/dashboard`;

	constructor(private readonly http: HttpClient) {}

	/**
	 * Retrieves dashboards matching the provided find options.
	 *
	 * @param params - Find options (e.g. `{ where: { organizationId, tenantId, createdByUserId } }`).
	 * @returns A promise resolving to the paginated list of dashboards.
	 */
	findAll(params?: any): Promise<IPagination<IDashboard>> {
		return firstValueFrom(
			this.http.get<IPagination<IDashboard>>(this.DASHBOARD_URL, {
				params: toParams(params)
			})
		);
	}

	/**
	 * Retrieves a single dashboard by its ID.
	 *
	 * @param id - The dashboard ID.
	 * @param params - Optional additional find options.
	 * @returns A promise resolving to the dashboard.
	 */
	findById(id: ID, params?: any): Promise<IDashboard> {
		return firstValueFrom(
			this.http.get<IDashboard>(`${this.DASHBOARD_URL}/${id}`, {
				// The endpoint's BaseQueryDTO rejects an empty `where`,
				// so always send at least the id filter.
				params: toParams(params ?? { where: { id } })
			})
		);
	}

	/**
	 * Creates a new dashboard.
	 *
	 * @param input - The dashboard creation input.
	 * @returns A promise resolving to the created dashboard.
	 */
	create(input: IDashboardCreateInput): Promise<IDashboard> {
		return firstValueFrom(this.http.post<IDashboard>(this.DASHBOARD_URL, input));
	}

	/**
	 * Updates an existing dashboard.
	 *
	 * @param id - The dashboard ID.
	 * @param input - The dashboard update input.
	 * @returns A promise resolving to the updated dashboard.
	 */
	update(id: ID, input: IDashboardUpdateInput): Promise<IDashboard> {
		return firstValueFrom(this.http.put<IDashboard>(`${this.DASHBOARD_URL}/${id}`, input));
	}

	/**
	 * Deletes a dashboard by its ID.
	 *
	 * @param id - The dashboard ID.
	 * @returns A promise resolving when the dashboard is deleted.
	 */
	delete(id: ID): Promise<any> {
		return firstValueFrom(this.http.delete(`${this.DASHBOARD_URL}/${id}`));
	}
}
