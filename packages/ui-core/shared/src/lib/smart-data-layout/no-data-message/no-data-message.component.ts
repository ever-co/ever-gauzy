import { ChangeDetectorRef, Component, Input, OnDestroy, OnInit } from '@angular/core';
import { UntilDestroy } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { SkeletonVariant } from '../../skeleton/skeleton.component';

/**
 * How long a freshly created empty-state waits before it is allowed to claim
 * "No Data".
 *
 * This is the safety net for the ~50 call sites that do NOT pass `[loading]`:
 * every list page mounts with an empty array and only then fires its request,
 * so without a grace window the very first frame tells the user their data is
 * gone. Bounded by construction — the placeholder can never outlive it unless
 * `[loading]` is explicitly still true.
 */
export const NO_DATA_SETTLE_DELAY_MS = 700;

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ngx-no-data-message',
    templateUrl: './no-data-message.component.html',
    styleUrls: ['./no-data-message.component.scss'],
    standalone: false
})
export class NoDataMessageComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	@Input() title: string = this.getTranslation('SM_TABLE.NO_DATA_MESSAGE');
	@Input() message: string;

	/**
	 * The owning page's in-flight flag. While true the empty state is replaced by
	 * a skeleton, because "we have not finished asking" is not the same statement
	 * as "there is nothing here".
	 */
	@Input() loading: boolean = false;

	/** Shape of the placeholder drawn while loading. */
	@Input() variant: SkeletonVariant = 'lines';

	/** How many placeholder rows / cards to draw. */
	@Input() skeletonRows: number = 5;

	/**
	 * Grace window in ms. Pass 0 at call sites that are a genuine terminal state
	 * (a 404-style "not found", a validation message) rather than a list result.
	 */
	@Input() settleDelay: number = NO_DATA_SETTLE_DELAY_MS;

	private settling: boolean = true;
	private settleTimer: ReturnType<typeof setTimeout>;

	constructor(public readonly translateService: TranslateService, private readonly cdr: ChangeDetectorRef) {
		super(translateService);
	}

	/** True while the request may still be in flight. */
	get showSkeleton(): boolean {
		return !!this.loading || this.settling;
	}

	ngOnInit() {
		if (this.settleDelay > 0) {
			this.settleTimer = setTimeout(() => {
				this.settling = false;
				this.settleTimer = undefined;
				// The host may sit under an OnPush ancestor, which a bare timer
				// callback would not mark dirty.
				this.cdr.markForCheck();
			}, this.settleDelay);
		} else {
			this.settling = false;
		}
	}

	ngOnDestroy() {
		if (this.settleTimer) {
			clearTimeout(this.settleTimer);
			this.settleTimer = undefined;
		}
	}
}
