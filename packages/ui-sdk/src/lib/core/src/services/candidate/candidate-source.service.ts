import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
	ICandidateSourceFindInput,
	ICandidateSource,
	ICandidateSourceCreateInput,
	IPagination
} from '@gauzy/contracts';
import { toParams } from '@gauzy/ui-sdk/common';
import { API_PREFIX } from '@gauzy/ui-sdk/common';

@Injectable({
	providedIn: 'root'
})
export class CandidateSourceService {
	constructor(private readonly http: HttpClient) {}

	getAll(where?: ICandidateSourceFindInput): Promise<IPagination<ICandidateSource>> {
		return firstValueFrom(
			this.http.get<IPagination<ICandidateSource>>(`${API_PREFIX}/candidate-source`, {
				params: toParams({ where })
			})
		);
	}

	create(input: ICandidateSourceCreateInput): Promise<ICandidateSource> {
		return firstValueFrom(this.http.post<ICandidateSource>(`${API_PREFIX}/candidate-source`, input));
	}
}
