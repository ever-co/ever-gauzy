import { Component, OnInit, Output, EventEmitter, Input } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { filter, tap } from 'rxjs/operators';
import { IEmployee, IOrganization, IOrganizationTeam, ITag } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange, isNotEmpty } from '@gauzy/common-angular';
import { Store } from '../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-teams-mutation',
	templateUrl: './teams-mutation.component.html',
	styleUrls: ['./teams-mutation.component.scss']
})
export class TeamsMutationComponent implements OnInit {

	@Input() employees: IEmployee[] = [];
	@Input() team?: IOrganizationTeam;
	@Output() canceled = new EventEmitter();
	@Output() addOrEditTeam = new EventEmitter();

	public organization: IOrganization;

	/*
	* Team Mutation Form
	*/
	public form: FormGroup = TeamsMutationComponent.buildForm(this.fb);
	static buildForm(fb: FormBuilder): FormGroup {
		const form = fb.group({
			name: [null, Validators.required],
			memberIds: [null, Validators.required],
			managerIds: [],
			tags: [],
		});
		form.get('memberIds').setValue([]);
		form.get('managerIds').setValue([]);
		form.get('tags').setValue([]);
		return form;
	}

	constructor(
		private readonly fb: FormBuilder,
		private readonly store: Store
	) {}

	ngOnInit() {
		this.store.selectedOrganization$
			.pipe(
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization) => this.organization = organization),
				tap(() => this.patchFormValue()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit(): void {
		const members = <FormControl>this.form.get('memberIds');
		const managers = <FormControl>this.form.get('managerIds');

		managers.valueChanges.subscribe((value) => {
			if (isNotEmpty(value)) {
				members.setValidators(null);
			} else {
				members.setValidators([Validators.required]);
			}
			members.updateValueAndValidity();
		});
	}

	/**
	 * Set Form Values
	 *
	 */
	patchFormValue() {
		if (this.team) {
			const selectedEmployees = this.team.members.map((member) => member.id);
			const selectedManagers = this.team.managers.map((manager) => manager.id);
			this.form.patchValue({
				name: this.team.name,
				tags: this.team.tags,
				memberIds: selectedEmployees,
				managerIds: selectedManagers
			});
		}
	}

	addOrEditTeams() {
		if (!this.organization) {
			return;
		}
		const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;

		this.addOrEditTeam.emit({
			...this.form.getRawValue(),
			organizationId,
			tenantId,
		});
	}

	/**
	 * On Selected Members Handler
	 *
	 * @param members
	 */
	onMembersSelected(members: string[]) {
		this.form.get('memberIds').setValue(members);
		this.form.get('memberIds').updateValueAndValidity();
	}

	/**
	 * On Selected Managers Handler
	 *
	 * @param managers
	 */
	onManagersSelected(managers: string[]) {
		this.form.get('managerIds').setValue(managers);
		this.form.get('managerIds').updateValueAndValidity();
	}

	cancel() {
		this.canceled.emit();
	}

	/**
	 * On Selected Tags Handler
	 *
	 * @param tags
	 */
	selectedTagsEvent(tags: ITag[]) {
		this.form.get('tags').setValue(tags);
		this.form.get('tags').updateValueAndValidity();
	}
}
