import { TimeLogSourceEnum } from '@gauzy/contracts';
import { ITimerIcon } from '@gauzy/ui-sdk/core';
import {
	BrowserExtensionTimerIcon,
	DesktopTimerIcon,
	HubstaffTimerIcon,
	MobileTimerIcon,
	TeamTimerIcon,
	UpworkTimerIcon,
	WebTimerIcon
} from '../concretes';

export class TimerIconFactory {
	public static create(source: TimeLogSourceEnum): ITimerIcon {
		switch (source) {
			case TimeLogSourceEnum.MOBILE:
				return new MobileTimerIcon();
			case TimeLogSourceEnum.DESKTOP:
				return new DesktopTimerIcon();
			case TimeLogSourceEnum.BROWSER_EXTENSION:
				return new BrowserExtensionTimerIcon();
			case TimeLogSourceEnum.HUBSTAFF:
				return new HubstaffTimerIcon();
			case TimeLogSourceEnum.UPWORK:
				return new UpworkTimerIcon();
			case TimeLogSourceEnum.TEAMS:
				return new TeamTimerIcon();
			default:
				return new WebTimerIcon();
		}
	}
}
