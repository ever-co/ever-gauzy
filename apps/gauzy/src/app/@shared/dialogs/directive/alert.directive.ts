// tslint:disable: variable-name
import {
	Directive,
	Input,
	Output,
	HostListener,
	EventEmitter,
	OnDestroy
} from '@angular/core';
import { AlertComponent, AlertDialogOptions } from '../alert/alert.component';
import { NbDialogService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
@UntilDestroy({ checkProperties: true })
@Directive({
	selector: '[ngxAlertDialog]'
})
export class AlertDirective implements OnDestroy {
	data: AlertDialogOptions = {};

	@Input() set message(value) {
		this.data.message = value;
	}
	@Input() set title(value) {
		this.data.title = value;
	}
	@Input() set closeText(value) {
		this.data.closeText = value;
	}

	@Output() close = new EventEmitter();

	constructor(private dialogService: NbDialogService) {}

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
