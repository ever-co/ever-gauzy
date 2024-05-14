import { Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter, tap } from 'rxjs/operators';
import { IEventTypeViewModel, IOrganization } from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/shared';
import { Store } from './../../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	templateUrl: './event-type-mutation.component.html',
	styleUrls: ['./event-type-mutation.component.scss']
})
export class EventTypeMutationComponent extends TranslationBaseComponent implements OnInit {
	public organization: IOrganization;
	eventType: IEventTypeViewModel;
	durationUnits: string[] = ['Minute(s)', 'Hour(s)', 'Day(s)'];

	readonly form: UntypedFormGroup = EventTypeMutationComponent.buildForm(this.fb, this);
	static buildForm(fb: UntypedFormBuilder, self: EventTypeMutationComponent): UntypedFormGroup {
		return fb.group({
			title: [],
			description: [],
			duration: [],
			durationUnit: [self.durationUnits[0]],
			isActive: [false],
			tags: [],
			employeeId: []
		});
	}

	constructor(
		private readonly fb: UntypedFormBuilder,
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
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => this._patchRawForm()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	onEmployeeChange(event) {
		this.form.patchValue({ employeeId: event });
		this.form.updateValueAndValidity();
	}

	addOrEditEventType() {
		if (this.form.invalid) {
			return;
		}

		const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;

		this.dialogRef.close(
			Object.assign(
				{
					id: this.eventType ? this.eventType.id : null,
					tenantId,
					organizationId
				},
				this.form.value
			)
		);
	}

	private _patchRawForm() {
		if (!this.eventType) {
			return;
		}

		const { title, description, duration, isActive = false, tags, employeeId } = this.eventType;
		this.form.patchValue({
			title: title,
			description: description,
			duration: duration,
			isActive: isActive,
			tags,
			employeeId
		});

		const { durationUnit } = this.eventType;
		this.form.patchValue({
			durationUnit: durationUnit ? durationUnit : this.durationUnits[0]
		});
	}

	selectedTagsEvent(ev) {
		this.form.patchValue({ tags: ev });
	}
}
