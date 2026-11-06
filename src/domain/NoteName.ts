// A name becomes a file name and a link target, so some characters are out.
const FORBIDDEN = /[\\/:*?"<>|#^[\]]/;

export function hasForbiddenCharacters(name: string): boolean {
  return FORBIDDEN.test(name);
}
