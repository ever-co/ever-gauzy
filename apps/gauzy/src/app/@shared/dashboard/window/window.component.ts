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
import { WindowService } from './window.service';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-window',
	templateUrl: './window.component.html',
	styleUrls: ['./window.component.scss']
})
export class WindowComponent extends GuiDrag implements OnInit, AfterViewInit {
	@Input()
	public windowDragEnded: Observable<any>;
	@ViewChild(NbPopoverDirective) windowPopover: NbPopoverDirective;
	@ViewChild('window') element: ElementRef;

	constructor(private readonly windowService: WindowService) {
		super();
	}
	ngAfterViewInit(): void {
		if (this.element) {
			const win: HTMLElement = this.element.nativeElement;
			const title: any = win.querySelector('nb-card-header');
			if (title) this.title = title.innerText;
		}
	}

	ngOnInit(): void {
		this.windowDragEnded
			.pipe(
				filter((event) => !!event),
				tap(() => (this.move = false)),
				untilDestroyed(this)
			)
			.subscribe();
		this.windowService.windows.forEach((window: GuiDrag) => {
			if (window.templateRef === this.templateRef) {
				this.isCollapse = window.isCollapse;
				this.isExpand = window.isExpand;
			}
		});
	}

	public onClickSetting(event: boolean) {
		if (event) {
			this.windowPopover.hide();
			this.windowService.serialize();
		}
	}
}
