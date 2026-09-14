import { IInputs, IOutputs } from "./generated/ManifestTypes";

export class PlaceholderText implements ComponentFramework.StandardControl<IInputs, IOutputs> {
  private container!: HTMLDivElement;
  private host!: HTMLDivElement;
  private placeholderOverlay!: HTMLDivElement;

  private input!: HTMLInputElement;
  private textarea!: HTMLTextAreaElement;

  private notifyOutputChanged!: () => void;
  private currentValue = "";
  private lastContextValue = "";
  private accessiblePlaceholder = "";
  private hasPlaceholderContent = false;
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

    this.placeholderOverlay = document.createElement("div");
    this.placeholderOverlay.className = "evidi-placeholder-overlay";
    this.placeholderOverlay.setAttribute("aria-hidden", "true");

    this.input = document.createElement("input");
    this.input.type = "text";
    this.input.className = "evidi-placeholder-input";

    this.input.addEventListener("input", this.handleInput);
    this.input.addEventListener("focus", this.handleFocusChange);
    this.input.addEventListener("blur", this.handleFocusChange);
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
    this.textarea.addEventListener("focus", this.handleFocusChange);
    this.textarea.addEventListener("blur", this.handleFocusChange);
    this.textarea.addEventListener("compositionstart", () => {
      this.isComposing = true;
    });
    this.textarea.addEventListener("compositionend", () => {
      this.isComposing = false;
      this.handleInput();
      this.autoResize();
    });

    this.host.append(this.input, this.placeholderOverlay);
    this.container.appendChild(this.host);
  }

  private handleInput = (): void => {
    if (this.isComposing) return;

    const activeControl = this.isMultiline ? this.textarea : this.input;
    this.currentValue = activeControl.value;
    if (this.isMultiline) this.autoResize();
    this.syncPlaceholderVisibility();
    this.notifyOutputChanged();
  };

  private handleFocusChange = (): void => {
    this.syncPlaceholderVisibility();
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
      this.host.replaceChildren(this.isMultiline ? this.textarea : this.input, this.placeholderOverlay);
    }

    const activeControl = this.isMultiline ? this.textarea : this.input;

    this.renderPlaceholder(placeholder);
    activeControl.placeholder = this.accessiblePlaceholder;
    activeControl.disabled = context.mode.isControlDisabled;
    this.placeholderOverlay.classList.toggle("disabled", context.mode.isControlDisabled);

    const isFocused = document.activeElement === activeControl;

    // Only sync external value into the DOM when user is not actively editing.
    // This prevents older updateView values from overwriting fast typing.
    if (!isFocused && activeControl.value !== value) {
      activeControl.value = value;
      this.currentValue = value;
      if (this.isMultiline) this.autoResize();
    }

    this.syncPlaceholderVisibility();

    // Track the last value received from the framework
    this.lastContextValue = value;
  }

  public getOutputs(): IOutputs {
    return { value: this.currentValue };
  }

  public destroy(): void {
    this.input.removeEventListener("input", this.handleInput);
    this.input.removeEventListener("focus", this.handleFocusChange);
    this.input.removeEventListener("blur", this.handleFocusChange);
    this.textarea.removeEventListener("input", this.handleInput);
    this.textarea.removeEventListener("focus", this.handleFocusChange);
    this.textarea.removeEventListener("blur", this.handleFocusChange);

    this.input?.remove();
    this.textarea?.remove();
    this.placeholderOverlay?.remove();
    this.host?.remove();
  }

  private renderPlaceholder(rawPlaceholder: string): void {
    const safeMarkup = this.sanitizePlaceholder(rawPlaceholder);
    this.placeholderOverlay.innerHTML = safeMarkup;
    this.accessiblePlaceholder = this.toPlainText(safeMarkup);
    this.hasPlaceholderContent = this.accessiblePlaceholder.trim().length > 0;
  }

  private syncPlaceholderVisibility(): void {
    const activeControl = this.isMultiline ? this.textarea : this.input;
    const isFocused = document.activeElement === activeControl;
    const shouldShow = this.hasPlaceholderContent && activeControl.value.length === 0 && !isFocused;
    this.placeholderOverlay.style.display = shouldShow ? "block" : "none";
  }

  private sanitizePlaceholder(value: string): string {
    const parser = new DOMParser();
    const parsed = parser.parseFromString(`<div>${value}</div>`, "text/html");
    const sourceRoot = parsed.body.firstElementChild;
    if (!sourceRoot) return "";

    const safeDoc = document.implementation.createHTMLDocument("");
    const safeRoot = safeDoc.createElement("div");
    const allowedTags = new Set(["P", "BR", "B", "I", "UL", "LI"]);

    const sanitizeNode = (node: Node): Node | null => {
      if (node.nodeType === Node.TEXT_NODE) {
        return safeDoc.createTextNode(node.textContent ?? "");
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        return null;
      }

      const element = node as HTMLElement;
      const cleanContainer = safeDoc.createDocumentFragment();

      for (const childNode of Array.from(element.childNodes)) {
        const cleanChild = sanitizeNode(childNode);
        if (cleanChild) cleanContainer.appendChild(cleanChild);
      }

      if (!allowedTags.has(element.tagName)) {
        return cleanContainer;
      }

      const safeElement = safeDoc.createElement(element.tagName.toLowerCase());
      safeElement.appendChild(cleanContainer);
      return safeElement;
    };

    for (const childNode of Array.from(sourceRoot.childNodes)) {
      const cleanNode = sanitizeNode(childNode);
      if (cleanNode) safeRoot.appendChild(cleanNode);
    }

    return safeRoot.innerHTML;
  }

  private toPlainText(html: string): string {
    const tempContainer = document.createElement("div");
    tempContainer.innerHTML = html;
    return tempContainer.textContent ?? "";
  }
}