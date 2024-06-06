import { Directive, Input, Output, HostListener, EventEmitter, OnDestroy } from '@angular/core';
import { PromptComponent, PromptDialogOptions } from '../prompt/prompt.component';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../language-base/translation-base.component';

@UntilDestroy({ checkProperties: true })
@Directive({
	selector: '[ngxPromptDialog]'
})
export class PromptDirective extends TranslationBaseComponent implements OnDestroy {
	/*
	 * Getter & Setter for label
	 */
	_label: string;
	get label(): string {
		return this._label;
	}
	@Input() set label(value: string) {
		this._label = value;
	}

	/*
	 * Getter & Setter for title
	 */
	_title: string;
	get title(): string {
		return this._title;
	}
	@Input() set title(value: string) {
		this._title = value;
	}

	/*
	 * Getter & Setter for okText
	 */
	_okText: string = this.getTranslation('BUTTONS.OK');
	get okText(): string {
		return this._okText;
	}
	@Input() set okText(value: string) {
		this._okText = value;
	}

	/*
	 * Getter & Setter for cancelText
	 */
	_cancelText: string = this.getTranslation('BUTTONS.CANCEL');
	get cancelText(): string {
		return this._cancelText;
	}
	@Input() set cancelText(value: string) {
		this._cancelText = value;
	}

	/*
	 * Getter & Setter for placeholder
	 */
	_placeholder: string;
	get placeholder(): string {
		return this._placeholder;
	}
	@Input() set placeholder(value: string) {
		this._placeholder = value;
	}

	/*
	 * Getter & Setter for inputType
	 */
	_inputType: PromptDialogOptions['inputType'] = 'text';
	get inputType(): PromptDialogOptions['inputType'] {
		return this._inputType;
	}
	@Input() set inputType(value: PromptDialogOptions['inputType']) {
		this._inputType = value;
	}

	@Output() callback = new EventEmitter<string | string[]>();

	constructor(private readonly dialogService: NbDialogService, readonly translateService: TranslateService) {
		super(translateService);
	}

	/**
	 * Handles the click event for the onClick function.
	 *
	 * @param {any} $event - The click event object.
	 * @return {void} This function does not return anything.
	 */
	@HostListener('click', ['$event']) onClick($event: any): void {
		$event.stopPropagation();
		const { cancelText, inputType, label, okText, placeholder, title } = this;
		const dialogRef = this.dialogService.open(PromptComponent, {
			dialogClass: 'modal-lg',
			context: {
				data: {
					cancelText,
					inputType,
					label,
					okText,
					placeholder,
					title
				}
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
