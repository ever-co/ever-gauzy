import {
	Directive,
	Input,
	Output,
	HostListener,
	EventEmitter,
	OnDestroy
} from '@angular/core';
import {
	PromptComponent,
	PromptDialogOptions
} from '../prompt/prompt.component';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { NbDialogService } from '@nebular/theme';

@UntilDestroy({ checkProperties: true })
@Directive({
	selector: '[ngxPromptDialog]'
})
export class PromptDirective implements OnDestroy {
	data: PromptDialogOptions;

	@Input() set message(value) {
		this.data.message = value;
	}
	@Input() set title(value) {
		this.data.title = value;
	}

	@Input() set okText(value) {
		this.data.okText = value;
	}

	@Input() set cancelText(value) {
		this.data.cancelText = value;
	}

	@Input() set placeholder(value) {
		this.data.placeholder = value;
	}

	@Input() set inputType(value) {
		this.data.inputType = value || 'text';
	}

	@Output() callback = new EventEmitter<string | string[]>();

	constructor(private dialogService: NbDialogService) {}

	@HostListener('click', ['$event']) onClick($event) {
		$event.stopPropagation();

		const dialogRef = this.dialogService.open(PromptComponent, {
			dialogClass: 'modal-sm',
			context: {
				data: this.data
			}
		});

		dialogRef.onClose.pipe(untilDestroyed(this)).subscribe((confirm) => {
			if (confirm) {
				this.callback.emit(confirm);
			}
		});
	}

	ngOnDestroy(): void {}
}
