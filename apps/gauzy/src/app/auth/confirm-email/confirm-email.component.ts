import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter, tap } from 'rxjs/operators';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/shared';

@UntilDestroy({ checkProperties: true })
@Component({
	templateUrl: './confirm-email.component.html'
})
export class ConfirmEmailComponent extends TranslationBaseComponent implements OnInit {
	loading: boolean = true;
	errorMessage: string;
	successMessage: string;

	constructor(private readonly route: ActivatedRoute, public readonly translateService: TranslateService) {
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
