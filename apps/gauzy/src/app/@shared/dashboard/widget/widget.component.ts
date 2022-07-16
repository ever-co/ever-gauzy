import {
	Component,
	Input,
	OnInit,
	TemplateRef,
	ViewChild
} from '@angular/core';
import { NbPopoverDirective } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Observable } from 'rxjs/internal/Observable';
import { filter, tap } from 'rxjs/operators';
import { GuiDrag } from '../interfaces/gui-drag.abstract';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-widget',
	templateUrl: './widget.component.html',
	styleUrls: ['./widget.component.scss']
})
export class WidgetComponent extends GuiDrag implements OnInit {
	@Input()
	public dragEnded: Observable<any>;
	@ViewChild(NbPopoverDirective) popover: NbPopoverDirective;

	constructor() {
		super();
	}

	ngOnInit(): void {
		this.dragEnded
			.pipe(
				filter((event) => !!event),
				tap(() => (this.move = false)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	public onClickSetting(event: boolean) {
		if (event) this.popover.hide();
	}

	@Input()
	public set templateRef(value: TemplateRef<HTMLElement>) {
		this._templateRef = value;
	}

	public get templateRef(): TemplateRef<HTMLElement> {
		return this._templateRef;
	}
}
