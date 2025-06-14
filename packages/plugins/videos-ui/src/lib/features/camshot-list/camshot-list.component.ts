import { ChangeDetectionStrategy, Component } from '@angular/core';
import { combineLatest, map, Observable } from 'rxjs';
import { CamshotQuery } from 'src/lib/+state/camshot/camshot.query';
import { ICamshot } from 'src/lib/shared/models/camshot.model';

@Component({
	selector: 'plug-camshot-list',
	templateUrl: './camshot-list.component.html',
	styleUrl: './camshot-list.component.scss',
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class CamshotListComponent {
	constructor(private readonly camshotQuery: CamshotQuery) {}

	public get camshots$(): Observable<ICamshot[]> {
		return this.camshotQuery.camshots$;
	}

	public get isAvailable$(): Observable<boolean> {
		return combineLatest([this.camshotQuery.isAvailable$, this.isLoading$]).pipe(
			map(([isAvailable, isLoading]) => isAvailable && !isLoading)
		);
	}

	public get isLoading$(): Observable<boolean> {
		return this.camshotQuery.isLoading$;
	}
}
