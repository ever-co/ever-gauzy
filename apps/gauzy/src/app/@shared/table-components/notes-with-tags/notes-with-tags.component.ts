import { Component, Input, OnInit } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';
import { ComponentLayoutStyleEnum } from '@gauzy/contracts';
import { Color } from '@kurkle/color';
import { NbThemeService } from '@nebular/theme';
import { BehaviorSubject, Observable } from 'rxjs';
import { Rgba } from 'ngx-color-picker';
import { TranslationBaseComponent } from '../../language-base';
import { TranslateService } from '@ngx-translate/core';

@Component({
	selector: 'ga-notes-with-tags',
	templateUrl: './notes-with-tags.component.html',
	styleUrls: ['./notes-with-tags.component.scss']
})
export class NotesWithTagsComponent
	extends TranslationBaseComponent
	implements ViewCell, OnInit
{
	@Input()
	rowData: any;

	@Input()
	value: string | number;

	@Input()
	layout?: ComponentLayoutStyleEnum | undefined;

	private textColor!: string;
	data$: BehaviorSubject<any> = new BehaviorSubject<any>(null);
	data: Observable<any> = new Observable<any>(null);

	constructor(
		protected themeService: NbThemeService,
		translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.themeService.getJsTheme().subscribe((theme) => {
			this.textColor = theme.variables.fgText.toString();
			this.data$.next(this.rowData);
			this.data = this.data$.asObservable();
		});
	}

	backgroundContrast(bgColor: string) {
		let color = new Color(bgColor);
		color = color.valid ? color : new Color(new Rgba(255, 255, 255, 0.5));
		const MIN_THRESHOLD = 128;
		const MAX_THRESHOLD = 186;
		const contrast = color.rgb
			? color.rgb.r * 0.299 + color.rgb.g * 0.587 + color.rgb.b * 0.114
			: null;
		if (contrast < MIN_THRESHOLD) {
			return '#ffffff';
		} else if (contrast > MAX_THRESHOLD) {
			return '#000000';
		} else {
			return this.textColor;
		}
	}
}
