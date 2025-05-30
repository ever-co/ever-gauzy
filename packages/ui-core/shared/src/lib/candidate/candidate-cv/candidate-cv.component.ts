import { Component, OnInit, Input } from '@angular/core';
import { Validators, UntypedFormBuilder } from '@angular/forms';
@Component({
    selector: 'ga-candidate-cv',
    templateUrl: 'candidate-cv.component.html',
    standalone: false
})
export class CandidateCvComponent implements OnInit {
	@Input() documentUrl: any;
	@Input() isDocument: false;
	form: any;
	cvUrl: any;
	constructor(private readonly fb: UntypedFormBuilder) { }

	ngOnInit(): void {
		this.loadFormData();
	}
	loadFormData = () => {
		this.form = this.fb.group({
			cvUrl: [
				'',
				Validators.compose([
					Validators.pattern(
						new RegExp(
							`(http)?s?:?(\/\/[^"']*\.(?:doc|docx|pdf|))`,
							'g'
						)
					)
				])
			]
		});
		this.cvUrl = this.form.get('cvUrl');
	};
}
