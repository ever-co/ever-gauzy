import { Component, OnInit, OnDestroy, AfterViewInit, Input, ViewChild } from '@angular/core';
import { debounceTime, filter, switchMap, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { DaterangepickerDirective as DateRangePickerDirective, LocaleConfig } from 'ngx-daterangepicker-material';
import * as moment from 'moment';
import { IOrganization, OrganizationPermissionsEnum } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/common-angular';
import { NgxPermissionsService } from 'ngx-permissions';
import { Store } from './../../../../../@core/services';
import { Arrow } from './../../../../../@shared/timesheet/gauzy-range-picker/arrow/context/arrow.class';
import { Next, Previous } from './../../../../../@shared/timesheet/gauzy-range-picker/arrow/strategies/concrete';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-date-range-picker',
	templateUrl: './date-range-picker.component.html',
	styleUrls: ['./date-range-picker.component.scss']
})
export class DateRangePickerComponent implements AfterViewInit, OnInit, OnDestroy {
	public isDisable: boolean;
	public maxDate: moment.Moment;
	private futureDateAllowed: boolean;

	/**
	 * declaration of arrow variables
	 */
	private arrow: Arrow;
	private next: Next = new Next();
	private previous: Previous = new Previous();

	/**
	 * ngx-daterangepicker-material local configuration
	 */
	public localConfig: LocaleConfig = {
		displayFormat: 'MMM DD, YYYY', // could be 'YYYY-MM-DDTHH:mm:ss.SSSSZ'
		format: 'YYYY-MM-DD', // default is format value
		direction: 'ltr'
	}
	/**
	 * Define ngx-daterangepicker-material range configuration
	 */
	public ranges: any = {
		'Today': [moment(), moment()],
		'Yesterday': [moment().subtract(1, 'days'), moment().subtract(1, 'days')],
		'Last 7 Days': [moment().subtract(6, 'days'), moment()],
		'Last 30 Days': [moment().subtract(29, 'days'), moment()],
		'This Month': [moment().startOf('month'), moment().endOf('month')],
		'Last Month': [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')]
	}

	// show or hide arrows button, show by default
	@Input()
	arrows: boolean = true;

	@ViewChild(DateRangePickerDirective, { static: false }) dateRangePickerDirective: DateRangePickerDirective;

	constructor(
		private readonly ngxPermissionsService: NgxPermissionsService,
		private readonly store: Store
	) {}

	ngOnInit() {
		this.store.selectedOrganization$
			.pipe(
				distinctUntilChange(),
				debounceTime(200),
				filter((organization: IOrganization) => !!organization && !!organization.dateFormat),
				tap((organization: IOrganization) => {
					this.localConfig = {
						...this.localConfig,
						displayFormat: organization.dateFormat
					}
				}),
				switchMap(() => this.ngxPermissionsService.hasPermission(
					OrganizationPermissionsEnum.ALLOW_FUTURE_DATE
				)),
				tap((futureDateAllowed: boolean) => this.futureDateAllowed = futureDateAllowed),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {}

	/**
	 * get next selected range
	 */
	nextRange() {
		this.arrow.setStrategy = this.next;
	}

   /**
   * get previous selected range
   */
	previousRange() {
		this.arrow.setStrategy = this.previous;
	}

	/**
	 * listen event on ngx-daterangepicker-material
	 * @param $event
	 */
	 onDatesUpdated($event) {
		console.log($event);
	}

	ngOnDestroy() {}
}
