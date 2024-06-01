import { IPackager } from './interfaces/i-packager';
import { DesktopTimerPackager } from './concrete-packager/desktop-timer-packager';
import { DesktopPackager } from './concrete-packager/desktop-packager';
import { ServerPackager } from './concrete-packager/server-packager';
import { ServerApiPackager } from './concrete-packager/server-api-packager';


export class PackagerFactory {
	public static packager(desktop: string): IPackager {
		switch (desktop) {
			case 'desktop-timer':
				return new DesktopTimerPackager();
			case 'desktop':
				return new DesktopPackager();
			case 'server':
				return new ServerPackager();
			case 'server-api':
				return new ServerApiPackager();
			default:
				console.warn('WARNING: Unknown application.');
				break;
		}
	}
}
