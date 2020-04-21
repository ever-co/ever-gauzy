import {
	Skill,
	ISkillCreateInput,
	ISkillFindInput
} from './../../../../../../libs/models/src/lib/candidate-skill.model';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';

@Injectable({
	providedIn: 'root'
})
export class CandidateSkillsService {
	constructor(private http: HttpClient) {}

	create(createInput: ISkillCreateInput): Promise<Skill> {
		return this.http
			.post<Skill>('/api/candidate-skills', createInput)
			.pipe(first())
			.toPromise();
	}

	getAll(
		findInput?: ISkillFindInput
	): Promise<{ items: any[]; total: number }> {
		const data = JSON.stringify({ findInput });
		return this.http
			.get<{ items: Skill[]; total: number }>(`/api/candidate-skills`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: any): Promise<any> {
		return this.http
			.put(`/api/candidate-skills/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`/api/candidate-skills/${id}`)
			.pipe(first())
			.toPromise();
	}
}
