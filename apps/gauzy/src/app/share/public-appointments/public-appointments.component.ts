import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { IEmployee, IEventType } from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { filter } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/shared';
import { EmployeesService, EventTypeService, Store } from '../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-public-appointments',
	templateUrl: './public-appointments.component.html',
	styleUrls: ['./public-appointments.component.scss']
})
export class PublicAppointmentsComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	employee: IEmployee;
	eventTypes: IEventType[];
	loading = true;
	_selectedOrganizationId: string;
	eventTypesExist: boolean;

	constructor(
		private readonly router: Router,
		private readonly route: ActivatedRoute,
		private readonly store: Store,
		private readonly employeeService: EmployeesService,
		private readonly eventTypeService: EventTypeService,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.route.params.pipe(untilDestroyed(this)).subscribe(async (params) => {
			try {
				this.employee = await firstValueFrom(this.employeeService.getEmployeeById(params.id, ['user']));
				await this._getEventTypes();
			} catch (error) {
				await this.router.navigate(['/share/404']);
			}
		});
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				untilDestroyed(this)
			)
			.subscribe((org) => {
				if (org) {
					this._selectedOrganizationId = org.id;
				}
			});
	}

	async _getEventTypes() {
		let { items } = await this.eventTypeService.getAll(['employee', 'employee.user', 'tags'], {
			employee: {
				id: this.employee.id
			},
			isActive: true
		});

		if (items.length === 0) {
			const { tenantId } = this.store.user;
			items = (
				await this.eventTypeService.getAll(['tags'], {
					organizationId: this._selectedOrganizationId,
					tenantId,
					isActive: true
				})
			).items;
		}

		if (items.length === 1) {
			this.router.navigate([`/share/employee/${this.employee.id}/${items[0].id}`]);
		}

		if (items.length !== 0) {
			this.eventTypesExist = true;
		}

		const eventTypesOrder = ['Minute(s)', 'Hour(s)', 'Day(s)'];
		this.eventTypes = [...items].sort((a, b) => {
			if (a.duration > b.duration && a.durationUnit === b.durationUnit) {
				return 1;
			} else if (a.durationUnit !== b.durationUnit) {
				return eventTypesOrder.indexOf(a.durationUnit) - eventTypesOrder.indexOf(b.durationUnit);
			}

			return -1;
		});
		this.loading = false;
	}

	selectEventType(id) {
		this.router.navigate([`${this.router.url}/${id}`]);
	}

	ngOnDestroy() {}
}
