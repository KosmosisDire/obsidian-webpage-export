
export namespace HTMLGeneration
{

	export function makeHeadingsTrees(html: HTMLElement)
	{
		// make headers into format:
		/*
		- .heading-wrapper
			- h1.heading
				- .heading-before
				- .heading-collapse-indicator.collapse-indicator.collapse-icon
				- "Text"
				- .heading-after
			- .heading-children
		*/

		function getHeaderEl(headingContainer: HTMLDivElement)
		{
			let first = headingContainer.firstElementChild;
			if (first && /[Hh][1-6]/g.test(first.tagName)) return first;
			else return;
		}
		
		function makeHeaderTree(headerDiv: HTMLDivElement, childrenContainer: HTMLElement)
		{
			let headerEl = getHeaderEl(headerDiv);

			if (!headerEl) return;

			let possibleChild = headerDiv.nextElementSibling;

			while (possibleChild != null)
			{
				let possibleChildHeader = getHeaderEl(possibleChild as HTMLDivElement);

				if(possibleChildHeader)
				{
					// if header is a sibling of this header then break
					if (possibleChildHeader.tagName <= headerEl.tagName)
					{
						break;
					}

					// if we reached the footer then break
					if (possibleChildHeader.querySelector(":has(section.footnotes)") || possibleChildHeader.classList.contains("mod-footer"))
					{
						break;
					}
				}

				let nextEl = possibleChild.nextElementSibling;
				childrenContainer.appendChild(possibleChild);
				possibleChild = nextEl;
			}
		}

		const arrowHTML = "<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' class='svg-icon right-triangle'><path d='M3 8L12 17L21 8'></path></svg>";

		html.querySelectorAll("div:has(> :is(h1, h2, h3, h4, h5, h6)):not(.markdown-preview-sizer)").forEach(function (header: HTMLDivElement)
		{
			header.classList.add("heading-wrapper");

			let hEl = getHeaderEl(header) as HTMLHeadingElement;

			if (!hEl || hEl.classList.contains("heading")) return;

			hEl.classList.add("heading");

			let collapseIcon = hEl.querySelector(".heading-collapse-indicator");
			if (!collapseIcon)
			{
				collapseIcon = hEl.createDiv({ cls: "heading-collapse-indicator collapse-indicator collapse-icon" });
				collapseIcon.innerHTML = arrowHTML;
				hEl.prepend(collapseIcon);
			}

			if (!hEl.querySelector(".heading-after")) 
			{
				let afterEl = hEl.createDiv({ cls: "heading-after" });
				afterEl.textContent = "...";
			}

			// the before element is for future styling
			if (!hEl.querySelector(".heading-before")) 
			{
				let beforeEl = hEl.createDiv({ cls: "heading-before" });
				hEl.prepend(beforeEl);
				beforeEl.textContent = "";
			}

			let children = header.createDiv({ cls: "heading-children" });

			makeHeaderTree(header, children);
		});

		// remove collapsible arrows from h1 and inline titles
		html.querySelectorAll("div h1, div .inline-title").forEach((element) =>
		{
			element.querySelector(".heading-collapse-indicator")?.remove();
		});

		html.querySelectorAll(".callout[data-callout]").forEach(element => {
		    var calloutType = element.getAttribute("data-callout");
		    switch(calloutType){
		        case "info":
		            element.querySelector(".callout-icon").innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#007bff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-info"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
		            break;
		        case "warning":
		        case "caution":
		        case "attention":
		            element.querySelector(".callout-icon").innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-alert-triangle"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
		            break;
		        case "example":
		            element.querySelector(".callout-icon").innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-list"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>';
		            break;
		        case "tip":
		        case "hint":
		        case "important":
		            element.querySelector(".callout-icon").innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-flame"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>';
		            break;
		        case "bug":
		            element.querySelector(".callout-icon").innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-bug"><rect x="8" y="6" width="8" height="14" rx="4"></rect><path d="m19 7-3 2"></path><path d="m5 7 3 2"></path><path d="m19 19-3-2"></path><path d="m5 19 3-2"></path><path d="M20 13h-4"></path><path d="M4 13h4"></path><path d="m10 4 1 2"></path><path d="m14 4-1 2"></path></svg>';
		            break;
		        case "abstract":
		        case "summary":
		        case "tldr":
		            element.querySelector(".callout-icon").innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-clipboard-list"><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><path d="M12 11h4"></path><path d="M12 16h4"></path><path d="M8 11h.01"></path><path d="M8 16h.01"></path></svg>';
		            break;
		        case "todo":
		            element.querySelector(".callout-icon").innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-check-circle-2"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path><path d="m9 12 2 2 4-4"></path></svg>';
		            break;
		        case "success":
		        case "check":
		        case "done":
		            element.querySelector(".callout-icon").innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-check"><polyline points="20 6 9 17 4 12"></polyline></svg>';
		            break;
		        case "question":
		        case "help":
		        case "faq":
		            element.querySelector(".callout-icon").innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-help-circle"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
		            break;
		        case "failure":
		        case "fail":
		        case "missing":
		            element.querySelector(".callout-icon").innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-x"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
		            break;
		        case "danger":
		        case "error":
		            element.querySelector(".callout-icon").innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-zap"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>';
		            break;
		        case "cite":
		        case "quote":
		            element.querySelector(".callout-icon").innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-quote"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"></path><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"></path></svg>';
		            break;
		        case "note":
		        default:
		            element.querySelector(".callout-icon").innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-pencil"><line x1="18" y1="2" x2="22" y2="6"></line><path d="M7.5 20.5 19 9l-4-4L3.5 16.5 2 22z"></path></svg>';
		            break;
		    }
		});

		// remove all new lines from header elements which cause spacing issues
		html.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((el) => el.innerHTML = el.innerHTML.replaceAll("\n", ""));
	}

	export function createThemeToggle(container: HTMLElement) : HTMLElement
	{
		let toggle = container.createDiv();
		let label = toggle.createEl("label");
		let input = label.createEl("input");
		let div = label.createDiv();

		label.classList.add("theme-toggle-container");
		label.setAttribute("for", "theme_toggle");

		input.classList.add("theme-toggle-input");
		input.setAttribute("type", "checkbox");
		input.setAttribute("id", "theme_toggle");

		div.classList.add("toggle-background");

		return toggle;
	}
	
}
