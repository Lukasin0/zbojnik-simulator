import { el } from './button';

export interface DialogOption {
  label: string;
  disabled?: boolean;
  /** Return another node to continue the conversation, or nothing to close it. */
  action?: () => DialogNode | void;
}

export interface DialogNode {
  speaker: string;
  text: string;
  options?: DialogOption[];
}

/** DOM box for conversations. Navigation is driven by the DialogState. */
export class DialogBox {
  private readonly root: HTMLDivElement;
  private buttons: HTMLButtonElement[] = [];
  selected = 0;

  constructor(private readonly parent: HTMLElement) {
    this.root = el('div', 'dialog interactive');
  }

  show(node: DialogNode, onPick: (index: number) => void): void {
    this.root.innerHTML = '';
    const panel = el('div', 'panel');
    panel.append(el('div', 'speaker', node.speaker), el('div', 'text'));
    (panel.querySelector('.text') as HTMLDivElement).textContent = node.text;
    const opts = el('div', 'options');
    const options = node.options && node.options.length > 0 ? node.options : [{ label: 'Pokračovať' }];
    this.buttons = options.map((o, i) => {
      const b = el('button', 'opt');
      b.innerHTML = `<span class="n">${i + 1}.</span>`;
      b.append(document.createTextNode(o.label));
      b.disabled = o.disabled ?? false;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!b.disabled) onPick(i);
      });
      b.addEventListener('mouseenter', () => this.select(i));
      opts.appendChild(b);
      return b;
    });
    panel.appendChild(opts);
    this.root.appendChild(panel);
    if (!this.root.isConnected) this.parent.appendChild(this.root);
    this.selected = this.buttons.findIndex((b) => !b.disabled);
    this.select(Math.max(0, this.selected));
  }

  select(i: number): void {
    if (this.buttons.length === 0) return;
    this.selected = (i + this.buttons.length) % this.buttons.length;
    this.buttons.forEach((b, k) => b.classList.toggle('sel', k === this.selected));
  }

  move(delta: number): void {
    for (let step = 1; step <= this.buttons.length; step++) {
      const i = (this.selected + delta * step + this.buttons.length * 4) % this.buttons.length;
      if (!this.buttons[i].disabled) {
        this.select(i);
        return;
      }
    }
  }

  isEnabled(i: number): boolean {
    return i >= 0 && i < this.buttons.length && !this.buttons[i].disabled;
  }

  get count(): number {
    return this.buttons.length;
  }

  hide(): void {
    this.root.remove();
  }
}
