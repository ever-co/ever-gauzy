import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CandidatesService } from 'apps/gauzy/src/app/@core/services/candidates.service';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';

@Component({
	selector: 'ga-candidate-picture-name',
	template: `
		<div style="display: flex; align-items: center;">
			<div
				class="image-container"
				*ngIf="rowData?.candidate?.user?.imageUrl"
			>
				<img [src]="rowData?.candidate?.user?.imageUrl" />
			</div>
			<div
				class="d-block"
				style="margin-left:15px;"
				*ngIf="rowData?.candidate?.user?.name"
			>
				{{ rowData?.candidate?.user?.name }}
			</div>
		</div>
	`,
	styles: [
		`
			.image-container {
				width: 70px;
				height: 63px;
				display: flex;
				justify-content: center;
			}

			.color {
				position: static;
				margin-top: 5px;
				margin-right: 5px;
				display: inline-block;
			}
			.tags {
				display: flex;
				width: 200px;
				flex-wrap: wrap;
			}

			img {
				height: 100%;
				max-width: 70px;
			}

			.tags-right {
				justify-content: flex-end;
			}
		`
	]
})
export class InterviewCandidatePictureNameComponent
	implements OnInit, OnDestroy {
	@Input()
	rowData: any;

	private _ngDestroy$ = new Subject<void>();

	constructor(private candidatesService: CandidatesService) {}
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
}
