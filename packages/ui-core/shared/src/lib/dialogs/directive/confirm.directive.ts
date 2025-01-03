import { Directive, Input, Output, HostListener, EventEmitter, OnDestroy } from '@angular/core';
import { NbDialogService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ConfirmComponent, ConfirmDialogOptions } from '../confirm/confirm.component';

@UntilDestroy({ checkProperties: true })
@Directive({
    selector: '[ngxConfirmDialog]',
    standalone: false
})
export class ConfirmDirective implements OnDestroy {
	data: ConfirmDialogOptions = {};

	@Input() set message(value: string) {
		this.data.message = value;
	}

	@Input() set title(value: string) {
		this.data.title = value;
	}

	@Input() set yesText(value: string) {
		this.data.yesText = value;
	}

	@Input() set noText(value: string) {
		this.data.noText = value;
	}

	@Output() confirm = new EventEmitter();
	@Output() decline = new EventEmitter();

	constructor(private readonly dialogService: NbDialogService) {}

	/**
	 * Handles the click event and opens a confirmation dialog.
	 *
	 * @param {Event} $event - The click event object.
	 * @return {void} This function does not return anything.
	 */
	@HostListener('click', ['$event']) onClick($event) {
		$event.stopPropagation();

		const dialogRef = this.dialogService.open(ConfirmComponent, {
			dialogClass: 'modal-sm',
			context: {
				data: this.data
			}
		});

		dialogRef.onClose.pipe(untilDestroyed(this)).subscribe((confirm) => {
			if (confirm) {
				this.confirm.emit();
			} else {
				this.decline.emit();
			}
		});
	}

	ngOnDestroy(): void {}
}
