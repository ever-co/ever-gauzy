import { ID } from '@gauzy/contracts';
import { createAction } from '@ngneat/effects';

export class CamshotAction {
	public static fetchCamshots = createAction('[Camshots] Fetch Camshots', (params?: any) => ({ params }));
	public static fetchOneCamshot = createAction('[Camshots] Fetch One Camshot', (id: ID, params?: any) => ({
		id,
		params
	}));
	public static deleteCamshot = createAction('[Camshots] Delete Camshot', (id: ID, params?: any) => ({ id, params }));
	public static hardDeleteCamshot = createAction('[Camshots] Hard Delete Camshot', (id: ID, params: any) => ({
		id,
		params
	}));
	public static restoreCamshot = createAction('[Camshots] Restore Camshot', (id: ID) => ({ id }));
	public static downloadCamshot = createAction('[Camshots] Download Camshot', (url: string) => ({ url }));
}
