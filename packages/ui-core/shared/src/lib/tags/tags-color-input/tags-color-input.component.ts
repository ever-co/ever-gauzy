import {
	Component,
	OnInit,
	Input,
	Output,
	EventEmitter,
	OnDestroy,
	ElementRef,
	HostListener,
	Renderer2
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { filter, map, tap } from 'rxjs/operators';
import { Observable, Subject } from 'rxjs';
import { NbThemeService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import * as randomColor from 'randomcolor';
import { ITag, IOrganization, PermissionsEnum, ITagCreateInput } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { Store, TagsService } from '@gauzy/ui-core/core';
import { PictureNameTagsComponent } from '../../table-components';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-tags-color-input',
	templateUrl: './tags-color-input.component.html',
	styleUrls: ['./tags-color-input.component.scss'],
	standalone: false
})
export class TagsColorInputComponent extends PictureNameTagsComponent implements OnInit, OnDestroy {
	public subject$: Subject<boolean> = new Subject();
	public hasAddTag$: Observable<boolean>;
	public tags: ITag[] = [];
	public loading: boolean;
	private organization: IOrganization;

	/*
	 * Getter & Setter selected tags
	 */
	_selectedTags: ITag[] = [];
	get selectedTags(): ITag[] {
		return this._selectedTags;
	}
	@Input() set selectedTags(value: ITag[]) {
		this._selectedTags = value;
	}

	/*
	 * Getter & Setter for check organization level
	 */
	_isOrgLevel: boolean = false;
	get isOrgLevel(): boolean {
		return this._isOrgLevel;
	}
	@Input() set isOrgLevel(value: boolean) {
		this._isOrgLevel = value;
	}

	/*
	 * Getter & Setter for check tenant level
	 */
	_isTenantLevel: boolean = false;
	get isTenantLevel(): boolean {
		return this._isTenantLevel;
	}
	@Input() set isTenantLevel(value: boolean) {
		this._isTenantLevel = value;
	}

	/*
	 * Getter & Setter for multiple selection
	 */
	_multiple: boolean = true;
	get multiple(): boolean {
		return this._multiple;
	}
	@Input() set multiple(value: boolean) {
		this._multiple = value;
	}

	/*
	 * Getter & Setter for display label
	 */
	_label: boolean = true;
	get label(): boolean {
		return this._label;
	}
	@Input() set label(value: boolean) {
		this._label = value;
	}

	/*
	 * Getter & Setter for dynamic add tag option
	 */
	_addTag: boolean = true;
	get addTag(): boolean {
		return this._addTag;
	}
	@Input() set addTag(value: boolean) {
		this._addTag = value;
	}

	@Output() selectedTagsEvent = new EventEmitter<ITag[]>();

	selectedTagsOverflow: boolean = false;
	noOfTagsFits: number = 0;

	@HostListener('window:resize')
	onResize(): void {
		this.checkTagsFit(this.selectedTags);
	}

	constructor(
		private readonly tagsService: TagsService,
		private readonly store: Store,
		public readonly themeService: NbThemeService,
		public readonly translateService: TranslateService,
		private readonly el: ElementRef,
		private readonly renderer: Renderer2
	) {
		super(themeService, translateService);
	}

	ngOnInit(): void {
		this.hasAddTag$ = this.store.userRolePermissions$.pipe(
			map(() => this.store.hasAnyPermission(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TAGS_ADD))
		);
		this.subject$
			.pipe(
				tap(() => this.getTagsByLevel()),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.selectedOrganization$
			.pipe(
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();

		this.selectedTagsEvent.pipe(untilDestroyed(this)).subscribe((selectedTags: ITag[]) => {
			this.checkTagsFit(selectedTags);
		});
	}

	/**
	 * Get tags by level
	 *
	 * @returns
	 */
	async getTagsByLevel() {
		if (!this.organization) {
			return;
		}
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		if (this.isOrgLevel) {
			const { items } = await this.tagsService.getTagsByLevel({
				organizationId,
				tenantId
			});
			this.tags = items;
		}

		if (this.isTenantLevel) {
			const { items } = await this.tagsService.getTagsByLevel({
				tenantId
			});
			this.tags = items;
		}
	}

	/**
	 * Create new tag
	 *
	 * @param name
	 * @returns
	 */
	createNewTag = async (name: ITagCreateInput['name']) => {
		if (!name) {
			return;
		}
		this.loading = true;

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		try {
			return await firstValueFrom(
				this.tagsService.create({
					name: name,
					color: randomColor(),
					description: '',
					tenantId,
					...(this.isOrgLevel ? { organizationId } : {})
				})
			);
		} catch (error) {
			console.log('Error while creating tags', error);
		} finally {
			this.loading = false;
		}
	};

	/**
	 * Check if selected tags fits on the screen
	 */
	private checkTagsFit(selectedTags: ITag[]) {
		if (!selectedTags) {
			this.selectedTagsOverflow = false;
			return;
		}
		const selectedContainer = this.el.nativeElement.querySelector('.ng-value-container');
		const containerWidth = selectedContainer.offsetWidth;

		// The row ends with a "+N" chip, so the space it needs has to be held back
		// before any tag is allowed to claim it. That used to be a flat 30px, which
		// is about what a single-digit "+9" measures — at ten or more hidden tags
		// the chip is wider than the room kept for it and the value container clips
		// it. Measured instead, against `selectedTags.length`: the count shown can
		// never exceed the total, so the total's width is an upper bound for it,
		// and taking the bound rather than the count is what keeps this from
		// depending on the `noOfTagsFits` it is being used to work out. Never below
		// the old 30px, which was also doing duty as general slack.
		let usedWidth = Math.max(this.getOverflowLabelWidth(selectedTags.length), 30);

		// A plain loop rather than the `reduce` that was here, which counted by
		// assigning `noOfTagsFits` the first index that did NOT fit while the value
		// still read 0 — so a first tag wider than the whole trigger left the count
		// at 0 on that pass and then picked up index 1 on the next, reporting one
		// fitting tag in the one case where none do.
		let fittingTags = 0;
		for (const tag of selectedTags) {
			usedWidth += this.getTagWidth(tag.name);

			if (usedWidth >= containerWidth) {
				break;
			}
			fittingTags++;
		}

		this.selectedTagsOverflow = fittingTags < selectedTags.length;
		// At least one chip whenever anything is hidden. With none fitting, the
		// honest count is 0, but a trigger showing "+3" and no tag at all says less
		// than one truncated tag and "+2" does — and `.tag-label` already caps at
		// the trigger width and ellipsizes, so the one chip cannot overflow it.
		this.noOfTagsFits = this.selectedTagsOverflow ? Math.max(fittingTags, 1) : selectedTags.length;
	}

	/**
	 * Width of the trailing "+N" chip, measured with the classes it actually renders with.
	 *
	 * @param count the largest number the chip could have to show
	 */
	private getOverflowLabelWidth(count: number): number {
		const container = this.el.nativeElement;
		const testLabel = this.renderer.createElement('span');

		// Same element and same classes as the template's overflow chip, so the
		// padding, weight and caption font size it is drawn at are the ones being
		// measured rather than a guess at them.
		this.renderer.setProperty(testLabel, 'innerHTML', `+${count}`);
		['ng-value-label', 'tag-overflow'].forEach((labelClass) => {
			this.renderer.addClass(testLabel, labelClass);
		});

		// Appended to the host, not to the value container: an inline-block's width
		// is its content either way, and this keeps the probe out of the row being
		// measured. Same approach as `getTagWidth`.
		this.renderer.appendChild(container, testLabel);

		// The 10px `getTagWidth` also adds: the chips are spaced by a `margin-right`
		// on their `.ng-value` wrapper, which no single element's width reports.
		const labelWidth = testLabel.offsetWidth + 10;

		this.renderer.removeChild(container, testLabel);
		return labelWidth;
	}

	private getTagWidth(badgeText: string) {
		const container = this.el.nativeElement;
		const testBadge = this.renderer.createElement('nb-badge');

		// Set badge text
		this.renderer.setProperty(testBadge, 'innerHTML', badgeText);

		// Append test badge to the container (not in DOM)
		this.renderer.appendChild(container, testBadge);

		// Add multiple classes to badge
		const badgeClasses = ['tag-color', 'tag-label', 'status-basic', 'position-top', 'position-right'];
		badgeClasses.forEach((badgeClass) => {
			this.renderer.addClass(testBadge, badgeClass);
		});

		const badgeWidth = testBadge.offsetWidth + 10; // 10px is the padding

		// Remove test badge from container (not in DOM)
		this.renderer.removeChild(container, testBadge);
		return badgeWidth;
	}

	ngOnDestroy(): void {}
}
