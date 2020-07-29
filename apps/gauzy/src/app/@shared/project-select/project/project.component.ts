import { Component, OnInit, OnDestroy, Input, forwardRef } from '@angular/core';
import { OrganizationProjects } from '@gauzy/models';
import { OrganizationProjectsService } from 'apps/gauzy/src/app/@core/services/organization-projects.service';
import { NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
	selector: 'ga-project-selector',
	templateUrl: './project.component.html',
	styleUrls: ['./project.component.scss'],
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => ProjectSelectorComponent),
			multi: true
		}
	]
})
export class ProjectSelectorComponent implements OnInit, OnDestroy {
	private _projectId: string | string[];
	private _organizationContactId: string;
	projects: OrganizationProjects[];

	@Input() disabled = false;
	@Input() multiple = false;

	@Input()
	public get organizationContactId(): string {
		return this._organizationContactId;
	}
	public set organizationContactId(value: string) {
		this._organizationContactId = value;
		if (this._organizationContactId) {
			this.loadProjects();
		}
	}

	onChange: any = () => {};
	onTouched: any = () => {};

	constructor(private organizationProjects: OrganizationProjectsService) {}

	set projectId(val: string | string[]) {
		this._projectId = val;
		this.onChange(val);
		this.onTouched(val);
	}
	get projectId(): string | string[] {
		return this._projectId;
	}

	ngOnInit() {
		this.loadProjects();
	}

	private async loadProjects(): Promise<void> {
		const { items = [] } = await this.organizationProjects.getAll([], {
			organizationContactId: this.organizationContactId
		});
		this.projects = items;
		if (
			items.length === 0 ||
			items.find((item) => this.projectId !== item.id)
		) {
			this.projectId = this.multiple ? [] : null;
		}
	}

	writeValue(value: string | string[]) {
		if (this.multiple) {
			this._projectId = value instanceof Array ? value : [value];
		} else {
			this._projectId = value;
		}
	}

	registerOnChange(fn: (rating: number) => void): void {
		this.onChange = fn;
	}

	registerOnTouched(fn: () => void): void {
		this.onTouched = fn;
	}

	setDisabledState(isDisabled: boolean): void {
		this.disabled = isDisabled;
	}
	ngOnDestroy() {}
}
