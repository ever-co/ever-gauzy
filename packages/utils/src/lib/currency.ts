export function currencyFormat(value: number) {
    return Number(value).toFixed(2);
}

export function currencyWithSymbol(value: number, currency: string) {
    return `${currency} ${currencyFormat(value)}`;
}
