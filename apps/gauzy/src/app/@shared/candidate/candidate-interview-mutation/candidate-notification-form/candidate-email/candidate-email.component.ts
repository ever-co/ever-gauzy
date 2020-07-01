import { Component, OnInit, Input } from '@angular/core';
import { Candidate, ICandidateInterview, Employee } from '@gauzy/models';
import { FormGroup, FormBuilder } from '@angular/forms';
import { CandidatesService } from '../../../../../@core/services/candidates.service';

@Component({
	selector: 'ga-candidate-email',
	templateUrl: 'candidate-email.component.html',
	styleUrls: ['candidate-email.component.scss']
})
export class CandidateEmailComponent implements OnInit {
	@Input() isCandidate: boolean;
	@Input() templateData: ICandidateInterview;
	@Input() selectedCandidate: Candidate;
	@Input() employees: Employee[];
	form: FormGroup;
	employeeList: string;
	dateTemplate: string;
	candidateName: string;
	emailText: string;
	candidateNameTemplate: string;
	textTemplate: string;
	constructor(
		protected candidatesService: CandidatesService,
		private readonly fb: FormBuilder
	) {}

	ngOnInit() {
		this.loadFormData();
		this.setTemplate();
		this.form.patchValue({
			text: this.isCandidate
				? this.textTemplate
				: this.textTemplate + this.candidateNameTemplate
		});
	}
	loadFormData() {
		this.form = this.fb.group({
			text: [this.emailText]
		});
	}
	public onChange(value: string) {
		this.emailText = value;
	}

	setTemplate() {
		this.candidateName =
			this.selectedCandidate.user.firstName +
			' ' +
			this.selectedCandidate.user.lastName;

		this.getDate(this.templateData.startTime, this.templateData.endTime);

		const res = [];
		this.employees.forEach((employee) => {
			res.push(employee.user.firstName + ' ' + employee.user.lastName);
		});
		this.employeeList = res.join(', ');

		this.textTemplate = `
	 	<p>You are invited to <strong> ${this.templateData.title}</strong></p>
		<p>When <strong> ${this.dateTemplate}</strong></p>
		<p>Where <strong> ${this.templateData.location || 'Online'}</strong></p>
		<p>Interviewer(s) <strong>${this.employeeList}</strong></p>	`;

		this.candidateNameTemplate = `
	 	<p>Candidate <strong> ${this.candidateName}</strong></p>`;
	}

	getDate(startTime: Date, endTime: Date) {
		this.dateTemplate =
			startTime.toDateString() +
			', ' +
			this.getTime(startTime) +
			'-' +
			this.getTime(endTime);
	}
	getTime(time: Date) {
		const hours = time.getHours();
		let minutes: any = time.getMinutes();
		if (minutes === 0) {
			minutes = '00';
		}
		return hours + ':' + minutes;
	}
}
