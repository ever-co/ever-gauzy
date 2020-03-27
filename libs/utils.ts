import * as moment from 'moment';

export function toUTC(data: string | Date | moment.Moment): moment.Moment {
	return moment(data).utc();
}

export function toLocal(data: string | Date | moment.Moment): moment.Moment {
	return moment.utc(data).local();
}
