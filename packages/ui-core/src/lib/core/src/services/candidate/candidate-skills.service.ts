import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ICandidateSkillCreateInput, ISkill, ICandidateSkillFindInput, IPagination } from '@gauzy/contracts';
import { toParams } from '@gauzy/ui-core/common';
import { API_PREFIX } from '@gauzy/ui-core/common';

@Injectable({
	providedIn: 'root'
})
export class CandidateSkillsService {
	constructor(private http: HttpClient) {}

	create(createInput: ICandidateSkillCreateInput): Promise<ISkill> {
		return firstValueFrom(this.http.post<ISkill>(`${API_PREFIX}/candidate-skills`, createInput));
	}

	getAll(where?: ICandidateSkillFindInput): Promise<IPagination<ISkill>> {
		return firstValueFrom(
			this.http.get<IPagination<ISkill>>(`${API_PREFIX}/candidate-skills`, {
				params: toParams({ where })
			})
		);
	}

	update(id: string, updateInput: any): Promise<any> {
		return firstValueFrom(this.http.put(`${API_PREFIX}/candidate-skills/${id}`, updateInput));
	}

	delete(id: string): Promise<any> {
		return firstValueFrom(this.http.delete(`${API_PREFIX}/candidate-skills/${id}`));
	}
}
