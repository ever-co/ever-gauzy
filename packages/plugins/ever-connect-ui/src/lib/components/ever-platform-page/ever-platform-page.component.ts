import { DatePipe, KeyValuePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import {
	NbAlertModule,
	NbButtonModule,
	NbCardModule,
	NbInputModule,
	NbTabsetModule,
	NbToggleModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { distinctUntilChanged, forkJoin, Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { PermissionsEnum } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/core';
import { ApprovalDecision, PendingApprovalsComponent } from '../pending-approvals/pending-approvals.component';
import {
	EverConnectAuditRow,
	EverConnectEntitlement,
	EverConnectIntegration,
	EverConnectPolicyRow,
	EverConnectStatus,
	EverConnectUiService
} from '../../services/ever-connect.service';

/** What the page shows. */
export type EverPlatformView = 'loading' | 'ready' | 'unavailable' | 'error';

/**
 * Integrations > Ever Platform.
 *
 * - Connection (the operator of the installation only; "Operated by Ever Cloud" on Ever's cloud):
 *   what connecting sends, the connect code, the state of the connection, the approvals the
 *   operator owes, the instance policy, Disconnect.
 * - Organization link: link this organization with a link code, or remove the link.
 * - Integrations & data: each integration, its state, what it moves (Show scope), the consent link
 *   to app.ever.co ("Enable in app.ever.co…") and Disable. Nothing is enabled from here. For an
 *   administrator who may change integrations, opening the page reads the states from Ever Platform
 *   (the result of a consent given in app.ever.co shows at once).
 * - Entitlements and Audit.
 *
 * When the API answers 404 the module is not loaded on this installation: the page says so and
 * makes no other request.
 */
@Component({
	selector: 'ngx-ever-connect-page',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		DatePipe,
		KeyValuePipe,
		FormsModule,
		NbAlertModule,
		NbButtonModule,
		NbCardModule,
		NbInputModule,
		NbTabsetModule,
		NbToggleModule,
		TranslateModule,
		PendingApprovalsComponent
	],
	template: `
		<nb-card>
			<nb-card-header>{{ 'EVER_CONNECT.TITLE' | translate }}</nb-card-header>
			<nb-card-body>
				@switch (view) {
					@case ('unavailable') {
						<p data-test="unavailable">{{ 'EVER_CONNECT.UNAVAILABLE' | translate }}</p>
					}
					@case ('error') {
						<nb-alert status="danger" role="alert" data-test="error">{{
							'EVER_CONNECT.ERROR' | translate
						}}</nb-alert>
					}
					@case ('ready') {
						@if (notice) {
							<nb-alert [status]="noticeStatus" role="status" data-test="notice">{{
								notice | translate: noticeParams
							}}</nb-alert>
						}
						<nb-tabset>
							@if (status?.managed_by === 'ever_cloud' || status?.operator) {
								<nb-tab
									[tabTitle]="'EVER_CONNECT.TABS.CONNECTION' | translate"
									data-test="tab-connection"
								>
									@if (status?.managed_by === 'ever_cloud') {
										<p data-test="ever-cloud">
											{{ 'EVER_CONNECT.CONNECTION.EVER_CLOUD' | translate }}
										</p>
									} @else {
										<section data-test="connection">
											@if (status?.connection?.key_material !== 'ok') {
												<nb-alert status="warning" data-test="key-material">{{
													'EVER_CONNECT.CONNECTION.KEY_MATERIAL' | translate
												}}</nb-alert>
											} @else if (status?.connection?.secret_short) {
												<nb-alert status="warning" data-test="secret-short">{{
													'EVER_CONNECT.CONNECTION.SECRET_SHORT' | translate
												}}</nb-alert>
											}
											@if (status?.connection?.connect_key === 'unreadable') {
												<nb-alert status="danger" data-test="key-unreadable">{{
													'EVER_CONNECT.CONNECTION.KEY_UNREADABLE' | translate
												}}</nb-alert>
											}
											@if (status?.connection?.return_unusable) {
												<nb-alert status="info" data-test="return-unusable">{{
													'EVER_CONNECT.CONNECTION.RETURN_UNUSABLE' | translate
												}}</nb-alert>
											}
											@if (
												status?.connection?.status === 'connected' ||
												status?.connection?.status === 'pending_approval'
											) {
												<dl class="facts">
													<dt>{{ 'EVER_CONNECT.CONNECTION.STATE' | translate }}</dt>
													<dd data-test="connection-state">
														@if (status.connection.status === 'connected') {
															{{
																'EVER_CONNECT.CONNECTION.CONNECTED'
																	| translate
																		: {
																				handle:
																					status.connection.owner_handle ||
																					'—'
																		  }
															}}
														} @else {
															{{ 'EVER_CONNECT.CONNECTION.PENDING' | translate }}
															<button
																nbButton
																ghost
																size="tiny"
																type="button"
																data-test="check"
																[disabled]="busy"
																(click)="checkApproval()"
															>
																{{ 'EVER_CONNECT.CONNECTION.CHECK' | translate }}
															</button>
														}
													</dd>
													<dt>{{ 'EVER_CONNECT.CONNECTION.KEY' | translate }}</dt>
													<dd>
														<code>{{ status.connection.kid }}</code>
														@if (
															status.connection.status === 'connected' &&
															status.connection.connect_key === 'ok'
														) {
															<button
																nbButton
																ghost
																size="tiny"
																type="button"
																data-test="rotate-key"
																[disabled]="busy"
																(click)="rotateKey()"
															>
																{{ 'EVER_CONNECT.CONNECTION.ROTATE_KEY' | translate }}
															</button>
														}
													</dd>
													<dt>{{ 'EVER_CONNECT.CONNECTION.LAST_SEEN' | translate }}</dt>
													<dd>
														{{
															status.connection.last_heartbeat_at
																? (status.connection.last_heartbeat_at | date: 'medium')
																: '—'
														}}
													</dd>
													<dt>{{ 'EVER_CONNECT.CONNECTION.FEED' | translate }}</dt>
													<dd>{{ status.connection.feed_mode }}</dd>
													@if (status.connection.last_error) {
														<dt>{{ 'EVER_CONNECT.CONNECTION.LAST_ERROR' | translate }}</dt>
														<dd>
															<code>{{ status.connection.last_error }}</code>
														</dd>
													}
												</dl>
												<ngx-ever-connect-pending-approvals
													[items]="status.pending_approvals"
													[handle]="status.connection.owner_handle"
													[busy]="busy"
													(decide)="decide($event)"
												/>
												<h3>{{ 'EVER_CONNECT.POLICY.TITLE' | translate }}</h3>
												<p>{{ 'EVER_CONNECT.POLICY.DESCRIPTION' | translate }}</p>
												<table class="table" data-test="policy">
													@for (row of policy; track row.key) {
														<tr>
															<td>{{ row.name }}</td>
															<td>
																@if (row.source === 'env') {
																	{{
																		'EVER_CONNECT.POLICY.DENIED_BY_ENV' | translate
																	}}
																} @else {
																	<nb-toggle
																		[checked]="row.allowed"
																		[disabled]="busy"
																		(checkedChange)="setPolicy(row.key, $event)"
																	>
																		{{
																			(row.allowed
																				? 'EVER_CONNECT.POLICY.ALLOWED'
																				: 'EVER_CONNECT.POLICY.DENIED'
																			) | translate
																		}}
																	</nb-toggle>
																}
															</td>
														</tr>
													}
												</table>
												<h3>{{ 'EVER_CONNECT.DISCONNECT.TITLE' | translate }}</h3>
												@if (confirmingDisconnect) {
													<section class="confirm" data-test="disconnect-confirmation">
														<p>{{ 'EVER_CONNECT.DISCONNECT.EFFECTS' | translate }}</p>
														<button
															nbButton
															status="danger"
															type="button"
															data-test="disconnect-confirm"
															[disabled]="busy"
															(click)="disconnect()"
														>
															{{ 'EVER_CONNECT.DISCONNECT.CONFIRM' | translate }}
														</button>
														<button
															nbButton
															ghost
															type="button"
															(click)="confirmingDisconnect = false"
														>
															{{ 'EVER_CONNECT.CANCEL' | translate }}
														</button>
													</section>
												} @else {
													<button
														nbButton
														status="danger"
														ghost
														type="button"
														data-test="disconnect"
														[disabled]="busy"
														(click)="confirmingDisconnect = true"
													>
														{{ 'EVER_CONNECT.DISCONNECT.TITLE' | translate }}
													</button>
												}
											} @else {
												<p data-test="connect-notice">
													{{ 'EVER_CONNECT.CONNECTION.NOTICE' | translate }}
												</p>
												@if (status?.connection?.status === 'revoked') {
													<nb-alert status="warning" data-test="revoked">{{
														'EVER_CONNECT.CONNECTION.REVOKED' | translate
													}}</nb-alert>
												}
												<div class="row">
													<input
														nbInput
														fieldSize="small"
														data-test="connect-code"
														[(ngModel)]="connectCode"
														[placeholder]="'EVC-XXXX-XXXX-XXXX'"
														autocomplete="off"
													/>
													<nb-toggle
														[(checked)]="linkOrganization"
														data-test="link-organization"
														>{{
															'EVER_CONNECT.CONNECTION.LINK_ORGANIZATION' | translate
														}}</nb-toggle
													>
													<button
														nbButton
														status="primary"
														type="button"
														data-test="connect"
														[disabled]="busy || !connectCode.trim()"
														(click)="connect()"
													>
														{{ 'EVER_CONNECT.CONNECTION.CONNECT' | translate }}
													</button>
												</div>
											}
										</section>
									}
								</nb-tab>
							}
							<nb-tab [tabTitle]="'EVER_CONNECT.TABS.LINK' | translate" data-test="tab-link">
								@if (status?.link; as link) {
									<p data-test="linked">
										{{ 'EVER_CONNECT.LINK.LINKED' | translate: { handle: link.handle || '—' } }}
									</p>
									<button
										nbButton
										ghost
										status="danger"
										type="button"
										data-test="unlink"
										[disabled]="busy || !link.integration_tenant_id"
										(click)="unlink(link.integration_tenant_id)"
									>
										{{ 'EVER_CONNECT.LINK.REMOVE' | translate }}
									</button>
								} @else {
									<p>
										{{
											(status?.connected
												? 'EVER_CONNECT.LINK.DESCRIPTION'
												: 'EVER_CONNECT.LINK.NOT_CONNECTED'
											) | translate
										}}
									</p>
									@if (status?.connected) {
										<div class="row">
											<input
												nbInput
												fieldSize="small"
												data-test="link-code"
												[(ngModel)]="linkCode"
												[placeholder]="'EVL-XXXX-XXXX-XXXX'"
												autocomplete="off"
											/>
											<button
												nbButton
												status="primary"
												type="button"
												data-test="link"
												[disabled]="busy || !linkCode.trim()"
												(click)="link()"
											>
												{{ 'EVER_CONNECT.LINK.LINK' | translate }}
											</button>
										</div>
									}
								}
							</nb-tab>
							<nb-tab
								[tabTitle]="'EVER_CONNECT.TABS.INTEGRATIONS' | translate"
								data-test="tab-integrations"
							>
								<p>{{ 'EVER_CONNECT.INTEGRATIONS.DESCRIPTION' | translate }}</p>
								@for (item of integrations; track item.key) {
									<article class="integration" [attr.data-test]="'integration-' + item.key">
										<p>
											<strong>{{ item.name }}</strong>
											<span class="chip" data-test="state">{{
												'EVER_CONNECT.STATE.' + item.state | translate
											}}</span>
										</p>
										<p>{{ item.description }}</p>
										@if (item.state === 'revoked_remote' && item.revoked_at) {
											<p data-test="revoked-at">
												{{
													'EVER_CONNECT.INTEGRATIONS.REVOKED_AT'
														| translate: { date: (item.revoked_at | date: 'mediumDate') }
												}}
											</p>
										}
										@if (item.consent?.at) {
											<p class="hint">
												{{
													'EVER_CONNECT.INTEGRATIONS.CONSENTED_AT'
														| translate: { date: (item.consent.at | date: 'mediumDate') }
												}}
											</p>
										}
										<div class="row">
											@if (canAskConsent(item)) {
												<button
													nbButton
													status="primary"
													size="small"
													type="button"
													data-test="enable"
													[disabled]="busy"
													(click)="enable(item)"
												>
													{{ 'EVER_CONNECT.INTEGRATIONS.ENABLE' | translate }}
												</button>
											}
											@if (item.enabled && (!item.instance_wide || status?.operator)) {
												<button
													nbButton
													ghost
													status="danger"
													size="small"
													type="button"
													data-test="disable"
													[disabled]="busy"
													(click)="disable(item)"
												>
													{{ 'EVER_CONNECT.INTEGRATIONS.DISABLE' | translate }}
												</button>
											}
											<button
												nbButton
												ghost
												size="small"
												type="button"
												data-test="show-scope"
												(click)="toggleScope(item.key)"
											>
												{{ 'EVER_CONNECT.INTEGRATIONS.SHOW_SCOPE' | translate }}
											</button>
										</div>
										@if (item.state === 'pending_operator' && !status?.operator) {
											<p class="hint" data-test="waiting-operator">
												{{ 'EVER_CONNECT.INTEGRATIONS.WAITING_OPERATOR' | translate }}
											</p>
										}
										@if (item.instance_wide && !status?.operator) {
											<p class="hint">
												{{ 'EVER_CONNECT.INTEGRATIONS.OPERATOR_ONLY' | translate }}
											</p>
										}
										@if (scopeShown[item.key]) {
											<table class="table" data-test="scope">
												<tr>
													<th>{{ 'EVER_CONNECT.SCOPE.FIELD' | translate }}</th>
													<th>{{ 'EVER_CONNECT.SCOPE.FORM' | translate }}</th>
													<th>{{ 'EVER_CONNECT.SCOPE.WHEN' | translate }}</th>
													<th>{{ 'EVER_CONNECT.SCOPE.PURPOSE' | translate }}</th>
													<th>{{ 'EVER_CONNECT.SCOPE.RETENTION' | translate }}</th>
												</tr>
												@for (row of item.scope; track row.field_path) {
													<tr>
														<td>
															<code>{{ row.field_path }}</code>
														</td>
														<td>{{ row.form }}</td>
														<td>{{ row.frequency }}</td>
														<td>{{ row.purpose }}</td>
														<td>{{ row.retention }}</td>
													</tr>
												}
											</table>
										}
									</article>
								}
							</nb-tab>
							<nb-tab
								[tabTitle]="'EVER_CONNECT.TABS.ENTITLEMENTS' | translate"
								data-test="tab-entitlements"
							>
								@for (document of [entitlement?.link, entitlement?.instance]; track $index) {
									@if (document) {
										<dl class="facts" [attr.data-test]="'entitlement-' + document.subject">
											<dt>
												{{
													'EVER_CONNECT.ENTITLEMENTS.' +
														(document.subject === 'link' ? 'ORGANIZATION' : 'INSTALLATION')
														| translate
												}}
											</dt>
											<dd>
												{{ document.handle ? 'ever.co/' + document.handle : '—' }} ·
												{{ 'EVER_CONNECT.ENTITLEMENTS.STATUS.' + document.status | translate }}
											</dd>
											<dt>{{ 'EVER_CONNECT.ENTITLEMENTS.PLAN' | translate }}</dt>
											<dd>{{ document.plan || '—' }} ({{ document.tier || '—' }})</dd>
											<dt>{{ 'EVER_CONNECT.ENTITLEMENTS.FEATURES' | translate }}</dt>
											<dd>
												@for (feature of document.features | keyvalue; track feature.key) {
													@if (feature.value) {
														<code>{{ feature.key }}</code
														>&nbsp;
													}
												}
											</dd>
											<dt>{{ 'EVER_CONNECT.ENTITLEMENTS.EXPIRES' | translate }}</dt>
											<dd>{{ document.expires_at | date: 'medium' }} (#{{ document.seq }})</dd>
											@for (licence of document.licence_ids ?? []; track licence) {
												<dd class="licence" data-test="licence" [attr.data-licence]="licence">
													{{
														'EVER_CONNECT.ENTITLEMENTS.LICENCE_ACTIVE'
															| translate: { id: licence }
													}}
												</dd>
											}
										</dl>
										@if (document.ladder === 'grace') {
											<p class="hint" data-test="entitlement-grace">
												{{
													'EVER_CONNECT.ENTITLEMENTS.GRACE'
														| translate
															: {
																	date:
																		(document.fetched_at | date: 'mediumDate') ??
																		'—'
															  }
												}}
											</p>
										}
										@if (document.ladder === 'paused') {
											<p class="hint" data-test="entitlement-paused">
												{{ 'EVER_CONNECT.ENTITLEMENTS.PAUSED' | translate }}
											</p>
										}
									}
								}
								@if (!entitlement?.link && !entitlement?.instance) {
									<p>{{ 'EVER_CONNECT.ENTITLEMENTS.NONE' | translate }}</p>
								}
								<button
									nbButton
									ghost
									size="small"
									type="button"
									data-test="refresh-entitlement"
									[disabled]="busy || !status?.connected"
									(click)="refreshEntitlement()"
								>
									{{ 'EVER_CONNECT.ENTITLEMENTS.REFRESH' | translate }}
								</button>
								@if (status?.operator && status?.connected && status?.managed_by !== 'ever_cloud') {
									<label class="import" data-test="import-entitlement">
										{{ 'EVER_CONNECT.ENTITLEMENTS.IMPORT' | translate }}
										<input
											type="file"
											accept=".jws,text/plain"
											[disabled]="busy"
											(change)="importEntitlement($event)"
										/>
									</label>
								}
							</nb-tab>
							<nb-tab [tabTitle]="'EVER_CONNECT.TABS.AUDIT' | translate" data-test="tab-audit">
								<table class="table" data-test="audit">
									@for (row of audit; track row.id) {
										<tr>
											<td>{{ row.at | date: 'medium' }}</td>
											<td>
												<code>{{ row.action }}</code>
											</td>
											<td>{{ row.integration || '' }}</td>
											<td>{{ row.actor_label }}</td>
										</tr>
									}
								</table>
								@if (auditTotal > audit.length) {
									<button nbButton ghost size="small" type="button" (click)="moreAudit()">
										{{ 'EVER_CONNECT.AUDIT.MORE' | translate }}
									</button>
								}
							</nb-tab>
						</nb-tabset>
					}
				}
			</nb-card-body>
		</nb-card>
	`,
	styles: [
		`
			.facts {
				display: grid;
				grid-template-columns: max-content auto;
				gap: 4px 16px;
				margin: 16px 0;
			}
			.row {
				display: flex;
				gap: 12px;
				align-items: center;
				margin: 12px 0;
				flex-wrap: wrap;
			}
			.integration {
				margin: 16px 0;
				padding-bottom: 12px;
				border-bottom: 1px solid var(--border-basic-color-3, #e4e9f2);
			}
			.chip {
				margin-left: 8px;
				padding: 2px 8px;
				border-radius: 10px;
				background: var(--background-basic-color-3, #edf1f7);
				font-size: 0.85em;
			}
			.hint {
				opacity: 0.8;
			}
			.table td,
			.table th {
				padding: 4px 8px;
				vertical-align: top;
			}
		`
	]
})
export class EverPlatformPageComponent implements OnInit {
	private readonly api = inject(EverConnectUiService);
	private readonly store = inject(Store);
	private readonly cdr = inject(ChangeDetectorRef);
	private readonly destroyRef = inject(DestroyRef);

	view: EverPlatformView = 'loading';
	status: EverConnectStatus | null = null;
	integrations: EverConnectIntegration[] = [];
	entitlement: { instance: EverConnectEntitlement | null; link: EverConnectEntitlement | null } | null = null;
	policy: EverConnectPolicyRow[] = [];
	audit: EverConnectAuditRow[] = [];
	auditTotal = 0;
	auditPage = 1;
	scopeShown: Record<string, boolean> = {};
	connectCode = '';
	linkCode = '';
	linkOrganization = true;
	confirmingDisconnect = false;
	busy = false;
	notice: string | null = null;
	noticeParams: Record<string, unknown> = {};
	noticeStatus: 'success' | 'warning' | 'danger' | 'info' = 'success';
	private organizationId: string | null = null;

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

	/** Reads everything for the selected organization; 404 on the status means the module is not loaded. */
	load(): void {
		const organizationId = this.organizationId;
		this.api
			.status(organizationId)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (status) => {
					this.status = status;
					this.view = 'ready';
					if (organizationId) {
						const canEdit = this.store.hasPermission(PermissionsEnum.INTEGRATION_EDIT);
						const integrations$ =
							status.connected && canEdit
								? this.api.refresh(organizationId)
								: this.api.integrations(organizationId);
						forkJoin({
							integrations: integrations$.pipe(catchError(() => of([] as EverConnectIntegration[]))),
							entitlement: this.api.entitlement(organizationId).pipe(catchError(() => of(null))),
							audit: this.api
								.audit(organizationId, 1)
								.pipe(catchError(() => of({ items: [], total: 0 }))),
							policy:
								status.operator && status.managed_by !== 'ever_cloud'
									? this.api.policy().pipe(catchError(() => of([] as EverConnectPolicyRow[])))
									: of([] as EverConnectPolicyRow[])
						}).subscribe(({ integrations, entitlement, audit, policy }) => {
							this.integrations = integrations;
							this.entitlement = entitlement;
							this.audit = audit.items;
							this.auditTotal = audit.total;
							this.auditPage = 1;
							this.policy = policy;
							this.cdr.markForCheck();
						});
					}
					this.cdr.markForCheck();
				},
				error: (error: HttpErrorResponse) => {
					this.view = error.status === 404 ? 'unavailable' : 'error';
					this.cdr.markForCheck();
				}
			});
	}

	/** "Enable in app.ever.co…" is offered for an integration that can be consented to from here. */
	canAskConsent(item: EverConnectIntegration): boolean {
		if (!this.status?.connected || !['available', 'disabled', 'revoked_remote'].includes(item.state)) return false;
		return !item.instance_wide || this.status.operator;
	}

	toggleScope(key: string): void {
		this.scopeShown = { ...this.scopeShown, [key]: !this.scopeShown[key] };
	}

	connect(): void {
		this.run(
			this.api.connect(this.connectCode.trim(), this.linkOrganization ? this.organizationId : null),
			(result) => {
				this.connectCode = '';
				this.say(
					result.status === 'pending_approval'
						? 'EVER_CONNECT.NOTICES.PENDING'
						: 'EVER_CONNECT.NOTICES.CONNECTED'
				);
			}
		);
	}

	checkApproval(): void {
		this.run(this.api.checkApproval(), () => undefined);
	}

	rotateKey(): void {
		this.run(this.api.rotateKey(), () => this.say('EVER_CONNECT.NOTICES.KEY_ROTATED'));
	}

	disconnect(): void {
		this.run(this.api.disconnect(), () => {
			this.confirmingDisconnect = false;
			this.say('EVER_CONNECT.NOTICES.DISCONNECTED');
		});
	}

	setPolicy(key: string, allowed: boolean): void {
		this.run(this.api.setPolicy(key, allowed), () => undefined);
	}

	decide(decision: ApprovalDecision): void {
		this.run(this.api.accept(decision.key, decision.accepted), () =>
			this.say(decision.accepted ? 'EVER_CONNECT.NOTICES.ACCEPTED' : 'EVER_CONNECT.NOTICES.DECLINED')
		);
	}

	link(): void {
		if (!this.organizationId) return;
		this.run(this.api.link(this.linkCode.trim(), this.organizationId), () => {
			this.linkCode = '';
			this.say('EVER_CONNECT.NOTICES.LINKED');
		});
	}

	unlink(integrationTenantId: string | null): void {
		if (!this.organizationId || !integrationTenantId) return;
		this.run(this.api.unlink(integrationTenantId, this.organizationId), () =>
			this.say('EVER_CONNECT.NOTICES.UNLINKED')
		);
	}

	/** Asks the API for the app.ever.co consent link and opens it; the page reads the result on return. */
	enable(item: EverConnectIntegration): void {
		if (!this.organizationId) return;
		this.busy = true;
		this.api.consentUrl(item.key, this.organizationId).subscribe({
			next: ({ url }) => {
				this.busy = false;
				// Only an https link is opened (the API checks its host as well).
				if (!/^https:\/\//i.test(String(url))) {
					this.say('EVER_CONNECT.ERRORS.consent_url_invalid', {}, 'danger');
					return;
				}
				window.open(url, '_blank', 'noopener');
				this.say('EVER_CONNECT.NOTICES.CONSENT_OPENED');
			},
			error: (error: HttpErrorResponse) => this.failed(error)
		});
	}

	disable(item: EverConnectIntegration): void {
		if (!this.organizationId) return;
		this.run(this.api.disable(item.key, this.organizationId), (row) =>
			this.say(
				row.pending_remote_revoke ? 'EVER_CONNECT.NOTICES.DISABLED_OFFLINE' : 'EVER_CONNECT.NOTICES.DISABLED'
			)
		);
	}

	refreshEntitlement(): void {
		if (!this.organizationId) return;
		this.run(this.api.refreshEntitlement(this.organizationId), () => undefined);
	}

	/** Operator only: reads the chosen `.jws` file (at most 16 KiB) and imports it. */
	importEntitlement(event: Event): void {
		const input = event.target as HTMLInputElement | null;
		const file = input?.files?.[0];
		if (!file) return;
		if (input) input.value = '';
		if (file.size > 16 * 1024) {
			this.say('EVER_CONNECT.ERRORS.entitlement_invalid', {}, 'danger');
			return;
		}
		file.text().then((jws) =>
			this.run(this.api.importEntitlement(jws), (result) =>
				this.say(
					result.status === 'stored'
						? 'EVER_CONNECT.NOTICES.ENTITLEMENT_IMPORTED'
						: 'EVER_CONNECT.NOTICES.ENTITLEMENT_UNCHANGED',
					{ seq: result.seq }
				)
			)
		);
	}

	moreAudit(): void {
		if (!this.organizationId) return;
		this.api.audit(this.organizationId, this.auditPage + 1).subscribe((page) => {
			this.auditPage += 1;
			this.audit = [...this.audit, ...page.items];
			this.cdr.markForCheck();
		});
	}

	private run<T>(action: Observable<T>, done: (value: T) => void): void {
		this.busy = true;
		this.notice = null;
		action.subscribe({
			next: (value) => {
				this.busy = false;
				done(value);
				this.load();
			},
			error: (error: HttpErrorResponse) => this.failed(error)
		});
	}

	private say(
		key: string,
		params: Record<string, unknown> = {},
		status: 'success' | 'warning' | 'danger' | 'info' = 'success'
	): void {
		this.notice = key;
		this.noticeParams = params;
		this.noticeStatus = status;
		this.cdr.markForCheck();
	}

	/** Shows the API's problem code (never a value it echoes) with a sentence for the known ones. */
	private failed(error: HttpErrorResponse): void {
		this.busy = false;
		const code = typeof error?.error?.code === 'string' ? error.error.code : null;
		const known = [
			'key_material_missing',
			'key_unreadable',
			'consent_url_invalid',
			'redeem_unverifiable',
			'rotation_not_installed',
			'code_invalid',
			'already_connected',
			'already_linked',
			'not_connected',
			'denied_by_policy',
			'keys_unverifiable',
			'entitlement_unverifiable',
			'entitlement_invalid',
			'platform_unreachable',
			'rate_limited',
			'not_available',
			'product_mismatch'
		];
		this.say(
			code && known.includes(code) ? `EVER_CONNECT.ERRORS.${code}` : 'EVER_CONNECT.ERRORS.generic',
			{ code: code ?? error?.status },
			'danger'
		);
	}
}
