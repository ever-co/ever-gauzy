import { AfterViewInit, Component, ElementRef, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { NbPopoverDirective } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Observable } from 'rxjs/internal/Observable';
import { filter, tap } from 'rxjs/operators';
import { GuiDrag } from '@gauzy/ui-sdk/shared';
import { WidgetService } from './widget.service';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-widget',
	templateUrl: './widget.component.html',
	styleUrls: ['./widget.component.scss']
})
export class WidgetComponent extends GuiDrag implements OnInit, AfterViewInit, OnDestroy {
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
			-(79730266276099 * Math.pow(x, 7)) / 2560103347328383765708800000 +
			(4728564053374099 * Math.pow(x, 6)) / 14066501908397712998400000 -
			(369154233196212757 * Math.pow(x, 5)) / 238104850011940454400000 +
			(51440697463141483721 * Math.pow(x, 4)) / 12987537273378570240000 -
			(491376385800833711797 * Math.pow(x, 3)) / 81172107958616064000 +
			(16396027307988847931 * Math.pow(x, 2)) / 2962092580761600 -
			(19016315799060904323959 * x) / 6781957804702080 +
			6006199631979423447 / 9894312857
		);
	}

	public hideWidget() {
		this.widgetService.hideWidget(this.position);
		this.widgetService.save();
	}

	ngOnDestroy(): void {}
}
