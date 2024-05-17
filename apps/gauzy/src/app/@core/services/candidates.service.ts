import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	ICandidateCreateInput,
	ICandidateFindInput,
	ICandidate,
	ICandidateUpdateInput,
	CandidateStatusEnum,
	IBasePerTenantAndOrganizationEntityModel,
	IPagination
} from '@gauzy/contracts';
import { firstValueFrom, Observable } from 'rxjs';
import { toParams } from '@gauzy/ui-sdk/common';
import { API_PREFIX } from '../constants/app.constants';

@Injectable()
export class CandidatesService {
	constructor(private readonly http: HttpClient) {}

	getAll(relations: string[] = [], where: ICandidateFindInput): Observable<IPagination<ICandidate>> {
		return this.http.get<IPagination<ICandidate>>(`${API_PREFIX}/candidate`, {
			params: toParams({ where, relations })
		});
	}

	getCandidateById(id: ICandidate['id'], relations: string[] = [], where?: ICandidateFindInput): Promise<ICandidate> {
		return firstValueFrom(
			this.http.get<ICandidate>(`${API_PREFIX}/candidate/${id}`, {
				params: toParams({ where, relations })
			})
		);
	}

	delete(id: ICandidate['id']): Promise<ICandidate> {
		return firstValueFrom(this.http.delete<ICandidate>(`${API_PREFIX}/candidate/${id}`));
	}

	update(id: ICandidate['id'], body: ICandidateUpdateInput): Promise<ICandidate> {
		return firstValueFrom(this.http.put<ICandidate>(`${API_PREFIX}/candidate/${id}`, body));
	}

	create(body: ICandidateCreateInput): Observable<ICandidate> {
		return this.http.post<ICandidate>(`${API_PREFIX}/candidate`, body);
	}

	createBulk(body: ICandidateCreateInput[]): Observable<ICandidate[]> {
		return this.http.post<ICandidate[]>(`${API_PREFIX}/candidate/bulk`, body);
	}

	/**
	 * Set candidate as archived
	 *
	 * @param id
	 * @param body
	 * @returns
	 */
	setCandidateAsArchived(id: ICandidate['id'], body: IBasePerTenantAndOrganizationEntityModel): Promise<ICandidate> {
		return firstValueFrom(
			this.http.put<ICandidate>(`${API_PREFIX}/candidate/${id}`, {
				isArchived: true,
				...body
			})
		);
	}

	/**
	 * Set candidate hired as employee
	 *
	 * @param id
	 * @returns
	 */
	setCandidateAsHired(id: ICandidate['id']): Promise<ICandidate> {
		return firstValueFrom(this.http.put<ICandidate>(`${API_PREFIX}/candidate/${id}/hired`, {}));
	}

	/**
	 * Set candidate as rejected application
	 *
	 * @param id
	 * @returns
	 */
	setCandidateAsRejected(id: ICandidate['id']): Promise<ICandidate> {
		return firstValueFrom(this.http.put<ICandidate>(`${API_PREFIX}/candidate/${id}/rejected`, {}));
	}

	/**
	 * Set candidate as applied application
	 *
	 * @param id
	 * @returns
	 */
	setCandidateAsApplied(id: ICandidate['id']): Promise<ICandidate> {
		return firstValueFrom(
			this.http.put<ICandidate>(`${API_PREFIX}/candidate/${id}`, {
				status: CandidateStatusEnum.APPLIED
			})
		);
	}
}
