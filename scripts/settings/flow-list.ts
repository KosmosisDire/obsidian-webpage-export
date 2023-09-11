

export class FlowList {
	containerEl: HTMLElement;
	flowListEl: HTMLElement;
	checkedList: string[] = [];

	constructor(containerEl: HTMLElement) {
		this.containerEl = containerEl;
		this.flowListEl = this.containerEl.createDiv({ cls: 'flow-list' });

	}

	addItem(name: string, key: string, value: boolean, onChange: (value: boolean) => void): HTMLElement {
		let item = this.flowListEl.createDiv({ cls: 'flow-item' });
		let checkbox = item.createEl('input', { type: 'checkbox' });
		checkbox.checked = value;
		if (checkbox.checked) this.checkedList.push(key)

		checkbox.addEventListener('change', (evt) => {
			if (checkbox.checked) {
				if (!this.checkedList.includes(key))
					this.checkedList.push(key)
			}
			else {
				if (this.checkedList.includes(key))
					this.checkedList.remove(key)
			}
		});

		checkbox.addEventListener('change', (evt) => onChange(checkbox.checked));


		let label = item.createDiv({ cls: 'flow-label' });
		label.setText(name);

		return item;
	}

}
