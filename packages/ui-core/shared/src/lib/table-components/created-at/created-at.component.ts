import { Component, Input } from '@angular/core';
import { DateTimeFormatPipe } from '../../pipes/datetime-format.pipe';

@Component({
	selector: 'ngx-created-at',
	templateUrl: './created-at.component.html',
	styleUrls: ['./created-at.component.scss'],
	standalone: true,
	imports: [DateTimeFormatPipe]
})
export class CreatedAtComponent {
	@Input() value: string | Date;
	@Input() rowData: any;
}
