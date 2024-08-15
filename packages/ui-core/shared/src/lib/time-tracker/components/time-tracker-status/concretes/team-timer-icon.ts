import { faUsers } from '@fortawesome/free-solid-svg-icons';
import { TimeLogSourceEnum } from '@gauzy/contracts';
import { TimerIcon } from '@gauzy/ui-core/core';

export class TeamTimerIcon extends TimerIcon {
	constructor() {
		super();
		this.source = TimeLogSourceEnum.TEAMS;
		this.name = faUsers;
	}
}
