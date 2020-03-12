import {
	Component,
	OnInit,
	ViewChild,
	Input,
	Output,
	EventEmitter
} from '@angular/core';
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
	tags: any;

	@Input()
	items: any;

	@Input()
	multiple: string;

	@Input()
	ngModelOptions: any;

	@Input('ngModel')
	model: any;

	@Output()
	selectedTags: EventEmitter<any> = new EventEmitter<any>();
	debbuger;
	constructor(private readonly tagsService: TagsService) {}

	ngOnInit() {
		this.getAllTags();
	}
	async getAllTags() {
		const { items } = await this.tagsService.getAllTags();
		this.tags = items;
	}
}
