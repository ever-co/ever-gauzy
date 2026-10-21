import {
	Component,
	Input,
	OnChanges,
	OnDestroy,
	OnInit,
	type SimpleChanges,
	ViewChild,
	ViewContainerRef,
	ChangeDetectionStrategy,
	reflectComponentType
} from '@angular/core';
import { ComponentLayoutStyleEnum } from '@gauzy/contracts';

const RESERVED_INPUTS = ['value', 'rowData', 'layout'];

@Component({
	selector: 'ga-custom-component',
	template: ` <ng-template #dynamicTarget></ng-template> `,
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class CustomViewComponent implements OnInit, OnChanges, OnDestroy {
	@Input() renderComponent: any;
	@Input() value: any;
	@Input() rowData: any;
	@Input() inputs: Record<string, any>;
	customComponent: any;
	private _initialInputs: Record<string, any> = {};
	@ViewChild('dynamicTarget', { read: ViewContainerRef, static: true })
	dynamicTarget: any;

	ngOnInit() {
		this.createCustomComponent();
		this.patchInstance();
	}

	ngOnChanges(changes: SimpleChanges) {
		if (changes['inputs'] && !changes['inputs'].firstChange && this.customComponent) {
			this.patchInstance();
		}
	}

	ngOnDestroy() {
		if (this.customComponent) {
			this.customComponent.destroy();
		}
	}

	protected createCustomComponent() {
		this.customComponent = this.dynamicTarget.createComponent(this.renderComponent);
	}

	protected patchInstance() {
		const instance = this.customComponent.instance;
		const inputs = Object.fromEntries(
			Object.entries(this.inputs ?? {}).filter(([key]) => !RESERVED_INPUTS.includes(key))
		);
		Object.keys(this._initialInputs)
			.filter((key) => !(key in inputs))
			.forEach((key) => {
				this.setCustomInput(key, this._initialInputs[key]);
				delete this._initialInputs[key];
			});
		Object.keys(inputs)
			.filter((key) => !(key in this._initialInputs))
			.forEach((key) => (this._initialInputs[key] = instance[key]));
		Object.entries(inputs).forEach(([key, value]) => this.setCustomInput(key, value));

		Object.assign(instance, {
			value: this.value,
			rowData: this.rowData,
			layout: ComponentLayoutStyleEnum.CARDS_GRID
		});
		this.customComponent.changeDetectorRef.markForCheck();
	}

	private setCustomInput(key: string, value: any) {
		const input = reflectComponentType(this.renderComponent)?.inputs.find(({ propName }) => propName === key);
		if (input) {
			this.customComponent.setInput(input.templateName, value);
		} else {
			this.customComponent.instance[key] = value;
		}
	}
}
