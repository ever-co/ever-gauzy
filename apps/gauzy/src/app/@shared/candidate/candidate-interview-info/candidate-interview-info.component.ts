import { Component, OnInit } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';

@Component({
	selector: 'ngx-candidate-interview-info',
	templateUrl: './candidate-interview-info.component.html',
	styleUrls: ['./candidate-interview-info.component.scss']
})
export class CandidateInterviewInfoComponent implements OnInit {
	constructor(
		protected dialogRef: NbDialogRef<CandidateInterviewInfoComponent>
	) {}
	interview = {
		title: 'Interview',
		interviewers: ['Denis', 'Mio'],
		location: 'London',
		startTime: new Date(2013, 0, 24, 14, 30, 0, 0),
		endTime: new Date(2013, 0, 24, 15, 30, 0, 0),
		note: 'Some note',
		updatedAt: new Date(2020, 5, 7, 14, 0, 0, 0)
	};
	isMinutes = false;
	hoursUpdate: number;
	currentTime: Date = new Date();
	candidateName = 'John Dowson';
	closeDialog() {
		this.dialogRef.close();
	}

	ngOnInit() {
		this.hoursUpdate =
			this.currentTime.getHours() - this.interview.updatedAt.getHours();
		if (this.hoursUpdate === 0) {
			this.isMinutes = true;
			this.hoursUpdate =
				this.currentTime.getMinutes() -
				this.interview.updatedAt.getMinutes();
		}
	}
}
