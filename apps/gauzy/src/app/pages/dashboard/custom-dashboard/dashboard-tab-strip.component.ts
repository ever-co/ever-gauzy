import { Component, EventEmitter, Input, Output, QueryList, ViewChildren } from '@angular/core';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { firstValueFrom } from 'rxjs';
import { NbDialogService, NbPopoverDirective } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { IDashboardTab } from '@gauzy/contracts';
import { ConfirmComponent, PromptComponent } from '@gauzy/ui-core/shared';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';

/**
 * Horizontal tab strip of a custom dashboard.
 *
 * Read-only mode is a plain chip row. Edit mode adds a `+` button, a per-tab
 * kebab menu (Rename / Duplicate / Delete) and horizontal drag reordering.
 *
 * The component owns the Prompt/Confirm dialogs and emits the RESULT of the
 * interaction (a name, a confirmed tab, the reordered list), so the page stays
 * free of dialog plumbing.
 */
@Component({
	selector: 'ga-dashboard-tab-strip',
	templateUrl: './dashboard-tab-strip.component.html',
	styleUrls: ['./dashboard-tab-strip.component.scss'],
	standalone: false
})
export class DashboardTabStripComponent extends TranslationBaseComponent {
	/** Tabs of the dashboard, in display order. */
	@Input() public tabs: IDashboardTab[] = [];

	/** Id of the currently displayed tab. */
	@Input() public activeTabId: string | null = null;

	/** Whether the dashboard is in edit (arrange) mode. */
	@Input() public editing = false;

	/** Emits the id of the tab the user switched to. */
	@Output() public readonly select = new EventEmitter<string>();

	/** Emits the name entered for a new tab. */
	@Output() public readonly add = new EventEmitter<string>();

	/** Emits the tab together with its new name. */
	@Output() public readonly rename = new EventEmitter<{ tab: IDashboardTab; name: string }>();

	/** Emits the tab to duplicate. */
	@Output() public readonly duplicate = new EventEmitter<IDashboardTab>();

	/** Emits the tab to delete (already confirmed by the user). */
	@Output() public readonly delete = new EventEmitter<IDashboardTab>();

	/** Emits the full tab list in its new order, with `order` re-numbered. */
	@Output() public readonly reorder = new EventEmitter<IDashboardTab[]>();

	/** Tab whose kebab menu is currently open (the menu template reads it). */
	public menuTab: IDashboardTab | null = null;

	@ViewChildren(NbPopoverDirective) private _popovers: QueryList<NbPopoverDirective>;

	constructor(
		public readonly translateService: TranslateService,
		private readonly _dialogService: NbDialogService
	) {
		super(translateService);
	}

	/** The last tab may not be deleted — a dashboard always has one canvas. */
	public get canDelete(): boolean {
		return this.tabs.length > 1;
	}

	/**
	 * Switches to the given tab.
	 *
	 * @param tab - The tab to display.
	 */
	public onSelect(tab: IDashboardTab): void {
		if (tab.id !== this.activeTabId) {
			this.select.emit(tab.id);
		}
	}

	/**
	 * Opens the kebab menu of a tab.
	 *
	 * Runs before Nebular renders the popover (Angular host listeners fire first),
	 * so the shared menu template already knows which tab it belongs to.
	 *
	 * @param tab - The tab whose menu is opening.
	 */
	public openMenu(tab: IDashboardTab): void {
		this.menuTab = tab;
	}

	/**
	 * Reorders the tabs after a horizontal drag.
	 *
	 * @param event - The CDK drop event.
	 */
	public onDrop(event: CdkDragDrop<IDashboardTab[]>): void {
		if (!this.editing || event.previousIndex === event.currentIndex) {
			return;
		}
		const tabs = [...this.tabs];
		moveItemInArray(tabs, event.previousIndex, event.currentIndex);
		this.reorder.emit(tabs.map((tab, index) => ({ ...tab, order: index })));
	}

	/*
	|--------------------------------------------------------------------------
	| Edit-mode actions
	|--------------------------------------------------------------------------
	*/

	/** Prompts for a name and emits it as a new tab request. */
	public async promptAdd(): Promise<void> {
		const name = await this._promptForName('DASHBOARD_PAGE.BUILDER.TABS.ADD_TAB');
		if (name) {
			this.add.emit(name);
		}
	}

	/**
	 * Prompts for a new name for the given tab.
	 *
	 * @param tab - The tab to rename.
	 */
	public async promptRename(tab: IDashboardTab): Promise<void> {
		this._closeMenus();
		const name = await this._promptForName('DASHBOARD_PAGE.BUILDER.TABS.RENAME_TAB');
		if (name) {
			this.rename.emit({ tab, name });
		}
	}

	/**
	 * Requests a duplicate of the given tab.
	 *
	 * @param tab - The tab to duplicate.
	 */
	public onDuplicate(tab: IDashboardTab): void {
		this._closeMenus();
		this.duplicate.emit(tab);
	}

	/**
	 * Asks for confirmation, then requests deletion of the given tab.
	 *
	 * @param tab - The tab to delete.
	 */
	public async confirmDelete(tab: IDashboardTab): Promise<void> {
		this._closeMenus();
		if (!this.canDelete) {
			return;
		}

		const dialogRef = this._dialogService.open(ConfirmComponent, {
			context: {
				data: {
					title: this.getTranslation('DASHBOARD_PAGE.BUILDER.TABS.DELETE_TAB'),
					message: this.getTranslation('DASHBOARD_PAGE.BUILDER.TABS.DELETE_CONFIRM', { name: tab.name })
				}
			}
		});

		if (await firstValueFrom(dialogRef.onClose)) {
			this.delete.emit(tab);
		}
	}

	/*
	|--------------------------------------------------------------------------
	| Internals
	|--------------------------------------------------------------------------
	*/

	/**
	 * Opens a prompt dialog asking for a tab name.
	 *
	 * @param titleKey - Translation key for the dialog title.
	 * @returns The trimmed name, or `null` when cancelled/empty.
	 */
	private async _promptForName(titleKey: string): Promise<string | null> {
		const dialogRef = this._dialogService.open(PromptComponent, {
			context: {
				data: {
					title: this.getTranslation(titleKey),
					label: this.getTranslation('DASHBOARD_PAGE.BUILDER.TABS.NAME_LABEL'),
					placeholder: this.getTranslation('DASHBOARD_PAGE.BUILDER.TABS.NAME_PLACEHOLDER'),
					okText: this.getTranslation('BUTTONS.OK'),
					cancelText: this.getTranslation('BUTTONS.CANCEL'),
					inputType: 'text'
				}
			}
		});

		const name = await firstValueFrom(dialogRef.onClose);
		return typeof name === 'string' && name.trim().length > 0 ? name.trim() : null;
	}

	/** Hides every kebab popover (only one can be open at a time). */
	private _closeMenus(): void {
		this._popovers?.forEach((popover: NbPopoverDirective) => popover.hide());
	}
}
