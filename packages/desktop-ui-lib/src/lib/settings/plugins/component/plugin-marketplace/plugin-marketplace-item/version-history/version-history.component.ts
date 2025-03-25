import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IPluginVersion } from '@gauzy/contracts';
import { BehaviorSubject, catchError, EMPTY, finalize, Observable, switchMap } from 'rxjs';
import { PluginService } from '../../../../services/plugin.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store, ToastrNotificationService } from '../../../../../../services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'lib-version-history',
	templateUrl: './version-history.component.html',
	styleUrl: './version-history.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class VersionHistoryComponent implements OnInit {
	public versions$!: Observable<IPluginVersion[]>;
	public pluginId: string;
	public isLoading$ = new BehaviorSubject<boolean>(false);

	constructor(
		private readonly toastrService: ToastrNotificationService,
		private readonly pluginService: PluginService,
		private readonly route: ActivatedRoute,
		private readonly router: Router,
		private readonly store: Store
	) {}

	ngOnInit(): void {
		this.isLoading$.next(true);
		this.versions$ = this.route.params.pipe(
			switchMap((params) => {
				this.pluginId = params['id'];
				if (!this.pluginId) {
					this.isLoading$.next(false);
					return EMPTY;
				}
				return this.pluginService
					.getVersions(this.pluginId, {
						relations: ['plugin'],
						order: { createdAt: 'DESC' }
					})
					.pipe(
						finalize(() => this.isLoading$.next(false)),
						catchError((error) => {
							this.toastrService.error('Error fetching plugin versions');
							return EMPTY;
						})
					);
			}),
			untilDestroyed(this)
		);
	}

	public navigateBack(): void {
		this.router.navigate(['settings', 'marketplace-plugins', this.pluginId]);
	}

	public edit(): void {
		//TODO: Implements edit feature
	}

	public remove(): void {
		//TODO: Implements remove feature
	}

	public isOwner(version: IPluginVersion): boolean {
		return !!this.store.user && this.store.user.employee?.id === version?.plugin?.uploadedById;
	}
}
