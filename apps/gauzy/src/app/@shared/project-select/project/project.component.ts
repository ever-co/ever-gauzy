import { Component, OnInit, OnDestroy, Input, forwardRef } from '@angular/core';
import { OrganizationProjects } from '@gauzy/models';
import { Subject } from 'rxjs';
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
	projects: OrganizationProjects[];

	onChange: any = () => {};
	onTouched: any = () => {};
	val: any;

	@Input() disabled = false;

	set projectId(val: string) {
		// this value is updated by programmatic changes if( val !== undefined && this.val !== val){
		this.val = val;
		this.onChange(val);
		this.onTouched(val);
	}
	get projectId() {
		// this value is updated by programmatic changes if( val !== undefined && this.val !== val){
		return this.val;
	}

	private _ngDestroy$ = new Subject<void>();

	constructor(private organizationProjects: OrganizationProjectsService) {}

	ngOnInit() {
		this.loadProjects();
	}

	private async loadProjects(): Promise<void> {
		const { items = [] } = await this.organizationProjects.getAll([]);
		this.projects = items;
		this.projectId = this.val;
	}

	writeValue(value: any) {
		this.projectId = value;
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
	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
