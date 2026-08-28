const initializedCopyButtons = new WeakSet<HTMLButtonElement>();

function copyUsingSelection(text: string, ownerDocument: Document): boolean {
	const textArea = ownerDocument.createElement("textarea");
	const activeElement = ownerDocument.activeElement as HTMLElement | null;
	const selection = ownerDocument.getSelection();
	const selectedRanges: Range[] = [];
	if (selection) {
		for (let index = 0; index < selection.rangeCount; index++) {
			selectedRanges.push(selection.getRangeAt(index).cloneRange());
		}
	}

	textArea.value = text;
	textArea.readOnly = true;
	textArea.setAttribute("aria-hidden", "true");
	textArea.style.position = "fixed";
	textArea.style.top = "0";
	textArea.style.left = "-9999px";
	textArea.style.opacity = "0";
	textArea.style.pointerEvents = "none";
	textArea.style.fontSize = "12pt";

	ownerDocument.body.appendChild(textArea);
	textArea.focus({ preventScroll: true });
	textArea.select();

	let copied = false;
	try {
		copied = ownerDocument.execCommand?.("copy") ?? false;
	} catch (error) {
		console.warn("Selection fallback write failed", error);
	} finally {
		textArea.remove();
		selection?.removeAllRanges();
		for (const range of selectedRanges) selection?.addRange(range);
		activeElement?.focus({ preventScroll: true });
	}

	return copied;
}

export async function writeTextToClipboard(
	text: string,
	ownerDocument: Document = document
): Promise<void> {
	const clipboard = ownerDocument.defaultView?.navigator.clipboard;
	if (clipboard?.writeText) {
		try {
			await clipboard.writeText(text);
			return;
		} catch (error) {
			console.warn("Clipboard API write failed, trying selection fallback", error);
		}
	}

	if (!copyUsingSelection(text, ownerDocument)) {
		throw new Error("Could not copy code block to the clipboard");
	}
}

export function initializeCodeCopyButtons(root: ParentNode): void {
	// Obsidian's event listeners are not part of serialized HTML, so exported
	// copy buttons need handlers attached again in the standalone webpage.
	const buttons = Array.from(
		root.querySelectorAll<HTMLButtonElement>(
			"pre > button.copy-code-button"
		)
	);

	for (const button of buttons) {
		if (initializedCopyButtons.has(button)) continue;
		initializedCopyButtons.add(button);

		button.addEventListener("click", async (event) => {
			event.preventDefault();
			event.stopPropagation();

			const code = button.parentElement?.querySelector("code");
			if (!code) return;

			try {
				await writeTextToClipboard(
					code.textContent ?? "",
					button.ownerDocument
				);
			} catch (error) {
				console.error("Failed to copy code block", error);
			}
		});
	}
}
