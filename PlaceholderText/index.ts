import { IInputs, IOutputs } from "./generated/ManifestTypes";

export class PlaceholderText implements ComponentFramework.StandardControl<IInputs, IOutputs> {
  private container!: HTMLDivElement;
  private host!: HTMLDivElement;

  private input!: HTMLInputElement;
  private textarea!: HTMLTextAreaElement;

  private notifyOutputChanged!: () => void;
  private currentValue = "";
  private lastContextValue = "";
  private isMultiline = false;
  private isComposing = false;

  public init(
    _context: ComponentFramework.Context<IInputs>,
    notifyOutputChanged: () => void,
    _state: ComponentFramework.Dictionary,
    container: HTMLDivElement
  ): void {
    this.container = container;
    this.notifyOutputChanged = notifyOutputChanged;

    this.host = document.createElement("div");
    this.host.className = "evidi-field-host";

    this.input = document.createElement("input");
    this.input.type = "text";
    this.input.className = "evidi-placeholder-input";

    this.input.addEventListener("input", this.handleInput);
    this.input.addEventListener("compositionstart", () => {
      this.isComposing = true;
    });
    this.input.addEventListener("compositionend", () => {
      this.isComposing = false;
      this.handleInput();
    });

    this.textarea = document.createElement("textarea");
    this.textarea.className = "evidi-placeholder-textarea";

    this.textarea.addEventListener("input", this.handleInput);
    this.textarea.addEventListener("compositionstart", () => {
      this.isComposing = true;
    });
    this.textarea.addEventListener("compositionend", () => {
      this.isComposing = false;
      this.handleInput();
      this.autoResize();
    });

    this.host.appendChild(this.input);
    this.container.appendChild(this.host);
  }

  private handleInput = (): void => {
    if (this.isComposing) return;

    const activeControl = this.isMultiline ? this.textarea : this.input;
    this.currentValue = activeControl.value;
    if (this.isMultiline) this.autoResize();
    this.notifyOutputChanged();
  };

  private autoResize(): void {
    this.textarea.style.height = "auto";
    this.textarea.style.height = `${this.textarea.scrollHeight}px`;
  }

  public updateView(context: ComponentFramework.Context<IInputs>): void {
    const value = context.parameters.value.raw ?? "";
    const placeholder = context.parameters.placeholderText.raw ?? "";
    const shouldBeMultiline = context.parameters.multilineMode?.raw === true;

    if (shouldBeMultiline !== this.isMultiline) {
      this.isMultiline = shouldBeMultiline;
      this.host.replaceChildren(this.isMultiline ? this.textarea : this.input);
    }

    const activeControl = this.isMultiline ? this.textarea : this.input;

    activeControl.placeholder = placeholder;
    activeControl.disabled = context.mode.isControlDisabled;

    const isFocused = document.activeElement === activeControl;

    // Only sync external value into the DOM when user is not actively editing.
    // This prevents older updateView values from overwriting fast typing.
    if (!isFocused && activeControl.value !== value) {
      activeControl.value = value;
      this.currentValue = value;
      if (this.isMultiline) this.autoResize();
    }

    // Track the last value received from the framework
    this.lastContextValue = value;
  }

  public getOutputs(): IOutputs {
    return { value: this.currentValue };
  }

  public destroy(): void {
    this.input.removeEventListener("input", this.handleInput);
    this.textarea.removeEventListener("input", this.handleInput);

    this.input?.remove();
    this.textarea?.remove();
    this.host?.remove();
  }
}