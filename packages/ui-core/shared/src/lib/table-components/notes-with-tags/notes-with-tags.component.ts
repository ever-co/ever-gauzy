import { Component, Input, OnInit } from '@angular/core';
import { ComponentLayoutStyleEnum } from '@gauzy/contracts';
import { Color } from '@kurkle/color';
import { NbThemeService } from '@nebular/theme';
import { BehaviorSubject, Observable } from 'rxjs';
import { Rgba } from 'ngx-color-picker';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';

@Component({
	selector: 'ga-notes-with-tags',
	templateUrl: './notes-with-tags.component.html',
	styleUrls: ['./notes-with-tags.component.scss']
})
export class NotesWithTagsComponent extends TranslationBaseComponent implements OnInit {
	@Input() rowData: any;
	@Input() value: any;
	@Input() layout?: ComponentLayoutStyleEnum | undefined;

	private textColor!: string;
	data$: BehaviorSubject<any> = new BehaviorSubject<any>(null);
	data: Observable<any> = new Observable<any>(null);

	constructor(
		protected readonly themeService: NbThemeService,
		protected readonly translateService: TranslateService
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

	/**
	 *
	 * @param bgColor
	 * @returns
	 */
	background(bgColor: string) {
		let color = new Color(bgColor);
		return color.valid ? bgColor : this._test(bgColor);
	}

	/**
	 * Calculates the appropriate text color based on the contrast with the background color.
	 *
	 * @param {string} bgColor - The background color in hex or RGB format.
	 * @returns {string} - The recommended text color ('#ffffff' for dark backgrounds, '#000000' for light backgrounds, or a default color).
	 */
	backgroundContrast(bgColor: string, minThreshold: number = 128, maxThreshold: number = 186): string {
		let color = new Color(bgColor);
		color = color.valid ? color : new Color(this.hex2rgb(bgColor));
		const contrast = color.rgb ? color.rgb.r * 0.299 + color.rgb.g * 0.587 + color.rgb.b * 0.114 : null;
		if (contrast < minThreshold) {
			return '#ffffff';
		} else if (contrast > maxThreshold) {
			return '#000000';
		} else {
			return this.textColor;
		}
	}

	/**
	 *
	 * @param hex
	 * @returns
	 */
	public hex2rgb(hex: string) {
		hex = this._test(hex);
		const r = parseInt(hex.slice(1, 3), 16);
		const g = parseInt(hex.slice(3, 5), 16);
		const b = parseInt(hex.slice(5, 7), 16);
		return new Rgba(r, g, b, 1);
	}

	/**
	 *
	 * @param hex
	 * @returns
	 */
	private _test(hex: string): string {
		const regex = /^#[0-9A-F]{6}$/i;
		if (regex.test(hex)) {
			return hex;
		} else {
			hex = '#' + hex;
			return regex.test(hex) ? hex : '#000000';
		}
	}
}
