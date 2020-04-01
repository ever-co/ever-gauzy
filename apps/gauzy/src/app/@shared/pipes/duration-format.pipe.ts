import { Pipe, PipeTransform } from '@angular/core';
import { Store } from '../../@core/services/store.service';
import { Subject } from 'rxjs/internal/Subject';
import { Organization } from '@gauzy/models';
import * as moment from 'moment';

@Pipe({
	name: 'durationFormat'
})
export class DurationFormatPipe implements PipeTransform {
	transform(seconds: number): any {
		console.log(moment.utc(seconds));
		return moment.utc(seconds * 1000).format('HH:mm:ss');
	}
}
