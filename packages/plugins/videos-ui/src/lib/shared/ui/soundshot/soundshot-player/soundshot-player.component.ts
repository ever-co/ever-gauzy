import { Component, ElementRef, EventEmitter, Output, ViewChild, computed, input, signal } from '@angular/core';
import { SoundshotQuery } from '../../../../+state/soundshot/soundshot.query';
import { ActionButton, IActionButton } from '../../../models/action-button.model';
import { ISoundshot, Soundshot } from '../../../models/soundshot.model';

@Component({
	selector: 'plug-soundshot-player',
	standalone: false,
	templateUrl: './soundshot-player.component.html',
	styleUrl: './soundshot-player.component.scss'
})
export class SoundshotPlayerComponent {
	@ViewChild('player') playerRef: ElementRef<HTMLAudioElement>;
	soundshot = input<ISoundshot>();
	isPlaying = signal(false);
	progress = signal(0);
	currentTime = signal(0);
	duration = signal(0);
	volume = signal(1);

	@Output() download = new EventEmitter<ISoundshot>();
	@Output() recover = new EventEmitter<ISoundshot>();
	@Output() delete = new EventEmitter<ISoundshot>();
	@Output() hardDelete = new EventEmitter<ISoundshot>();

	constructor(private readonly soundshotQuery: SoundshotQuery) { }

	public buttons = computed(() => {
		const soundshot = new Soundshot(this.soundshot());
		const commons = [
			new ActionButton({
				icon: 'download-outline',
				label: 'BUTTONS.DOWNLOAD',
				status: 'info',
				loading: this.soundshotQuery.downloading$,
				action: (soundshot: ISoundshot) => this.download.emit(soundshot)
			})
		];
		const statusSpecificButtons: IActionButton[] = soundshot.isDeleted
			? [
				new ActionButton({
					icon: 'refresh-outline',
					label: 'BUTTONS.RECOVER',
					status: 'success',
					loading: this.soundshotQuery.restoring$,
					action: (soundshot: ISoundshot) => this.recover.emit(soundshot)
				}),
				new ActionButton({
					icon: 'trash-2-outline',
					label: 'Hard Delete',
					status: 'danger',
					loading: this.soundshotQuery.deleting$,
					action: (soundshot: ISoundshot) => this.hardDelete.emit(soundshot)
				})
			]
			: [
				new ActionButton({
					icon: 'trash-outline',
					label: 'BUTTONS.DELETE',
					status: 'danger',
					loading: this.soundshotQuery.deleting$,
					action: (soundshot: ISoundshot) => this.delete.emit(soundshot)
				})
			];
		return [...commons, ...statusSpecificButtons];
	});

	// Computed for duration from soundshot
	readonly displayDuration = computed(() => this.soundshot()?.duration || this.duration());

	togglePlay(): void {
		const player = this.playerRef?.nativeElement;
		if (!player) return;
		if (player.paused) {
			player.play();
			this.isPlaying.set(true);
		} else {
			player.pause();
			this.isPlaying.set(false);
		}
	}

	onTimeUpdate(): void {
		const player = this.playerRef?.nativeElement;
		if (!player) return;
		this.currentTime.set(player.currentTime);
		const dur = this.soundshot()?.duration || player.duration || 0;
		this.duration.set(dur);
		this.progress.set(dur ? (player.currentTime / dur) * 100 : 0);
	}

	onLoadedMetadata(): void {
		const player = this.playerRef?.nativeElement;
		if (!player) return;
		const dur = this.soundshot()?.duration || player.duration || 0;
		this.duration.set(dur);
	}

	onEnded(): void {
		this.isPlaying.set(false);
		this.currentTime.set(0);
		this.progress.set(0);
	}

	seek(event: MouseEvent): void {
		const player = this.playerRef?.nativeElement;
		const progressBar = (event.currentTarget as HTMLElement)?.querySelector?.('.progress-bar');
		if (!player) {
			console.warn('Audio player element not found.');
			return;
		}
		if (!progressBar) {
			console.warn('Progress bar element not found.');
			return;
		}
		const rect = progressBar.getBoundingClientRect();
		const clickX = event.clientX - rect.left;
		const width = rect.width;
		if (width === 0) {
			console.warn('Progress bar width is zero.');
			return;
		}
		const percent = clickX / width;
		const duration = this.duration();
		const seekTime = percent * (duration || 0);
		try {
			player.currentTime = seekTime;
			this.currentTime.set(seekTime);
			this.progress.set(percent * 100);
		} catch (error) {
			console.error('Failed to seek audio:', error);
		}
	}

	setVolume(event: Event): void {
		const player = this.playerRef?.nativeElement;
		if (!player) return;
		const value = +(event.target as HTMLInputElement).value;
		this.volume.set(value);
		player.volume = value;
	}
}
