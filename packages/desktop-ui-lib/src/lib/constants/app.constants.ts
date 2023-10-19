import {InjectionToken, Injector} from '@angular/core';
// @ts-ignore
import { environment } from '@env/environment';

export const API_PREFIX = '/api';
export const BACKGROUND_SYNC_INTERVAL = 25000; // milliseconds
export const BACKGROUND_SYNC_OFFLINE_INTERVAL = 5000; // milliseconds
export const GAUZY_ENV = new InjectionToken<any>(
	'gauzyEnvironment'
);
export const injector = Injector.create({
	providers: [
		{ provide: GAUZY_ENV, useValue: environment }
	]
});
