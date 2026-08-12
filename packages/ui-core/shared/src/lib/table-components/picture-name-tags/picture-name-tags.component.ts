import { Component, Input } from '@angular/core';
import { NotesWithTagsComponent } from '../notes-with-tags/notes-with-tags.component';

@Component({
    selector: 'ga-picture-name-tags',
    template: `
		<ngx-avatar
		  [src]="avatar?.imageUrl"
		  [name]="avatar?.name"
		  [id]="avatar?.id"
		  [employee]="avatar.employee"
		  class="report-table"
		></ngx-avatar>
		@if (rowData?.isDefault) {
		  <nb-badge
		    class="color"
		    position="centered"
		    [style.background]="background(rowData?.color)"
		    [style.color]="backgroundContrast(rowData?.brandColor)"
		    text="Default"
		  ></nb-badge>
		}
		@if (isTags) {
		  <div class="badges-block">
		    @for (tag of (data | async)?.tags; track tag) {
		      <nb-badge
		        class="color"
		        position="centered"
		        [style.background]="background(tag?.color)"
		        [style.color]="backgroundContrast(tag?.color)"
		        [text]="tag?.name"
		      ></nb-badge>
		    }
		  </div>
		}
		`,
    styles: [
        `
			.image-container {
				width: 70px;
				height: 63px;
				display: flex;
				justify-content: center;
			}

			/* Chips inside a table cell — kept in step with the shared
			   table-density tokens ($gauzy-density in themes.scss); the
			   literals are CSS-var fallbacks only. The chips carry no margins:
			   .badges-block / .tags own all spacing via flex gap. */
			.color {
				position: static;
				display: inline-block;
				font-size: var(--gauzy-table-chip-font-size, 0.6875rem);
				font-weight: 600;
				line-height: var(--gauzy-table-chip-line-height, 0.875rem);
				letter-spacing: 0em;
				padding: var(--gauzy-table-chip-padding-y, 0.0625rem) var(--gauzy-table-chip-padding-x, 0.375rem);
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
    styleUrls: ['./picture-name-tags.component.scss'],
    standalone: false
})
export class PictureNameTagsComponent extends NotesWithTagsComponent {
	/**
	 * Returns the avatar data based on the properties of the current row data.
	 *
	 * @returns An object representing the avatar data.
	 */
	public get avatar(): any {
		const { id, employeeId, fullName, name, employee } = this.rowData;
		const avatarId = employeeId === id ? id : employeeId;

		return {
			...this.rowData,
			id: avatarId || null,
			name: fullName || name || null,
			imageUrl: this.rowData.user?.image?.fullUrl || this.rowData.imageUrl,
			employee
		};
	}

	@Input() isTags = true;
}
