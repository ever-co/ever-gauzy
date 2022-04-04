import { Component } from "@angular/core";
import { ProgressStatusComponent } from "../../progress-status/progress-status/progress-status.component";


@Component({
	selector: 'ga-table-progress-bar',
	templateUrl: './table-progress-bar.component.html',
	styleUrls: ['./table-progress-bar.component.scss']
})
export class TableProgressBarComponent extends ProgressStatusComponent {}