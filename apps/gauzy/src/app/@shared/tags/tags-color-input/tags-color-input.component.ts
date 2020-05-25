import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { TagsService } from '../../../@core/services/tags.service';
import { Tag } from '@gauzy/models';
import { getContrastColor } from 'libs/utils';

@Component({
	selector: 'ga-tags-color-input',
	templateUrl: './tags-color-input.component.html',
	styleUrls: ['./tags-color-input.component.scss'],
})
export class TagsColorInputComponent implements OnInit {
	tags: Tag[];
	loading = false;

	@Input('selectedTags')
	selectedTags: Tag[];

	selectedTagIds: string[];

	@Output()
	selectedTagsEvent = new EventEmitter<Tag[]>();

	constructor(private readonly tagsService: TagsService) {}

	async onChange(currentSelection: string[]) {
		const selectedTags = this.tags.filter((tag) =>
			currentSelection.includes(tag.id)
		);
		this.selectedTagsEvent.emit(selectedTags);
	}

	addTag = async (tagName: string) => {
		const newTag: Tag = {
			name: tagName,
			color: '#' + Math.floor(Math.random() * 16777215).toString(16),
			description: '',
		};
		this.loading = true;
		const tag = await this.tagsService.insertTag(newTag);
		this.loading = false;
		return tag;
	};

	async ngOnInit() {
		await this.getAllTags();
		this.selectedTagIds = this.selectedTags.map((tag: Tag) => tag.id);
	}

	async getAllTags() {
		const { items } = await this.tagsService.getAllTags();
		this.tags = items;
	}

	backgroundContrast(bgColor: string) {
		return getContrastColor(bgColor);
	}
}
