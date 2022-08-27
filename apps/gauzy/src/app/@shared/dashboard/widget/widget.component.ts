import {
	AfterViewInit,
	Component,
	ElementRef,
	Input,
	OnDestroy,
	OnInit,
	ViewChild
} from '@angular/core';
import { NbPopoverDirective } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Observable } from 'rxjs/internal/Observable';
import { filter, tap } from 'rxjs/operators';
import { GuiDrag } from '../interfaces/gui-drag.abstract';
import { WidgetService } from './widget.service';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-widget',
	templateUrl: './widget.component.html',
	styleUrls: ['./widget.component.scss']
})
export class WidgetComponent
	extends GuiDrag
	implements OnInit, AfterViewInit, OnDestroy
{
	private _widgetDragEnded: Observable<any>;
	@ViewChild(NbPopoverDirective)
	private _widgetPopover: NbPopoverDirective;
	@ViewChild('widget')
	private _element: ElementRef;

	constructor(private readonly widgetService: WidgetService) {
		super();
	}

	ngAfterViewInit(): void {
		if (this._element) {
			const wgt: HTMLElement = this._element.nativeElement;
			const title: any = wgt.querySelector('div.title');
			if (title) this.title = title.innerText;
		}
	}

	ngOnInit(): void {
		this.widgetDragEnded
			.pipe(
				filter((event) => !!event),
				tap(() => (this.move = false)),
				untilDestroyed(this)
			)
			.subscribe();
		this.widgetService.updateWidget(this);
	}

	public onClickSetting(event: boolean) {
		if (event) {
			this._widgetPopover.hide();
			this.widgetService.save();
		}
	}

	public get widgetDragEnded(): Observable<any> {
		return this._widgetDragEnded;
	}

	@Input()
	public set widgetDragEnded(value: Observable<any>) {
		this._widgetDragEnded = value;
	}

	get width() {
		return this._interpolatedWidth();
	}

	_interpolatedWidth() {
		const x = window.innerWidth;
		return (
			-(632775071777 * Math.pow(x, 7)) / 20318280534352252108800000 +
			(788088302470037 * Math.pow(x, 6)) / 2344416984732952166400000 -
			(1476606751322603929 * Math.pow(x, 5)) / 952419400047761817600000 +
			(1714678639112229899 * Math.pow(x, 4)) / 432917909112619008000 -
			(40947774919891075787 * Math.pow(x, 3)) / 6764342329884672000 +
			(2186123836522015321 * Math.pow(x, 2)) / 394945677434880 -
			(905533633805933134967 * x) / 322950371652480 +
			6006166452812179367 / 9894312857
		);
	}

	ngOnDestroy(): void {}
}
