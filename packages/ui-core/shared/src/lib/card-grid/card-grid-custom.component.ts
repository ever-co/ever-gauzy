import {
	Component,
	Input,
	OnDestroy,
	OnInit,
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
export class CustomViewComponent implements OnInit, OnDestroy {
	@Input() renderComponent: any;
	@Input() value: any;
	@Input() rowData: any;
	/** Extra inputs for the rendered component — what a table column sets in its `componentInitFunction`, which the grid never runs. */
	@Input() inputs: Record<string, any>;
	customComponent: any;
	@ViewChild('dynamicTarget', { read: ViewContainerRef, static: true })
	dynamicTarget: any;

	ngOnInit() {
		this.createCustomComponent();
		this.patchInstance();
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
		Object.assign(this.customComponent.instance, {
			value: this.value,
			rowData: this.rowData,
			layout: ComponentLayoutStyleEnum.CARDS_GRID,
			...(this.inputs ?? {})
		});
	}
}
