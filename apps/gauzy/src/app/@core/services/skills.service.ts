import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ISkill } from '@gauzy/contracts';
import { first } from 'rxjs/operators';
import { API_PREFIX } from '../constants/app.constants';

@Injectable()
export class SkillsService {
	constructor(private http: HttpClient) {}

	insertSkills(createSkills: ISkill[]): Promise<ISkill[]> {
		return this.http
			.post<ISkill[]>(`${API_PREFIX}/skills`, createSkills)
			.pipe(first())
			.toPromise();
	}

	insertSkill(createSkill: ISkill): Promise<ISkill> {
		return this.http
			.post<ISkill>(`${API_PREFIX}/skills`, createSkill)
			.pipe(first())
			.toPromise();
	}

	getAllSkills(): Promise<{ items: ISkill[] }> {
		return this.http
			.get<{ items: ISkill[] }>(`${API_PREFIX}/skills`)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`${API_PREFIX}/skills/${id}`)
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: ISkill) {
		return this.http
			.put(`${API_PREFIX}/skills/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}
	findByName(name: string): Promise<{ item: ISkill }> {
		return this.http
			.get<{ item: ISkill }>(`${API_PREFIX}/skills/getByName/${name}`)
			.pipe(first())
			.toPromise();
	}
}
