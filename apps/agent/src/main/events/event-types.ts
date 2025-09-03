import { TMainEventType } from '../../constant';
import { TEmployeeResponse } from '../util';
export type TEventArgs = {
	type: TMainEventType,
	data?: Partial<{
		trayStatus?: 'Working' | 'Error' | 'Startup' | 'Network error' | 'Afk' | 'Idle';
		trayMenuId?: 'keyboard_mouse' | 'network' | 'afk';
		trayMenuChecked?: boolean;
		trayUpdateType?: 'title' | 'menu',
		employee?: Partial<TEmployeeResponse>
	}>
};
