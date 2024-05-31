import { Component, OnInit, Output, EventEmitter, Input } from '@angular/core';
import { UntypedFormBuilder, FormControl, UntypedFormGroup, Validators } from '@angular/forms';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IEmployee, IOrganization, IImageAsset, IOrganizationProject, IOrganizationTeam, ITag } from '@gauzy/contracts';
import { DUMMY_PROFILE_IMAGE, distinctUntilChange, isNotEmpty } from '@gauzy/ui-sdk/common';
import { Store } from '../../../@core/services';
import { ToastrService } from '@gauzy/ui-sdk/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-teams-mutation',
	templateUrl: './teams-mutation.component.html',
	styleUrls: ['./teams-mutation.component.scss']
})
export class TeamsMutationComponent implements OnInit {
	@Input() employees: IEmployee[] = [];
	@Input() projects: IOrganizationProject[] = [];
	@Input() team?: IOrganizationTeam;
	@Output() canceled = new EventEmitter();
	@Output() addOrEditTeam = new EventEmitter();

	public organization: IOrganization;
	public hoverState: boolean;
	public imageUrl: string;
	/*
	 * Team Mutation Form
	 */
	public form: UntypedFormGroup = TeamsMutationComponent.buildForm(this.fb);
	static buildForm(fb: UntypedFormBuilder): UntypedFormGroup {
		const form = fb.group({
			name: [null, Validators.required],
			memberIds: [[], Validators.required],
			managerIds: [[]],
			projects: [[]],
			tags: [[]],
			imageUrl: [{ value: null, disabled: true }],
			imageId: []
		});
		return form;
	}

	constructor(
		private readonly fb: UntypedFormBuilder,
		private readonly store: Store,
		private readonly toastrService: ToastrService
	) {}

	ngOnInit() {
		this.store.selectedOrganization$
			.pipe(
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
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
	 * Set Form Values based on an existing team.
	 */
	patchFormValue() {
		// Check if there is a valid team
		if (this.team) {
			// Extract employee and manager IDs from the team
			const selectedEmployees = this.team.members.map((member) => member.id);
			const selectedManagers = this.team.managers.map((manager) => manager.id);

			// Patch form values with team information
			this.form.patchValue({
				name: this.team.name,
				tags: this.team.tags,
				memberIds: selectedEmployees,
				managerIds: selectedManagers,
				imageUrl: this.team.image?.fullUrl,
				imageId: this.team.image?.id,
				projects: this.team.projects.map((project: IOrganizationProject) => project.id)
			});
		}
	}

	/**
	 * Add or edit teams based on the form values.
	 * Emits an event with the team information.
	 */
	addOrEditTeams() {
		// Check if there is a valid organization
		if (!this.organization) {
			return;
		}

		// Extract organizationId and tenantId from the organization and user store
		const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;

		const projects = this.form.get('projects').value;

		// Prepare team information and emit the event
		this.addOrEditTeam.emit({
			...this.form.value, // Include form values
			projects: projects.map((id: string) => this.projects.find((p) => p.id === id)).filter((p) => !!p), // Map project IDs to projects and filter out null values
			organizationId,
			tenantId
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

	/**
	 * On Selected Projects Handler
	 *
	 * @param projects
	 */
	onProjectsSelected(projects: IOrganizationProject[]) {
		this.form.get('projects').setValue(projects);
		this.form.get('projects').updateValueAndValidity();
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

	/**
	 *
	 * @param image
	 */
	updateImageAsset(image: IImageAsset) {
		try {
			if (image && image.id) {
				this.form.get('imageId').setValue(image.id);
				this.form.get('imageUrl').setValue(image.fullUrl);
			} else {
				this.form.get('imageUrl').setValue(DUMMY_PROFILE_IMAGE);
			}
			this.form.updateValueAndValidity();
		} catch (error) {
			console.log("Error while updating team's avatars");
			this.handleImageUploadError(error);
		}
	}

	/**
	 *
	 * @param error
	 */
	handleImageUploadError(error: any) {
		this.toastrService.danger(error);
	}
}
