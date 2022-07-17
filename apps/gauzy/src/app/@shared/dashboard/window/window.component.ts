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
	selector: 'ga-window',
	templateUrl: './window.component.html',
	styleUrls: ['./window.component.scss']
})
export class WindowComponent extends GuiDrag implements OnInit {
	@Input()
	public windowDragEnded: Observable<any>;
	@ViewChild(NbPopoverDirective) windowPopover: NbPopoverDirective;

	constructor() {
		super();
	}

	ngOnInit(): void {
		this.windowDragEnded
			.pipe(
				filter((event) => !!event),
				tap(() => (this.move = false)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	public onClickSetting(event: boolean) {
		if (event) this.windowPopover.hide();
	}

	@Input()
	public set templateRef(value: TemplateRef<HTMLElement>) {
		this._templateRef = value;
	}

	public get templateRef(): TemplateRef<HTMLElement> {
		return this._templateRef;
	}
}
