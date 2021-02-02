import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ICandidateLevelInput } from '@gauzy/contracts';
import { API_PREFIX } from '../constants/app.constants';

@Injectable({
	providedIn: 'root'
})
export class CandidateLevelService {
	constructor(private http: HttpClient) {}

	getAll(orgId: string) {
		return this.http.get(`${API_PREFIX}/candidate-level/${orgId}`);
	}

	create(candidateLevel: ICandidateLevelInput) {
		return this.http.post(`${API_PREFIX}/candidate-level`, candidateLevel);
	}

	delete(id: string) {
		return this.http.delete(`${API_PREFIX}/candidate-level/${id}`);
	}

	update(id: string, candidateLevel: ICandidateLevelInput) {
		return this.http.put(
			`${API_PREFIX}/candidate-level/${id}`,
			candidateLevel
		);
	}
}
