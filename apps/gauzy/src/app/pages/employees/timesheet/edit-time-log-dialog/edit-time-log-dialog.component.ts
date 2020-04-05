import { Component, OnInit, Input } from '@angular/core';
import { NbDialogService } from '@nebular/theme';
import { TimeLog } from '@gauzy/models';

@Component({
	selector: 'ngx-edit-time-log-dialog',
	templateUrl: './edit-time-log-dialog.component.html',
	styleUrls: ['./edit-time-log-dialog.component.scss']
})
export class EditTimeLogDialogComponent implements OnInit {
	@Input('timeLog') timeLog: TimeLog;

	constructor(private dialogService: NbDialogService) {}

	ngOnInit() {}
}
