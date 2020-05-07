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
	hoursUpdate: number;
	time: Date = new Date();
	currentTime: Date = new Date();
	candidateName = 'John Dowson';
	interviewersName = ['Brus'];
	interviewLocation = 'London';
	interviewNote = 'Some note';
	closeDialog() {
		this.dialogRef.close();
	}

	ngOnInit() {
		this.currentTime.setHours(this.currentTime.getHours() + 1);
		this.hoursUpdate = this.currentTime.getHours() - this.time.getHours();
	}
}
