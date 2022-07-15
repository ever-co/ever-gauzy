import { AfterViewInit, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
	IEmployee,
	ISelectedEmployee,
	IUser
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { distinctUntilChange } from '@gauzy/common-angular';
import { debounceTime } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { Store } from '../../../@core/services';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { ALL_EMPLOYEES_SELECTED } from '../../../@theme/components/header/selectors/employee';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-edit-employee',
	templateUrl: './edit-employee.component.html',
	styleUrls: [
		'./edit-employee.component.scss',
		'../../dashboard/dashboard.component.scss'
	]
})
export class EditEmployeeComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy, AfterViewInit {

	selectedEmployee: IEmployee;
	selectedEmployeeFromHeader: ISelectedEmployee;

	constructor(
		private readonly route: ActivatedRoute,
		private readonly router: Router,
		private readonly store: Store,
		public readonly translateService: TranslateService,
		private readonly cdr: ChangeDetectorRef
	) {
		super(translateService);
	}

	ngOnInit() {
		this.store.selectedEmployee$
			.pipe(
				debounceTime(200),
				filter((employee: ISelectedEmployee) => !!employee && !!employee.id),
				distinctUntilChange(),
				tap((employee) => this.selectedEmployeeFromHeader = employee),
				tap(({ id }) => {
					this.cdr.detectChanges();
					this.router.navigate(['/pages/employees/edit/', id]);
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		this.route.data
			.pipe(
				debounceTime(500),
				distinctUntilChange(),
				filter((data) => !!data && !!data.employee),
				tap(({ employee }) => this.selectedEmployee = employee),
				tap(({ employee }) => {
					try {
						if (employee.startedWorkOn) {
							setTimeout(() => {
								this.store.selectedEmployee = {
									id: employee.id,
									firstName: employee.user.firstName,
									lastName: employee.user.lastName,
									fullName: employee.user.name,
									imageUrl: employee.user.imageUrl,
									tags: employee.user.tags || [],
									skills: employee.skills || []
								};
							}, 1600);
						}
					} catch (error) {
						this.router.navigate(['/pages/employees']);
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	updateImage(imageUrl: string) {
		try {
			if (imageUrl) {
				this.selectedEmployee.user.imageUrl = imageUrl;
				this.store.selectedEmployee = {
					...this.store.selectedEmployee,
					imageUrl: imageUrl
				}
			}
		} catch (error) {
			console.log('Error while uploading profile avatar', error);
		}
	}

	ngOnDestroy() {
		this.store.user$
			.pipe(
				filter((user) => !!user),
				tap((user: IUser) => {
					if (!!user && !user.employeeId) {
						this.store.selectedEmployee = ALL_EMPLOYEES_SELECTED;
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}
}
