import {
	Component,
	Input,
	EventEmitter,
	Output,
	OnInit,
	OnDestroy
} from '@angular/core';
import { ICandidateInterview } from '@gauzy/models';
import { Subject } from 'rxjs';
import { CandidatesService } from 'apps/gauzy/src/app/@core/services/candidates.service';
import { takeUntil } from 'rxjs/operators';
import { NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';

@Component({
	selector: 'ga-interview-actions',
	template: `
		<div class="update">
			<span class="title">
				updated:
			</span>
			<span class="title">
				{{ rowData?.updatedAt | date: 'short' }}
			</span>
			<div>
				<nb-icon
					(click)="editInterview()"
					icon="edit"
					class="icons"
					[ngClass]="{
						enabled: !isPastInterview(rowData),
						disabled: isPastInterview(rowData)
					}"
				>
				</nb-icon>
				<nb-icon
					(click)="removeInterview()"
					icon="close"
					class="icons ml-2"
					[ngClass]="{
						enabled: !isPastInterview(rowData),
						disabled: isPastInterview(rowData)
					}"
				></nb-icon>
			</div>
		</div>
	`,
	styles: [
		`
			.update {
				display: flex;
				flex-direction: column;
				justify-content: center;
				align-items: center;
			}
			.title {
				color: #8f9bb3;
				font-size: 12px;
			}
			.icons {
				font-size: 1.3rem;
				cursor: pointer !important;
			}
			.enabled {
				color: #222b45 !important;
				&:focus {
					transform: translateY(2px);
				}
			}
			.disabled {
				color: rgba(143, 155, 179, 0.48) !important;
			}
		`
	]
})
export class InterviewActionsTableComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	@Input() rowData: any;
	@Output() updateResult = new EventEmitter<any>();
	private _ngDestroy$ = new Subject<void>();

	constructor(
		private candidatesService: CandidatesService,
		readonly translateService: TranslateService,
		private toastrService: NbToastrService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.candidatesService
			.getAll(['user'])
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((candidates) => {
				candidates.items.forEach((item) => {
					if (item.id === this.rowData.candidate.id) {
						this.rowData.candidate = item;
					}
				});
			});
	}
	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
	isPastInterview(interview: ICandidateInterview) {
		const now = new Date().getTime();
		if (new Date(interview.startTime).getTime() > now) {
			return false;
		} else {
			return true;
		}
	}
	removeInterview() {
		if (this.isPastInterview(this.rowData)) {
			this.toastrService.warning(
				this.getTranslation('TOASTR.TITLE.WARNING'),
				this.getTranslation('TOASTR.MESSAGE.DELETE_PAST_INTERVIEW')
			);
		} else {
			const params = {
				isEdit: false,
				data: this.rowData
			};
			this.updateResult.emit(params);
		}
	}
	editInterview() {
		if (this.isPastInterview(this.rowData)) {
			this.toastrService.warning(
				this.getTranslation('TOASTR.TITLE.WARNING'),
				this.getTranslation('TOASTR.MESSAGE.EDIT_PAST_INTERVIEW')
			);
		} else {
			const params = {
				isEdit: true,
				data: this.rowData
			};
			this.updateResult.emit(params);
		}
	}
}
