import { IPackager } from './interfaces/i-packager';
import { DesktopTimerPackager } from './concrete-packager/desktop-timer-packager';
import { DesktopPackager } from './concrete-packager/desktop-packager';
import { ServerPackager } from './concrete-packager/server-packager';

export class PackagerFactory {
	public static packager(desktop: string): IPackager {
		switch (desktop) {
			case 'desktop-timer':
				return new DesktopTimerPackager();
			case 'desktop':
				return new DesktopPackager();
			case 'server':
			case 'server-api':
				return new ServerPackager();
			default:
				console.warn('WARNING: Unknown application.');
				break;
		}
	}
}
