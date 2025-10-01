import { Component, Input } from '@angular/core';

@Component({
	selector: 'ngx-employment-type',
	templateUrl: './employment-type.component.html',
	styleUrls: ['./employment-type.component.scss'],
	standalone: false
})
export class EmploymentTypeComponent<Entity = any> {
	@Input() value: any;
	@Input() rowData: Entity;
}
