import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { DateFormatPipe } from '../../pipes/date-format.pipe';

@Component({
	selector: 'gauzy-project-organization-grid-details',
	templateUrl: './project-organization-grid-details.component.html',
	styleUrls: ['./project-organization-grid-details.component.scss'],
	standalone: true,
	imports: [CommonModule, TranslateModule, DateFormatPipe]
})
export class ProjectOrganizationGridDetailsComponent {
	@Input()
	value: string | number;
	@Input()
	rowData: any;
}
