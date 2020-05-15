import { Component, OnInit, Input } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { ICandidateInterview } from '@gauzy/models';
import { CandidateInterviewService } from '../../../@core/services/candidate-interview.service';

@Component({
	selector: 'ngx-candidate-interview-info',
	templateUrl: './candidate-interview-info.component.html',
	styleUrls: ['./candidate-interview-info.component.scss']
})
export class CandidateInterviewInfoComponent implements OnInit {
	@Input() interviewId: string;
	candidateId: string;
	currentInterview: ICandidateInterview;
	interviewList: ICandidateInterview[];
	isMinutes = false;
	hoursUpdate: number;
	currentTime: Date = new Date();
	candidateName = 'John Dowson';

	constructor(
		protected dialogRef: NbDialogRef<CandidateInterviewInfoComponent>,
		private readonly candidateInterviewService: CandidateInterviewService
	) {}
	closeDialog() {
		this.dialogRef.close();
	}

	ngOnInit() {
		this.loadInterview();
	}
	setTime(interview: ICandidateInterview) {
		// this.hoursUpdate =
		// 	this.currentTime.getHours() - interview.updatedAt.getHours();
		// if (this.hoursUpdate === 0) {
		// 	this.isMinutes = true;
		// 	this.hoursUpdate =
		// 		this.currentTime.getMinutes() -
		// 		interview.updatedAt.getMinutes();
		// }
	}
	private async loadInterview() {
		const res = await this.candidateInterviewService.getAll([
			'interviewers'
		]);
		if (res) {
			this.interviewList = res.items;

			for (const interview of res.items) {
				if (this.interviewId === interview.id) {
					this.currentInterview = interview;
				}
			}
		}
		// this.setTime(this.currentInterview);
	}
}
