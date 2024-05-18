import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ICandidateExperience, IExperienceCreateInput, IExperienceFindInput, IPagination } from '@gauzy/contracts';
import { toParams } from '@gauzy/ui-sdk/common';
import { API_PREFIX } from '@gauzy/ui-sdk/common';

@Injectable({
	providedIn: 'root'
})
export class CandidateExperienceService {
	constructor(private http: HttpClient) {}

	create(createInput: IExperienceCreateInput): Promise<ICandidateExperience> {
		return firstValueFrom(this.http.post<ICandidateExperience>(`${API_PREFIX}/candidate-experience`, createInput));
	}

	getAll(where?: IExperienceFindInput, relations: string[] = []): Promise<IPagination<ICandidateExperience>> {
		return firstValueFrom(
			this.http.get<IPagination<ICandidateExperience>>(`${API_PREFIX}/candidate-experience`, {
				params: toParams({ where, relations })
			})
		);
	}

	update(id: string, updateInput: any): Promise<any> {
		return firstValueFrom(this.http.put(`${API_PREFIX}/candidate-experience/${id}`, updateInput));
	}

	delete(id: string): Promise<any> {
		return firstValueFrom(this.http.delete(`${API_PREFIX}/candidate-experience/${id}`));
	}
}
