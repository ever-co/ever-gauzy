import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { IEducationCreateInput, ICandidateEducation, IEducationFindInput, IPagination } from '@gauzy/contracts';
import { toParams } from '@gauzy/ui-sdk/common';
import { API_PREFIX } from '../constants/app.constants';

@Injectable({
	providedIn: 'root'
})
export class CandidateEducationsService {
	constructor(private readonly http: HttpClient) {}

	create(createInput: IEducationCreateInput): Promise<ICandidateEducation> {
		return firstValueFrom(this.http.post<ICandidateEducation>(`${API_PREFIX}/candidate-educations`, createInput));
	}

	getAll(where?: IEducationFindInput): Promise<IPagination<ICandidateEducation>> {
		return firstValueFrom(
			this.http.get<IPagination<ICandidateEducation>>(`${API_PREFIX}/candidate-educations`, {
				params: toParams({ where })
			})
		);
	}

	update(id: string, updateInput: any): Promise<any> {
		return firstValueFrom(this.http.put(`${API_PREFIX}/candidate-educations/${id}`, updateInput));
	}

	delete(id: string): Promise<any> {
		return firstValueFrom(this.http.delete(`${API_PREFIX}/candidate-educations/${id}`));
	}
}
