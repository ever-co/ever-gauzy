import { Component, OnInit, Input } from '@angular/core';

@Component({
	selector: 'ngx-avatar',
	templateUrl: './avatar.component.html',
	styleUrls: ['./avatar.component.scss']
})
export class AvatarComponent implements OnInit {
	@Input() size: 'lg' | 'sm' | 'md' = 'md';
	@Input() src: string;
	@Input() name: string;
	@Input() caption: string;
	constructor() {}

	ngOnInit() {}
}
