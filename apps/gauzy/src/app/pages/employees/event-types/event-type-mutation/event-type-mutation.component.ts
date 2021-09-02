import { Component, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter, tap } from 'rxjs/operators';
import { IEventTypeViewModel, IOrganization } from '@gauzy/contracts';
import { EmployeeSelectorComponent } from '../../../../@theme/components/header/selectors/employee/employee.component';
import { TranslationBaseComponent } from '../../../../@shared/language-base/translation-base.component';
import { Store } from './../../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	templateUrl: './event-type-mutation.component.html'
})
export class EventTypeMutationComponent
	extends TranslationBaseComponent
	implements OnInit {
		
	@ViewChild('employeeSelector')
	employeeSelector: EmployeeSelectorComponent;

	public organization: IOrganization;
	eventType: IEventTypeViewModel;
	durationUnits: string[] = ['Minute(s)', 'Hour(s)', 'Day(s)'];

	readonly form: FormGroup = EventTypeMutationComponent.buildForm(this.fb, this);
	static buildForm(
		fb: FormBuilder,
		self: EventTypeMutationComponent
	): FormGroup {
		return fb.group({
			title: [],
			description: [],
			duration: [],
			durationUnit: [self.durationUnits[0]],
			isActive: [false],
			tags: []
		});
	}

	constructor(
		private readonly fb: FormBuilder,
		public readonly dialogRef: NbDialogRef<EventTypeMutationComponent>,
		public readonly translate: TranslateService,
		private readonly store: Store
	) {
		super(translate);
	}

	ngOnInit() {
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => this.organization = organization),
				tap(() => this._patchRawForm()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	onEmployeeChange(ev) { }

	addOrEditEventType() {
		if (this.form.invalid) {
			return;
		}

		const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;
		const { selectedEmployee } = this.employeeSelector;

		this.dialogRef.close(
			Object.assign({
				id: this.eventType ? this.eventType.id : null,
				employee: selectedEmployee,
				tenantId,
				organizationId
			}, this.form.getRawValue())
		);
	}

	private _patchRawForm() {
		if (!this.eventType) {
			return;
		}

		const { title, description, duration, isActive = false, tags } = this.eventType;
		this.form.patchValue({
			title: title,
			description: description,
			duration: duration,
			isActive: isActive,
			tags
		});

		const { durationUnit } = this.eventType;
		this.form.patchValue({
			durationUnit: (durationUnit) ? durationUnit : this.durationUnits[0],
		});
	}

	selectedTagsEvent(ev) {
		this.form.patchValue({ tags: ev });
	}
}
