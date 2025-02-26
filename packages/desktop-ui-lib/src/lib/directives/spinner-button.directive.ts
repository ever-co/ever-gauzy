import {
	ComponentFactoryResolver,
	Directive,
	Input,
	Renderer2,
	TemplateRef,
	ViewContainerRef,
} from '@angular/core';
import { NbSpinnerComponent } from '@nebular/theme';

@Directive({
    selector: '[gauzySpinnerButton]',
    standalone: false
})
export class SpinnerButtonDirective {
	private _isSpinning = null;
	private _spinner: HTMLElement;

	constructor(
		private _componentFactoryResolver: ComponentFactoryResolver,
		private _templateRef: TemplateRef<any>,
		private _viewContainer: ViewContainerRef,
		private _render: Renderer2
	) {
		this._spinner = null;
	}

	@Input('gauzySpinnerButton')
	set show(value: boolean) {
		if (!!value !== this._isSpinning) {
			this._viewContainer.clear();
			this._isSpinning = value;
			if (!value) {
				this._viewContainer.createEmbeddedView(this._templateRef);
				if (this._spinner) {
					this._render.setStyle(this._spinner.parentElement, 'gap', '0px');
				}
			} else if (value) {
				this._addSpinner();
			}
		}
	}

	private _addSpinner() {
		const componentFactory =
			this._componentFactoryResolver.resolveComponentFactory(
				NbSpinnerComponent
			);
		const container =
			this._viewContainer.createComponent<NbSpinnerComponent>(
				componentFactory
			);

		container.instance.size = 'small';
		container.instance.message = '';

		const spinner = container.location.nativeElement as HTMLElement;
		this._render.setStyle(spinner, 'background', 'unset');
		this._render.setStyle(spinner, 'position', 'relative');

		this._render.setStyle(
			spinner.firstChild,
			'border-top-color',
			'inherit'
		);
		this._render.setStyle(
			spinner.firstChild,
			'border-bottom-color',
			'inherit'
		);
		this._render.setStyle(
			spinner.firstChild,
			'border-left-color',
			'inherit'
		);

		this._render.setStyle(
			spinner.firstChild,
			'width',
			'14px'
		);

		this._render.setStyle(
			spinner.firstChild,
			'height',
			'14px'
		);

		this._render.setStyle(spinner.parentElement, 'display', 'flex');
		this._render.setStyle(spinner.parentElement, 'gap', '0.5rem');

		this._spinner = spinner;
	}
}
