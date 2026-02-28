import { CdkDragDrop, moveItemInArray, CdkDropList, CdkDrag, CdkDragHandle } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormArray } from '@angular/forms';
import { PluginSourceType } from '@gauzy/contracts';
import { NbIconModule, NbButtonModule, NbTooltipModule } from '@nebular/theme';
import { PluginSourceComponent } from '../../../component/plugin-marketplace/plugin-marketplace-upload/plugin-source/plugin-source.component';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
    selector: 'lib-source-container',
    templateUrl: './source-container.component.html',
    styleUrl: './source-container.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CdkDropList, CdkDrag, CdkDragHandle, NbIconModule, NbButtonModule, NbTooltipModule, PluginSourceComponent, TranslatePipe]
})
export class SourceContainerComponent {
	@Input() sources: FormArray;
	@Input() sourceTypes = Object.values(PluginSourceType);
	@Input() showSourceSelector = false;
	@Input() cantAddMore = false;

	@Output() add = new EventEmitter<PluginSourceType>();
	@Output() remove = new EventEmitter<number>();
	@Output() restore = new EventEmitter<number>();

	public drop(event: CdkDragDrop<string[]>) {
		moveItemInArray(this.sources.controls, event.previousIndex, event.currentIndex);
	}

	public openSourceTypeSelector() {
		this.showSourceSelector = true;
	}

	public closeSourceTypeSelector() {
		this.showSourceSelector = false;
	}

	public getSourceIcon(sourceType: PluginSourceType): string {
		const sourceIcons = new Map<PluginSourceType, string>([
			[PluginSourceType.CDN, 'layers-outline'],
			[PluginSourceType.GAUZY, 'cube-outline'],
			[PluginSourceType.NPM, 'code-outline']
		]);
		return sourceIcons.get(sourceType);
	}
}
