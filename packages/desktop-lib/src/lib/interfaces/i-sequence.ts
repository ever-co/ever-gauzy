import { IntervalTO, TimerTO } from '../offline';

export interface ISequence {
	timer: TimerTO;
	intervals: IntervalTO[];
}
