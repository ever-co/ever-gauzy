import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ISkill } from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-core/common';

@Injectable()
export class SkillsService {
	private http = inject(HttpClient);

	insertSkills(createSkills: ISkill[]): Promise<ISkill[]> {
		return firstValueFrom(this.http.post<ISkill[]>(`${API_PREFIX}/skills`, createSkills));
	}

	insertSkill(createSkill: ISkill): Promise<ISkill> {
		return firstValueFrom(this.http.post<ISkill>(`${API_PREFIX}/skills`, createSkill));
	}

	getAllSkills(): Promise<{ items: ISkill[] }> {
		return firstValueFrom(this.http.get<{ items: ISkill[] }>(`${API_PREFIX}/skills`));
	}

	delete(id: string): Promise<any> {
		return firstValueFrom(this.http.delete(`${API_PREFIX}/skills/${id}`));
	}

	update(id: string, updateInput: ISkill) {
		return firstValueFrom(this.http.put(`${API_PREFIX}/skills/${id}`, updateInput));
	}
	findByName(name: string): Promise<{ item: ISkill }> {
		return firstValueFrom(this.http.get<{ item: ISkill }>(`${API_PREFIX}/skills/getByName/${name}`));
	}
}
