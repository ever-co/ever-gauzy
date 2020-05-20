import { Component, OnInit, Input } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { ICandidateInterview, Candidate } from '@gauzy/models';
import { CandidateInterviewersService } from '../../../@core/services/candidate-interviewers.service';
import { EmployeesService } from '../../../@core/services';
import { CandidateInterviewService } from '../../../@core/services/candidate-interview.service';
@Component({
	selector: 'ngx-candidate-interview-info',
	templateUrl: './candidate-interview-info.component.html',
	styleUrls: ['./candidate-interview-info.component.scss']
})
export class CandidateInterviewInfoComponent implements OnInit {
	@Input() interviewId: any; //from calendar
	@Input() interviewList: ICandidateInterview[]; //from profile
	@Input() selectedCandidate: Candidate;
	candidateId: string;
	interviewerNames = [];
	currentInterview: ICandidateInterview;
	isMinutes = false;
	nameList: string;
	hoursUpdate: number;
	currentTime: Date = new Date();
	isNextBtn = true;
	index = 1;
	isPreviousBtn = false;
	constructor(
		protected dialogRef: NbDialogRef<CandidateInterviewInfoComponent>,
		private candidateInterviewersService: CandidateInterviewersService,
		private employeesService: EmployeesService,
		private candidateInterviewService: CandidateInterviewService
	) {}
	closeDialog() {
		this.dialogRef.close();
	}

	ngOnInit() {
		//if (this.interviewId) {
		//		this.loadInterviews(this.interviewId);
		//	}
		this.currentInterview = this.interviewList[0];
		this.getData(this.currentInterview.id);
		this.setTime(this.currentInterview.updatedAt);
	}
	/*	async loadInterviews(id: string) {
		if (id) {
			const res = await this.candidateInterviewService.findById(id);
			if (res) {
				this.interviewList = [];
				this.interviewList.push(res);
			}
		}
	}*/
	setTime(time: any) {
		const date = new Date(time);
		this.hoursUpdate = this.currentTime.getHours() - date.getHours();
		if (this.hoursUpdate === 0) {
			this.isMinutes = true;
			this.hoursUpdate =
				this.currentTime.getMinutes() - date.getMinutes();
		} else {
			this.isMinutes = false;
		}
	}

	async getData(id: string) {
		this.interviewerNames = [];
		const res = await this.candidateInterviewersService.findByInterviewId(
			id
		);
		if (res) {
			for (const interview of res) {
				const employee = await this.employeesService.getEmployeeById(
					interview.employeeId,
					['user']
				);
				if (employee) {
					this.interviewerNames.push(
						employee.user.firstName + ' ' + employee.user.lastName
					);
					this.nameList = this.interviewerNames.join(', ');
				}
			}
		}
	}
	previous() {
		--this.index;
		this.isNextBtn = true;
		const currentIndex = this.interviewList.indexOf(this.currentInterview);
		const newIndex = currentIndex === 0 ? currentIndex : currentIndex - 1;
		this.currentInterview = this.interviewList[newIndex];
		this.getData(this.currentInterview.id);
		this.setTime(this.currentInterview.updatedAt);
		if (currentIndex === 1) {
			this.isPreviousBtn = false;
		}
	}
	next() {
		++this.index;
		this.isPreviousBtn = true;
		const currentIndex = this.interviewList.indexOf(this.currentInterview);
		const newIndex =
			currentIndex === this.interviewList.length - 1
				? currentIndex
				: currentIndex + 1;
		this.currentInterview = this.interviewList[newIndex];
		this.getData(this.currentInterview.id);
		this.setTime(this.currentInterview.updatedAt);
		if (currentIndex === this.interviewList.length - 2) {
			this.isNextBtn = false;
		}
	}
}
