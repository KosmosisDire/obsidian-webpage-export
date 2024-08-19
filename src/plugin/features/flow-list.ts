import { FeatureGenerator } from "./feature-generator";


export class FlowList implements FeatureGenerator
{
	containerEl: HTMLElement;
	flowListEl: HTMLElement;
	checkedList: string[] = [];

	async generate(container?: HTMLElement): Promise<HTMLElement>
	{
		this.containerEl = container ?? document.body;
		this.flowListEl = this.containerEl.createDiv({ cls: 'flow-list' });
		return this.flowListEl;
	}

	addItem(name: string, key: string, value: boolean, onChange: (value: boolean) => void): HTMLElement {
		const item = this.flowListEl.createDiv({ cls: 'flow-item' });
		const checkbox = item.createEl('input', { type: 'checkbox' });
		checkbox.checked = value;
		if (checkbox.checked) this.checkedList.push(key)

		item.addEventListener('click', (evt) => 
		{
			if (!checkbox.checked) 
			{
				checkbox.checked = true;
				if (!this.checkedList.includes(key))
					this.checkedList.push(key)
			}
			else 
			{
				checkbox.checked = false;
				if (this.checkedList.includes(key))
					this.checkedList.remove(key)
			}

			onChange(checkbox.checked);
		});

		// override the default checkbox behavior
		checkbox.onclick = (evt) =>
		{
			checkbox.checked = !checkbox.checked;
		}

		const label = item.createDiv({ cls: 'flow-label' });
		label.setText(name);

		return item;
	}

}
