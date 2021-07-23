import colorLib from '@kurkle/color';

export class ChartUtil {
    public static COLORS: string[] = [
        '#4dc9f6',
        '#f67019',
        '#f53794',
        '#537bc4',
        '#acc236',
        '#166a8f',
        '#00a950',
        '#58595b',
        '#8549ba'
    ];

    public static CHART_COLORS: any = {
        red: 'rgb(255, 99, 132)',
        orange: 'rgb(255, 159, 64)',
        yellow: 'rgb(255, 205, 86)',
        green: 'rgb(75, 192, 192)',
        blue: 'rgb(54, 162, 235)',
        purple: 'rgb(153, 102, 255)',
        grey: 'rgb(201, 203, 207)'
    };

    constructor() {}

    public static color(index: number) {
        return ChartUtil.COLORS[index % ChartUtil.COLORS.length];
    }

    public static transparentize(value: string, opacity: number) {
        var alpha = opacity === undefined ? 0.5 : 1 - opacity;
        return colorLib(value).alpha(alpha).rgbString();
    }

    public static NAMED_COLORS: string[] = [
        ChartUtil.CHART_COLORS.red,
        ChartUtil.CHART_COLORS.orange,
        ChartUtil.CHART_COLORS.yellow,
        ChartUtil.CHART_COLORS.green,
        ChartUtil.CHART_COLORS.blue,
        ChartUtil.CHART_COLORS.purple,
        ChartUtil.CHART_COLORS.grey,
    ];

    public static namedColor(index: number) {
        return ChartUtil.NAMED_COLORS[index % ChartUtil.NAMED_COLORS.length];
    }
}