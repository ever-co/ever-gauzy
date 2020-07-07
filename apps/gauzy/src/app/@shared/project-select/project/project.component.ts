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
	projects: OrganizationProjects[];

	@Input() disabled = false;
	@Input() multiple = false;

	onChange: any = () => {};
	onTouched: any = () => {};

	constructor(private organizationProjects: OrganizationProjectsService) {}

	set projectId(val: string | string[]) {
		// this value is updated by programmatic changes if( val !== undefined && this.val !== val){
		this._projectId = val;
		console.log('projectId', this._projectId);
		this.onChange(val);
		this.onTouched(val);
	}
	get projectId(): string | string[] {
		// this value is updated by programmatic changes if( val !== undefined && this.val !== val){
		return this._projectId;
	}

	ngOnInit() {
		this.loadProjects();
	}

	private async loadProjects(): Promise<void> {
		const { items = [] } = await this.organizationProjects.getAll([]);
		this.projects = items;
		// this._projectId = this._projectId;
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
