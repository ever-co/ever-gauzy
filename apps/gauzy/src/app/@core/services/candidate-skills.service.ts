import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import { ISkillCreateInput, ISkill, ISkillFindInput } from '@gauzy/contracts';
import { API_PREFIX } from '../constants/app.constants';

@Injectable({
	providedIn: 'root'
})
export class CandidateSkillsService {
	constructor(private http: HttpClient) {}

	create(createInput: ISkillCreateInput): Promise<ISkill> {
		return this.http
			.post<ISkill>(`${API_PREFIX}/candidate-skills`, createInput)
			.pipe(first())
			.toPromise();
	}

	getAll(
		findInput?: ISkillFindInput
	): Promise<{ items: any[]; total: number }> {
		const data = JSON.stringify({ findInput });
		return this.http
			.get<{ items: ISkill[]; total: number }>(
				`${API_PREFIX}/candidate-skills`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: any): Promise<any> {
		return this.http
			.put(`${API_PREFIX}/candidate-skills/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`${API_PREFIX}/candidate-skills/${id}`)
			.pipe(first())
			.toPromise();
	}
}
