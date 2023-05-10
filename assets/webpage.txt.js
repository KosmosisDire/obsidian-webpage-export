async function loadDocument(url, pushHistory = true)
{
	let response;
	try
	{
		response = await fetch(url);
	}
	catch (error)
	{
		console.log("Cannot use fetch API (likely due to CORS), just loading the page normally.");
		window.location.assign(url);
		return;
	}
	
	let doc = document.implementation.createHTMLDocument();

	deinitializePage();

	if (response.ok)
	{
		let html = (await response.text()).replaceAll("<!DOCTYPE html>", "").replaceAll("<html>", "").replaceAll("</html>", "");
		doc.documentElement.innerHTML = html;

		document.querySelector(".center-content").innerHTML = doc.querySelector(".center-content").innerHTML;
		document.querySelector(".outline-tree").innerHTML = doc.querySelector(".outline-tree").innerHTML;
		document.title = doc.title;

		let pathsCode = doc.querySelector("#relative-paths").textContent;
		// get a list of strings contained inside of ""
		let paths = pathsCode.match(/"(.*?)"/g).map(function (val) { return val.replace(/"/g, ""); });
		rootPath = paths[0];
		mediaPath = paths[1];
		jsPath = paths[2];
		cssPath = paths[3];

		let splitURL = url.split("#");
		let pathnameTarget = splitURL[0] ?? url;
		let headingTarget = splitURL.length > 1 ? splitURL[1] : null;

		// if the url has a heading, scroll to it
		if (headingTarget) document.getElementById(headingTarget).scrollIntoView();

		if(pushHistory) window.history.pushState({ path: pathnameTarget }, '', pathnameTarget);
	}
	else
	{
		// if the page is not able to load instead add a header saying the page doesn't exist
		document.querySelector(".markdown-preview-view").innerHTML = 
		`
		<div>
			<center style='position: relative; transform: translateY(20vh); width: 100%; text-align: center;'>
				<h1 style>Page Not Found</h1>
			</center>
		</div>
		`;

		document.querySelector(".tree-container").innerHTML = "";

		document.title = "Page Not Found";

		if(pushHistory) window.history.pushState({ path: window.location.pathname }, '', window.location.pathname);
	}

	initializePage();

	return doc;
}

//#region Initialization

elementsWithEventListeners = [];

function setupThemeToggle()
{
	console.log("Setting up theme toggle");

	if (localStorage.getItem("theme_toggle") != null)
    {
        setThemeToggle(localStorage.getItem("theme_toggle") == "true");
    }

	var lastScheme = "theme-dark";
	// change theme to match current system theme
	if (localStorage.getItem("theme_toggle") == null && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches)
	{
		setThemeToggle(true);
		lastScheme = "theme-light";
	}
	if (localStorage.getItem("theme_toggle") == null && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
	{
		setThemeToggle(true);
		lastScheme = "theme-dark";
	}

	// set initial toggle state based on body theme class
	if ($("body").hasClass("theme-light"))
	{
		setThemeToggle(true);
	}
	else
	{
		setThemeToggle(false);
	}

	function setThemeToggle(state, instant = false)
	{
		$(".toggle__input").each(function()
		{
			$(this).prop("checked", state);
		});

		if(!$(".toggle__input").hasClass("is-checked") && state)
		{
			$(".toggle__input").addClass("is-checked");
		}
		else if ($(".toggle__input").hasClass("is-checked") && !state)
		{
			$(".toggle__input").removeClass("is-checked");
		}

		if(!state)
		{
			if ($("body").hasClass("theme-light"))
			{
				$("body").removeClass("theme-light");
			}

			if (!$("body").hasClass("theme-dark"))
			{
				$("body").addClass("theme-dark");
			}
		}
		else
		{
			if ($("body").hasClass("theme-dark"))
			{
				$("body").removeClass("theme-dark");
			}

			if (!$("body").hasClass("theme-light"))
			{
				$("body").addClass("theme-light");
			}
		}

		localStorage.setItem("theme_toggle", state ? "true" : "false");
	}

    document.querySelectorAll(".toggle__input").forEach(function(element)
	{
		element.addEventListener("change", function()
		{
			setThemeToggle(!(localStorage.getItem("theme_toggle") == "true"));
		});

		elementsWithEventListeners.push(element);
	});

    // window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => 
	// {
	// 	// return if we are printing
	// 	if (window.matchMedia('print').matches)
	// 	{
	// 		printing = true;
	// 		return;
	// 	}

    //     let newColorScheme = event.matches ? "theme-dark" : "theme-light";

	// 	if (newColorScheme == lastScheme) return;

    //     if (newColorScheme == "theme-dark")
    //     {
	// 		setThemeToggle(false);
    //     }

    //     if (newColorScheme == "theme-light")
    //     {
	// 		setThemeToggle(true);
    //     }

	// 	lastScheme = newColorScheme;
    // });

}

function setupHeaders()
{
    // MAKE HEADERS COLLAPSIBLE
    // if "heading-collapse-indicator" is clicked, toggle the display of every div until the next heading of the same or lower level
    function getHeadingContentsSelector(header)
    {
        let headingLevel = $(header).children().first().prop("tagName").toLowerCase();
        let headingNumber = parseInt(headingLevel.replace("h", ""));

        let endingHeadings = [1, 2, 3, 4, 5, 6].filter(function(item)
        {
            return item <= headingNumber;
        }).map(function(item)
        {
            return `div:has(h${item})`;
        });

        let endingHeadingsSelector = endingHeadings.join(", ");

        return endingHeadingsSelector;
    }

	function setHeaderCollapse(header, collapse)
	{
		let selector = getHeadingContentsSelector($(header));

        if(!collapse)
        {
			if ($(header).hasClass("is-collapsed")) $(header).toggleClass("is-collapsed");

            $(header).nextUntil(selector).show();
			
			// close headers inside of this one that are collapsed
            $(header).nextUntil(selector).each(function()
            {
				if($(this).hasClass("is-collapsed"))
					setHeaderCollapse($(this), true);
            });
			
			//open headers above this one that are collapsed
			lastHeaderSize = $(header).children().first().prop("tagName").toLowerCase().replace("h", "");
			$(header).prevAll().each(function()
			{
				if($(this).hasClass("is-collapsed") && $(this).has("h1, h2, h3, h4, h5, h6"))
				{
					let hSize = $(this).children().first().prop("tagName").toLowerCase().replace("h", "");
					if(hSize < lastHeaderSize)
					{
						setHeaderCollapse($(this), false);
						lastHeaderSize = hSize;
					}
				}
			});
        }
        else
        {
			if (!$(header).hasClass("is-collapsed")) $(header).toggleClass("is-collapsed");
            $(header).nextUntil(selector).hide();
        }
	}

	document.querySelectorAll(".heading-collapse-indicator").forEach(function (element) 
	{
		element.addEventListener("click", function () 
		{
			var isCollapsed = this.parentElement.parentElement.classList.contains("is-collapsed");
			setHeaderCollapse(this.parentElement.parentElement, !isCollapsed);
		});

		elementsWithEventListeners.push(element);
	});

	// unfold header when an internal link that points to that header is clicked
	document.querySelectorAll(".internal-link").forEach(function (element) 
	{
		element.addEventListener("click", function (event) 
		{
			event.preventDefault();
			let target = this.getAttribute("href");

			// if the target is a header uncollapse it
			if (target.startsWith("#")) {
				let header = document.getElementById(target.substring(1));
				setHeaderCollapse(header.parentElement, false);
			}
		});

		elementsWithEventListeners.push(element);
	});
}

function setupOutline() 
{
	function setCollapsed(element, collapsed, animate = true)
	{
		let children = element.querySelector(".tree-item-children");

		if (collapsed)
		{
			element.classList.add("is-collapsed");
			if(animate) $(children).slideUp(100);
			else children.style.display = "none";
		}
		else
		{
			element.classList.remove("is-collapsed");
			if(animate) $(children).slideDown(100);
			else children.style.display = "flex";
		}
	}

	function toggleCollapsed(element)
	{
		console.log(element);
		if (!element) return;
		setCollapsed(element, !element.classList.contains("is-collapsed"));
	}

    document.querySelectorAll(".tree-item-contents > .collapse-icon").forEach(function(item)
	{
		item.addEventListener("click", function()
		{
			toggleCollapsed(item.parentElement.parentElement);
		});

		elementsWithEventListeners.push(item);
	});

	document.querySelectorAll(".tree-container > .tree-header > .collapse-tree-button").forEach(function(button)
	{
		button.addEventListener("click", function()
		{
			button.parentElement.parentElement.querySelectorAll(".tree-item").forEach(function(item)
			{
				setCollapsed(item, !button.classList.contains("is-collapsed"));
			});

			button.classList.toggle("is-collapsed");

			button.querySelector("iconify-icon").setAttribute("icon", button.classList.contains("is-collapsed") ? "ph:arrows-out-line-horizontal-bold" : "ph:arrows-in-line-horizontal-bold");
		});

		elementsWithEventListeners.push(button);
	});

	document.querySelectorAll(".tree-container .tree-item").forEach(function(item)
	{
		if (item.classList.contains("is-collapsed")) setCollapsed(item, true, false);
	});

	// make sure the icons match their starting collaped state
	$(".tree-container > .tree-header > .collapse-tree-button").each(function()
	{
		if ($(this).hasClass("is-collapsed"))
		{
			$(this).find("iconify-icon").attr("icon", "ph:arrows-out-line-horizontal-bold");
		}
		else
		{
			$(this).find("iconify-icon").attr("icon", "ph:arrows-in-line-horizontal-bold");
		}
	});
}

function setupCallouts()
{
	// MAKE CALLOUTS COLLAPSIBLE
    // if the callout title is clicked, toggle the display of .callout-content
	document.querySelectorAll(".callout.is-collapsible .callout-title").forEach(function (element) 
	{
		element.addEventListener("click", function () 
		{
			var parent = this.parentElement;
			var isCollapsed = parent.classList.contains("is-collapsed");

			if (isCollapsed) {
				parent.classList.toggle("is-collapsed");
			}

			$(parent).find(".callout-content").slideToggle(duration = 100, complete = function () {
				if (!isCollapsed) {
					parent.classList.toggle("is-collapsed");
				}
			});
		});

		elementsWithEventListeners.push(element);
	});

}

function setupCheckboxes()
{
	// Fix checkboxed toggling .is-checked
	document.querySelectorAll(".task-list-item-checkbox").forEach(function (element) 
	{
		element.addEventListener("click", function () 
		{
			var parent = this.parentElement;
			parent.classList.toggle("is-checked");
			parent.setAttribute("data-task", parent.classList.contains("is-checked") ? "x" : " ");
		});

		elementsWithEventListeners.push(element);
	});

	$(`.plugin-tasks-list-item input[type="checkbox"]`).each(function()
	{
		$(this).prop("checked", $(this).parent().hasClass("is-checked"));
	});

	$('.kanban-plugin__item.is-complete').each(function()
	{
		$(this).find('input[type="checkbox"]').prop("checked", true);
	});
}

function setupCanvas()
{
	let focusedNode = null;

	// make canvas nodes selectable
	document.querySelectorAll(".canvas-node-content-blocker").forEach(function (element) 
	{
		element.addEventListener("click", function () 
		{
			var parent = this.parentElement.parentElement;
			parent.classList.toggle("is-focused");
			this.style.display = "none";

			if (focusedNode) 
			{
				focusedNode.classList.remove("is-focused");
				focusedNode.querySelector(".canvas-node-content-blocker").style.display = "";
			}

			focusedNode = parent;
		});

		elementsWithEventListeners.push(element);
	});

	// make canvas node deselect when clicking outside
	// document.addEventListener("click", function (event) 
	// {
	// 	if (!event.target.closest(".canvas-node")) 
	// 	{
	// 		document.querySelectorAll(".canvas-node").forEach(function (node) 
	// 		{
	// 			node.classList.remove("is-focused");
	// 			node.querySelector(".canvas-node-content-blocker").style.display = "";
	// 		});
	// 	}
	// });

}

function setupCodeblocks()
{
	// make code snippet block copy button copy the code to the clipboard
	document.querySelectorAll(".copy-code-button").forEach(function (element) 
	{
		element.addEventListener("click", function () 
		{
			var code = this.parentElement.querySelector("code").textContent;
			navigator.clipboard.writeText(code);
			this.textContent = "Copied!";
			// set a timeout to change the text back
			setTimeout(function () 
			{
				document.querySelectorAll(".copy-code-button").forEach(function (button) 
				{
					button.textContent = "Copy";
				});
			}, 2000);
		});

		elementsWithEventListeners.push(element);
	});
}

function setupLinks()
{
	document.querySelectorAll(".internal-link, .footnote-link, .tree-item-link").forEach(function(link)
	{
		link.addEventListener("click", function(event)
		{
			let target = link.getAttribute("href");

			event.preventDefault();

			// this is linking to a different page
			if (!target.startsWith("#"))
			{
				if (link.classList.contains("tree-item-link"))
				{
					console.log("Loading document: " + target);
					target = rootPath + "/" + target;
					loadDocument(target);
					return;
				}

				console.log("Loading document: " + target);
				// if the target is not a header, load the page
				loadDocument(target);
				return;
			}
			else
			{
				console.log("Scrolling to: " + target);
				document.getElementById(target.substring(1)).scrollIntoView();
			}
		});

		elementsWithEventListeners.push(link);
	});

    window.onpopstate = function(event)
    {
		loadDocument(window.location.pathname, false);
    }
}

function initializePage()
{
	elementsWithEventListeners = [];

    setupThemeToggle();
    setupHeaders();
    setupOutline();
	setupCallouts();
	setupCheckboxes();
	setupCanvas();
	setupCodeblocks();
	setupLinks();
}

function deinitializePage()
{
	elementsWithEventListeners.forEach(function(element)
	{
		if(!element || !element.parentNode) return;
		let copy = element.cloneNode(true);
		element.parentNode.replaceChild(copy, element);
	});	

	elementsWithEventListeners = [];
}

//#endregion

jQuery(initializePage);