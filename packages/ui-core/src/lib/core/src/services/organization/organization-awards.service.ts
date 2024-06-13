import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IOrganizationAwardCreateInput, IOrganizationAward, IOrganizationAwardFindInput } from '@gauzy/contracts';
import { firstValueFrom } from 'rxjs';
import { API_PREFIX } from '@gauzy/ui-core/common';

@Injectable({
	providedIn: 'root'
})
export class OrganizationAwardsService {
	constructor(private http: HttpClient) {}

	create(createInput: IOrganizationAwardCreateInput): Promise<IOrganizationAward> {
		return firstValueFrom(this.http.post<IOrganizationAward>(`${API_PREFIX}/organization-awards`, createInput));
	}

	getAll(
		findInput?: IOrganizationAwardFindInput,
		relations?: string[]
	): Promise<{ items: IOrganizationAward[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });
		return firstValueFrom(
			this.http.get<{ items: IOrganizationAward[]; total: number }>(`${API_PREFIX}/organization-awards`, {
				params: { data }
			})
		);
	}

	update(id: string, updateInput: any): Promise<any> {
		return firstValueFrom(this.http.put(`${API_PREFIX}/organization-awards/${id}`, updateInput));
	}

	delete(id: string): Promise<any> {
		return firstValueFrom(this.http.delete(`${API_PREFIX}/organization-awards/${id}`));
	}
}
