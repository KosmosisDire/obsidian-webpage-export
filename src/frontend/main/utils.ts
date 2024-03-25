
export function getTextNodes(element: Element) 
{
	const textNodes = [];
	const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);

	let node;
	while (node = walker.nextNode()) {
		textNodes.push(node);
	}

	return textNodes;
}

export function slideUp(target: HTMLElement, duration: number = 500)
{
	if (target.style.display === 'none') return;
	target.style.transitionProperty = 'height, margin, padding';
	target.style.transitionDuration = duration + 'ms';
	target.style.boxSizing = 'border-box';
	target.style.height = target.offsetHeight + 'px';
	target.offsetHeight;
	target.style.overflow = 'hidden';
	target.style.height = "0";
	target.style.paddingTop = "0";
	target.style.paddingBottom = "0";
	target.style.marginTop = "0";
	target.style.marginBottom = "0";
	window.setTimeout(async () => {
			target.style.display = 'none';
			target.style.removeProperty('height');
			target.style.removeProperty('padding-top');
			target.style.removeProperty('padding-bottom');
			target.style.removeProperty('margin-top');
			target.style.removeProperty('margin-bottom');
			target.style.removeProperty('overflow');
			target.style.removeProperty('transition-duration');
			target.style.removeProperty('transition-property');
	}, duration);
}

export function slideUpAll(targets: HTMLElement[], duration: number = 500)
{
	targets.forEach(async target => {
		if (!target) return;
		target.style.transitionProperty = 'height, margin, padding';
		target.style.transitionDuration = duration + 'ms';
		target.style.boxSizing = 'border-box';
		target.style.height = target.offsetHeight + 'px';
		target.offsetHeight;
		target.style.overflow = 'hidden';
		target.style.height = "0;"
		target.style.paddingTop = "0";
		target.style.paddingBottom = "0";
		target.style.marginTop = "0";
		target.style.marginBottom = "0";
	});

	window.setTimeout(async () => {
		targets.forEach(async target => {
			if (!target) return;
			target.style.display = 'none';
			target.style.removeProperty('height');
			target.style.removeProperty('padding-top');
			target.style.removeProperty('padding-bottom');
			target.style.removeProperty('margin-top');
			target.style.removeProperty('margin-bottom');
			target.style.removeProperty('overflow');
			target.style.removeProperty('transition-duration');
			target.style.removeProperty('transition-property');
		});
	}, duration);
}

export function slideDown(target: HTMLElement, duration: number = 500)
{
	if (window.getComputedStyle(target).display !== 'none') return;
	target.style.removeProperty('display');
	let display = window.getComputedStyle(target).display;
	if (display === 'none') display = 'block';
	target.style.display = display;
	let height = target.offsetHeight;
	target.style.overflow = 'hidden';
	target.style.height = "0";
	target.style.paddingTop = "0";
	target.style.paddingBottom = "0";
	target.style.marginTop = "0";
	target.style.marginBottom = "0";
	target.offsetHeight;
	target.style.boxSizing = 'border-box';
	target.style.transitionProperty = "height, margin, padding";
	target.style.transitionDuration = duration + 'ms';
	target.style.height = height + 'px';
	target.style.removeProperty('padding-top');
	target.style.removeProperty('padding-bottom');
	target.style.removeProperty('margin-top');
	target.style.removeProperty('margin-bottom');
	window.setTimeout(async () => {
		target.style.removeProperty('height');
		target.style.removeProperty('overflow');
		target.style.removeProperty('transition-duration');
		target.style.removeProperty('transition-property');
	}, duration);
}

export function slideDownAll(targets: HTMLElement[], duration: number = 500)
{
	targets.forEach(async target => {
		if (!target) return;
		target.style.removeProperty('display');
		let display = window.getComputedStyle(target).display;
		if (display === 'none') display = 'block';
		target.style.display = display;
		let height = target.offsetHeight;
		target.style.overflow = 'hidden';
		target.style.height = "0";
		target.style.paddingTop = "0";
		target.style.paddingBottom = "0";
		target.style.marginTop = "0";
		target.style.marginBottom = "0";
		target.offsetHeight;
		target.style.boxSizing = 'border-box';
		target.style.transitionProperty = "height, margin, padding";
		target.style.transitionDuration = duration + 'ms';
		target.style.height = height + 'px';
		target.style.removeProperty('padding-top');
		target.style.removeProperty('padding-bottom');
		target.style.removeProperty('margin-top');
		target.style.removeProperty('margin-bottom');
	});

	window.setTimeout( async () => {
		targets.forEach(async target => {
			if (!target) return;
			target.style.removeProperty('height');
			target.style.removeProperty('overflow');
			target.style.removeProperty('transition-duration');
			target.style.removeProperty('transition-property');
		});
	}, duration);
}

export function slideToggle(target: HTMLElement, duration: number = 500)
{
	if (window.getComputedStyle(target).display === 'none') 
	{
		return slideDown(target, duration);
	} else 
	{
		return slideUp(target, duration);
	}
}

export function slideToggleAll(targets: HTMLElement[], duration: number = 500)
{
	if (window.getComputedStyle(targets[0]).display === 'none') 
	{
		return slideDownAll(targets, duration);
	} else 
	{
		return slideUpAll(targets, duration);
	}
}
