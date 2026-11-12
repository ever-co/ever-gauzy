import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NbButtonModule, NbCardModule, NbDialogRef, NbIconModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { KEYBOARD_SETTINGS_LINK } from '../task-views-ui.constants';
import { SHORTCUT_CONTEXTS, ShortcutContext } from './shortcut-registry';
import { ShortcutKeyCapsComponent } from './shortcut-key-caps.component';
import { ShortcutRegistryService } from './shortcut-registry.service';

/** The i18n key of a context's heading. */
export function contextKey(context: ShortcutContext): string {
	return `TASK_VIEWS.SHORTCUTS.CONTEXTS.${context.toUpperCase()}`;
}

/** The i18n key of a command's name. */
export function commandKey(commandId: string): string {
	return `TASK_VIEWS.SHORTCUTS.COMMANDS.${commandId}`;
}

/**
 * The `?` help: every command with its binding in force, by where it applies; the commands that cannot run on this
 * page are dimmed. Links to Settings → Keyboard shortcuts, where they are changed.
 */
@Component({
	selector: 'ngx-task-views-shortcut-help',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [RouterLink, NbButtonModule, NbCardModule, NbIconModule, TranslatePipe, ShortcutKeyCapsComponent],
	template: `
		<nb-card class="shortcut-help" data-test="shortcut-help" role="dialog" aria-labelledby="shortcut-help-title">
			<nb-card-header class="header">
				<h2 id="shortcut-help-title">{{ 'TASK_VIEWS.SHORTCUTS.TITLE' | translate }}</h2>
				<button
					nbButton
					ghost
					size="small"
					type="button"
					[attr.aria-label]="'TASK_VIEWS.DIALOG.CLOSE' | translate"
					(click)="close()"
				>
					<nb-icon icon="close-outline"></nb-icon>
				</button>
			</nb-card-header>
			<nb-card-body class="body">
				@for (section of sections(); track section.context) {
					<section>
						<h3>{{ contextKey(section.context) | translate }}</h3>
						<dl>
							@for (row of section.rows; track row.id) {
								<div class="row" [class.idle]="!row.runnable" [attr.data-command]="row.id">
									<dt>{{ commandKey(row.id) | translate }}</dt>
									<dd>
										<ngx-task-views-key-caps
											[binding]="row.binding"
											[isMac]="isMac"
										></ngx-task-views-key-caps>
									</dd>
								</div>
							}
						</dl>
					</section>
				}
				<p class="note">{{ 'TASK_VIEWS.SHORTCUTS.QUICK_ACTIONS_NOTE' | translate }}</p>
			</nb-card-body>
			<nb-card-footer class="footer">
				<a nbButton status="basic" size="small" [routerLink]="settingsLink" (click)="close()">{{
					'TASK_VIEWS.SHORTCUTS.SETTINGS' | translate
				}}</a>
			</nb-card-footer>
		</nb-card>
	`,
	styles: [
		`
			.shortcut-help {
				width: min(44rem, 94vw);
				max-height: 86vh;
			}
			.header {
				display: flex;
				align-items: center;
				justify-content: space-between;
			}
			.header h2 {
				margin: 0;
				font-size: 1.125rem;
			}
			.body {
				overflow: auto;
				columns: 2 18rem;
				column-gap: 2rem;
			}
			section {
				break-inside: avoid;
				margin-bottom: 1rem;
			}
			h3 {
				margin: 0 0 0.5rem;
				font-size: 0.8125rem;
				text-transform: uppercase;
				letter-spacing: 0.04em;
				color: var(--text-hint-color);
			}
			dl {
				margin: 0;
			}
			.row {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 1rem;
				padding: 0.25rem 0;
			}
			.row.idle {
				opacity: 0.55;
			}
			dt {
				font-size: 0.875rem;
			}
			dd {
				margin: 0;
				white-space: nowrap;
			}
			.note {
				column-span: all;
				font-size: 0.8125rem;
				color: var(--text-hint-color);
				margin: 0.5rem 0 0;
			}
			.footer {
				display: flex;
				justify-content: flex-end;
			}
		`
	]
})
export class ShortcutHelpDialogComponent {
	private readonly ref = inject(NbDialogRef) as NbDialogRef<ShortcutHelpDialogComponent>;
	private readonly registry = inject(ShortcutRegistryService);

	protected readonly isMac = this.registry.isMac;
	protected readonly settingsLink = KEYBOARD_SETTINGS_LINK;
	protected readonly contextKey = contextKey;
	protected readonly commandKey = commandKey;

	protected readonly sections = computed(() => {
		this.registry.handlersVersion();
		const bindings = this.registry.bindings();
		return SHORTCUT_CONTEXTS.map((context) => ({
			context,
			rows: this.registry.commands
				.filter((command) => command.context === context)
				.map((command) => ({
					id: command.id,
					binding: bindings.get(command.id) ?? null,
					runnable: this.registry.isRunnable(command.id)
				}))
		}));
	});

	close(): void {
		this.ref.close();
	}
}
