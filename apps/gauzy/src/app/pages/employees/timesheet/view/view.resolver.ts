import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Resolve } from '@angular/router';
import { catchError, Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ITimesheet } from '@gauzy/contracts';
import { TimesheetService } from '@gauzy/ui-sdk/core';

@Injectable({
	providedIn: 'root'
})
export class ViewTimesheetResolver implements Resolve<Observable<ITimesheet>> {
	constructor(private readonly timesheetService: TimesheetService) {}

	resolve(route: ActivatedRouteSnapshot): Observable<ITimesheet> {
		const timesheetId = route.params.id;
		return this.timesheetService.getTimeSheet(timesheetId).pipe(
			catchError((error) => {
				return of(error);
			}),
			tap((timesheet: ITimesheet) => {})
		);
	}
}
