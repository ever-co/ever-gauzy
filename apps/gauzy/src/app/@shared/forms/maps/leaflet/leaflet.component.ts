import { AfterViewInit, ChangeDetectorRef, Component, EventEmitter, Input, Output } from '@angular/core';
import L, { icon, LatLng, latLng, Layer, marker, tileLayer } from 'leaflet';
import { convertPrecisionFloatDigit } from '@gauzy/ui-sdk/common';
import { environment } from '../../../../../environments/environment';

@Component({
	selector: 'ga-leaflet-map',
	templateUrl: './leaflet.component.html',
	styleUrls: ['./leaflet.component.scss']
})
export class LeafletMapComponent implements AfterViewInit {
	public loaded: boolean;
	private _zoom: number;
	private _icon: string;
	private _marker: LatLng;

	private map: L.Map;

	// Open Street Map definitions
	layer = tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
		maxZoom: 18,
		attribution: 'Open Street Map'
	});

	// Values to bind to Leaflet Directive
	protected options = {
		layers: [this.layer],
		zoom: this.zoom,
		center: latLng(environment.DEFAULT_LATITUDE, environment.DEFAULT_LONGITUDE)
	};
	markers: Layer[] = [];

	@Input()
	set zoom(val: number) {
		this._zoom = val;
		this.options.zoom = val;
	}
	get zoom() {
		return this._zoom || 12;
	}

	@Input()
	set icon(val: string) {
		this._icon = val;
	}
	get icon() {
		return this._icon || 'assets/leafelt/marker-icon.png';
	}

	@Input()
	set marker(val: LatLng) {
		this._marker = val;
		this.addMarker(this._marker);
	}
	get marker() {
		return this._marker;
	}

	@Output() mapClicked = new EventEmitter<LatLng>();
	@Output() mapDoubleClicked = new EventEmitter<LatLng>();

	constructor(private readonly cdr: ChangeDetectorRef) {}

	ngAfterViewInit() {
		setTimeout(() => {
			this.loaded = true;
		}, 200);
		this.cdr.detectChanges();
	}

	/*
	 * Map Zoom and Move: LeafletEvent
	 */
	onMapReady(map: L.Map) {
		this.map = map;
	}
	onMapMove(map: any) {
		// Do stuff with map
	}
	onMapMoveStart(map: any) {
		// Do stuff with map
	}
	onMapMoveEnd(map: any) {
		// Do stuff with map
	}
	onMapZoom(map: any) {
		// Do stuff with map
	}
	onMapZoomStart(map: any) {
		// Do stuff with map
	}
	onMapZoomEnd(map: any) {
		// Do stuff with map
	}
	/*
	 * Mouse Interactions: LeafletMouseEvent
	 */
	onMapClick(map: any) {
		const { lat, lng }: LatLng = map.latlng;

		const latitude = convertPrecisionFloatDigit(lat);
		const longitude = convertPrecisionFloatDigit(lng);

		this.mapClicked.emit(new LatLng(latitude, longitude));
		this.addMarker(new LatLng(latitude, longitude));
	}
	onMapDoubleClick(map: any) {
		// Do stuff with map
	}
	onMapMouseDown(map: any) {
		// Do stuff with map
	}
	onMapMouseUp(map: any) {
		// Do stuff with map
	}
	onMapMouseMove(map: any) {
		// Do stuff with map
	}
	onMapMouseOver(map: any) {
		// Do stuff with map
	}
	onMapMouseOut(map: any) {
		// Do stuff with map
	}

	/*
	 * Add location marker after click on map
	 */
	addMarker(latlng: LatLng) {
		if (!this.map) {
			return;
		}
		const { lat, lng } = latlng;
		const newMarker = marker([lat, lng], {
			icon: icon({
				iconSize: [25, 41],
				iconAnchor: [13, 41],
				iconUrl: this.icon,
				tooltipAnchor: [0, -41]
			}),
			riseOnHover: true
		}).bindTooltip(`${lat},${lng}`, {
			permanent: true,
			opacity: 1,
			direction: 'top'
		});
		this.markers = [];
		this.markers.push(newMarker);
		this.map.panTo(new LatLng(lat, lng));
	}
}
