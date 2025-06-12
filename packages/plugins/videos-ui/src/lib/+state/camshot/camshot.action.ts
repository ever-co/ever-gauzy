import { createAction } from '@ngneat/effects';

export class CamshotAction {
	public static fetchCamshots = createAction('[Camshots] Fetch Camshots', (params?: any) => ({ params }));
}
