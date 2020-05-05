import { Component, OnInit } from '@angular/core';
import { Validators, FormBuilder, FormArray } from '@angular/forms';
@Component({
	selector: 'ga-candidate-interview-form',
	templateUrl: 'candidate-interview-form.component.html'
})
export class CandidateInterviewFormComponent implements OnInit {
	form: any;

	//Fields for the form
	title: any;
	date: any;
	duration: any;
	timeZone: any;
	// interviewersNotification: any;
	// candidateNotification: any;
	location: any;
	note: any;
	interviewers: string[];

	constructor(private readonly fb: FormBuilder) {}

	ngOnInit() {
		this.loadFormData();
	}
	loadFormData = () => {
		this.form = this.fb.group({
			title: [''],
			date: [''],
			duration: [''],
			timeZone: [''],
			// interviewersNotification: [false],
			// candidateNotification: [false],
			location: [''],
			note: [''],
			interviewers: this.fb.array([])
		});
		const interviewerForm = this.form.controls.interviewers as FormArray;
		interviewerForm.push(
			this.fb.group({
				interviewers: ['', Validators.required]
			})
		);
		//this.title = this.form.get('title');
		//this.date = this.form.get('date');
		//this.duration = this.form.get('duration');
		//	this.timeZone = this.form.get('timeZone');
		// this.interviewersNotification = this.form.get(
		// 	'interviewersNotification'
		// );
		// this.candidateNotification = this.form.get('candidateNotification');
		//	this.location = this.form.get('location');
		//	this.note = this.form.get('note');
		//this.interviewers = this.form.get('candidateNotification');
	};
}
