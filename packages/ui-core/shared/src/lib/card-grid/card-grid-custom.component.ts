import {
	Component,
	Input,
	OnChanges,
	OnDestroy,
	OnInit,
	type SimpleChanges,
	ViewChild,
	ViewContainerRef,
	ChangeDetectionStrategy
} from '@angular/core';
import { ComponentLayoutStyleEnum } from '@gauzy/contracts';

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
		const inputs = this.inputs ?? {};
		Object.keys(this._initialInputs)
			.filter((key) => !(key in inputs))
			.forEach((key) => {
				instance[key] = this._initialInputs[key];
				delete this._initialInputs[key];
			});
		Object.keys(inputs)
			.filter((key) => !(key in this._initialInputs))
			.forEach((key) => (this._initialInputs[key] = instance[key]));

		Object.assign(instance, {
			...inputs,
			value: this.value,
			rowData: this.rowData,
			layout: ComponentLayoutStyleEnum.CARDS_GRID
		});
	}
}
