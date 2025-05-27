import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
	providedIn: 'root'
})
export class TimeLogEventService {
	private timeLogChanged$ = new Subject<'added' | 'deleted' | 'updated'>();

	notifyChange(action: 'added' | 'deleted' | 'updated') {
		this.timeLogChanged$.next(action);
	}

	get changes$() {
		return this.timeLogChanged$.asObservable();
	}
}
