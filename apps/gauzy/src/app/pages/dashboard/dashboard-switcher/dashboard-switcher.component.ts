import { AfterViewChecked, ChangeDetectorRef, Component, ElementRef, Signal, ViewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { NbDialogService, NbPopoverDirective } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy } from '@ngneat/until-destroy';
import { IDashboard } from '@gauzy/contracts';
import { DashboardStoreService, ToastrService } from '@gauzy/ui-core/core';
import { ConfirmComponent, PromptComponent } from '@gauzy/ui-core/shared';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';

/**
 * Dashboard switcher bar rendered above the dashboard tabs:
 *
 * - A chips row listing "Standard" plus each of the user's custom dashboards
 *   (only rendered when at least one custom dashboard exists), with < / >
 *   arrow buttons handling horizontal overflow (no visible scrollbar).
 * - A more-vertical (⋮) menu with New / Duplicate / Rename / Set as Default /
 *   Delete / Edit actions, plus a visible Edit button when a custom dashboard
 *   is active, and Save / Discard buttons while editing.
 */
@UntilDestroy()
@Component({
	selector: 'ga-dashboard-switcher',
	templateUrl: './dashboard-switcher.component.html',
	styleUrls: ['./dashboard-switcher.component.scss'],
	standalone: false
})
export class DashboardSwitcherComponent extends TranslationBaseComponent implements AfterViewChecked {
	// Signals (single subscription each) instead of repeated `| async` pipes
	public dashboards: Signal<IDashboard[]>;
	public selected: Signal<IDashboard | null>;
	public editing: Signal<boolean>;

	/** Whether the chips row currently overflows and needs scroll arrows. */
	public canScroll = false;

	@ViewChild('chipsScroll') chipsScroll: ElementRef<HTMLElement>;
	@ViewChild(NbPopoverDirective) actionsPopover: NbPopoverDirective;

	constructor(
		public readonly translateService: TranslateService,
		private readonly _dashboardStore: DashboardStoreService,
		private readonly _dialogService: NbDialogService,
		private readonly _toastrService: ToastrService,
		private readonly _changeRef: ChangeDetectorRef
	) {
		super(translateService);
		this.dashboards = toSignal(this._dashboardStore.dashboards$, { initialValue: [] as IDashboard[] });
		this.selected = toSignal(this._dashboardStore.selectedDashboard$, { initialValue: null });
		this.editing = toSignal(this._dashboardStore.editing$, { initialValue: false });
	}

	ngAfterViewChecked(): void {
		const el = this.chipsScroll?.nativeElement;
		const overflow = !!el && el.scrollWidth > el.clientWidth + 1;
		if (overflow !== this.canScroll) {
			this.canScroll = overflow;
			this._changeRef.detectChanges();
		}
	}

	/** Scrolls the chips row left (-1) or right (+1). */
	public scroll(direction: number): void {
		this.chipsScroll?.nativeElement?.scrollBy({ left: direction * 200, behavior: 'smooth' });
	}

	/** Switches to the Standard (prebuilt) dashboard. */
	public async selectStandard(): Promise<void> {
		if (!(await this._confirmDiscardIfEditing())) {
			return;
		}
		this._dashboardStore.navigateToStandard();
	}

	/** Switches to the given custom dashboard. */
	public async select(dashboard: IDashboard): Promise<void> {
		if (this._dashboardStore.selectedDashboard?.id === dashboard.id) {
			return;
		}
		if (!(await this._confirmDiscardIfEditing())) {
			return;
		}
		this._dashboardStore.navigateToDashboard(dashboard.id);
	}

	/**
	 * When edit mode is active, asks the user to confirm discarding the
	 * unsaved widget arrangement before navigating away.
	 *
	 * @returns `true` to proceed with the navigation, `false` to stay.
	 */
	private async _confirmDiscardIfEditing(): Promise<boolean> {
		if (!this.editing()) {
			return true;
		}
		const dialogRef = this._dialogService.open(ConfirmComponent, {
			context: {
				data: {
					title: this.getTranslation('DASHBOARD_PAGE.CUSTOM.DISCARD_CHANGES'),
					message: this.getTranslation('DASHBOARD_PAGE.CUSTOM.DISCARD_CONFIRM')
				}
			}
		});
		return !!(await firstValueFrom(dialogRef.onClose));
	}

	/*
	|--------------------------------------------------------------------------
	| Context menu (⋮) actions
	|--------------------------------------------------------------------------
	*/

	/** Creates a new custom dashboard (default widget arrangement) and switches to it. */
	public async newDashboard(): Promise<void> {
		this.actionsPopover?.hide();
		const name = await this._promptForName('DASHBOARD_PAGE.CUSTOM.NEW_DASHBOARD');
		if (!name) {
			return;
		}
		try {
			const dashboard = await this._dashboardStore.createDashboard(name);
			this._toastrService.success('DASHBOARD_PAGE.CUSTOM.CREATED', { name });
			this._dashboardStore.navigateToDashboard(dashboard.id);
		} catch (error) {
			this._toastrService.danger(error);
		}
	}

	/**
	 * Duplicates the active dashboard (Standard duplicates the current live
	 * layout) and switches to the copy.
	 */
	public async duplicateDashboard(): Promise<void> {
		this.actionsPopover?.hide();
		const source = this._dashboardStore.selectedDashboard;
		const baseName = source?.name ?? this.getTranslation('DASHBOARD_PAGE.CUSTOM.STANDARD');
		const name = `${baseName} ${this.getTranslation('DASHBOARD_PAGE.CUSTOM.COPY_SUFFIX')}`;
		try {
			const dashboard = await this._dashboardStore.duplicateDashboard(source, name);
			this._toastrService.success('DASHBOARD_PAGE.CUSTOM.CREATED', { name });
			this._dashboardStore.navigateToDashboard(dashboard.id);
		} catch (error) {
			this._toastrService.danger(error);
		}
	}

	/** Renames the active custom dashboard. */
	public async renameDashboard(): Promise<void> {
		this.actionsPopover?.hide();
		const selected = this._dashboardStore.selectedDashboard;
		if (!selected) {
			return;
		}
		const name = await this._promptForName('DASHBOARD_PAGE.CUSTOM.RENAME_DASHBOARD');
		if (!name) {
			return;
		}
		try {
			await this._dashboardStore.renameDashboard(selected, name);
			this._toastrService.success('DASHBOARD_PAGE.CUSTOM.UPDATED', { name });
		} catch (error) {
			this._toastrService.danger(error);
		}
	}

	/**
	 * Marks the active dashboard as the default one (loaded when the user
	 * clicks "Dashboards" in the sidebar). With Standard active, clears the
	 * default flag from all custom dashboards instead.
	 */
	public async setAsDefault(): Promise<void> {
		this.actionsPopover?.hide();
		const selected = this._dashboardStore.selectedDashboard;
		try {
			if (selected) {
				await this._dashboardStore.setDefaultDashboard(selected);
				this._toastrService.success('DASHBOARD_PAGE.CUSTOM.SET_DEFAULT_SUCCESS', { name: selected.name });
			} else {
				await this._dashboardStore.clearDefaultDashboard();
				this._toastrService.success('DASHBOARD_PAGE.CUSTOM.SET_DEFAULT_SUCCESS', {
					name: this.getTranslation('DASHBOARD_PAGE.CUSTOM.STANDARD')
				});
			}
		} catch (error) {
			this._toastrService.danger(error);
		}
	}

	/** Deletes the active custom dashboard (with confirmation). */
	public async deleteDashboard(): Promise<void> {
		this.actionsPopover?.hide();
		const selected = this._dashboardStore.selectedDashboard;
		if (!selected) {
			return;
		}

		const dialogRef = this._dialogService.open(ConfirmComponent, {
			context: {
				data: {
					title: this.getTranslation('DASHBOARD_PAGE.CUSTOM.DELETE_DASHBOARD'),
					message: this.getTranslation('DASHBOARD_PAGE.CUSTOM.DELETE_CONFIRM', { name: selected.name })
				}
			}
		});

		const confirmed = await firstValueFrom(dialogRef.onClose);
		if (!confirmed) {
			return;
		}

		try {
			await this._dashboardStore.deleteDashboard(selected);
			this._toastrService.success('DASHBOARD_PAGE.CUSTOM.DELETED', { name: selected.name });
		} catch (error) {
			this._toastrService.danger(error);
		}
	}

	/*
	|--------------------------------------------------------------------------
	| Edit mode
	|--------------------------------------------------------------------------
	*/

	/** Enters edit (arrange) mode for the active custom dashboard. */
	public editDashboard(): void {
		this.actionsPopover?.hide();
		this._dashboardStore.startEditing();
	}

	/** Persists the current widget arrangement into the active custom dashboard. */
	public async saveLayout(): Promise<void> {
		try {
			await this._dashboardStore.saveSelectedLayout();
			this._toastrService.success('DASHBOARD_PAGE.CUSTOM.LAYOUT_SAVED');
		} catch (error) {
			this._toastrService.danger(error);
		}
	}

	/** Discards unsaved layout changes. */
	public cancelEditing(): void {
		this._dashboardStore.cancelEditing();
	}

	/**
	 * Opens a prompt dialog asking for a dashboard name.
	 *
	 * @param titleKey - Translation key for the dialog title.
	 * @returns The entered name, or `null` when cancelled/empty.
	 */
	private async _promptForName(titleKey: string): Promise<string | null> {
		const dialogRef = this._dialogService.open(PromptComponent, {
			context: {
				data: {
					title: this.getTranslation(titleKey),
					label: this.getTranslation('DASHBOARD_PAGE.CUSTOM.NAME_LABEL'),
					placeholder: this.getTranslation('DASHBOARD_PAGE.CUSTOM.NAME_PLACEHOLDER'),
					okText: this.getTranslation('BUTTONS.OK'),
					cancelText: this.getTranslation('BUTTONS.CANCEL'),
					inputType: 'text'
				}
			}
		});

		const name = await firstValueFrom(dialogRef.onClose);
		return typeof name === 'string' && name.trim().length > 0 ? name.trim() : null;
	}
}
