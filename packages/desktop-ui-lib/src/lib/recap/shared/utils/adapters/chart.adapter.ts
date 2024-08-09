import { ITimeSlot } from '@gauzy/contracts';
import * as moment from 'moment';
import 'moment-duration-format';

export interface IChartData {
	name: string;
	value: number;
}

export class ChartDataAdapter implements IChartData {
	constructor(readonly timeSlot: ITimeSlot) {}

	public get value(): number {
		return this.timeSlot.overall;
	}
	public get name(): string {
		return moment(this.timeSlot.stoppedAt).format('HH A');
	}
}
