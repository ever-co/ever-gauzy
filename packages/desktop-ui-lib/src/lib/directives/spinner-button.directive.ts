import { Directive, Input, Renderer2, TemplateRef, ViewContainerRef, inject } from '@angular/core';
import { NbSpinnerComponent } from '@nebular/theme';

@Directive({
	selector: '[gauzySpinnerButton]',
	standalone: false
})
export class SpinnerButtonDirective {
	private _isSpinning: boolean | null = null;
	private _spinner: HTMLElement | null = null;
	private _viewContainer = inject(ViewContainerRef);
	private _templateRef = inject(TemplateRef<any>);
	private _render = inject(Renderer2);

	@Input('gauzySpinnerButton')
	set show(value: boolean) {
		if (!!value !== this._isSpinning) {
			this._viewContainer.clear();
			this._isSpinning = value;
			if (!value) {
				this._viewContainer.createEmbeddedView(this._templateRef);
				if (this._spinner?.parentElement) {
					this._render.setStyle(this._spinner.parentElement, 'gap', '0px');
				}
			} else {
				this._addSpinner();
			}
		}
	}

	private _addSpinner() {
		const container = this._viewContainer.createComponent(NbSpinnerComponent);

		container.instance.size = 'small';
		container.instance.message = '';

		const spinner = container.location.nativeElement as HTMLElement;
		this._render.setStyle(spinner, 'background', 'unset');
		this._render.setStyle(spinner, 'position', 'relative');

		if (spinner.firstChild) {
			this._render.setStyle(spinner.firstChild, 'border-top-color', 'inherit');
			this._render.setStyle(spinner.firstChild, 'border-bottom-color', 'inherit');
			this._render.setStyle(spinner.firstChild, 'border-left-color', 'inherit');
			this._render.setStyle(spinner.firstChild, 'width', '14px');
			this._render.setStyle(spinner.firstChild, 'height', '14px');
		}

		if (spinner.parentElement) {
			this._render.setStyle(spinner.parentElement, 'display', 'flex');
			this._render.setStyle(spinner.parentElement, 'gap', '0.5rem');
		}

		this._spinner = spinner;
	}
}
