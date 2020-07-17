import {
	Component,
	OnDestroy,
	OnInit,
	Input,
	TemplateRef
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { TranslationBaseComponent } from '../language-base/translation-base.component';
import './card-grid-invoice.component.scss';
import { ActivatedRoute } from '@angular/router';

@Component({
	selector: 'ga-card-grid-invoice',
	templateUrl: './card-grid-invoice.component.html',
	styleUrls: ['./card-grid-invoice.component.scss']
})
export class CardGridInvoiceComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	@Input() source: any;
	@Input() settings: any = {};
	@Input() buttonTemplate: TemplateRef<any>;

	private _ngDestroy$ = new Subject<void>();

	constructor(
		readonly translationService: TranslateService,
		readonly route: ActivatedRoute
	) {
		super(translationService);
	}

	ngOnInit(): void {}

	getKeys() {
		return Object.keys(this.settings.columns);
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
