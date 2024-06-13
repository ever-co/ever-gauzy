export interface IChartData {
    labels?: any[];
    datasets: {
        label?: string;
        backgroundColor?: string;
        borderColor?: string;
        borderWidth?: number;
        pointRadius?: number;
        pointHoverRadius?: number;
        pointBorderWidth?: number;
        pointHoverBorderWidth?: number;
        pointBorderColor?: string;
        fill?: boolean;
        data?: any[];
    }[];
}
