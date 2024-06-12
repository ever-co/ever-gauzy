import { Component, Input, EventEmitter, Output, OnInit, OnDestroy } from '@angular/core';
import { ICandidateInterview } from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/i18n';
import { TranslateService } from '@ngx-translate/core';

@Component({
	selector: 'ga-interview-actions',
	template: `
		<div class="update">
			<div class="badges">
				<div class="badge badge-primary" *ngIf="isPastInterview(rowData)">
					{{ 'CANDIDATES_PAGE.MANAGE_INTERVIEWS.PAST' | translate }}
				</div>
				<div class="badge badge-warning" *ngIf="rowData.isArchived && rowData.showArchive">
					{{ 'CANDIDATES_PAGE.ARCHIVED' | translate }}
				</div>
			</div>
			<span class="title"> updated: </span>
			<span class="title">
				{{ rowData?.updatedAt | date : 'short' }}
			</span>
			<div class="btn" *ngIf="!rowData.hideActions">
				<nb-icon
					*ngIf="isPastInterview(rowData)"
					(click)="addFeedback()"
					nbTooltip="{{ 'CANDIDATES_PAGE.MANAGE_INTERVIEWS.ADD_FEEDBACK' | translate }}
					({{ rowData.feedbacks.length }}/{{ rowData.interviewers.length }})"
					nbTooltipPlacement="top"
					icon="message-square-outline"
					class="icons enabled"
				></nb-icon>
				<nb-icon
					*ngIf="!isPastInterview(rowData)"
					(click)="addFeedback()"
					nbTooltip="{{ 'CANDIDATES_PAGE.MANAGE_INTERVIEWS.ADD_FEEDBACK' | translate }} "
					nbTooltipPlacement="top"
					icon="message-square-outline"
					class="icons disabled"
				></nb-icon>
				<nb-icon
					(click)="editInterview()"
					icon="edit-outline"
					nbTooltip="{{ 'CANDIDATES_PAGE.MANAGE_INTERVIEWS.EDIT' | translate }}"
					nbTooltipPlacement="top"
					class="icons ml-2"
					[ngClass]="{
						enabled: !isPastInterview(rowData),
						disabled: isPastInterview(rowData)
					}"
				>
				</nb-icon>
				<nb-icon
					(click)="archive()"
					nbTooltip="{{ 'CANDIDATES_PAGE.MANAGE_INTERVIEWS.ARCHIVE' | translate }}"
					*ngIf="rowData.showArchive"
					nbTooltipPlacement="top"
					icon="archive-outline"
					class="icons ml-2"
					[ngClass]="{
						enabled: !rowData.isArchived,
						disabled: rowData.isArchived
					}"
				></nb-icon>
				<nb-icon
					(click)="removeInterview()"
					icon="close"
					class="icons ml-2"
					nbTooltip="{{ 'CANDIDATES_PAGE.MANAGE_INTERVIEWS.DELETE' | translate }}"
					nbTooltipPlacement="top"
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
			.badge-warning {
				background-color: #fa0;
			}
			.badges {
				display: flex;
				justify-content: space-between;
				align-items: center;
			}
			.badge-primary {
				background-color: #0095ff;
			}
			.badge {
				text-align: center;
				padding: 4px 8px;
				font-size: 12px;
				font-weight: 600;
				line-height: 15px;
				letter-spacing: 0em;
				text-align: left;
			}
			.update {
				display: flex;
				flex-direction: column;
				justify-content: center;
				align-items: flex-start;
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
			}
			.icons:active {
				transform: translateY(2px);
			}
			.disabled {
				color: rgba(143, 155, 179, 0.48) !important;
			}
			.btn {
				display: flex;
				flex-direction: row;
				justify-content: space-between;
				align-items: center;
			}
		`
	]
})
export class InterviewActionsTableComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	@Input() rowData: any;
	@Output() updateResult = new EventEmitter<any>();

	constructor(public readonly translateService: TranslateService) {
		super(translateService);
	}

	ngOnInit() {}
	ngOnDestroy() {}

	isPastInterview(interview: ICandidateInterview) {
		const now = new Date().getTime();
		if (new Date(interview.startTime).getTime() > now) {
			return false;
		} else {
			return true;
		}
	}

	removeInterview() {
		const params = {
			type: 'remove',
			data: this.rowData
		};
		this.updateResult.emit(params);
	}

	archive() {
		const params = {
			type: 'archive',
			data: this.rowData
		};
		this.updateResult.emit(params);
	}

	addFeedback() {
		const params = {
			type: 'feedback',
			data: this.rowData
		};
		this.updateResult.emit(params);
	}

	editInterview() {
		const params = {
			type: 'edit',
			data: this.rowData
		};
		this.updateResult.emit(params);
	}
}
