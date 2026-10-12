import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

@Component({
    selector: 'ngx-created-at',
    templateUrl: './created-at.component.html',
    styleUrls: ['./created-at.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class CreatedAtComponent {

	@Input() value: string | Date;
	@Input() rowData: any;
}
