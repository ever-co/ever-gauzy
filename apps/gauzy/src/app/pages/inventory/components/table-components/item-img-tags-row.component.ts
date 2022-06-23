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
				<div
					class="no-image"
					(mouseenter)="hoverState = true"
					(mouseleave)="hoverState = false"
				>
					<div class="content">
						<i class="fas fa-image"></i>
						<div>{{'ORGANIZATIONS_PAGE.NO_IMAGE' | translate }}</div>
					</div>
				</div>
			</div>
			<div class="row">
				<div class="col-12 text-truncate" style="margin-left:15px;">
					{{ value || '-' }}
				</div>
				<div
					*ngIf="isTags"
					style="margin-left:15px;"
					class="col-12 mt-2 {{
						layout === 'CARDS_GRID' ? 'tags-right' : ''
					}}"
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
				height: 100%;
				width: 100%;
				border-radius: 4px;
				object-fit: cover;
			}

			.no-image {
				width: 100%;
				height: 100%;
				background-color: var(--gauzy-sidebar-background-3);
				display: flex;
				align-items: center;
				justify-content: center;
				border-radius: 4px;
				font-size: 9px;
				font-weight: 400;
				line-height: 11px;
				letter-spacing: 0em;
				text-align: left;
				color: var(--gauzy-text-color-2);
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
