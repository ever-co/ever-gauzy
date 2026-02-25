import {
	ChangeDetectionStrategy,
	Component,
	inject,
	Input,
	OnChanges,
	OnInit,
	SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExtensionDefinition, ExtensionSlotId } from './extension-slot.types';
import { PageExtensionRegistryService } from './extension-registry.service';

/**
 * Renders all extensions registered for a given slot.
 *
 * This component queries the `PageExtensionRegistryService` for extensions
 * matching the `slotId` and renders each extension's component using
 * `*ngComponentOutlet`. This allows plugins to inject React, Vue, or any
 * other framework components into Angular host pages.
 *
 * @example
 * ```html
 * <!-- In TimeTrackingComponent template -->
 * <ga-extension-slot slotId="dashboard-widgets"></ga-extension-slot>
 *
 * <!-- Or using the constant -->
 * <ga-extension-slot [slotId]="EXTENSION_SLOTS.DASHBOARD_WIDGETS"></ga-extension-slot>
 * ```
 *
 * Extensions are rendered in order (sorted by `order` property).
 * Each extension can provide its own `config` object that gets passed as inputs.
 */
@Component({
	selector: 'ga-extension-slot',
	standalone: true,
	imports: [CommonModule],
	template: `
		@for (ext of extensions; track ext.id) {
			<div class="extension-container" [attr.data-extension-id]="ext.id">
				@if (ext.component) {
					<ng-container *ngComponentOutlet="ext.component; inputs: $any(ext.config)" />
				}
			</div>
		}
	`,
	styles: [
		`
			:host {
				display: contents;
			}
			.extension-container {
				display: contents;
			}
		`
	],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExtensionSlotComponent implements OnInit, OnChanges {
	private readonly _extensionRegistry = inject(PageExtensionRegistryService);

	/**
	 * The slot identifier to render extensions for.
	 * Use EXTENSION_SLOTS constants for well-known slots.
	 */
	@Input({ required: true }) slotId!: ExtensionSlotId;

	/**
	 * Optional CSS class to apply to each extension container.
	 */
	@Input() extensionClass?: string;

	/**
	 * The extensions to render, sorted by order.
	 */
	extensions: ExtensionDefinition[] = [];

	ngOnInit(): void {
		this._loadExtensions();
	}

	ngOnChanges(changes: SimpleChanges): void {
		if (changes['slotId']) {
			this._loadExtensions();
		}
	}

	private _loadExtensions(): void {
		if (this.slotId) {
			this.extensions = this._extensionRegistry.getExtensions(this.slotId);
		}
	}
}
