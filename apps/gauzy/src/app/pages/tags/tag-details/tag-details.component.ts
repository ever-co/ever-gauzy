import { Component, Input, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { ITag } from '@gauzy/contracts';
import { TagsService } from '@gauzy/ui-core/core';

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
 * Closes with `'edit'` when the viewer asks to edit the tag from here.
 */
@Component({
	selector: 'ngx-tag-details',
	templateUrl: './tag-details.component.html',
	styleUrls: ['./tag-details.component.scss'],
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class TagDetailsComponent implements OnInit {
	/** The row of the tags list: the tag, its type name and its usage counters. */
	@Input() row: ITag & Record<string, any>;

	tag: ITag & Record<string, any>;
	usages: ITagUsage[] = [];
	totalUsage = 0;
	loading = false;

	constructor(private readonly dialogRef: NbDialogRef<TagDetailsComponent>, private readonly tagsService: TagsService) {}

	async ngOnInit(): Promise<void> {
		this.tag = this.row;
		this.usages = this.usagesOf(this.row);
		this.totalUsage = this.usages.reduce((sum, usage) => sum + usage.count, 0);

		// The row is already on screen; the single read only refreshes the fields someone may have changed since.
		this.loading = true;
		try {
			const fresh = await this.tagsService.getTagById(this.row.id);
			this.tag = { ...this.row, ...fresh };
		} catch (error) {
			// Keep showing the row: it is what the list showed a moment ago.
			console.error('Error while retrieving the tag', error);
		} finally {
			this.loading = false;
		}
	}

	/** Where the tag lives: the whole tenant, one organization, or one team of it. */
	get levelKey(): string {
		if (this.tag?.organizationTeamId) {
			return 'TAGS_PAGE.LEVEL_TEAM';
		}
		return this.tag?.organizationId ? 'TAGS_PAGE.LEVEL_ORGANIZATION' : 'TAGS_PAGE.LEVEL_TENANT';
	}

	/** The type's name: the list row carries it as `tagTypeName`, a read with the relation as `tagType`. */
	get typeName(): string | null {
		return this.tag?.tagType?.type || this.tag?.tagTypeName || null;
	}

	edit(): void {
		this.dialogRef.close('edit');
	}

	close(): void {
		this.dialogRef.close();
	}

	private usagesOf(row: Record<string, any>): ITagUsage[] {
		const usages: ITagUsage[] = [];
		for (const [property, value] of Object.entries(row ?? {})) {
			if (!property.endsWith(COUNTER_SUFFIX)) {
				continue;
			}
			const count = parseInt(value, 10);
			if (!Number.isFinite(count) || count <= 0) {
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
