export interface Clock {
  now(): Date;
}

/** Local time as `YYYYMMDD-HHmmss`, the suffix used in stock position file names. */
export function formatStamp(date: Date): string {
  const two = (n: number): string => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}${two(date.getMonth() + 1)}${two(date.getDate())}` +
    `-${two(date.getHours())}${two(date.getMinutes())}${two(date.getSeconds())}`
  );
}

/** Local time as `YYYY-MM-DD-HH_mm_ss_SSS`, the prefix of photo file names. */
export function formatPhotoStamp(date: Date): string {
  const two = (n: number): string => String(n).padStart(2, "0");
  const three = (n: number): string => String(n).padStart(3, "0");
  return (
    `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}` +
    `-${two(date.getHours())}_${two(date.getMinutes())}_${two(date.getSeconds())}` +
    `_${three(date.getMilliseconds())}`
  );
}
