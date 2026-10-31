let clickSound: (() => void) | null = null;

/** Register the UI click sound once the audio manager exists. */
export function setButtonSound(fn: () => void): void {
  clickSound = fn;
}

export interface ButtonOptions {
  variant?: 'primary' | 'default';
  small?: boolean;
  disabled?: boolean;
}

export function createButton(label: string, onClick: () => void, o: ButtonOptions = {}): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = `btn${o.variant === 'primary' ? ' primary' : ''}${o.small ? ' small' : ''}`;
  b.textContent = label;
  b.disabled = o.disabled ?? false;
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    if (b.disabled) return;
    clickSound?.();
    onClick();
  });
  return b;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  html = '',
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (html) e.innerHTML = html;
  return e;
}
