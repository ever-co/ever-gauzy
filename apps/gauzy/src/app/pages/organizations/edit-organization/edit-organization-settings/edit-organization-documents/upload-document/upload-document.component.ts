import { Component, OnInit, Input } from '@angular/core';
import { Validators, FormBuilder } from '@angular/forms';

@Component({
	selector: 'ga-upload-doc',
	templateUrl: './upload-document.component.html'
})
export class UploadDocumentComponent implements OnInit {
	@Input() documentUrl: any;
	@Input() isDocument: false;

	form: any;
	docUrl: any;

	constructor(private readonly fb: FormBuilder) {}

	ngOnInit(): void {
		this.loadFormData();
	}

	loadFormData = () => {
		this.form = this.fb.group({
			docUrl: [
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
		this.docUrl = this.form.get('docUrl');
	};
}
