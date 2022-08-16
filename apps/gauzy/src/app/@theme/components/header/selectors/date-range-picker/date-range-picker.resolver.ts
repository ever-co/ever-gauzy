import { Injectable } from "@angular/core";
import { ActivatedRouteSnapshot, Resolve } from "@angular/router";
import { of as observableOf } from 'rxjs';
import { Observable } from "rxjs/internal/Observable";
import * as moment from 'moment';
import { IDateRangePicker } from "@gauzy/contracts";
import { IDatePickerConfig } from "./../../../../../@core/services/selector-builder/date-range-picker-builder.service";

@Injectable({
    providedIn: 'root'
})
export class DateRangePickerResolver implements Resolve<Observable<IDateRangePicker>> {

    resolve(route: ActivatedRouteSnapshot): Observable<IDateRangePicker>  {
        const { unitOfTime } = route.data.datePicker as IDatePickerConfig;

        const date_start = route.queryParams.date || new Date();
        const date_end = route.queryParams.date_end;

        const start_date = moment(date_start).startOf(unitOfTime);
        const end_date = moment(date_end || start_date).endOf(unitOfTime);

        let isCustomDate: boolean;
        if (date_end) {
            isCustomDate = true;
        } else {
            isCustomDate = false;
        }

        return observableOf({
            startDate: start_date.toDate(),
            endDate: end_date.toDate(),
            isCustomDate: isCustomDate
        });
    }
}