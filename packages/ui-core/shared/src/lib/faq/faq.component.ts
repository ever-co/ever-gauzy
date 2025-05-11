import { Component, OnDestroy, OnInit } from '@angular/core';
import { UntilDestroy } from '@ngneat/until-destroy';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import { Observable } from 'rxjs/internal/Observable';
import { faqs } from './faq-setting';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ngx-faq',
    templateUrl: './faq.component.html',
    styleUrls: ['./faq.component.scss'],
    standalone: false
})
export class NgxFaqComponent implements OnInit, OnDestroy {
	private _faqs$: BehaviorSubject<any> = new BehaviorSubject([]);
	public faqs$: Observable<any> = this._faqs$.asObservable();

	ngOnInit(): void {
		this._faqs$.next(faqs);
	}

	ngOnDestroy(): void {}
}
