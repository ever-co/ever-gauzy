import {
	ApplicationRef,
	ComponentRef,
	createComponent,
	Directive,
	ElementRef,
	EnvironmentInjector,
	HostListener,
	Injector
} from '@angular/core';
import { tap } from 'rxjs/operators';
import { NbCardComponent, NbDialogRef, NbDialogService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { UnderConstructionPopupComponent } from '../components/popup/popup.component';

@UntilDestroy({ checkProperties: true })
@Directive({
	selector: '[underConstruction]',
	standalone: false
})
export class UnderConstructionDirective {
	private _popupComponentRef: ComponentRef<UnderConstructionPopupComponent>;
	private _dialogRef: NbDialogRef<NbCardComponent>;

	constructor(
		private readonly _elementRef: ElementRef,
		private readonly _dialogService: NbDialogService,
		private readonly _injector: Injector,
		private readonly _environmentInjector: EnvironmentInjector,
		private readonly _applicationRef: ApplicationRef
	) {
		// Create element
		const popup = document.createElement('popup-component');

		// Create the component using the modern API (Angular 13+)
		this._popupComponentRef = createComponent(UnderConstructionPopupComponent, {
			elementInjector: this._injector,
			environmentInjector: this._environmentInjector,
			hostElement: popup
		});

		// Attach to the view so that the change detector knows to run
		this._applicationRef.attachView(this._popupComponentRef.hostView);

		// Listen for event
		this._popupComponentRef.instance.onClosed
			.pipe(
				tap(() => this._dialogRef.close()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Opens a dialog if the target element is clicked.
	 *
	 * @param {MouseEvent} event - The mouse event that triggered the click.
	 * @param {HTMLElement} targetElement - The element that was clicked.
	 * @return {void} This function does not return anything.
	 */
	@HostListener('document:click', ['$event', '$event.target'])
	public open(event: MouseEvent, targetElement: HTMLElement): void {
		if (!targetElement) {
			return;
		}
		const clicked = this._elementRef.nativeElement.contains(targetElement);
		if (clicked) {
			// Type assertion needed due to multiple @angular/core versions in monorepo causing TemplateRef type mismatch
			this._dialogRef = this._dialogService.open(this._popupComponentRef.instance.popup as any);
		}
	}
}
