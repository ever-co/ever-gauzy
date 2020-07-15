import { Component, OnInit } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import * as timezone from 'moment-timezone';

@Component({
	templateUrl: './timezone-selector.component.html'
})
export class TimezoneSelectorComponent extends TranslationBaseComponent
	implements OnInit {
	listOfZones = timezone.tz.names().filter((zone) => zone.includes('/'));
	selectedTimezone;
	constructor(
		public dialogRef: NbDialogRef<TimezoneSelectorComponent>,
		private translate: TranslateService
	) {
		super(translate);
	}

	ngOnInit() {}

	close() {
		this.dialogRef.close();
	}

	getTimeWithOffset(zone: string) {
		let cutZone = zone;
		if (zone.includes('/')) {
			cutZone = zone.split('/')[1];
		}

		const offset = timezone.tz(zone).format('zZ');

		return '(' + offset + ') ' + cutZone;
	}

	select() {
		this.dialogRef.close(this.selectedTimezone);
	}
}
