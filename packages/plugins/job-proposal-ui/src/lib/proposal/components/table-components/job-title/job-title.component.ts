import { Component, Input } from '@angular/core';

@Component({
    template: `<span>{{ rowData.jobTitle }}</span>`,
    standalone: false
})
export class JobTitleComponent {
	@Input() rowData: any;
	@Input() value: string | number;
}
