import {
	Component,
	Input,
	OnInit,
	Output,
	EventEmitter,
	TemplateRef
} from '@angular/core';
import { NbDialogService } from '@nebular/theme';
import { IUser } from '@gauzy/contracts';

@Component({
	selector: 'gauzy-user-menu',
	templateUrl: './user-menu.component.html',
	styleUrls: ['./user-menu.component.scss']
})
export class UserMenuComponent implements OnInit {
	@Input() user: IUser;
	@Output() close: EventEmitter<any> = new EventEmitter<any>(null);

	clicks: boolean[] = [];

	downloadApps = [
		{
			link: 'https://web.gauzy.co/downloads#desktop/apple',
			icon: 'fab fa-apple'
		},
		{
			link: 'https://web.gauzy.co/downloads#desktop/windows',
			icon: 'fa-brands fa-windows'
		},
		{
			link: 'https://web.gauzy.co/downloads#desktop/linux',
			icon: 'fa-brands fa-linux'
		},
		{
			link: 'https://web.gauzy.co/downloads#mobile',
			icon: 'fas fa-mobile'
		},
		{
			link: 'https://web.gauzy.co/downloads#extensions',
			icon: 'fa-brands fa-chrome'
		}
	];

	constructor(private dialogService: NbDialogService) {}

	ngOnInit(): void {}

	onClick() {
		this.close.emit();
	}

	onClickOutside(event: boolean) {
		this.clicks.push(event);
		if (!event && this.clicks.length > 1) this.onClick();
	}

	open(dialog: TemplateRef<any>) {
		this.dialogService.open(dialog);
	}
}
