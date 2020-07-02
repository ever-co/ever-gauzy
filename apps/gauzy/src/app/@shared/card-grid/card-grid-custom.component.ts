import {
	Component,
	ComponentFactoryResolver,
	Input,
	OnDestroy,
	OnInit,
	ViewChild,
	ViewContainerRef
} from '@angular/core';
import { ComponentLayoutStyleEnum } from '@gauzy/models';

@Component({
	selector: 'ga-custom-component',
	template: ` <ng-template #dynamicTarget></ng-template> `
})
export class CustomViewComponent implements OnInit, OnDestroy {
	@Input() renderComponent: any;
	@Input() value: any;
	@Input() rowData: any;
	customComponent: any;
	@ViewChild('dynamicTarget', { read: ViewContainerRef, static: true })
	dynamicTarget: any;

	constructor(private resolver: ComponentFactoryResolver) {}

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
		const componentFactory = this.resolver.resolveComponentFactory(
			this.renderComponent
		);
		this.customComponent = this.dynamicTarget.createComponent(
			componentFactory
		);
	}

	protected patchInstance() {
		Object.assign(this.customComponent.instance, {
			value: this.value,
			rowData: this.rowData,
			layout: ComponentLayoutStyleEnum.CARDS_GRID
		});
	}
}
