// tslint:disable: variable-name
import { Directive, Input, Output, HostListener, EventEmitter, OnDestroy } from '@angular/core';
import { NbDialogService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { AlertComponent, AlertDialogOptions } from '../alert/alert.component';

@UntilDestroy({ checkProperties: true })
@Directive({
	selector: '[ngxAlertDialog]'
})
export class AlertDirective implements OnDestroy {
	data: AlertDialogOptions = {};

	@Input() set message(value: string) {
		this.data.message = value;
	}
	@Input() set title(value: string) {
		this.data.title = value;
	}
	@Input() set closeText(value: string) {
		this.data.closeText = value;
	}

	@Output() close = new EventEmitter();

	constructor(private readonly dialogService: NbDialogService) {}

	/**
	 * Handles the click event and opens an alert dialog.
	 *
	 * @param {Event} $event - The click event object.
	 * @return {void} This function does not return anything.
	 */
	@HostListener('click', ['$event']) onClick($event) {
		$event.stopPropagation();
		const dialogRef = this.dialogService.open(AlertComponent, {
			dialogClass: 'modal-sm',
			context: {
				data: this.data
			}
		});

		dialogRef.onClose.pipe(untilDestroyed(this)).subscribe((result) => {
			this.close.emit();
		});
	}

	ngOnDestroy(): void {}
}
