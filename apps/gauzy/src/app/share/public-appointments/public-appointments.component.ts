import { Component, OnInit, OnDestroy } from '@angular/core';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { Subject } from 'rxjs';
import { Router, ActivatedRoute } from '@angular/router';
import { ITimeOff, IEmployee, IEventType } from '@gauzy/models';
import { TranslateService } from '@ngx-translate/core';
import { timeOff } from './test-data';
import { takeUntil } from 'rxjs/operators';
import { EmployeesService } from '../../@core/services';
import { EventTypeService } from '../../@core/services/event-type.service';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';

@Component({
	selector: 'ga-public-appointments',
	templateUrl: './public-appointments.component.html',
	styleUrls: ['./public-appointments.component.scss']
})
export class PublicAppointmentsComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	employee: IEmployee;
	eventTypes: IEventType[];
	timeOff: ITimeOff[] = timeOff;
	loading = true;
	_selectedOrganizationId: string;

	constructor(
		private router: Router,
		private route: ActivatedRoute,
		private store: Store,
		private employeeService: EmployeesService,
		private eventTypeService: EventTypeService,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.route.params
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (params) => {
				try {
					this.employee = await this.employeeService.getEmployeeById(
						params.id,
						['user']
					);
					await this._getEventTypes();
				} catch (error) {
					await this.router.navigate(['/share/404']);
				}
			});

		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((org) => {
				if (org) {
					this._selectedOrganizationId = org.id;
				}
			});
	}

	async _getEventTypes() {
		let { items } = await this.eventTypeService.getAll(
			['employee', 'employee.user', 'tags'],
			{
				employee: {
					id: this.employee.id
				}
			}
		);

		if (items.length === 0) {
			const { tenantId } = this.store.user;
			items = (
				await this.eventTypeService.getAll(['tags'], {
					organizationId: this._selectedOrganizationId,
					tenantId
				})
			).items;
		}

		const eventTypesOrder = ['Minute(s)', 'Hour(s)', 'Day(s)'];
		this.eventTypes = [...items].sort((a, b) => {
			if (a.duration > b.duration && a.durationUnit === b.durationUnit) {
				return 1;
			} else if (a.durationUnit !== b.durationUnit) {
				return (
					eventTypesOrder.indexOf(a.durationUnit) -
					eventTypesOrder.indexOf(b.durationUnit)
				);
			}

			return -1;
		});
		this.loading = false;
	}

	selectEventType(id) {
		this.router.navigate([`${this.router.url}/${id}`]);
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
