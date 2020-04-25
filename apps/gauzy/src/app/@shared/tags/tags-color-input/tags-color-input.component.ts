import {
	Component,
	OnInit,
	ViewChild,
	Input,
	Output,
	EventEmitter
} from '@angular/core';
import { TagsService } from '../../../@core/services/tags.service';
import { NgModel, FormGroup } from '@angular/forms';

@Component({
	selector: 'ngx-tags-color-input',
	templateUrl: './tags-color-input.component.html',
	styleUrls: ['./tags-color-input.component.scss']
})
export class TagsColorInputComponent implements OnInit {
	@ViewChild('shownInput', { static: true })
	shownInput: NgModel;

	@Input('tags')
	tags: any;

	@Input('form')
	form: FormGroup;

	@Input('selectedTags')
	selectedTags: any;

	@Input('items')
	items: any;

	@Output()
	selectedTagsEvent: EventEmitter<any> = new EventEmitter<any>();

	constructor(private readonly tagsService: TagsService) {}

	async onChange() {
		const tags = [];

		for (const tag of this.selectedTags) {
			const tagToCheck = await this.tagsService.findByName(tag.name);
			if (!tagToCheck) {
				const tagNew = await this.tagsService.insertTag({
					name: tag.name,
					description: '',
					color: ''
				});
				if (tagNew.id) {
					tags.push(tagNew);
				}
			} else {
				tags.push(tagToCheck);
			}
		}

		this.selectedTagsEvent.emit(tags);
	}

	ngOnInit() {
		this.getAllTags();
	}

	selectedTagsHandler(ev) {
		this.form.get('selectedTags').setValue(ev);
	}

	async getAllTags() {
		const { items } = await this.tagsService.getAllTags();
		this.tags = items;
	}
}
