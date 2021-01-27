export interface ChartData {
	labels?: string[];
	datasets: {
		label?: string;
		backgroundColor?: string;
		borderWidth?: number;
		data?: number[];
	}[];
}
