import { ChangeDetectionStrategy, Component } from '@angular/core';
import { UntilDestroy } from '@ngneat/until-destroy';
import { Observable } from 'rxjs';
import { RecapQuery } from '../../+state/recap.query';
import { LanguageElectronService } from '../../../language/language-electron.service';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'gauzy-recap',
	templateUrl: './recap.component.html',
	styleUrls: ['./recap.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class RecapComponent {
	constructor(private readonly recapQuery: RecapQuery, private languageElectronService: LanguageElectronService) {
		this.languageElectronService.initialize<void>();
	}

	public get isLoading$(): Observable<boolean> {
		return this.recapQuery.isLoading$;
	}
}
