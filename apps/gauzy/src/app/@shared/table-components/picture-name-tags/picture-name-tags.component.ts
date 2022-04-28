import { Component, Input } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';
import { NotesWithTagsComponent } from '../notes-with-tags/notes-with-tags.component';

@Component({
	selector: 'ga-picture-name-tags',
	template: `
		<ngx-avatar
			[src]="rowData?.imageUrl"
			[name]="rowData?.fullName ? rowData?.fullName : rowData?.name"
		></ngx-avatar>
		<ng-template [ngIf]="rowData?.isDefault">
			<nb-badge
				class="color"
				position="centered"
				[style.background]="rowData?.brandColor"
				[style.color]="backgroundContrast(rowData?.brandColor)"
				text="Default"
			>
			</nb-badge>
		</ng-template>
		<div class="badges-block" *ngIf="isTags">
			<nb-badge
				*ngFor="let tag of (data | async)?.tags"
				class="color"
				position="centered"
				[style.background]="tag?.color"
				[style.color]="backgroundContrast(tag?.color)"
				[text]="tag?.name"
			>
			</nb-badge>
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
				border-radius: 50%;
			}

			.tags-right {
				justify-content: flex-end;
			}
		`
	],
	styleUrls: ['./picture-name-tags.component.scss']
})
export class PictureNameTagsComponent
	extends NotesWithTagsComponent
	implements ViewCell
{
	@Input()
	isTags = true;
}
