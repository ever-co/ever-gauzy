import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Skill } from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable()
export class SkillsService {
	constructor(private http: HttpClient) {}

	insertSkills(createSkills: Skill[]): Promise<Skill[]> {
		return this.http
			.post<Skill[]>('/api/skills', createSkills)
			.pipe(first())
			.toPromise();
	}

	insertSkill(createSkill: Skill): Promise<Skill> {
		return this.http
			.post<Skill>('/api/skills', createSkill)
			.pipe(first())
			.toPromise();
	}

	getAllSkills(): Promise<{ items: Skill[] }> {
		return this.http
			.get<{ items: Skill[] }>(`/api/skills`)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`/api/skills/${id}`)
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: Skill) {
		return this.http
			.put(`/api/skills/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}
	findByName(name: string): Promise<{ item: Skill }> {
		return this.http
			.get<{ item: Skill }>(`/api/skills/getByName/${name}`)
			.pipe(first())
			.toPromise();
	}
}
