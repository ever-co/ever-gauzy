import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NbIconModule } from '@nebular/theme';
import { AngularNodeViewComponent } from '../node-view/angular-node-view-renderer';
import { CalloutType } from '../extensions/callout.node';

const CALLOUT_ICONS: Record<CalloutType, string> = {
	info: 'info-outline',
	success: 'checkmark-circle-2-outline',
	warning: 'alert-triangle-outline',
	danger: 'alert-circle-outline'
};

const CALLOUT_TYPES: CalloutType[] = ['info', 'success', 'warning', 'danger'];

/**
 * Interactive node view for `callout` (spec 05 §6.2): status icon (or emoji
 * override) with a type-switcher popover and an editable content hole.
 */
@Component({
	selector: 'gz-callout-node-view',
	standalone: true,
	imports: [CommonModule, NbIconModule],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div class="gz-callout" [attr.data-callout-type]="type" [class.selected]="selected()">
			<button
				*ngIf="editor().isEditable; else staticIcon"
				type="button"
				class="gz-callout-icon"
				data-node-view-interactive
				(click)="switcherOpen = !switcherOpen"
			>
				<span *ngIf="emoji; else evaIcon">{{ emoji }}</span>
				<ng-template #evaIcon><nb-icon [icon]="icon"></nb-icon></ng-template>
			</button>
			<ng-template #staticIcon>
				<span class="gz-callout-icon">
					<span *ngIf="emoji; else evaIconRo">{{ emoji }}</span>
					<ng-template #evaIconRo><nb-icon [icon]="icon"></nb-icon></ng-template>
				</span>
			</ng-template>
			<div class="gz-callout-switcher" *ngIf="switcherOpen" data-node-view-interactive>
				<button
					*ngFor="let option of types"
					type="button"
					[attr.data-callout-type]="option"
					[class.active]="option === type"
					(click)="setType(option)"
				>
					<nb-icon [icon]="iconOf(option)"></nb-icon>
				</button>
			</div>
			<div class="gz-callout-content" data-node-view-content></div>
		</div>
	`,
	styles: [
		`
			:host {
				display: block;
			}
			.gz-callout {
				position: relative;
				display: flex;
				gap: 0.625rem;
				padding: 0.75rem 1rem;
				border-radius: var(--border-radius);
				margin: 0.375rem 0;
			}
			.gz-callout[data-callout-type='info'] {
				background: var(--color-info-transparent-100);
			}
			.gz-callout[data-callout-type='success'] {
				background: var(--color-success-transparent-100);
			}
			.gz-callout[data-callout-type='warning'] {
				background: var(--color-warning-transparent-100);
			}
			.gz-callout[data-callout-type='danger'] {
				background: var(--color-danger-transparent-100);
			}
			.gz-callout.selected {
				outline: 2px solid var(--color-primary-transparent-300);
			}
			.gz-callout-icon {
				flex: 0 0 auto;
				display: flex;
				align-items: center;
				justify-content: center;
				width: 1.75rem;
				height: 1.75rem;
				border: none;
				background: transparent;
				border-radius: 0.25rem;
				cursor: pointer;
				font-size: 1rem;
			}
			.gz-callout[data-callout-type='info'] .gz-callout-icon {
				color: var(--color-info-default);
			}
			.gz-callout[data-callout-type='success'] .gz-callout-icon {
				color: var(--color-success-default);
			}
			.gz-callout[data-callout-type='warning'] .gz-callout-icon {
				color: var(--color-warning-default);
			}
			.gz-callout[data-callout-type='danger'] .gz-callout-icon {
				color: var(--color-danger-default);
			}
			.gz-callout-switcher {
				position: absolute;
				top: -2.25rem;
				left: 0;
				display: flex;
				gap: 0.125rem;
				padding: 0.25rem;
				border-radius: var(--border-radius);
				border: 1px solid var(--border-basic-color-3);
				background: var(--background-basic-color-1);
				box-shadow: var(--shadow);
				z-index: 10;
			}
			.gz-callout-switcher button {
				border: none;
				background: transparent;
				border-radius: 0.25rem;
				cursor: pointer;
				padding: 0.25rem;
			}
			.gz-callout-switcher button.active,
			.gz-callout-switcher button:hover {
				background: var(--background-basic-color-2);
			}
			.gz-callout-content {
				flex: 1;
				min-width: 0;
			}
		`
	]
})
export class CalloutNodeViewComponent extends AngularNodeViewComponent {
	public switcherOpen = false;
	public readonly types = CALLOUT_TYPES;

	get type(): CalloutType {
		return (this.node().attrs['type'] as CalloutType) ?? 'info';
	}

	get emoji(): string | null {
		return (this.node().attrs['emoji'] as string | null) ?? null;
	}

	get icon(): string {
		return CALLOUT_ICONS[this.type] ?? CALLOUT_ICONS.info;
	}

	iconOf(type: CalloutType): string {
		return CALLOUT_ICONS[type];
	}

	setType(type: CalloutType): void {
		this.switcherOpen = false;
		this.updateAttributes()({ type });
	}
}
