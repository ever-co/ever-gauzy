import { TimeOff } from '@gauzy/models';
import * as moment from 'moment';

export const timeOff: TimeOff[] = [
	{
		start: new Date(
			moment().hour(0).minute(0).second(0).subtract(2, 'days').format()
		),
		end: new Date(
			moment().hour(0).minute(0).second(0).subtract(1, 'days').format()
		),
	},
];
