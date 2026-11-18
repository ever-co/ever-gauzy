import {
	ChangeDetectionStrategy,
	Component,
	Input,
	OnInit,
	computed,
	inject,
	signal
} from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { ID, ITag, ITagType } from '@gauzy/contracts';
import { Store, TagTypesService, TagsService } from '@gauzy/ui-core/core';

/**
 * A row of the tags list: the tag, the type name the list joins in (`tagTypeName`), and one `<relation>_counter`
 * per relation the tag can be attached to. The counters come back as numbers or numeric strings depending on the
 * database driver, and not every list read returns them.
 */
export type ITagListRow = ITag & {
	tagTypeName?: string | null;
	[counter: `${string}_counter`]: unknown;
};

/** What the dialog closes with when the viewer asks to edit: the tag as the dialog showed it. */
export interface ITagDetailsResult {
	action: 'edit';
	tag: ITag;
}

/** One kind of record the tag is attached to, and how many of them. */
interface ITagUsage {
	/** A translation key for the built-in kinds; the field name itself for a custom field. */
	label: string;
	translate: boolean;
	count: number;
}

/**
 * The usage counters the tags list returns with each tag (`<name>_counter`), and the label each is shown under.
 * A counter not named here comes from a custom field and is shown under the field's own name.
 */
const USAGE_LABELS: Record<string, string> = {
	candidate_counter: 'TAGS_PAGE.USED_IN.CANDIDATES',
	employee_counter: 'TAGS_PAGE.USED_IN.EMPLOYEES',
	employee_level_counter: 'TAGS_PAGE.USED_IN.EMPLOYEE_LEVELS',
	equipment_counter: 'TAGS_PAGE.USED_IN.EQUIPMENT',
	event_type_counter: 'TAGS_PAGE.USED_IN.EVENT_TYPES',
	expense_counter: 'TAGS_PAGE.USED_IN.EXPENSES',
	income_counter: 'TAGS_PAGE.USED_IN.INCOMES',
	integration_counter: 'TAGS_PAGE.USED_IN.INTEGRATIONS',
	invoice_counter: 'TAGS_PAGE.USED_IN.INVOICES',
	merchant_counter: 'TAGS_PAGE.USED_IN.MERCHANTS',
	organization_counter: 'TAGS_PAGE.USED_IN.ORGANIZATIONS',
	organization_contact_counter: 'TAGS_PAGE.USED_IN.CONTACTS',
	organization_department_counter: 'TAGS_PAGE.USED_IN.DEPARTMENTS',
	organization_employment_type_counter: 'TAGS_PAGE.USED_IN.EMPLOYMENT_TYPES',
	expense_category_counter: 'TAGS_PAGE.USED_IN.EXPENSE_CATEGORIES',
	organization_position_counter: 'TAGS_PAGE.USED_IN.POSITIONS',
	organization_project_counter: 'TAGS_PAGE.USED_IN.PROJECTS',
	organization_team_counter: 'TAGS_PAGE.USED_IN.TEAMS',
	organization_vendor_counter: 'TAGS_PAGE.USED_IN.VENDORS',
	payment_counter: 'TAGS_PAGE.USED_IN.PAYMENTS',
	product_counter: 'TAGS_PAGE.USED_IN.PRODUCTS',
	request_approval_counter: 'TAGS_PAGE.USED_IN.APPROVALS',
	task_counter: 'TAGS_PAGE.USED_IN.TASKS',
	user_counter: 'TAGS_PAGE.USED_IN.USERS',
	warehouse_counter: 'TAGS_PAGE.USED_IN.WAREHOUSES'
};

const COUNTER_SUFFIX = '_counter';

/**
 * A tag's details: its name, colour, description, type, level and dates, read fresh with `GET /tags/:id`, and
 * where it is used, from the counters the tags list row already carries (the single read has none).
 *
 * Closes with an {@link ITagDetailsResult} when the viewer asks to edit the tag, carrying the tag as shown here
 * so the editor starts from the refreshed fields rather than the list row.
 */
@Component({
	selector: 'ngx-tag-details',
	templateUrl: './tag-details.component.html',
	styleUrls: ['./tag-details.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: false
})
export class TagDetailsComponent implements OnInit {
	private readonly dialogRef = inject<NbDialogRef<TagDetailsComponent>>(NbDialogRef);
	private readonly tagsService = inject(TagsService);
	private readonly tagTypesService = inject(TagTypesService);
	private readonly store = inject(Store);

	/** The row of the tags list: the tag, its type name and its usage counters. */
	@Input() row: ITagListRow;
	/**
	 * The organization's tag types as the Tags page held them when the dialog opened: the first place a changed
	 * type is looked up. It is a snapshot (the page may still have been loading them), so a type it does not hold
	 * is read fresh instead (see {@link refreshTypeName}).
	 */
	@Input() tagTypes: ITagType[] = [];

	/** The tag as shown: the list row at first, then the row with the refreshed fields over it. */
	protected readonly tag = signal<ITagListRow | null>(null);
	/** The type's name, kept in step with the refreshed `tagTypeId` (see {@link refreshTypeName}). */
	protected readonly typeName = signal<string | null>(null);
	/** True while the single read is out. Edit waits for it, so the editor gets the refreshed fields. */
	protected readonly loading = signal(false);

	/** Where the tag lives: the whole tenant, one organization, or one team of it. */
	protected readonly levelKey = computed(() => {
		const tag = this.tag();
		if (tag?.organizationTeamId) {
			return 'TAGS_PAGE.LEVEL_TEAM';
		}
		return tag?.organizationId ? 'TAGS_PAGE.LEVEL_ORGANIZATION' : 'TAGS_PAGE.LEVEL_TENANT';
	});

	/** The usage rows, from the list row's counters; fixed for the dialog's life (the single read has none). */
	protected usages: ITagUsage[] = [];
	protected totalUsage = 0;
	/**
	 * Whether the row carries usage counters at all. Not every list read returns them (the MikroORM one does not),
	 * and a row without any must not read as a tag nobody uses: the dialog says the counts are unavailable instead.
	 */
	protected usageAvailable = false;

	async ngOnInit(): Promise<void> {
		this.tag.set(this.row);
		this.typeName.set(this.row?.tagType?.type || this.row?.tagTypeName || null);
		this.usageAvailable = Object.keys(this.row ?? {}).some((property) => property.endsWith(COUNTER_SUFFIX));
		this.usages = this.usagesOf(this.row);
		this.totalUsage = this.usages.reduce((sum, usage) => sum + usage.count, 0);

		// The row is already on screen; the single read only refreshes the fields someone may have changed since.
		this.loading.set(true);
		try {
			const fresh = await this.tagsService.getTagById(this.row.id);
			this.tag.set({ ...this.row, ...fresh });
			await this.refreshTypeName(fresh.tagTypeId ?? null);
		} catch (error) {
			// Keep showing the row: it is what the list showed a moment ago.
			console.error('Error while retrieving the tag', error);
		} finally {
			this.loading.set(false);
		}
	}

	protected edit(): void {
		const tag = this.tag();
		if (!tag || this.loading()) {
			return;
		}
		const result: ITagDetailsResult = { action: 'edit', tag };
		this.dialogRef.close(result);
	}

	protected close(): void {
		this.dialogRef.close();
	}

	/**
	 * The type's name for the refreshed `tagTypeId`, which is the source of truth (the single read carries the id
	 * only):
	 * - no id: no type;
	 * - the id the list joined its name for: the list's name;
	 * - another id: its name from the tag types the page passed in, or, when that snapshot does not hold it (the
	 *   page may still have been loading them), from the organization's tag types read now.
	 *
	 * A type the dialog cannot name is shown as none rather than as the list's stale one.
	 */
	private async refreshTypeName(tagTypeId: ID | null): Promise<void> {
		if (!tagTypeId) {
			this.typeName.set(null);
			return;
		}
		const listName = this.row.tagType?.type || this.row.tagTypeName;
		if (tagTypeId === this.row.tagTypeId && listName) {
			this.typeName.set(listName);
			return;
		}
		const known = this.tagTypes?.find(({ id }) => id === tagTypeId);
		if (known) {
			this.typeName.set(known.type ?? null);
			return;
		}
		try {
			const { tenantId } = this.store.user;
			// The refreshed tag's organization (it may have moved since the list loaded); the page's for a tenant tag.
			const organizationId = this.tag()?.organizationId ?? this.store.selectedOrganization?.id;
			const { items } = await this.tagTypesService.getTagTypes({ tenantId, organizationId });
			this.typeName.set(items.find(({ id }) => id === tagTypeId)?.type ?? null);
		} catch (error) {
			console.error('Error while retrieving tag types', error);
			this.typeName.set(null);
		}
	}

	private usagesOf(row: ITagListRow): ITagUsage[] {
		const usages: ITagUsage[] = [];
		for (const [property, value] of Object.entries(row ?? {})) {
			if (!property.endsWith(COUNTER_SUFFIX)) {
				continue;
			}
			const count = this.countOf(value);
			if (count <= 0) {
				continue;
			}
			const key = USAGE_LABELS[property];
			usages.push(
				key
					? { label: key, translate: true, count }
					: { label: this.readableName(property.slice(0, -COUNTER_SUFFIX.length)), translate: false, count }
			);
		}
		return usages.sort((a, b) => b.count - a.count);
	}

	/** A counter as a whole number: drivers return it as a number or a numeric string; anything else counts 0. */
	private countOf(value: unknown): number {
		const count = typeof value === 'number' ? value : typeof value === 'string' ? parseInt(value, 10) : NaN;
		return Number.isFinite(count) ? Math.trunc(count) : 0;
	}

	/** A custom field's name as a label: `proposals` → `Proposals`, `clientProjects` → `Client projects`. */
	private readableName(field: string): string {
		const words = field
			.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
			.replace(/[_-]+/g, ' ')
			.trim()
			.toLowerCase();
		return words.charAt(0).toUpperCase() + words.slice(1);
	}
}
