const nf = new Intl.NumberFormat("ja-JP");
export const num = (n: number) => nf.format(n);

export function dateTime(ms: number): string {
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "medium" }).format(new Date(ms));
}

export function clock(ms: number): string {
  return new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(ms));
}

/** 10^x の指数を桁区切りつきで返す(小数は切り捨てた整数)。 */
export const exp = (x: number) => num(Math.floor(Math.abs(x)));
