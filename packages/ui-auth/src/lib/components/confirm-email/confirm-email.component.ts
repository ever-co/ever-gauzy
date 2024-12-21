import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter, tap } from 'rxjs/operators';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ngx-confirm-email',
    templateUrl: './confirm-email.component.html',
    standalone: false
})
export class ConfirmEmailComponent extends TranslationBaseComponent implements OnInit {
	public loading: boolean = true;
	public errorMessage: string;
	public successMessage: string;

	constructor(private readonly route: ActivatedRoute, translateService: TranslateService) {
		super(translateService);
	}

	ngOnInit() {
		this.route.data
			.pipe(
				filter((data) => !!data && !!data.resolver),
				tap(({ resolver }) => this.verifiedEmail(resolver)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Verify the email.
	 *
	 * @param response - The response from the API.
	 */
	async verifiedEmail(response: HttpErrorResponse) {
		try {
			if ('status' in response && response.status === HttpStatusCode.BadRequest) {
				this.errorMessage = this.getTranslation('TOASTR.MESSAGE.EMAIL_VERIFICATION_NOT_VALID');
			} else if ('status' in response && response.status === HttpStatusCode.Ok) {
				this.successMessage = this.getTranslation('TOASTR.MESSAGE.EMAIL_VERIFICATION_VALID');
			}
		} catch (error) {
			this.errorMessage = this.getTranslation('TOASTR.MESSAGE.EMAIL_VERIFICATION_NOT_VALID');
		} finally {
			this.loading = false;
		}
	}
}
