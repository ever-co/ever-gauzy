import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { UntilDestroy } from '@ngneat/until-destroy';
import { Observable } from 'rxjs';
import { AutoRefreshService } from '../../../+state/auto-refresh/auto-refresh.service';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-auto-refresh',
	templateUrl: './auto-refresh.component.html',
	styleUrls: ['./auto-refresh.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class AutoRefreshComponent {
	private service = inject(AutoRefreshService);

	public get autoRefresh$(): Observable<boolean> {
		return this.service.enabled$;
	}

	public setAutoRefresh(enabled: boolean) {
		this.service.enabled = enabled;
	}

	public refresh(): void {
		this.service.refresh();
	}
}
