import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormArray } from '@angular/forms';
import { PluginSourceType } from '@gauzy/contracts';

@Component({
	selector: 'lib-source-container',
	standalone: false,
	templateUrl: './source-container.component.html',
	styleUrl: './source-container.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
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
