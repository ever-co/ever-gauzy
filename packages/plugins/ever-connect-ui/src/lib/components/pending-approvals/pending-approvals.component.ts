import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { NbButtonModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { EverConnectIntegration } from '../../services/ever-connect.service';

/** The operator's decision on one installation-wide integration. */
export interface ApprovalDecision {
	key: string;
	accepted: boolean;
}

/**
 * The installation-wide integrations the connecting organization consented to in app.ever.co, which
 * wait for the operator of this installation: each shows who asked, what would start moving (the
 * read-only scope), and Accept or Decline behind a confirmation. Shown to the operator only.
 */
@Component({
	selector: 'ngx-ever-connect-pending-approvals',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NbButtonModule, TranslateModule],
	template: `
		@if (items.length) {
			<section data-test="pending-approvals">
				<h3>{{ 'EVER_CONNECT.APPROVALS.TITLE' | translate }}</h3>
				@for (item of items; track item.key) {
					<article class="approval" [attr.data-test]="'approval-' + item.key">
						<p>
							<strong>{{ item.name }}</strong> ·
							{{ 'EVER_CONNECT.APPROVALS.REQUESTED_BY' | translate: { handle: handle || '—' } }}
						</p>
						<p>{{ item.description }}</p>
						@if (confirming?.key === item.key) {
							<div class="confirm" data-test="confirmation">
								@if (confirming.accepted) {
									<p>{{ 'EVER_CONNECT.APPROVALS.ACCEPT_CONFIRM' | translate }}</p>
									<ul>
										@for (row of item.scope; track row.field_path) {
											<li>
												<code>{{ row.field_path }}</code> ({{ row.form }}, {{ row.frequency }}):
												{{ row.purpose }}
											</li>
										}
									</ul>
								} @else {
									<p>{{ 'EVER_CONNECT.APPROVALS.DECLINE_CONFIRM' | translate }}</p>
								}
								<button
									nbButton
									size="small"
									type="button"
									[status]="confirming.accepted ? 'primary' : 'danger'"
									data-test="confirm"
									[disabled]="busy"
									(click)="
										decide.emit({ key: item.key, accepted: confirming.accepted }); confirming = null
									"
								>
									{{
										(confirming.accepted
											? 'EVER_CONNECT.APPROVALS.ACCEPT'
											: 'EVER_CONNECT.APPROVALS.DECLINE'
										) | translate
									}}
								</button>
								<button
									nbButton
									ghost
									size="small"
									type="button"
									data-test="cancel"
									(click)="confirming = null"
								>
									{{ 'EVER_CONNECT.CANCEL' | translate }}
								</button>
							</div>
						} @else {
							<button
								nbButton
								status="primary"
								size="small"
								type="button"
								data-test="accept"
								[disabled]="busy"
								(click)="confirming = { key: item.key, accepted: true }"
							>
								{{ 'EVER_CONNECT.APPROVALS.ACCEPT' | translate }}
							</button>
							<button
								nbButton
								ghost
								status="danger"
								size="small"
								type="button"
								data-test="decline"
								[disabled]="busy"
								(click)="confirming = { key: item.key, accepted: false }"
							>
								{{ 'EVER_CONNECT.APPROVALS.DECLINE' | translate }}
							</button>
						}
					</article>
				}
			</section>
		}
	`,
	styles: [
		`
			.approval {
				margin: 12px 0;
				padding: 12px;
				border: 1px solid var(--border-basic-color-3, #e4e9f2);
				border-radius: 4px;
			}
			button {
				margin-right: 8px;
			}
		`
	]
})
export class PendingApprovalsComponent {
	@Input() items: EverConnectIntegration[] = [];
	/** The Ever organization that connected this installation (`ever.co/<handle>`). */
	@Input() handle: string | null = null;
	@Input() busy = false;
	@Output() readonly decide = new EventEmitter<ApprovalDecision>();

	confirming: ApprovalDecision | null = null;
}
