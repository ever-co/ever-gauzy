import { faBox } from '@fortawesome/free-solid-svg-icons';
import { TimeLogSourceEnum } from '@gauzy/contracts';
import { TimerIcon } from '@gauzy/ui-core/common';

export class BrowserExtensionTimerIcon extends TimerIcon {
	constructor() {
		super();
		this.source = TimeLogSourceEnum.BROWSER_EXTENSION;
		this.name = faBox;
	}
}
