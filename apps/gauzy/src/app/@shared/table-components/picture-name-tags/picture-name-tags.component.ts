import { Component, Input } from '@angular/core';
import { getContrastColor } from 'libs/utils';
import { ViewCell } from 'ng2-smart-table';
import { ComponentLayoutStyleEnum } from '@gauzy/models';

@Component({
	selector: 'ga-picture-name-tags',
	template: `
		<div
			style="display: flex; align-items: center;"
			class="{{ layout === 'CARDS_GRID' ? 'tags-right' : '' }}"
		>
			<div *ngIf="rowData.imageUrl" class="image-container">
				<img [src]="rowData.imageUrl" />
			</div>
			<div
				*ngIf="rowData.fullName"
				class="d-block"
				style="margin-left:15px;"
			>
				{{ rowData.fullName }}
			</div>
			<div *ngIf="rowData.name" class="d-block" style="margin-left:15px;">
				{{ rowData.name }}
			</div>
		</div>
		<div class="tags {{ layout === 'CARDS_GRID' ? 'tags-right' : '' }}">
			<nb-badge
				*ngFor="let tag of rowData?.tags"
				class="color"
				position="centered"
				[style.background]="tag.color"
				[style.color]="backgroundContrast(tag.color)"
				text="{{ tag.name }}"
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
			}

			.tags-right {
				justify-content: flex-end;
			}
		`
	]
})
export class PictureNameTagsComponent implements ViewCell {
	@Input()
	rowData: any;

	@Input()
	value: string | number;

	@Input()
	layout?: ComponentLayoutStyleEnum | undefined;

	backgroundContrast(bgColor: string) {
		return getContrastColor(bgColor);
	}
}
