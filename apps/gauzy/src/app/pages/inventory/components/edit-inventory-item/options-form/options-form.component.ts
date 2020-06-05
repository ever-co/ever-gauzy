import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { ProductOption } from '@gauzy/models';

export interface OptionCreateInput {
	name: string;
	code: string;
}

@Component({
	selector: 'ngx-options-form',
	templateUrl: './options-form.component.html',
	styleUrls: ['./options-form.component.scss']
})
export class OptionsFormComponent implements OnInit {
	activeOption: ProductOption;
	activeOptionName: string;
	optionMode = 'create';

	@Input() options: ProductOption[];
	@Output() optionsUpdated = new EventEmitter<ProductOption[]>();
	@Output() optionDeleted = new EventEmitter<ProductOption>();

	ngOnInit(): void {
		this.resetOptionForm();
	}

	onSaveOption() {
		if (!(this.activeOption.name && this.activeOption.code)) return;

		if (this.optionMode === 'create') {
			this.options = this.options.concat([
				{
					name: this.activeOption.name,
					code: this.activeOption.code
				}
			]);
		} else {
			this.options = this.options.filter((option) => {
				return option.name !== this.activeOptionName;
			});
			this.options.push(this.activeOption);
		}

		this.optionsUpdated.emit(this.options);
		this.resetOptionForm();
	}

	onRemoveOption(optionInput: ProductOption) {
		if (!optionInput) return;

		this.options = this.options.filter(
			(option) => option.name !== optionInput.name
		);
		this.optionDeleted.emit(optionInput);
		this.optionsUpdated.emit(this.options);
		this.resetOptionForm();
	}

	onEditOption(optionTarget: ProductOption) {
		if (!optionTarget) return;

		this.optionMode = 'edit';
		this.activeOptionName = optionTarget.name;
		this.activeOption = { ...optionTarget };
	}

	resetOptionForm() {
		this.activeOption = { name: '', code: '' };
		this.activeOptionName = '';
		this.optionMode = 'create';
	}
}
