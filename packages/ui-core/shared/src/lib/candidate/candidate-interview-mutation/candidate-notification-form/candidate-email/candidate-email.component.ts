import { Component, OnInit, Input, inject } from '@angular/core';
import { ICandidate, ICandidateInterview, IEmployee } from '@gauzy/contracts';
import { UntypedFormGroup, UntypedFormBuilder } from '@angular/forms';
import { CandidatesService } from '@gauzy/ui-core/core';

@Component({
	selector: 'ga-candidate-email',
	templateUrl: 'candidate-email.component.html',
	styleUrls: ['candidate-email.component.scss'],
	standalone: false
})
export class CandidateEmailComponent implements OnInit {
	protected readonly candidatesService = inject(CandidatesService);
	private readonly fb = inject(UntypedFormBuilder);

	@Input() isCandidate: boolean;
	@Input() templateData: ICandidateInterview;
	@Input() selectedCandidate: ICandidate;
	@Input() employees: IEmployee[];
	form: UntypedFormGroup;
	employeeList: string;
	dateTemplate: string;
	candidateName: string;
	emailText: string;
	candidateNameTemplate: string;
	textTemplate: string;

	ngOnInit() {
		this.loadFormData();
		this.setTemplate();
		this.form.patchValue({
			text: this.isCandidate ? this.textTemplate : this.textTemplate + this.candidateNameTemplate
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
		this.candidateName = this.selectedCandidate.user.firstName + ' ' + this.selectedCandidate.user.lastName;

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
		this.dateTemplate = startTime.toDateString() + ', ' + this.getTime(startTime) + '-' + this.getTime(endTime);
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
