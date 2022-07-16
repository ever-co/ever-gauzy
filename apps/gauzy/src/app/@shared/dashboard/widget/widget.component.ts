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
import { Collapsable } from '../interfaces/collapsable.interface';
import { Draggable } from '../interfaces/draggable.interface';
import { Expandable } from '../interfaces/expandable.interface';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-widget',
	templateUrl: './widget.component.html',
	styleUrls: ['./widget.component.scss']
})
export class WidgetComponent
	implements OnInit, Draggable, Expandable, Collapsable
{
	private _templateRef: TemplateRef<HTMLElement>;
	private _position: number;
	private _title: string;
	private _collapsed: boolean = false;
	private _move: boolean = false;
	public hide: boolean = false;
	@Input()
	public dragEnded: Observable<any>;
	@ViewChild(NbPopoverDirective) popover: NbPopoverDirective;

	constructor() {}

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
	set templateRef(value: TemplateRef<HTMLElement>) {
		this._templateRef = value;
	}
	get templateRef(): TemplateRef<HTMLElement> {
		return this._templateRef;
	}
	set title(value: string) {
		this._title = value;
	}
	get title(): string {
		return this._title;
	}
	get position(): number {
		return this._position;
	}
	set position(value: number) {
		this._position = value;
	}
	get isExpand(): boolean {
		return !this._collapsed;
	}
	set isExpand(value: boolean) {
		this._collapsed = !value;
	}
	get isCollapse(): boolean {
		return this._collapsed;
	}
	set isCollapse(value: boolean) {
		this._collapsed = value;
	}
	get move(): boolean {
		return this._move;
	}
	set move(value: boolean) {
		this._move = value;
	}
}
