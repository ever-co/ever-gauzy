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
import { ITag, IOrganization, PermissionsEnum, ITagCreateInput } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { firstValueFrom } from 'rxjs';
import { filter, map, tap } from 'rxjs/operators';
import { Observable } from 'rxjs/internal/Observable';
import { Subject } from 'rxjs/internal/Subject';
import { NbThemeService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import * as randomColor from 'randomcolor';
import { Store, distinctUntilChange } from '@gauzy/ui-sdk/common';
import { TagsService } from '../../../@core/services';
import { PictureNameTagsComponent } from '../../table-components';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-tags-color-input',
	templateUrl: './tags-color-input.component.html',
	styleUrls: ['./tags-color-input.component.scss']
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
		this.noOfTagsFits = 0;

		const totalTagWidth = selectedTags.reduce((acc, tag, currentIndex) => {
			const totalWidth = this.getTagWidth(tag.name) + acc;

			if (totalWidth >= containerWidth && this.noOfTagsFits === 0) this.noOfTagsFits = currentIndex;

			return totalWidth;
		}, 30); // 30px is the additional buffer

		this.selectedTagsOverflow = totalTagWidth >= containerWidth;
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
