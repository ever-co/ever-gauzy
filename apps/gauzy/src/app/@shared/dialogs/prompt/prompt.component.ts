import { Component, OnInit, Input } from '@angular/core';
import { FormGroup, Validators, FormBuilder } from '@angular/forms';
import { NbDialogRef } from '@nebular/theme';

export interface InputOptions {
	value: string;
	label: string;
}

export interface PromptDialogOptions {
	inputType?:
		| 'text'
		| 'email'
		| 'number'
		| 'checkbox'
		| 'radio'
		| 'password'
		| 'textarea'
		| 'select';
	title?: string;
	label?: string;
	okText?: string;
	cancelText?: string;
	placeholder?: string;
	options?: InputOptions[];
}

@Component({
	selector: 'ngx-prompt',
	templateUrl: './prompt.component.html',
	styleUrls: ['./prompt.component.scss']
})
export class PromptComponent implements OnInit {
	@Input() data: PromptDialogOptions;

	form: FormGroup;
	showPassword = false;

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

	getInputType() {
		if (this.showPassword) {
		  	return 'text';
		}
		return 'password';
	}
	
	toggleShowPassword() {
		this.showPassword = !this.showPassword;
	}

	isInvalidControl(control: string) {
		if (!this.form.contains(control)) {
			return true;
		}
		return this.form.get(control).touched && this.form.get(control).invalid;
	}
}
