import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { bindingKeyCaps, ShortcutBinding } from './shortcut-registry';

/** A binding drawn as key caps: `G` then `T`, `Ctrl` + `S`; "No key" when there is none. */
@Component({
	selector: 'ngx-task-views-key-caps',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	template: `
		@if (chords().length) {
			<span class="caps" [attr.aria-label]="label()">
				@for (chord of chords(); track $index; let last = $last) {
					<span class="chord">
						@for (cap of chord; track $index) {
							<kbd>{{ cap }}</kbd>
						}
					</span>
					@if (!last) {
						<span class="then">{{ 'TASK_VIEWS.SHORTCUTS.THEN' | translate }}</span>
					}
				}
			</span>
		} @else {
			<span class="none">{{ 'TASK_VIEWS.SHORTCUTS.NONE' | translate }}</span>
		}
	`,
	styles: [
		`
			.caps,
			.chord {
				display: inline-flex;
				align-items: center;
				gap: 0.25rem;
			}
			.caps {
				gap: 0.375rem;
			}
			kbd {
				display: inline-block;
				min-width: 1.5rem;
				padding: 0.0625rem 0.375rem;
				border: 1px solid var(--border-basic-color-4);
				border-bottom-width: 2px;
				border-radius: var(--border-radius);
				background: var(--background-basic-color-2);
				font: 600 0.75rem/1.25rem var(--font-family-monospace, monospace);
				text-align: center;
			}
			.then,
			.none {
				font-size: 0.75rem;
				color: var(--text-hint-color);
			}
		`
	]
})
export class ShortcutKeyCapsComponent {
	readonly binding = input<ShortcutBinding | null | undefined>(null);
	readonly isMac = input(false);

	protected readonly chords = computed(() => bindingKeyCaps(this.binding(), this.isMac()));
	protected readonly label = computed(() =>
		this.chords()
			.map((chord) => chord.join('+'))
			.join(' ')
	);
}
