import { Injectable } from '@angular/core';
import { FormGroup } from '@angular/forms';

@Injectable({
	providedIn: 'root'
})
export class ValidationService {
	constructor() {}
	validateDate(form: FormGroup): void {
		const offerDate = form.get('offerDate');
		const acceptDate = form.get('acceptDate');
		const rejectDate = form.get('rejectDate');

		if (acceptDate.value && acceptDate.value < offerDate.value) {
			acceptDate.setErrors({ invalid: true });
		}

		if (rejectDate.value && rejectDate.value < offerDate.value) {
			rejectDate.setErrors({ invalid: true });
		}
	}
}
