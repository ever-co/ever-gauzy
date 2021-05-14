import { Component, Input } from '@angular/core';
import { getContrastColor } from '@gauzy/common-angular';
import { ViewCell } from 'ng2-smart-table';
import { ComponentLayoutStyleEnum } from '@gauzy/contracts';

@Component({
	template: `
		<div
			style="display: flex; align-items: center;"
			class="{{ layout === 'CARDS_GRID' ? 'tags-right' : '' }}"
		>
			<div *ngIf="imageUrl" class="image-container">
				<img [src]="imageUrl" />
			</div>
			<div *ngIf="!imageUrl" class="image-container">
				<img
					[src]="
						'https://afostats.imagead.net/uploads/afo/no_img.png'
					"
					alt="Product Item Photo"
					(mouseenter)="hoverState = true"
					(mouseleave)="hoverState = false"
				/>
			</div>

			<div class="d-block" style="margin-left:15px;">
				{{ value || '-' }}
			</div>
		</div>
		<div
			*ngIf="isTags"
			class="tags {{ layout === 'CARDS_GRID' ? 'tags-right' : '' }}"
		>
			<nb-badge
				*ngFor="let tag of rowData?.tags"
				class="color"
				position="centered"
				[style.background]="tag?.color"
				[style.color]="backgroundContrast(tag?.color)"
				text="{{ tag?.name }}"
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
	]
})
export class ItemImgTagsComponent implements ViewCell {
	@Input()
	rowData: any;

	@Input()
	isTags = true;

	@Input()
	value: string | number;

	@Input()
	layout?: ComponentLayoutStyleEnum | undefined;

	get imageUrl() {
		if (this.rowData.logo) {
			return this.rowData.logo.url || this.rowData.logo;
		} else if (
			this.rowData.featuredImage &&
			this.rowData.featuredImage.url
		) {
			return this.rowData.featuredImage.url;
		}

		return null;
	}

	backgroundContrast(bgColor: string) {
		return getContrastColor(bgColor);
	}
}
