import { IconDefinition } from '@fortawesome/free-solid-svg-icons';
import { TimeLogSourceEnum } from '@gauzy/contracts';
import { ITimerIcon } from './itimer-icon';

export abstract class TimerIcon implements ITimerIcon {
	private _source: TimeLogSourceEnum;
	private _name: IconDefinition;

	public get source(): TimeLogSourceEnum {
		return this._source;
	}
	public set source(value: TimeLogSourceEnum) {
		this._source = value;
	}
	public get name(): IconDefinition {
		return this._name;
	}
	public set name(value: IconDefinition) {
		this._name = value;
	}
}
