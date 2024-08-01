import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { UntilDestroy } from '@ngneat/until-destroy';
import { Observable } from 'rxjs';
import { AutoRefreshService } from '../../../+state/auto-refresh/auto-refresh.service';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-auto-refesh',
	templateUrl: './auto-refesh.component.html',
	styleUrls: ['./auto-refesh.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class AutoRefeshComponent {
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
