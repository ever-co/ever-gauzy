import {
	Component,
	OnInit,
	Input,
	Output,
	EventEmitter,
	OnDestroy
} from '@angular/core';
import { TagsService } from '../../../@core/services/tags.service';
import { ITag, IOrganization } from '@gauzy/models';
import { getContrastColor } from 'libs/utils';
import { Store } from '../../../@core/services/store.service';
import { Subscription } from 'rxjs';

@Component({
	selector: 'ga-tags-color-input',
	templateUrl: './tags-color-input.component.html',
	styleUrls: ['./tags-color-input.component.scss']
})
export class TagsColorInputComponent implements OnInit, OnDestroy {
	tags: ITag[];
	loading = false;
	private selectedOrganization: IOrganization;
	private subscribeTakingSelectedOrganziation: Subscription;

	@Input('isOrgLevel')
	isOrgLevel: boolean = false;

	@Input('isTenantLevel')
	isTenantLevel: boolean = false;

	@Input('selectedTags')
	selectedTags: ITag[];

	selectedTagIds: string[];

	@Output()
	selectedTagsEvent = new EventEmitter<ITag[]>();

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
		this.subscribeTakingSelectedOrganziation = this.store.selectedOrganization$.subscribe(
			(org) => {
				this.selectedOrganization = org;
				this.getAllTags();
			}
		);

		this.selectedTagIds = this.selectedTags?.map((tag: ITag) => tag.id);
	}

	async getAllTags() {
		if (this.selectedOrganization) {
			if (this.isOrgLevel) {
				const tagsByOrgLevel = await this.tagsService.getAllTagsByOrgLevel(
					this.selectedOrganization.id,
					this.selectedOrganization.tenantId,
					['organization']
				);
				this.tags = tagsByOrgLevel;
			}
			if (this.isTenantLevel) {
				const tagsByTenantLevel = await this.tagsService.getAllTagsByTenantLevel(
					this.selectedOrganization.tenantId,
					['tenant']
				);
				this.tags = tagsByTenantLevel;
			}
		}
	}

	backgroundContrast(bgColor: string) {
		return getContrastColor(bgColor);
	}
	ngOnDestroy() {
		this.subscribeTakingSelectedOrganziation.unsubscribe();
	}
}
