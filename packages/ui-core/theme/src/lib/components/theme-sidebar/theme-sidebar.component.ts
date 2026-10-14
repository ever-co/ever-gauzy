import {
	AfterViewInit,
	ChangeDetectionStrategy,
	ChangeDetectorRef,
	Component,
	ComponentRef,
	Input,
	OnDestroy,
	ViewChild,
	ViewContainerRef
} from '@angular/core';
import { ISidebarConfig } from '@gauzy/ui-core/core';

@Component({
    selector: 'ngx-theme-sidebar',
    templateUrl: './theme-sidebar.component.html',
    styleUrls: ['./theme-sidebar.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class ThemeSidebarComponent implements AfterViewInit, OnDestroy {
	@Input() config: ISidebarConfig;

	@ViewChild('container', { read: ViewContainerRef })
	private container: ViewContainerRef;

	private componentRef: ComponentRef<any>;

	constructor(private changeDetectorRef: ChangeDetectorRef) {}

	ngAfterViewInit(): void {
		this.loadComponent();
		this.changeDetectorRef.detectChanges();
	}

	private async loadComponent() {
		const renderComponent = this.config.loadComponent();
		const component = renderComponent instanceof Promise ? await renderComponent : renderComponent;

		// Angular 22 removed ComponentFactoryResolver: the container creates the component from its class.
		this.componentRef = this.container.createComponent(component);
		this.componentRef.changeDetectorRef.markForCheck();
	}

	ngOnDestroy() {
		if (this.componentRef) {
			this.componentRef.destroy();
		}
	}
}
