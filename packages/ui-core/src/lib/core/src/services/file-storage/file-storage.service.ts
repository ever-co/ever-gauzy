import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { IWasabiFileStorageProviderConfig } from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-core/common';

@Injectable()
export class FileStorageService {
	constructor(private readonly http: HttpClient) {}

	validateWasabiCredentials(config: IWasabiFileStorageProviderConfig): Promise<any> | HttpErrorResponse {
		return firstValueFrom(
			this.http.post<IWasabiFileStorageProviderConfig>(`${API_PREFIX}/tenant-setting/wasabi/validate`, config)
		);
	}
}
