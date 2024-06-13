import { faArrowsTurnToDots } from '@fortawesome/free-solid-svg-icons';
import { TimeLogSourceEnum } from '@gauzy/contracts';
import { TimerIcon } from '@gauzy/ui-sdk/common';

export class HubstaffTimerIcon extends TimerIcon {
	constructor() {
		super();
		this.source = TimeLogSourceEnum.HUBSTAFF;
		this.name = faArrowsTurnToDots;
	}
}
