import { ChangeDetectorRef, DestroyRef, Directive, inject, OnInit, TemplateRef, ViewContainerRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RegistrationConfigService } from '../services/auth/registration-config.service';

/**
 * Renders its content only while the server accepts public sign-ups, e.g. a "Register" link:
 *
 * ```html
 * <p *gaRegistrationEnabled><a routerLink="/auth/register">Register</a></p>
 * ```
 *
 * The content appears once the server has answered, so a closed server never flashes the link. A server that cannot
 * answer (an older API) shows it, as it always has.
 */
@Directive({
	selector: '[gaRegistrationEnabled]',
	standalone: true
})
export class RegistrationEnabledDirective implements OnInit {
	private readonly _templateRef = inject(TemplateRef);
	private readonly _viewContainer = inject(ViewContainerRef);
	private readonly _changeDetectorRef = inject(ChangeDetectorRef);
	private readonly _destroyRef = inject(DestroyRef);
	private readonly _registrationConfigService = inject(RegistrationConfigService);

	ngOnInit(): void {
		this._registrationConfigService.registrationEnabled$
			.pipe(takeUntilDestroyed(this._destroyRef))
			.subscribe((enabled) => {
				this._viewContainer.clear();
				if (enabled) {
					this._viewContainer.createEmbeddedView(this._templateRef);
				}
				// The host may use OnPush change detection; the answer arrives outside its inputs.
				this._changeDetectorRef.markForCheck();
			});
	}
}
