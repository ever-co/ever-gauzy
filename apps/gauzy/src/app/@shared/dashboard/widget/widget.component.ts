import {
	AfterViewInit,
	Component,
	ElementRef,
	Input,
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
export class WidgetComponent extends GuiDrag implements OnInit, AfterViewInit {
	@Input()
	public widgetDragEnded: Observable<any>;
	@ViewChild(NbPopoverDirective) widgetPopover: NbPopoverDirective;
	@ViewChild('widget') element: ElementRef;

	constructor(private readonly widgetService: WidgetService) {
		super();
	}

	ngAfterViewInit(): void {
		if (this.element) {
			const wgt: HTMLElement = this.element.nativeElement;
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
		this.widgetService.widgets.forEach((widget: GuiDrag) => {
			if (widget.templateRef === this.templateRef) {
				this.isCollapse = widget.isCollapse;
				this.isExpand = widget.isExpand;
			}
		});
	}

	public onClickSetting(event: boolean) {
		if (event) {
			this.widgetPopover.hide();
			this.widgetService.serialize(this.widgetService.widgets);
		}
	}
}
