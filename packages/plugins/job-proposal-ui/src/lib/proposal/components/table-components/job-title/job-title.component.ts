import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

@Component({
    template: `<span>{{ rowData.jobTitle }}</span>`,
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class JobTitleComponent {
	@Input() rowData: any;
	@Input() value: string | number;
}
