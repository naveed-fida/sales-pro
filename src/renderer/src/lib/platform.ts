export function getPlatform(): string {
  return window.api.platform
}

export function isMac(): boolean {
  return getPlatform() === 'darwin'
}

export function isWindows(): boolean {
  return getPlatform() === 'win32'
}
