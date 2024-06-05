import { faGlobe } from '@fortawesome/free-solid-svg-icons';
import { TimeLogSourceEnum } from '@gauzy/contracts';
import { TimerIcon } from '@gauzy/ui-sdk/core';

export class WebTimerIcon extends TimerIcon {
	constructor() {
		super();
		this.source = TimeLogSourceEnum.WEB_TIMER;
		this.name = faGlobe;
	}
}
