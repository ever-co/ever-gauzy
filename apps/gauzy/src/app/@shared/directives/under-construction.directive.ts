import {
	ApplicationRef,
	ComponentFactoryResolver,
	ComponentRef,
	Directive,
	ElementRef,
	HostListener,
	Injector
} from '@angular/core';
import { NbCardComponent, NbDialogRef, NbDialogService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { tap } from 'rxjs/operators';
import { PopupComponent } from '../../@theme/components/popup/popup.component';

@UntilDestroy({ checkProperties: true })
@Directive({
	selector: '[underConstruction]'
})
export class UnderConstructionDirective {
	private _popupComponentRef: ComponentRef<PopupComponent>;
	private _dialogRef: NbDialogRef<NbCardComponent>;

	constructor(
		private readonly _elementRef: ElementRef,
		private readonly _dialogService: NbDialogService,
		private readonly _injector: Injector,
		private readonly _applicationRef: ApplicationRef,
		private readonly _componentFactoryResolver: ComponentFactoryResolver
	) {
		// Create element
		const popup = document.createElement('popup-component');

		// Create the component and wire it up with the element
		const factory = this._componentFactoryResolver.resolveComponentFactory(PopupComponent);
		this._popupComponentRef = factory.create(this._injector, [], popup);

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

	@HostListener('document:click', ['$event', '$event.target'])
	public open(event: MouseEvent, targetElement: HTMLElement): void {
		if (!targetElement) {
			return;
		}
		const clicked = this._elementRef.nativeElement.contains(targetElement);
		if (clicked) {
			this._dialogRef = this._dialogService.open(this._popupComponentRef.instance.popup);
		}
	}
}
