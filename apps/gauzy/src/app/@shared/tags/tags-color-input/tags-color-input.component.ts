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

	onChange() {
		this.selectedTagsEvent.emit(this.selectedTags);
	}

	ngOnInit() {
		this.getAllTags();
	}

	async getAllTags() {
		const { items } = await this.tagsService.getAllTags();
		this.tags = items;
	}
}
