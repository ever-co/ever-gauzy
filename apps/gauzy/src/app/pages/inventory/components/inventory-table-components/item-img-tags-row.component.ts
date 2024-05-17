import { Component, Input } from '@angular/core';
import { getContrastColor } from '@gauzy/ui-sdk/common';
import { ComponentLayoutStyleEnum } from '@gauzy/contracts';

@Component({
	template: `
		<div class="img-tags-container">
			<div *ngIf="imageUrl" class="image-container">
				<img [src]="imageUrl" />
			</div>
			<div *ngIf="!imageUrl" class="image-container">
				<ga-no-image class="no-image" (mouseenter)="hoverState = true" (mouseleave)="hoverState = false">
				</ga-no-image>
			</div>
			<div class="row">
				<div class="col-12 text-truncate name">
					{{ value || '-' }}
				</div>
				<div
					*ngIf="isTags"
					class="col-12 mt-2"
					[ngClass]="{
						'tags-right': layout === componentLayoutEnum.CARDS_GRID
					}"
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
			</div>
		</div>
	`,
	styles: [
		`
			.img-tags-container {
				display: flex;
				gap: 10px;
			}

			.image-container {
				width: 70px;
				height: 64px;
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
				width: 70px;
				height: 64px;
				border-radius: 4px;
				object-fit: cover;
				box-shadow: var(--gauzy-shadow) (0 0 0 / 15%);
			}

			.no-image {
				width: 100%;
				height: 100%;
			}

			.content {
				display: flex;
				align-items: baseline;
				padding: 8px;
				gap: 5px;
			}

			.tags-right {
				justify-content: flex-end;
			}

			.name {
				font-size: 14px;
				font-weight: 600;
				line-height: 17px;
				letter-spacing: 0em;
				text-align: left;
				color: var(--gauzy-color-text-1);
				margin-bottom: 4px;
			}
		`
	]
})
export class ItemImgTagsComponent {
	@Input()
	rowData: any;

	@Input()
	isTags = true;

	@Input()
	value: string | number;

	@Input()
	layout?: ComponentLayoutStyleEnum | undefined;

	componentLayoutEnum = ComponentLayoutStyleEnum;

	get imageUrl() {
		if (this.rowData.logo) {
			return this.rowData.logo.url || this.rowData.logo;
		} else if (this.rowData.featuredImage && this.rowData.featuredImage.url) {
			return this.rowData.featuredImage.url;
		}

		return null;
	}

	backgroundContrast(bgColor: string) {
		return getContrastColor(bgColor);
	}
}
