import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ISoundshot, Soundshot } from '../../../models/soundshot.model';

@Component({
	selector: 'plug-soundshot-player',
	standalone: false,
	templateUrl: './sounshot-player.component.html',
	styleUrl: './sounshot-player.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class SounshotPlayerComponent {
	private _soundshot: ISoundshot;

	public get soundshot(): ISoundshot {
		return this._soundshot;
	}

	@Input()
	public set soundshot(value: ISoundshot) {
		this._soundshot = new Soundshot(value);
	}
}
