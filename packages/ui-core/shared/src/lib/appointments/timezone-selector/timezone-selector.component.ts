import { Component, OnInit, Input } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import timezone from 'moment-timezone';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';

@Component({
	templateUrl: './timezone-selector.component.html',
	styleUrls: ['./timezone-selector.component.scss'],
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

	/** Last segment of the zone name, e.g. `Argentina/Buenos_Aires` → `Buenos Aires`. */
	getCity(zone: string): string {
		return zone.split('/').pop().replace(/_/g, ' ');
	}

	/** Everything before the city, e.g. `America/Argentina`. */
	getRegion(zone: string): string {
		return zone.split('/').slice(0, -1).join(' / ').replace(/_/g, ' ');
	}

	/** Matches the typed text against the readable name (spaces, not underscores) and the offset. */
	searchZone = (term: string, zone: string): boolean => {
		const query = term.trim().toLowerCase();
		return (zone.replace(/_/g, ' ') + ' ' + this.getOffset(zone)).toLowerCase().includes(query);
	};

	/** UTC offset, e.g. `UTC+08:00`. */
	getOffset(zone: string): string {
		return 'UTC' + timezone.tz(zone).format('Z');
	}

	select() {
		this.dialogRef.close(this.selectedTimezone);
	}
}
