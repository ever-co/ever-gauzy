import {
	Directive,
	Input,
	Output,
	HostListener,
	EventEmitter,
	OnDestroy
} from '@angular/core';
import {
	ConfirmComponent,
	ConfirmDialogOptions
} from '../confirm/confirm.component';
import { NbDialogService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy({ checkProperties: true })
@Directive({
	selector: '[ngxConfirmDialog]'
})
export class ConfirmDirective implements OnDestroy {
	data: ConfirmDialogOptions = {};

	@Input() set message(value) {
		this.data.message = value;
	}

	@Input() set title(value) {
		this.data.title = value;
	}

	@Input() set yesText(value) {
		this.data.yesText = value;
	}

	@Input() set noText(value) {
		this.data.noText = value;
	}

	@Output() confirm = new EventEmitter();
	@Output() decline = new EventEmitter();

	constructor(private dialogService: NbDialogService) {}

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
