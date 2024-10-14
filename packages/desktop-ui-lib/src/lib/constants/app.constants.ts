import { InjectionToken, Injector } from '@angular/core';
// @ts-ignore
import { environment } from '@gauzy/ui-config';

export const API_PREFIX = '/api';
export const BACKGROUND_SYNC_INTERVAL = 25000; // milliseconds
export const BACKGROUND_SYNC_OFFLINE_INTERVAL = 5000; // milliseconds

export const GAUZY_ENV = new InjectionToken<any>('gauzyEnvironment');

console.log('Environment: ', JSON.stringify(environment));

export const injector = Injector.create({
	providers: [{ provide: GAUZY_ENV, useValue: environment }]
});

export const API_ACTIVITY_WATCH_PREFIX = '/buckets';

export const AUTO_REFRESH_DELAY = 60 * 10 * 1000; // milliseconds

export const patterns = {
	websiteUrl: /^((?:https?:\/\/)[^./]+(?:\.[^./]+)+(?:\/.*)?)$/,
	imageUrl: /^(http)?s?:?(\/\/[^"']*\.(?:png|jpg|jpeg|gif|png|svg))/,
	email: /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@(([^<>()[\]\.,;:\s@"]+\.)+[^<>()[\]\.,;:\s@"]{2,})$/i,
	host: /^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]).)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9-]*[A-Za-z0-9])$/,
	passwordNoSpaceEdges: /^(?!\s).*[^\s]$/
};
