import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
    selector: 'ngx-theme-selector-container',
    templateUrl: './theme-selector-container.component.html',
    styleUrl: './theme-selector-container.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class ThemeSelectorContainerComponent {
	@Input() isClassic = true;
}
