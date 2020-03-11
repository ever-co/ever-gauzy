import { Component, OnInit, ViewChild, Input, Output } from '@angular/core';
import { Tag } from '@gauzy/models';
import { TagsService } from '../../../@core/services/tags.service';
import { NgModel } from '@angular/forms';

@Component({
	selector: 'ngx-tags-color-input',
	templateUrl: './tags-color-input.component.html',
	styleUrls: ['./tags-color-input.component.scss']
})
export class TagsColorInputComponent implements OnInit {
	@ViewChild('shownInput', { static: true })
	shownInput: NgModel;

	@Input()
	tags: Tag[];

	@Input()
	items: string;

	@Input()
	multiple: string;

	@Output()
	selectedTags: Tag[];

	constructor(private readonly tagsService: TagsService) {}

	ngOnInit() {
		this.getAllTags();
	}
	async getAllTags() {
		const { items } = await this.tagsService.getAllTags();
		this.tags = items;
		console.warn(this.tags);
	}
}
