import { Component, Input, OnInit } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';
import { ComponentLayoutStyleEnum } from '@gauzy/contracts';
import { Color } from '@kurkle/color';
import { NbThemeService } from '@nebular/theme';
import { BehaviorSubject, Observable } from 'rxjs';

@Component({
	selector: 'ga-notes-with-tags',
	templateUrl: './notes-with-tags.component.html',
	styleUrls: ['./notes-with-tags.component.scss']
})
export class NotesWithTagsComponent implements ViewCell, OnInit {
	@Input()
	rowData: any;

	@Input()
	value: string | number;

	@Input()
	layout?: ComponentLayoutStyleEnum | undefined;

	private textColor!: string;
  data$: BehaviorSubject<any> = new BehaviorSubject<any>(null);
  data: Observable<any> = new Observable<any>(null);

	constructor(private themeService: NbThemeService) {}

	ngOnInit(): void {
		this.themeService.getJsTheme().subscribe((theme) => {
			this.textColor = theme.variables.fgText.toString();
      this.data$.next(this.rowData);
      this.data = this.data$.asObservable();
		});
	}

	backgroundContrast(bgColor: string) {
		const color = new Color(bgColor);
    const MIN_THRESHOLD = 150;
    const MAX_THRESHOLD = 186;
		const contrast = color.rgb
			? color.rgb.r * 0.299 + color.rgb.g * 0.587 + color.rgb.b * 0.114
			: null;
		if (contrast && contrast < MIN_THRESHOLD) {
			return '#ffffff';
		} else if (contrast && contrast > MAX_THRESHOLD) {
			return '#000000';
		} else {
      return this.textColor;
    }
	}
}
