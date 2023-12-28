import { Component, Input } from '@angular/core';

@Component({
	template: `
		<span>{{ rowData.jobTitle }}</span>
	`
})
export class JobTitleComponent {
	@Input()
	rowData: any;

	value: string | number;
}
