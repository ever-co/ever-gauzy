import { Component, OnInit, Input } from '@angular/core';
import { FormGroup, Validators, FormBuilder } from '@angular/forms';
import { NbDialogRef } from '@nebular/theme';

export interface InputOptions {
	value: string;
	label: string;
}

export interface PromptDialogOptions {
	inputType:
		| 'text'
		| 'email'
		| 'number'
		| 'checkbox'
		| 'radio'
		| 'password'
		| 'textarea'
		| 'select';
	title: string;
	message: string;
	okText: string;
	cancelText: string;
	placeholder: string;
	options: InputOptions[];
}

@Component({
	selector: 'ngx-prompt',
	templateUrl: './prompt.component.html',
	styleUrls: ['./prompt.component.scss']
})
export class PromptComponent implements OnInit {
	@Input() data: PromptDialogOptions;

	form: FormGroup;

	constructor(
		private dialogRef: NbDialogRef<PromptComponent>,
		private fb: FormBuilder
	) {
		this.form = this.fb.group({
			input: ['', Validators.required]
		});
	}

	ngOnInit() {}

	close() {
		this.dialogRef.close();
	}

	submit() {
		if (this.form.valid) {
			this.dialogRef.close(this.form.get('input').value);
		}
	}
}
