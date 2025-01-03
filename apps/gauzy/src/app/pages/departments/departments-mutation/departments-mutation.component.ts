import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { IEmployee, IOrganization, IOrganizationDepartment, ITag } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { Store } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ga-departments-mutation',
    templateUrl: './departments-mutation.component.html',
    styleUrls: ['./departments-mutation.component.scss'],
    standalone: false
})
export class DepartmentsMutationComponent implements OnInit {
	/*
	 * Getter & Setter for dynamic department element
	 */
	_department: IOrganizationDepartment;
	get department(): IOrganizationDepartment {
		return this._department;
	}
	@Input() set department(department: IOrganizationDepartment) {
		this._department = department;
		this._syncDepartment();
	}

	@Output()
	canceled = new EventEmitter();

	@Output()
	addOrEditDepartment = new EventEmitter();

	/*
	 * Department Mutation Form
	 */
	public form: UntypedFormGroup = DepartmentsMutationComponent.buildForm(this.fb);
	static buildForm(fb: UntypedFormBuilder): UntypedFormGroup {
		return fb.group({
			name: ['', Validators.required],
			members: [[], Validators.required],
			tags: [[]]
		});
	}

	employees: IEmployee[] = [];
	organization: IOrganization;

	constructor(private readonly fb: UntypedFormBuilder, private readonly store: Store) {}

	ngOnInit() {
		this.store.selectedOrganization$
			.pipe(
				debounceTime(200),
				filter((organization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Sync department
	 */
	private _syncDepartment() {
		if (this.department) {
			this.form.setValue({
				name: this.department.name,
				tags: this.department.tags,
				members: this.department.members.map((member: IEmployee) => member.id)
			});
		}
	}

	/**
	 * Load employees from multiple selected employees
	 *
	 * @param employees
	 */
	public onLoadEmployees(employees: IEmployee[]) {
		this.employees = employees;
	}

	/**
	 * On submit form
	 *
	 * @returns
	 */
	onSubmit() {
		if (this.form.invalid || !this.organization) {
			return;
		}

		const { id: organizationId } = this.organization;
		const { name, tags, members } = this.form.getRawValue();

		this.addOrEditDepartment.emit({
			tags,
			name,
			organizationId,
			members: members.map((id: string) => this.employees.find((e) => e.id === id)).filter((e: IEmployee) => !!e)
		});
	}

	/**
	 * Members selection handler
	 *
	 * @param members
	 */
	onMembersSelected(members: string[]) {
		this.form.get('members').setValue(members);
		this.form.get('members').updateValueAndValidity();
	}

	/**
	 * Tag selection handler
	 *
	 * @param selectedTags
	 */
	selectedTagsEvent(selectedTags: ITag[]) {
		this.form.get('tags').setValue(selectedTags);
		this.form.get('tags').updateValueAndValidity();
	}

	cancel() {
		this.canceled.emit();
	}
}
