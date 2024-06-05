import { faDesktop } from '@fortawesome/free-solid-svg-icons';
import { TimeLogSourceEnum } from '@gauzy/contracts';
import { TimerIcon } from '@gauzy/ui-sdk/core';

export class DesktopTimerIcon extends TimerIcon {
	constructor() {
		super();
		this.source = TimeLogSourceEnum.DESKTOP;
		this.name = faDesktop;
	}
}
