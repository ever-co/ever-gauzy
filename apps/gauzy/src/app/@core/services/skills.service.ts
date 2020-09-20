import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ISkill } from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable()
export class SkillsService {
	constructor(private http: HttpClient) {}

	insertSkills(createSkills: ISkill[]): Promise<ISkill[]> {
		return this.http
			.post<ISkill[]>('/api/skills', createSkills)
			.pipe(first())
			.toPromise();
	}

	insertSkill(createSkill: ISkill): Promise<ISkill> {
		return this.http
			.post<ISkill>('/api/skills', createSkill)
			.pipe(first())
			.toPromise();
	}

	getAllSkills(): Promise<{ items: ISkill[] }> {
		return this.http
			.get<{ items: ISkill[] }>(`/api/skills`)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http.delete(`/api/skills/${id}`).pipe(first()).toPromise();
	}

	update(id: string, updateInput: ISkill) {
		return this.http
			.put(`/api/skills/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}
	findByName(name: string): Promise<{ item: ISkill }> {
		return this.http
			.get<{ item: ISkill }>(`/api/skills/getByName/${name}`)
			.pipe(first())
			.toPromise();
	}
}
