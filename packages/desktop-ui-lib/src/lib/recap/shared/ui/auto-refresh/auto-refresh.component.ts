import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { UntilDestroy } from '@ngneat/until-destroy';
import { Observable } from 'rxjs';
import { AutoRefreshService } from '../../../+state/auto-refresh/auto-refresh.service';
import { NbToggleModule, NbButtonModule, NbIconModule } from '@nebular/theme';
import { AsyncPipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ngx-auto-refresh',
    templateUrl: './auto-refresh.component.html',
    styleUrls: ['./auto-refresh.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [NbToggleModule, NbButtonModule, NbIconModule, AsyncPipe, TranslatePipe]
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
