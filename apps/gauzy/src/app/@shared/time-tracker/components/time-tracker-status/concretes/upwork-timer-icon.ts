import { faArrowTurnUp } from '@fortawesome/free-solid-svg-icons';
import { TimeLogSourceEnum } from '@gauzy/contracts';
import { TimerIcon } from '@gauzy/ui-sdk/core';

export class UpworkTimerIcon extends TimerIcon {
	constructor() {
		super();
		this.source = TimeLogSourceEnum.UPWORK;
		this.name = faArrowTurnUp;
	}
}
