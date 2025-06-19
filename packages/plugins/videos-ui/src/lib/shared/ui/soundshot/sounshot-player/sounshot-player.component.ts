import { Component, ElementRef, ViewChild, computed, input, signal } from '@angular/core';
import { ISoundshot, Soundshot } from '../../../models/soundshot.model';

@Component({
	selector: 'plug-soundshot-player',
	standalone: false,
	templateUrl: './sounshot-player.component.html',
	styleUrl: './sounshot-player.component.scss',
})
export class SounshotPlayerComponent {
	@ViewChild('player') playerRef: ElementRef<HTMLAudioElement>;
	soundshot = input<ISoundshot>();

	isPlaying = signal(false);
	progress = signal(0);
	currentTime = signal(0);
	duration = signal(0);
	volume = signal(1);

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
		const progressBar = (event.currentTarget as HTMLElement).querySelector('.progress-bar');
		if (!player || !progressBar) return;
		const rect = progressBar.getBoundingClientRect();
		const clickX = event.clientX - rect.left;
		const width = rect.width;
		const percent = clickX / width;
		const duration = this.duration();
		const seekTime = percent * (duration || 0);
		player.currentTime = seekTime;
		this.currentTime.set(seekTime);
		this.progress.set(percent * 100);
	}

	setVolume(event: Event): void {
		const player = this.playerRef?.nativeElement;
		if (!player) return;
		const value = +(event.target as HTMLInputElement).value;
		this.volume.set(value);
		player.volume = value;
	}
}
