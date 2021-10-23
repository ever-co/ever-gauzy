import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ISkillCreateInput, ISkill, ISkillFindInput } from '@gauzy/contracts';
import { API_PREFIX } from '../constants/app.constants';

@Injectable({
	providedIn: 'root'
})
export class CandidateSkillsService {
	constructor(private http: HttpClient) { }

	create(createInput: ISkillCreateInput): Promise<ISkill> {
		return firstValueFrom(
			this.http
				.post<ISkill>(`${API_PREFIX}/candidate-skills`, createInput)
		);
	}

	getAll(
		findInput?: ISkillFindInput
	): Promise<{ items: any[]; total: number }> {
		const data = JSON.stringify({ findInput });
		return firstValueFrom(
			this.http
				.get<{ items: ISkill[]; total: number }>(
					`${API_PREFIX}/candidate-skills`,
					{
						params: { data }
					}
				)
		);
	}

	update(id: string, updateInput: any): Promise<any> {
		return firstValueFrom(
			this.http
				.put(`${API_PREFIX}/candidate-skills/${id}`, updateInput)
		);
	}

	delete(id: string): Promise<any> {
		return firstValueFrom(
			this.http
				.delete(`${API_PREFIX}/candidate-skills/${id}`)
		);
	}
}
