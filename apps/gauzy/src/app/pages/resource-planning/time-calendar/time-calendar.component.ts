import { Component, OnInit, OnDestroy } from '@angular/core';
import { DateService } from '../date-service.service';
import { Employee } from '@gauzy/models';
import { EmployeesService } from '../../../@core/services';
import { takeUntil } from 'rxjs/operators';
import { Store } from '../../../@core/services/store.service';
import { Subject } from 'rxjs';

@Component({
	selector: 'ngx-time-calendar',
	templateUrl: './time-calendar.component.html',
	styleUrls: ['./time-calendar.component.scss']
})
export class TimeCalendarComponent implements OnInit, OnDestroy {
	selectedDate = new Date();

	arrDays = [];

	organizationId: string;
	employees: Employee[];

	private _ngDestroy$ = new Subject<void>();

	constructor(
		private dateService: DateService,
		private employeesService: EmployeesService,
		private store: Store
	) {}

	async ngOnInit() {
		this.dateService.selectedDate = this.selectedDate;

		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((org) => {
				if (org) {
					this.organizationId = org.id;
					this.loadEmployees();
				}
			});

		this.loadEmployees();
		this.createWeekArr();
	}

	ngOnDestroy(): void {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}

	async createWeekArr() {
		let day = this.selectedDate.getDate();
		this.arrDays = [];

		for (let i = 0; i < 7; i++) {
			this.arrDays.push(
				new Date(
					this.selectedDate.getFullYear(),
					this.selectedDate.getMonth(),
					day++
				)
			);
		}
	}

	async loadEmployees() {
		if (!this.organizationId) return;

		this.employees = (
			await this.employeesService
				.getAll(['user'], { organization: { id: this.organizationId } })
				.toPromise()
		).items;
	}

	loadNextWeek() {
		this.selectedDate.setDate(this.selectedDate.getDate() + 7);
		this.createWeekArr();
	}

	loadPreviousWeek() {
		this.selectedDate.setDate(this.selectedDate.getDate() - 7);
		this.createWeekArr();
	}
}
