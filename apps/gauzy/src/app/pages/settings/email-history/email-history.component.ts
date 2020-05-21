import { Component, OnInit } from '@angular/core';
import { NbDialogService } from '@nebular/theme';

@Component({
	selector: 'ngx-email-history',
	templateUrl: './email-history.component.html',
	styleUrls: ['./email-history.component.scss']
})
export class EmailHistoryComponent implements OnInit {
	fakeEmails = [{}, {}, {}, {}];

	constructor(private dialogService: NbDialogService) {}

	ngOnInit() {}

	selectEmail(email: any) {
		console.log('Selecting Email');
	}

	openFiltersDialog() {
		// this.dialogService.open(.....)
		console.log('Opening Filters Dialog');
	}
}
