import { faMobile } from '@fortawesome/free-solid-svg-icons';
import { TimeLogSourceEnum } from '@gauzy/contracts';
import { TimerIcon } from '@gauzy/ui-sdk/common';

export class MobileTimerIcon extends TimerIcon {
	constructor() {
		super();
		this.source = TimeLogSourceEnum.MOBILE;
		this.name = faMobile;
	}
}
