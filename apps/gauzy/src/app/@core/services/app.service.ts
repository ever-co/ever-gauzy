import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs/internal/Observable';
import { IAppConfig } from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-sdk/common';

@Injectable({ providedIn: 'root' })
export class AppService {
	constructor(private readonly _http: HttpClient) {}

	/**
	 * Service method to retrieve application configurations.
	 *
	 * This method makes an HTTP GET request to the '/configs' endpoint and returns an Observable of type IAppSetting.
	 *
	 * @returns {Observable<IAppSetting>} Observable containing application configurations.
	 */
	getAppConfigs(): Observable<IAppConfig> {
		return this._http.get<IAppConfig>(`${API_PREFIX}/configs`);
	}
}
