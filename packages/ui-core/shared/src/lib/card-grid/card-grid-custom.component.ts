import {
	Component,
	ComponentFactoryResolver,
	Input,
	OnDestroy,
	OnInit,
	ViewChild,
	ViewContainerRef
} from '@angular/core';
import { ComponentLayoutStyleEnum } from '@gauzy/contracts';

@Component({
	selector: 'ga-custom-component',
	template: ` <ng-template #dynamicTarget></ng-template> `,
	standalone: false
})
export class CustomViewComponent implements OnInit, OnDestroy {
	@Input() renderComponent: any;
	@Input() componentInitFunction: (instance: any) => void;
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
		const componentFactory = this.resolver.resolveComponentFactory(this.renderComponent);
		this.customComponent = this.dynamicTarget.createComponent(componentFactory);
	}

	protected patchInstance() {
		const instance = this.customComponent.instance;

		Object.assign(instance, {
			value: this.value,
			rowData: this.rowData,
			layout: ComponentLayoutStyleEnum.CARDS_GRID
		});

		if (typeof this.componentInitFunction === 'function') {
			try {
				this.componentInitFunction(instance);
			} catch (error) {
				console.log('Error in componentInitFunction:', error);
			}
		}
	}
}
