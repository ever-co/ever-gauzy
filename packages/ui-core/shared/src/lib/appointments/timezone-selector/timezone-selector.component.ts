import { Component, OnInit, Input } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import * as timezone from 'moment-timezone';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';

@Component({
    templateUrl: './timezone-selector.component.html',
    standalone: false
})
export class TimezoneSelectorComponent extends TranslationBaseComponent implements OnInit {
	listOfZones = timezone.tz.names().filter((zone) => zone.includes('/'));

	@Input() selectedTimezone: string;

	constructor(
		private readonly dialogRef: NbDialogRef<TimezoneSelectorComponent>,
		readonly translateService: TranslateService
	) {
		super(translateService);
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
