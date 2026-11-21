import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NbDialogRef, NbDialogService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { combineLatest, firstValueFrom } from 'rxjs';
import { distinctUntilChanged, filter, first, map } from 'rxjs/operators';
import {
	BaseEntityEnum,
	IEquipment,
	IEquipmentSharing,
	IOrganization,
	PermissionsEnum,
	RequestApprovalStatusTypesEnum
} from '@gauzy/contracts';
import { EquipmentService, ErrorHandlingService, Store, ToastrService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import {
	DeleteConfirmationComponent,
	EquipmentMutationComponent,
	IRecordViewScope,
	IRecordViewSection,
	RecordViewPageState,
	recordViewPageStateOf
} from '@gauzy/ui-core/shared';
import { formatExpenseMoney } from '../../expenses/expense-record-view';
import { EQUIPMENT_LIST_LINK, loadEquipment } from '../equipment-record-view';

/** Where the sharing requests are made and approved. */
export const EQUIPMENT_SHARING_LINK = '/pages/organization/equipment-sharing';

/** A sharing request as the page lists it: its name, its dates and where it stands. */
export interface IEquipmentSharingRow {
	id: string;
	name: string;
	start: Date | null;
	end: Date | null;
	/** i18n key of the status: requested, approved or refused. */
	status: string;
	tone: 'success' | 'danger' | 'warning';
}

/** The equipment's headline, worked out once per load. */
export interface IEquipmentHeadline {
	/** The picture's address, when the equipment has one. */
	imageUrl: string | null;
	/** The initial cost in the equipment's currency, e.g. "$40,000.00". */
	cost: string | null;
	/** How old the equipment is, as an i18n key and its count. */
	age: { key: string; count: number } | null;
	/** The longest a sharing may last, as an i18n key and its count. */
	sharePeriod: { key: string; count: number } | null;
}

/**
 * A piece of equipment on its own full-width page, `/pages/organization/equipment/view/:id`: what the list's View
 * button and an equipment favorite in the sidebar open.
 *
 * Laid out as the income page: the actions — Edit, Copy link, the star and Delete — beside the back button; the
 * headline — the picture, the name, its type, serial number and tags, then the initial cost, its age, the longest
 * sharing and whether requests are approved by themselves as figures; the wide column — the sharing requests made
 * for it, then its tags; and the side column — every field of the equipment, then its stamps.
 *
 * The page belongs to the organization selected in the header, like the list: equipment of another organization
 * reads "not found", and switching the organization reloads the page, discarding any load in flight.
 */
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-equipment-view-page',
	templateUrl: './equipment-view-page.component.html',
	styleUrls: [
		'../../employees/view-employee/view-employee.component.scss',
		'../../projects/components/project-quick-look/project-quick-look.component.scss',
		'./equipment-view-page.component.scss'
	],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: false,
	// The project page's page layout: headline, then two columns.
	host: { class: 'is-page' }
})
export class EquipmentViewPageComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	// The base class injects the TranslateService itself.
	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);
	private readonly dialogService = inject(NbDialogService);
	private readonly equipmentService = inject(EquipmentService);
	private readonly toastrService = inject(ToastrService);
	private readonly errorHandler = inject(ErrorHandlingService);
	private readonly store = inject(Store);
	private readonly cdr = inject(ChangeDetectorRef);

	// Explicit, so the compiler does not inherit the undecorated base class's constructor (NG2006).
	constructor() {
		super();
	}

	readonly PermissionsEnum = PermissionsEnum;
	readonly favoriteEntity = BaseEntityEnum.Equipment;
	readonly backLink = EQUIPMENT_LIST_LINK;
	readonly sharingLink = EQUIPMENT_SHARING_LINK;

	/** The equipment as read: what the edit dialog is opened on, and what the record sections read. */
	equipment: IEquipment = null;
	headline: IEquipmentHeadline = null;
	/** The sharing requests made for the equipment, the latest first. */
	sharings: IEquipmentSharingRow[] = [];

	/** The tags, in the wide column. */
	tagSections: IRecordViewSection[] = [];
	/** Every field of the equipment, at the top of the side column. */
	detailsSections: IRecordViewSection[] = [];
	/** The created / updated stamps, at the foot of the side column. */
	metaSections: IRecordViewSection[] = [];

	state: RecordViewPageState = 'loading';
	organization: IOrganization | null = null;
	/** An edit or a delete is being saved: the actions wait for it. */
	busy = false;

	private equipmentId: string = null;
	/** Bumped by every load; a load that is no longer the latest one when it answers is discarded. */
	private loadSequence = 0;
	/** The edit or delete dialog that is open: closed when the page turns to another record or organization. */
	private openDialog: NbDialogRef<unknown> | null = null;

	ngOnInit(): void {
		// The component is reused across `view/:id` navigations, and the page follows the header's
		// organization: either changing reloads.
		const id$ = this.route.paramMap.pipe(
			map((params) => params.get('id')),
			filter((id): id is string => !!id),
			distinctUntilChanged()
		);
		const organization$ = this.store.selectedOrganization$.pipe(
			filter((organization: IOrganization) => !!organization?.id),
			distinctUntilChanged((a: IOrganization, b: IOrganization) => a.id === b.id)
		);
		combineLatest([id$, organization$])
			.pipe(untilDestroyed(this))
			.subscribe(([id, organization]) => {
				// A dialog opened on the previous record must not act on it once the page shows another.
				this.openDialog?.close();
				this.equipmentId = id;
				this.organization = organization;
				void this.load();
			});
		// The cost is formatted in the viewer's language.
		this.translateService.onLangChange.pipe(untilDestroyed(this)).subscribe(() => {
			this.describe();
			this.cdr.markForCheck();
		});
	}

	ngOnDestroy(): void {
		// A read still in flight is discarded when it answers.
		this.loadSequence++;
		this.openDialog?.close();
	}

	/** Loads (or reloads, after an error) the equipment the URL names. */
	async load(): Promise<void> {
		const id = this.equipmentId;
		const scope = this.scope();
		if (!id || !scope) {
			return;
		}
		const sequence = ++this.loadSequence;
		// Nothing of the previous record stays on screen while this one loads or if it fails.
		this.equipment = null;
		this.headline = null;
		this.sharings = [];
		this.state = 'loading';
		this.cdr.markForCheck();
		try {
			const equipment = await loadEquipment(this.equipmentService, id, scope);
			if (sequence !== this.loadSequence) {
				return; // a newer navigation or organization switch owns the page
			}
			if (!equipment || (equipment.organizationId && equipment.organizationId !== scope.organizationId)) {
				throw { status: 404 };
			}
			this.show(equipment);
			this.state = 'ready';
		} catch (error) {
			if (sequence !== this.loadSequence) {
				return;
			}
			this.state = recordViewPageStateOf(error);
		} finally {
			this.cdr.markForCheck();
		}
	}

	/* ── Actions ── */

	/** Opens the equipment form the list edits with — it saves itself — then reads the equipment again. */
	async edit(): Promise<void> {
		const equipment = this.equipment;
		if (!equipment || this.busy) return;
		const saved = await this.ask<IEquipment>(
			this.dialogService.open(EquipmentMutationComponent, { context: { equipment } }),
			equipment
		);
		if (!saved) return;
		this.toastrService.success('EQUIPMENT_PAGE.EQUIPMENT_SAVED', { name: saved.name });
		await this.refresh(equipment.id);
	}

	/** Asks, deletes the equipment, and goes back to the list. */
	async delete(): Promise<void> {
		const equipment = this.equipment;
		if (!equipment || this.busy) return;
		const dialog = this.dialogService.open(DeleteConfirmationComponent, {
			context: { recordType: this.getTranslation('EQUIPMENT_PAGE.HEADER') }
		});
		const confirmed = await this.ask<boolean>(dialog, equipment);
		if (!confirmed) return;
		this.setBusy(true);
		const sequence = this.loadSequence;
		try {
			await this.equipmentService.delete(equipment.id);
			this.toastrService.success('EQUIPMENT_PAGE.EQUIPMENT_DELETED', { name: equipment.name });
			// Not when the page turned or was left while the delete was saving.
			if (sequence === this.loadSequence) await this.router.navigateByUrl(EQUIPMENT_LIST_LINK);
		} catch (error) {
			this.errorHandler.handleError(error);
		} finally {
			this.setBusy(false);
		}
	}

	/** Copies the page's address, to paste in a chat or a ticket. */
	async copyLink(): Promise<void> {
		if (!this.equipment) return;
		const path = this.router.serializeUrl(
			this.router.createUrlTree([EQUIPMENT_LIST_LINK, 'view', this.equipment.id])
		);
		const { origin, pathname, hash } = window.location;
		// The app routes by the hash (`/#/pages/…`); the link keeps to it.
		const url = hash.startsWith('#/') ? `${origin}${pathname}#${path}` : `${origin}${path}`;
		try {
			await navigator.clipboard.writeText(url);
			this.toastrService.success('EQUIPMENT_VIEW.LINK_COPIED');
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	/* ── Reading and describing ── */

	/**
	 * What an action's dialog closes with — or nothing when, by then, the page has turned to another record or
	 * organization (or been left): the answer was given for the equipment the dialog was opened on.
	 */
	private async ask<T>(dialog: NbDialogRef<unknown>, equipment: IEquipment): Promise<T | null> {
		const sequence = this.loadSequence;
		const organizationId = this.organization?.id;
		this.openDialog = dialog;
		const answer = (await firstValueFrom(dialog.onClose.pipe(first()))) as T;
		if (this.openDialog === dialog) {
			this.openDialog = null;
		}
		const current =
			sequence === this.loadSequence &&
			this.equipment?.id === equipment.id &&
			this.organization?.id === organizationId;
		return current && answer ? answer : null;
	}

	private setBusy(busy: boolean): void {
		this.busy = busy;
		this.cdr.markForCheck();
	}

	/** Reads the equipment again after a change made here, keeping the page on screen while it does. */
	private async refresh(id: string): Promise<void> {
		const scope = this.scope();
		if (!scope || this.equipmentId !== id) return;
		const sequence = ++this.loadSequence;
		try {
			const equipment = await loadEquipment(this.equipmentService, id, scope);
			if (sequence !== this.loadSequence || this.equipmentId !== id) return;
			if (equipment) {
				this.show(equipment);
				this.state = 'ready';
			} else {
				this.state = 'not-found';
			}
		} catch (error) {
			if (sequence === this.loadSequence) {
				this.errorHandler.handleError(error);
			}
		} finally {
			this.cdr.markForCheck();
		}
	}

	private show(equipment: IEquipment): void {
		this.equipment = equipment;
		this.sharings = this.sharingRows(equipment.equipmentSharings ?? []);
		this.describe();
	}

	/** The sharing requests, the latest asked for first. */
	private sharingRows(sharings: IEquipmentSharing[]): IEquipmentSharingRow[] {
		const time = (sharing: IEquipmentSharing) =>
			new Date(sharing.shareRequestDay ?? sharing.shareStartDay ?? sharing.createdAt ?? 0).getTime();
		return [...sharings]
			.sort((a, b) => time(b) - time(a))
			.map((sharing) => ({
				id: sharing.id,
				name: sharing.name,
				start: sharing.shareStartDay ?? null,
				end: sharing.shareEndDay ?? null,
				...this.statusOf(sharing.status)
			}));
	}

	/** A request's status as the sharing list shows it: approved, refused, else requested. */
	private statusOf(status: number): Pick<IEquipmentSharingRow, 'status' | 'tone'> {
		switch (status) {
			case RequestApprovalStatusTypesEnum.APPROVED:
				return { status: 'EQUIPMENT_SHARING_PAGE.APPROVED', tone: 'success' };
			case RequestApprovalStatusTypesEnum.REFUSED:
				return { status: 'EQUIPMENT_SHARING_PAGE.REFUSED', tone: 'danger' };
			default:
				return { status: 'EQUIPMENT_SHARING_PAGE.REQUESTED', tone: 'warning' };
		}
	}

	/** Works out the headline and the sections from the equipment, in the viewer's language. */
	private describe(): void {
		const equipment = this.equipment;
		if (!equipment) {
			return;
		}
		const locale = this.translateService.getCurrentLang() || undefined;
		const cost = equipment.initialCost;
		const year = Number(equipment.manufacturedYear);
		const age = year ? new Date().getFullYear() - year : null;
		const period = Number(equipment.maxSharePeriod);
		this.headline = {
			imageUrl: equipment.image?.thumbUrl || equipment.image?.url || null,
			cost: cost !== null && cost !== undefined ? formatExpenseMoney(Number(cost), equipment.currency, locale) : null,
			age:
				age === null || age < 0
					? null
					: age === 0
					? { key: 'EQUIPMENT_VIEW.AGE_NEW', count: 0 }
					: { key: age === 1 ? 'EQUIPMENT_VIEW.AGE_ONE_YEAR' : 'EQUIPMENT_VIEW.AGE_YEARS', count: age },
			sharePeriod: period
				? { key: period === 1 ? 'EQUIPMENT_VIEW.ONE_DAY' : 'EQUIPMENT_VIEW.DAYS', count: period }
				: null
		};

		this.tagSections = [
			{
				title: 'SM_TABLE.TAGS',
				icon: 'pricetags-outline',
				// Kept when there are none, with the record view's "None", so the panel does not come and go.
				fields: [
					{ label: 'SM_TABLE.TAGS', key: 'tags', type: 'tags', wide: true, hideLabel: true, showWhenEmpty: true }
				]
			}
		];

		// Every field the list shows, so nothing is lost from the old page.
		this.detailsSections = [
			{
				title: 'EQUIPMENT_VIEW.DETAILS',
				icon: 'info-outline',
				fields: [
					{ label: 'EQUIPMENT_PAGE.EQUIPMENT_NAME', key: 'name', icon: 'cube-outline' },
					{ label: 'EQUIPMENT_PAGE.EQUIPMENT_TYPE', key: 'type', icon: 'layers-outline' },
					{ label: 'EQUIPMENT_PAGE.EQUIPMENT_SN', key: 'serialNumber', icon: 'hash-outline' },
					{
						label: 'EQUIPMENT_PAGE.EQUIPMENT_MANUFACTURED_YEAR',
						key: 'manufacturedYear',
						icon: 'calendar-outline'
					},
					{
						label: 'EQUIPMENT_PAGE.EQUIPMENT_INITIAL_COST',
						key: 'initialCost',
						icon: 'pricetags-outline',
						value: this.headline.cost ?? undefined,
						divider: true
					},
					{ label: 'EQUIPMENT_PAGE.EQUIPMENT_CURRENCY', key: 'currency', icon: 'credit-card-outline' },
					{
						label: 'EQUIPMENT_PAGE.EQUIPMENT_MAX_SHARE_PERIOD',
						key: 'maxSharePeriod',
						icon: 'clock-outline',
						divider: true
					},
					{
						label: 'EQUIPMENT_PAGE.EQUIPMENT_AUTO_APPROVE',
						key: 'autoApproveShare',
						type: 'boolean',
						icon: 'checkmark-circle-outline'
					}
				]
			}
		];

		this.metaSections = [
			{
				variant: 'meta',
				fields: [
					{ label: 'SM_TABLE.CREATED_AT', key: 'createdAt', type: 'datetime', icon: 'plus-circle-outline' },
					{ label: 'SM_TABLE.LAST_UPDATED', key: 'updatedAt', type: 'datetime', icon: 'refresh-outline' }
				]
			}
		];
	}

	/** The organization the page reads in: the one selected in the header. */
	private scope(): IRecordViewScope | null {
		return this.organization ? { organizationId: this.organization.id, tenantId: this.organization.tenantId } : null;
	}
}
