import { Component } from '@angular/core';

@Component({
	selector: 'ngx-calendar-view-select',
	template: `
		<nb-select placeholder="Select Showcase" [(selected)]="selectedItem">
			<nb-option value="view1">View 1</nb-option>
			<nb-option value="view2">View 2</nb-option>
		</nb-select>
	`,
	styleUrls: ['../time-calendar.component.scss']
})
export class CalendarViewSelectComponent {
	selectedItem = 'view1';
}
