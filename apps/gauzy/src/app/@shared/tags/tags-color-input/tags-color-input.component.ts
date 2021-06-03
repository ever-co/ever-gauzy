import {
	Component,
	OnInit,
	Input,
	Output,
	EventEmitter,
	OnDestroy
} from '@angular/core';
import { TagsService } from '../../../@core/services/tags.service';
import { ITag, IOrganization } from '@gauzy/contracts';
import { getContrastColor } from '@gauzy/common-angular';
import { Store } from '../../../@core/services/store.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter, tap } from 'rxjs/operators';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-tags-color-input',
	templateUrl: './tags-color-input.component.html',
	styleUrls: ['./tags-color-input.component.scss']
})
export class TagsColorInputComponent implements OnInit, OnDestroy {
	tags: ITag[];
	loading = false;
	private selectedOrganization: IOrganization;

	@Input('isOrgLevel')
	isOrgLevel: boolean = false;

	@Input('isTenantLevel')
	isTenantLevel: boolean = false;

	@Input('selectedTags')
	selectedTags: ITag[];

	selectedTagIds: string[];

	@Output()
	selectedTagsEvent = new EventEmitter<ITag[]>();

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

	constructor(
		private readonly tagsService: TagsService,
		private store: Store
	) {}

	async onChange(currentSelection: string[]) {
		const selectedTags = this.tags.filter((tag) =>
			currentSelection.includes(tag.id)
		);
		this.selectedTagsEvent.emit(selectedTags);
	}

	addTag = async (tagName: string) => {
		this.loading = true;
		const newTag: ITag = {
			name: tagName,
			color: '#' + Math.floor(Math.random() * 16777215).toString(16),
			description: '',
			organization: this.selectedOrganization,
			tenantId: this.selectedOrganization.tenantId
		};
		const tag = await this.tagsService.insertTag(newTag);
		this.loading = false;
		return tag;
	};

	ngOnInit() {
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization) => this.selectedOrganization = organization),
				tap(() => this.getAllTags()),
				untilDestroyed(this)
			)
			.subscribe();
		this.selectedTagIds = this.selectedTags?.map((tag: ITag) => tag.id);
	}

	async getAllTags() {
		if (this.selectedOrganization) {
			const { tenantId } = this.store.user;
			const { id: organizationId } = this.selectedOrganization;

			if (this.isOrgLevel) {
				const tagsByOrgLevel = await this.tagsService.getAllTagsByOrgLevel(
					{ organizationId, tenantId },
					['organization']
				);
				this.tags = tagsByOrgLevel;
			}
			if (this.isTenantLevel) {
				const tagsByTenantLevel = await this.tagsService.getAllTagsByTenantLevel(
					{ tenantId },
					['tenant']
				);
				this.tags = tagsByTenantLevel;
			}
		}
	}

	backgroundContrast(bgColor: string) {
		return getContrastColor(bgColor);
	}

	ngOnDestroy() {}
}
