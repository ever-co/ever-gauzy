import { Component, Input } from '@angular/core';
import { NotesWithTagsComponent } from '../notes-with-tags/notes-with-tags.component';

@Component({
	selector: 'ga-picture-name-tags',
	template: `
		<ngx-avatar
			[src]="avatar?.imageUrl"
			[name]="avatar?.name"
			[id]="avatar?.id"
			class="report-table"
		></ngx-avatar>
		<ng-template [ngIf]="rowData?.isDefault">
			<nb-badge
				class="color"
				position="centered"
				[style.background]="background(rowData?.color)"
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
				[style.background]="background(tag?.color)"
				[style.color]="backgroundContrast(tag?.color)"
				[text]="tag?.name"
			></nb-badge>
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
				font-size: 11px;
				font-weight: 600;
				line-height: 13px;
				letter-spacing: 0em;
				padding: 3px 8px;
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
export class PictureNameTagsComponent extends NotesWithTagsComponent {
	/**
	 * Returns the avatar data based on the properties of the current row data.
	 *
	 * @returns An object representing the avatar data.
	 */
	public get avatar(): any {
		const { id, employeeId, fullName, name } = this.rowData;
		const avatarId = employeeId === id ? id : employeeId;

		return {
			...this.rowData,
			id: avatarId || null,
			name: fullName || name || null
		};
	}

	@Input() isTags = true;
}
