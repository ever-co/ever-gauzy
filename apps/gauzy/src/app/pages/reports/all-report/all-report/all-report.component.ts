import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	OnInit
} from '@angular/core';
import {
	IGetReportCategory,
	IOrganization,
	IReportCategory,
	ITimeLogFilters,
	PermissionsEnum
} from '@gauzy/models';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { SelectedEmployee } from 'apps/gauzy/src/app/@theme/components/header/selectors/employee/employee.component';
import * as moment from 'moment';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { ReportService } from '../report.server';

@UntilDestroy()
@Component({
	selector: 'gauzy-all-report',
	templateUrl: './all-report.component.html',
	styleUrls: ['./all-report.component.scss']
})
export class AllReportComponent implements OnInit, AfterViewInit {
	PermissionsEnum = PermissionsEnum;
	updateLogs$: Subject<any> = new Subject();
	organization: IOrganization;

	logRequest: ITimeLogFilters = {
		startDate: moment().startOf('week').toDate(),
		endDate: moment().endOf('week').toDate()
	};
	countsLoading: boolean;
	reportCategories: IReportCategory[];

	constructor(
		private reportService: ReportService,
		private store: Store,
		private cd: ChangeDetectorRef
	) {}

	ngOnInit(): void {
		this.updateLogs$
			.pipe(untilDestroyed(this), debounceTime(500))
			.subscribe(() => {
				this.getReportCategories();
			});

		this.store.selectedOrganization$
			.pipe(untilDestroyed(this))
			.subscribe((organization: IOrganization) => {
				if (organization) {
					this.organization = organization;
					this.updateLogs$.next();
				}
			});

		this.store.selectedEmployee$
			.pipe(untilDestroyed(this))
			.subscribe((employee: SelectedEmployee) => {
				if (employee && employee.id) {
					this.logRequest.employeeIds = [employee.id];
				} else {
					delete this.logRequest.employeeIds;
				}
				this.updateLogs$.next();
			});
	}

	ngAfterViewInit() {
		this.cd.detectChanges();
	}

	getReportCategories() {
		const request: IGetReportCategory = {
			relations: ['reports'],
			where: {
				organizationId: this.organization ? this.organization.id : null,
				tenantId: this.organization ? this.organization.tenantId : null
			}
		};
		this.countsLoading = true;
		this.reportService
			.getReportCategories(request)
			.then((resp) => {
				this.reportCategories = resp.items;
			})
			.finally(() => {
				this.countsLoading = false;
			});
	}
}
