import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { TagsService } from '../../../@core/services/tags.service';
import { Tag } from '@gauzy/models';

@Component({
	selector: 'ga-tags-color-input',
	templateUrl: './tags-color-input.component.html',
	styleUrls: ['./tags-color-input.component.scss']
})
export class TagsColorInputComponent implements OnInit {
	tags: Tag[];

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

	async ngOnInit() {
		await this.getAllTags();
		this.selectedTagIds = this.selectedTags.map((tag: Tag) => tag.id);
	}

	async getAllTags() {
		const { items } = await this.tagsService.getAllTags();
		this.tags = items;
	}
}
