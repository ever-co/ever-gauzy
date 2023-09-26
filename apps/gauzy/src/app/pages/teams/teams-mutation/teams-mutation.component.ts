import { Component, OnInit, Output, EventEmitter, Input } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { filter, tap } from 'rxjs/operators';
import { IEmployee, IOrganization, IImageAsset, IOrganizationProject, IOrganizationTeam, ITag } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange, isNotEmpty } from '@gauzy/common-angular';
import { Store } from '../../../@core/services';
import { DUMMY_PROFILE_IMAGE, ToastrService } from '../../../@core';

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
	public form: FormGroup = TeamsMutationComponent.buildForm(this.fb);
	static buildForm(fb: FormBuilder): FormGroup {
		const form = fb.group({
			name: [null, Validators.required],
			memberIds: [null, Validators.required],
			managerIds: [],
			projects: [],
			tags: [],
			imageUrl: [
				{ value: null, disabled: true }
			],
			imageId: [],
		});
		form.get('memberIds').setValue([]);
		form.get('managerIds').setValue([]);
		form.get('projects').setValue([]);
		form.get('tags').setValue([]);
		return form;
	}

	constructor(
		private readonly fb: FormBuilder,
		private readonly store: Store,
		private readonly toastrService: ToastrService
	) { }

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
				managerIds: selectedManagers,
				imageUrl: this.team.image?.fullUrl,
				imageId: this.team.image?.id,
				projects: this.team.projects.map((project: IOrganizationProject) => project.id),
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
			projects: this.form.get('projects').value.map((id) => this.projects.find((p) => p.id === id)).filter((p) => !!p),
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

	handleImageUploadError(error: any) {
		this.toastrService.danger(error);
	}
}
