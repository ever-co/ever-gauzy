import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, inject, Input, OnChanges, Output, type SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NbAlertModule, NbButtonModule, NbCardModule, NbInputModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import type { EverWorksConnection, EverWorksKeyValidation, EverWorksMapping, EverWorksSyncRun } from '../../services/ever-works.service';
import { EverWorksUiService } from '../../services/ever-works.service';
import { EverWorksDirectionsComponent } from '../directions/ever-works-directions.component';
import { EverWorksMatchReviewComponent } from '../match-review/ever-works-match-review.component';
import { EverWorksPreviewComponent } from '../preview/ever-works-preview.component';
import { errorText } from '../shared/ever-works-ui.utils';

/** The steps of the wizard, in order (plan 02 §1, plan 06 G-P1-11). */
export const CONNECT_STEPS = ['key', 'connect', 'organization', 'review', 'directions', 'start'] as const;
export type ConnectStep = (typeof CONNECT_STEPS)[number];

/** What the wizard hands back once the first sync has started. */
export interface EverWorksConnectResult {
	mapping: EverWorksMapping;
	run: EverWorksSyncRun;
	/** Why the webhook could not be registered (the change feed keeps the sync going), or `null`. */
	webhookError: string | null;
}

/**
 * Connect an organization to Ever Works (plan 02 §1): create the integration key in Ever Works (a deep
 * link with the "Ever Gauzy" preset), enter the API URL and the key, **Validate** (`whoami`: tenant,
 * pinned organizations, scopes, API version), connect, map this organization to a pinned Ever Works
 * organization, review the matches (people, agents, teams, projects), choose the entities and directions,
 * and from the dry run **Start**: the webhook is registered (best effort) and the first sync starts.
 *
 * A tenant that is already connected starts at the organization step; the key is never shown again. When that
 * connection is not active (paused, a revoked key, an error) and no organization is mapped yet, there are no sync
 * settings to fix it from, so the organization step offers a new key, Resume and Disconnect itself (review F99).
 */
@Component({
	selector: 'ngx-ever-works-connect',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		FormsModule,
		NbAlertModule,
		NbButtonModule,
		NbCardModule,
		NbInputModule,
		TranslatePipe,
		EverWorksDirectionsComponent,
		EverWorksMatchReviewComponent,
		EverWorksPreviewComponent
	],
	template: `
		<ol class="steps" data-test="steps">
			@for (name of steps; track name; let index = $index) {
				<li [class.current]="name === step" [class.done]="index < stepIndex">{{ 'EVER_WORKS.STEPS.' + stepKey(name) | translate }}</li>
			}
		</ol>
		@if (error) {
			<nb-alert status="danger" role="alert" data-test="connect-error">{{ error }}</nb-alert>
		}
		@if (webhookKept) {
			<nb-alert status="warning" role="status" data-test="webhook-kept">{{ 'EVER_WORKS.SETTINGS.DISCONNECT_WEBHOOK_KEPT' | translate }}</nb-alert>
		}
		@switch (step) {
			@case ('key') {
				<section data-test="step-key">
					<h6>{{ 'EVER_WORKS.KEY.TITLE' | translate }}</h6>
					<ol>
						<li>{{ 'EVER_WORKS.KEY.STEP_1' | translate }}</li>
						<li>{{ 'EVER_WORKS.KEY.STEP_2' | translate: { organization: organizationName || '…' } }}</li>
						<li>{{ 'EVER_WORKS.KEY.STEP_3' | translate }}</li>
						<li>{{ 'EVER_WORKS.KEY.STEP_4' | translate }}</li>
						<li>{{ 'EVER_WORKS.KEY.STEP_5' | translate }}</li>
					</ol>
					@if (newKeyUrl) {
						<p>
							<a [href]="newKeyUrl" target="_blank" rel="noopener noreferrer" data-test="create-key">{{ 'EVER_WORKS.CREATE_KEY' | translate }}</a>
						</p>
					} @else {
						<p data-test="no-app-url">{{ 'EVER_WORKS.KEY.NO_APP_URL' | translate }}</p>
					}
					<button nbButton status="primary" type="button" data-test="have-key" (click)="go('connect')">{{ 'EVER_WORKS.KEY.HAVE_KEY' | translate }}</button>
				</section>
			}
			@case ('connect') {
				<section data-test="step-connect">
					<div class="form-group">
						<label for="ew-api-url">{{ 'EVER_WORKS.CONNECT.API_URL' | translate }}</label>
						<input
							nbInput
							fullWidth
							id="ew-api-url"
							name="apiBaseUrl"
							type="url"
							autocomplete="off"
							data-test="api-url"
							[(ngModel)]="apiBaseUrl"
							(ngModelChange)="validation = null"
							[disabled]="busy"
						/>
						<small>{{ 'EVER_WORKS.CONNECT.API_URL_HINT' | translate }}</small>
					</div>
					<div class="form-group">
						<label for="ew-api-key">{{ 'EVER_WORKS.CONNECT.KEY' | translate }}</label>
						<input
							nbInput
							fullWidth
							id="ew-api-key"
							name="apiKey"
							type="password"
							autocomplete="new-password"
							spellcheck="false"
							data-test="api-key"
							[(ngModel)]="apiKey"
							(ngModelChange)="validation = null"
							[disabled]="busy"
						/>
						<small>{{ 'EVER_WORKS.CONNECT.KEY_HINT' | translate }}</small>
					</div>
					@if (validation) {
						<dl class="facts" data-test="validation">
							<dt>{{ 'EVER_WORKS.CONNECT.TENANT' | translate }}</dt>
							<dd data-test="validation-tenant">{{ validation.tenant.slug }}</dd>
							<dt>{{ 'EVER_WORKS.CONNECT.KEY_NAME' | translate }}</dt>
							<dd>{{ validation.keyName }} (<code>{{ validation.keyPrefix }}</code>)</dd>
							<dt>{{ 'EVER_WORKS.CONNECT.ORGANIZATIONS' | translate }}</dt>
							<dd data-test="validation-organizations">{{ organizationNames(validation) }}</dd>
							<dt>{{ 'EVER_WORKS.CONNECT.SCOPES' | translate }}</dt>
							<dd>{{ validation.scopes.length }}</dd>
							<dt>{{ 'EVER_WORKS.CONNECT.API_VERSION' | translate }}</dt>
							<dd>v{{ validation.apiVersion }}</dd>
						</dl>
						@if (!validation.compatible) {
							<nb-alert status="danger" data-test="incompatible">{{ 'EVER_WORKS.CONNECT.INCOMPATIBLE' | translate: { version: validation.apiVersion } }}</nb-alert>
						}
						@if (validation.missingRequiredScopes.length) {
							<nb-alert status="danger" data-test="missing-required">{{
								'EVER_WORKS.CONNECT.MISSING_REQUIRED' | translate: { scopes: validation.missingRequiredScopes.join(', ') }
							}}</nb-alert>
						}
						@if (validation.missingScopes.length) {
							<nb-alert status="warning" data-test="missing-scopes">{{
								'EVER_WORKS.CONNECT.MISSING_SCOPES' | translate: { scopes: validation.missingScopes.join(', ') }
							}}</nb-alert>
						}
					}
					<div class="actions">
						<button nbButton ghost type="button" (click)="go('key')" [disabled]="busy">{{ 'EVER_WORKS.COMMON.BACK' | translate }}</button>
						<button nbButton type="button" data-test="validate" [disabled]="busy || !apiBaseUrl || !apiKey" (click)="validate()">
							{{ 'EVER_WORKS.CONNECT.VALIDATE' | translate }}
						</button>
						<button nbButton status="primary" type="button" data-test="connect" [disabled]="busy || !canConnect" (click)="connect()">
							{{ 'EVER_WORKS.CONNECT.CONNECT' | translate }}
						</button>
					</div>
				</section>
			}
			@case ('organization') {
				<section data-test="step-organization">
					@if (connection) {
						<p data-test="existing-connection">
							{{ 'EVER_WORKS.CONNECT.EXISTING' | translate: { tenant: connection.ewTenant.slug || connection.ewTenant.id, key: connection.key.name || connection.key.prefix || '—' } }}
						</p>
						@if (connection.status !== 'active') {
							<nb-alert status="warning" data-test="connection-not-active">{{ 'EVER_WORKS.CONNECT.STATUS_NOT_ACTIVE' | translate: { status: connection.status } }}</nb-alert>
							<!-- No mapping yet, so no sync settings: the connection is recovered here (review F99). -->
							<section class="recover" data-test="recover">
								<label for="ew-new-key">{{ 'EVER_WORKS.SETTINGS.KEY_TITLE' | translate }}</label>
								<p>{{ 'EVER_WORKS.SETTINGS.KEY_CURRENT' | translate: { name: connection.key.name || '—', prefix: connection.key.prefix || '—' } }}</p>
								<input
									nbInput
									fullWidth
									id="ew-new-key"
									name="newKey"
									type="password"
									autocomplete="new-password"
									spellcheck="false"
									data-test="recover-key"
									[placeholder]="'EVER_WORKS.CONNECT.KEY' | translate"
									[(ngModel)]="newKey"
									[disabled]="busy"
								/>
								<div class="actions">
									<button nbButton status="primary" type="button" data-test="recover-rotate" [disabled]="busy || !newKey.trim()" (click)="rotateKey()">
										{{ 'EVER_WORKS.SETTINGS.ROTATE_KEY' | translate }}
									</button>
									@if (connection.status !== 'disconnected') {
										<button nbButton ghost type="button" data-test="recover-resume" [disabled]="busy" (click)="resume()">{{ 'EVER_WORKS.SETTINGS.RESUME' | translate }}</button>
									}
								</div>
								<p>{{ 'EVER_WORKS.SETTINGS.DISCONNECT_HINT' | translate }}</p>
								@if (!confirmDisconnect) {
									<button nbButton status="danger" outline type="button" data-test="recover-disconnect" [disabled]="busy" (click)="confirmDisconnect = true">
										{{ 'EVER_WORKS.SETTINGS.DISCONNECT' | translate }}
									</button>
								} @else {
									<button nbButton status="danger" type="button" data-test="recover-confirm-disconnect" [disabled]="busy" (click)="disconnect()">
										{{ 'EVER_WORKS.SETTINGS.CONFIRM_DISCONNECT' | translate }}
									</button>
									<button nbButton ghost type="button" [disabled]="busy" (click)="confirmDisconnect = false">{{ 'EVER_WORKS.COMMON.BACK' | translate }}</button>
								}
							</section>
						}
						<p>{{ 'EVER_WORKS.ORGANIZATION.TITLE' | translate }}</p>
						@if (!connection.pinnedOrganizations.length) {
							<nb-alert status="danger" data-test="none-pinned">{{ 'EVER_WORKS.ORGANIZATION.NONE_PINNED' | translate }}</nb-alert>
						} @else {
							<label for="ew-organization">{{ 'EVER_WORKS.ORGANIZATION.SELECT' | translate }}</label>
							<select class="form-control" id="ew-organization" name="everWorksOrganizationId" data-test="ew-organization" [(ngModel)]="everWorksOrganizationId" [disabled]="busy">
								@for (org of connection.pinnedOrganizations; track org.id) {
									<option [value]="org.id">{{ org.displayName || org.slug }}</option>
								}
							</select>
						}
						<div class="actions">
							<button
								nbButton
								status="primary"
								type="button"
								data-test="map"
								[disabled]="busy || !everWorksOrganizationId || connection.status !== 'active'"
								(click)="mapOrganization()"
							>
								{{ 'EVER_WORKS.ORGANIZATION.MAP' | translate }}
							</button>
						</div>
					}
				</section>
			}
			@case ('review') {
				<section data-test="step-review">
					<ngx-ever-works-match-review [organizationId]="organizationId" [integrationTenantId]="mapping?.integrationTenantId ?? null" [mapping]="mapping" />
					<div class="actions">
						<button nbButton status="primary" type="button" data-test="review-next" (click)="go('directions')">{{ 'EVER_WORKS.COMMON.NEXT' | translate }}</button>
					</div>
				</section>
			}
			@case ('directions') {
				<section data-test="step-directions">
					<ngx-ever-works-directions
						[organizationId]="organizationId"
						[mapping]="mapping"
						saveLabel="EVER_WORKS.COMMON.NEXT"
						(savedMapping)="directionsSaved($event)"
					/>
					<div class="actions">
						<button nbButton ghost type="button" (click)="go('review')">{{ 'EVER_WORKS.COMMON.BACK' | translate }}</button>
					</div>
				</section>
			}
			@case ('start') {
				<section data-test="step-start">
					<ngx-ever-works-preview [organizationId]="organizationId" [integrationTenantId]="mapping?.integrationTenantId ?? null" />
					<div class="actions">
						<button nbButton ghost type="button" [disabled]="busy" (click)="go('directions')">{{ 'EVER_WORKS.COMMON.BACK' | translate }}</button>
						<button nbButton status="success" type="button" data-test="start" [disabled]="busy" (click)="start()">
							{{ (busy ? 'EVER_WORKS.PREVIEW.STARTING' : 'EVER_WORKS.PREVIEW.START') | translate }}
						</button>
					</div>
				</section>
			}
		}
	`,
	styles: [
		`
			.steps {
				display: flex;
				flex-wrap: wrap;
				gap: 1rem;
				padding-left: 1.25rem;
				margin-bottom: 1.5rem;
			}
			.steps li {
				opacity: 0.6;
			}
			.steps li.current {
				opacity: 1;
				font-weight: 600;
			}
			.steps li.done {
				opacity: 0.85;
			}
			.form-group {
				margin-bottom: 1rem;
			}
			.facts {
				display: grid;
				grid-template-columns: max-content 1fr;
				gap: 0.25rem 1rem;
			}
			.actions {
				display: flex;
				gap: 0.5rem;
				margin-top: 1rem;
			}
			.recover {
				margin: 1rem 0 1.5rem;
			}
		`
	]
})
export class EverWorksConnectComponent implements OnChanges {
	private readonly api = inject(EverWorksUiService);
	private readonly cdr = inject(ChangeDetectorRef);

	@Input() organizationId: string | null = null;
	@Input() organizationName: string | null = null;
	@Input() defaultApiUrl: string | null = null;
	/** The Ever Works page that creates an integration key (HTTPS only), or `null`. */
	@Input() newKeyUrl: string | null = null;
	/** The tenant's connection, when it is already connected. */
	@Input() connection: EverWorksConnection | null = null;
	/** This organization's mapping, when it exists (the wizard then resumes at the review). */
	@Input() mapping: EverWorksMapping | null = null;
	@Output() readonly started = new EventEmitter<EverWorksConnectResult>();

	readonly steps = CONNECT_STEPS;
	step: ConnectStep = 'key';
	apiBaseUrl = '';
	/** Kept only in this form, sent to the API and cleared once connected; never stored in the browser. */
	apiKey = '';
	validation: EverWorksKeyValidation | null = null;
	everWorksOrganizationId = '';
	/** A new key for a connection that is not active (kept only in this form, cleared once the API has it). */
	newKey = '';
	/** Disconnect asks once more before it goes out. */
	confirmDisconnect = false;
	/**
	 * The connection whose disconnect could not delete its Ever Works webhook subscription, or `null`: the admin is told
	 * how to remove it until a reconnect resumes that connection (same Ever Works tenant) and confirms it is gone
	 * (#11096 review).
	 */
	webhookKept: string | null = null;
	busy = false;
	error: string | null = null;
	/** Set once the first sync has started: the wizard stays locked until the page moves on. */
	private startedOnce = false;

	get stepIndex(): number {
		return CONNECT_STEPS.indexOf(this.step);
	}

	get canConnect(): boolean {
		return !!this.validation && this.validation.compatible && !this.validation.missingRequiredScopes.length && !!this.apiKey;
	}

	ngOnChanges(changes?: SimpleChanges): void {
		if (!this.apiBaseUrl && this.defaultApiUrl) this.apiBaseUrl = this.defaultApiUrl;
		// Only a new connection or mapping moves the wizard; any other input (the organization's name, say)
		// leaves the admin on the step they are on.
		const resumes = !changes || 'connection' in changes || 'mapping' in changes;
		if (resumes) this.step = this.mapping ? 'review' : this.connection ? 'organization' : this.step === 'connect' ? 'connect' : 'key';
		this.preselectOrganization();
	}

	stepKey(name: ConnectStep): string {
		return name.toUpperCase();
	}

	go(step: ConnectStep): void {
		this.error = null;
		this.step = step;
		this.cdr.markForCheck();
	}

	organizationNames(validation: EverWorksKeyValidation): string {
		return validation.organizations.map((org) => org.displayName || org.slug).join(', ') || '—';
	}

	validate(): void {
		this.request(this.api.validate(this.organizationId, this.apiBaseUrl.trim(), this.apiKey.trim()), (validation) => (this.validation = validation));
	}

	connect(): void {
		if (!this.canConnect) return;
		this.request(this.api.connect(this.organizationId, this.apiBaseUrl.trim(), this.apiKey.trim()), (connection) => {
			this.connection = connection;
			// Another Ever Works tenant (a new connection) leaves the kept subscription as it is; a failed retry keeps it too.
			if (connection.id === this.webhookKept && connection.earlierWebhookDeleted === true) this.webhookKept = null;
			this.apiKey = '';
			this.validation = null;
			this.preselectOrganization();
			this.step = 'organization';
		});
	}

	mapOrganization(): void {
		this.request(this.api.createMapping(this.organizationId, this.everWorksOrganizationId), (mapping) => {
			this.mapping = mapping;
			this.step = 'review';
		});
	}

	/** A connection that is not active, with no mapping yet: a new key of the same Ever Works tenant (review F99). */
	rotateKey(): void {
		const connection = this.connection;
		const key = this.newKey.trim();
		if (!connection || !key) return;
		this.request(this.api.rotateKey(this.organizationId, connection.id, key), (rotated) => {
			this.connection = rotated;
			this.newKey = '';
			this.preselectOrganization();
		});
	}

	/** Resumes a paused (or failed) connection; the API checks the key first and says why it stays as it is. */
	resume(): void {
		const connection = this.connection;
		if (!connection) return;
		this.request(this.api.resume(this.organizationId, connection.id), (resumed) => {
			this.connection = resumed;
			this.preselectOrganization();
		});
	}

	/** Disconnects the tenant (confirmed first): synced data stays; the wizard starts over at the key. */
	disconnect(): void {
		const connection = this.connection;
		if (!connection) return;
		this.request(this.api.disconnect(this.organizationId, connection.id), (result) => {
			this.connection = null;
			this.confirmDisconnect = false;
			// Disconnected, but Ever Works kept the webhook subscription (the server keeps its id): say so (#11096 review).
			this.webhookKept = result?.webhookDeleted === false ? connection.id : null;
			this.newKey = '';
			this.everWorksOrganizationId = '';
			this.step = 'key';
		});
	}

	directionsSaved(mapping: EverWorksMapping): void {
		this.mapping = mapping;
		this.go('start');
	}

	/** Registers the webhook (best effort: without it the change feed keeps the sync going), then starts the first sync. */
	start(): void {
		const mapping = this.mapping;
		const connection = this.connection;
		if (!mapping || !connection || this.startedOnce || this.busy) return;
		const webhook$ = connection.webhook?.registered
			? of(null)
			: this.api.registerWebhook(this.organizationId, connection.id).pipe(
					map(() => null),
					catchError((error) => of(errorText(error)))
				);
		this.request(
			webhook$.pipe(switchMap((webhookError) => this.api.startSync(this.organizationId, mapping.integrationTenantId).pipe(map((run) => ({ run, webhookError }))))),
			({ run, webhookError }) => {
				// Locked: a second click before the page navigates must not ask for another sync.
				this.startedOnce = true;
				this.busy = true;
				this.started.emit({ mapping, run, webhookError });
			}
		);
	}

	private preselectOrganization(): void {
		const pinned = this.connection?.pinnedOrganizations ?? [];
		if (!pinned.some((org) => org.id === this.everWorksOrganizationId)) this.everWorksOrganizationId = pinned[0]?.id ?? '';
	}

	private request<T>(request: Observable<T>, apply: (value: T) => void): void {
		this.busy = true;
		this.error = null;
		this.cdr.markForCheck();
		request.subscribe({
			next: (value) => {
				this.busy = false;
				apply(value);
				this.cdr.markForCheck();
			},
			error: (error) => {
				this.busy = false;
				this.error = errorText(error);
				this.cdr.markForCheck();
			}
		});
	}
}
