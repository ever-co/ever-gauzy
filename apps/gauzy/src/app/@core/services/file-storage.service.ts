import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { IWasabiFileStorageProviderConfig } from '@gauzy/contracts';
import { API_PREFIX } from '../constants/app.constants';

@Injectable()
export class FileStorageService {
	constructor(
        private readonly http: HttpClient
    ) { }

	validateWasabiCredentials(config: IWasabiFileStorageProviderConfig) {
		return firstValueFrom(
			this.http.post<IWasabiFileStorageProviderConfig>(`${API_PREFIX}/tenant-setting/wasabi/validate`, config)
		);
	}
}
