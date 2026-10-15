import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NbAlertModule, NbCardModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { distinctUntilChanged } from 'rxjs';
import { Store } from '@gauzy/ui-core/core';
import { EverWorksStatus, EverWorksUiService } from '../../services/ever-works.service';

/** What the page shows. */
export type EverWorksView = 'loading' | 'ready' | 'unavailable' | 'error';

/** The Ever Works page that creates an integration key with the "Ever Gauzy" preset (plan 02 §1). */
export const EVER_WORKS_NEW_KEY_PATH = '/settings/api-keys?new=integration&preset=ever-gauzy';

/**
 * Integrations > Ever Works (`/pages/integrations/ever-works`, also under `:integrationTenantId`).
 *
 * The page asks the API first. When the API answers 404 the plugin is not loaded on this installation
 * (`EVER_WORKS_ENABLED` is not `true`, the default): the page says so and makes no other request.
 */
@Component({
	selector: 'ngx-ever-works-page',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NbAlertModule, NbCardModule, TranslatePipe],
	template: `
		<nb-card>
			<nb-card-header>{{ 'EVER_WORKS.TITLE' | translate }}</nb-card-header>
			<nb-card-body>
				@switch (view) {
					@case ('unavailable') {
						<p data-test="unavailable">{{ 'EVER_WORKS.UNAVAILABLE' | translate }}</p>
					}
					@case ('error') {
						<nb-alert status="danger" role="alert" data-test="error">{{
							'EVER_WORKS.ERROR' | translate
						}}</nb-alert>
					}
					@case ('ready') {
						<p data-test="ready">{{ 'EVER_WORKS.READY' | translate }}</p>
						<p>{{ 'EVER_WORKS.INTRO' | translate }}</p>
						@if (status?.defaultApiUrl) {
							<p data-test="default-api-url">
								{{ 'EVER_WORKS.DEFAULT_API_URL' | translate }}: <code>{{ status.defaultApiUrl }}</code>
							</p>
						}
						@if (newKeyUrl) {
							<p>
								<a [href]="newKeyUrl" target="_blank" rel="noopener noreferrer" data-test="create-key">{{
									'EVER_WORKS.CREATE_KEY' | translate
								}}</a>
							</p>
						}
						<nb-alert status="info" data-test="connect-soon">{{ 'EVER_WORKS.CONNECT_SOON' | translate }}</nb-alert>
						<p class="versions" data-test="versions">
							{{
								'EVER_WORKS.VERSIONS'
									| translate: { plugin: status?.pluginVersion, contract: status?.contractVersion }
							}}
						</p>
					}
				}
			</nb-card-body>
		</nb-card>
	`,
	styles: [
		`
			.versions {
				opacity: 0.7;
				font-size: 0.85em;
			}
		`
	]
})
export class EverWorksPageComponent implements OnInit {
	private readonly api = inject(EverWorksUiService);
	private readonly store = inject(Store);
	private readonly cdr = inject(ChangeDetectorRef);
	private readonly destroyRef = inject(DestroyRef);

	view: EverWorksView = 'loading';
	status: EverWorksStatus | null = null;
	private organizationId: string | null = null;

	/** The Ever Works page that creates an integration key, when the operator configured the app URL. */
	get newKeyUrl(): string | null {
		const appUrl = this.status?.appUrl;
		return appUrl && /^https:\/\//.test(appUrl) ? `${appUrl}${EVER_WORKS_NEW_KEY_PATH}` : null;
	}

	ngOnInit(): void {
		this.store.selectedOrganization$
			.pipe(
				distinctUntilChanged((a, b) => a?.id === b?.id),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe((organization) => {
				this.organizationId = organization?.id ?? null;
				this.load();
			});
	}

	/** Reads the status for the selected organization; 404 means the plugin is not loaded. */
	load(): void {
		this.api
			.status(this.organizationId)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (status) => {
					this.status = status;
					this.view = 'ready';
					this.cdr.markForCheck();
				},
				error: (error: HttpErrorResponse) => {
					this.status = null;
					this.view = error?.status === 404 ? 'unavailable' : 'error';
					this.cdr.markForCheck();
				}
			});
	}
}
