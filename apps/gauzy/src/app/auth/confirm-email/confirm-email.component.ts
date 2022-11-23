import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter, tap } from 'rxjs/operators';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';

@UntilDestroy({ checkProperties: true })
@Component({
	templateUrl: './confirm-email.component.html'
})
export class ConfirmEmailComponent extends TranslationBaseComponent
	implements OnInit {

	loading: boolean = true;
	errorMessage: string;
	successMessage: string;

	constructor(
		private readonly route: ActivatedRoute,
		public readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.route.data
			.pipe(
				filter((data) => !!data && !!data.resolver),
				tap(({ resolver }) => this.verfiedEmail(resolver)),
				untilDestroyed(this),
			)
			.subscribe();
	}

	async verfiedEmail(response: HttpErrorResponse) {
		try {
			if ('status' in response && response.status === HttpStatusCode.BadRequest) {
				this.errorMessage = 'Sorry, this verification link is not valid.';
			} else if ('status' in response && response.status === HttpStatusCode.Ok) {
				this.successMessage = 'Congrats! Your email is now verified.'
			}
		} catch (error) {
			this.errorMessage = 'Sorry, this verification link is not valid.';
		} finally {
			this.loading = false;
		}
	}
}
