import { Injectable } from '@angular/core';
import { NbToastrService } from '@nebular/theme';

@Injectable({
	providedIn: 'root'
})
export class ErrorHandlingService {
	constructor(private toastrService: NbToastrService) {}

	errorTitle: string;
	errorContent: string;

	public handleError(err: any) {
		this.getErrorDetails(err);
		this.toastrService.danger(this.errorContent, this.errorTitle);
	}

	private getErrorDetails(err) {
		const message: string = err.error.message;
		const detail: string = err.error.detail;

		if (message) {
			const keywords = message.split(' ', 3).join(' ');

			switch (keywords) {
				case 'duplicate key value':
					this.handleDuplicateKeyError(detail);
					this.errorTitle = 'Record already exists';
					break;
				default:
					this.errorTitle = message;
			}
		} else {
			const keywords = err.message.split(' ', 3).join(' ');

			switch (keywords) {
				case 'Http failure response':
					this.errorTitle = 'Lost connection with the server';
					this.errorContent = 'Please try again later';
					break;
				default:
					this.errorTitle = 'Error';
					this.errorContent = err.message;
			}
		}
	}

	private handleDuplicateKeyError(detail) {
		if (detail) {
			const firstIndexKey = detail.indexOf('(') + 1;
			const lastIndexKey = detail.indexOf(')');
			const firstIndexValue = detail.lastIndexOf('(') + 1;
			const lastIndexValue = detail.lastIndexOf(')');

			const key = detail.substring(firstIndexKey, lastIndexKey);
			const value = detail.substring(firstIndexValue, lastIndexValue);

			this.errorContent = `The ${key}: ${value} already exists. Please use another one`;
		}
	}
}
