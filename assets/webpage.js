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
		document.querySelector(".outline-container").innerHTML = doc.querySelector(".outline-container").innerHTML;
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

		document.querySelector(".outline-container").innerHTML = "";

		document.title = "Page Not Found";

		if(pushHistory) window.history.pushState({ path: window.location.pathname }, '', window.location.pathname);
	}

	initializePage();

	return doc;
}

//#region Initialization

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

    $(".toggle__input").on("click tap", function()
    {
		setThemeToggle(!(localStorage.getItem("theme_toggle") == "true"));
    });

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => 
	{
		// return if we are printing
		if (window.matchMedia('print').matches)
		{
			printing = true;
			return;
		}

        let newColorScheme = event.matches ? "theme-dark" : "theme-light";

		if (newColorScheme == lastScheme) return;

        if (newColorScheme == "theme-dark")
        {
			setThemeToggle(false);
        }

        if (newColorScheme == "theme-light")
        {
			setThemeToggle(true);
        }

		lastScheme = newColorScheme;
    });
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

    $(".heading-collapse-indicator").on("click tap", function()
    {
        var isCollapsed = $(this).parent().parent().hasClass("is-collapsed");
		setHeaderCollapse($(this).parent().parent(), !isCollapsed);
    });

	// unfold header when an internal link that points to that header is clicked
	$(".internal-link").on("click tap", function()
	{
		let target = $(this).attr("href");

		// if the target is a header uncollapse it
		if (target.startsWith("#"))
		{
			let header = $(document.getElementById(target.substring(1)));

			setHeaderCollapse($(header).parent(), false);
		}

	});
}

function setupOutline() 
{
	// MAKE OUTLINE COLLAPSIBLE
    // if "outline-header" is clicked, toggle the display of every div until the next heading of the same or lower level
	function setOutlineCollapse(header, collapse)
	{
		if (collapse)
		{
			if (!$(header).hasClass("is-collapsed")) 
				$(header).addClass("is-collapsed");

			$(header).children(".outline-item-children").slideUp(120);
		}
		else
		{
			if ($(header).hasClass("is-collapsed"))
				$(header).removeClass("is-collapsed");
			
			$(header).children(".outline-item-children").slideDown(120);
		}
	}

	function toggleOutlineCollapse(header)
	{
		let isCollapsed = $(header).hasClass("is-collapsed");
		setOutlineCollapse(header, !isCollapsed);
	}

    $(".outline-item-contents > .collapse-icon").on("click tap", function(e)
    {
        toggleOutlineCollapse($(this).parent().parent());

		// Prevent the collapse button from triggering the parent <a> tag navigation.
		// fix implented by 'zombony' from GitHub
		return false;
    });

	$(".collapse-all").on("click tap", function()
	{
		let button = $(this);
		$(".outline-container div.outline-item").each(function()
		{
			setOutlineCollapse($(this), !button.hasClass("is-collapsed"));
		});

		button.toggleClass("is-collapsed");

		button.find("iconify-icon").attr("icon", button.hasClass("is-collapsed") ? "ph:arrows-out-line-horizontal-bold" : "ph:arrows-in-line-horizontal-bold");
	});

    // hide the control button if the header has no children
    $(".outline-item-children:not(:has(*))").each(function()
    {
        $(this).parent().find(".collapse-icon").hide();
    });
}

function setupCallouts()
{
	// MAKE CALLOUTS COLLAPSIBLE
    // if the callout title is clicked, toggle the display of .callout-content
    $(".callout.is-collapsible .callout-title").on("click tap", function()
    {
        var isCollapsed = $(this).parent().hasClass("is-collapsed");

        if (isCollapsed)
        {
            $(this).parent().toggleClass("is-collapsed");
        }

        $(this).parent().find(".callout-content").slideToggle(duration = 100, complete = function()
        {
            if (!isCollapsed)
            {
                $(this).parent().toggleClass("is-collapsed");
            }
        });
    });
}

function setupCheckboxes()
{
	// Fix checkboxed toggling .is-checked
	$(".task-list-item-checkbox").on("click tap", function()
	{
		$(this).parent().toggleClass("is-checked");
		$(this).parent().attr("data-task", $(this).parent().hasClass("is-checked") ? "x" : " ");
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
	$(".canvas-node-content-blocker").on("click tap", function()
	{
		$(this).parent().parent().toggleClass("is-focused");
		$(this).hide();

		if (focusedNode)
		{
			focusedNode.removeClass("is-focused");
			$(focusedNode).find(".canvas-node-content-blocker").show();
		}

		focusedNode = $(this).parent().parent();
	});

	// make canvas node deselect when clicking outside
	$(document).on("click tap", function(event)
	{
		if (!$(event.target).closest(".canvas-node").length)
		{
			$(".canvas-node").removeClass("is-focused");
			$(".canvas-node-content-blocker").show();
		}
	});
}

function setupCodeblocks()
{
	// make code snippet block copy button copy the code to the clipboard
	$(".copy-code-button").on("click tap", function()
	{
		let code = $(this).parent().find("code").text();
		navigator.clipboard.writeText(code);
		$(this).text("Copied!");
		// set a timeout to change the text back
		setTimeout(function()
		{
			$(".copy-code-button").text("Copy");
		}, 2000);
	});
}

function setupLinks()
{
	$(".internal-link, .footnote-link").on("click tap", function()
	{
		let target = $(this).attr("href");

		// this is linking to a different page
		if (!target.startsWith("#"))
		{
			console.log("Loading document: " + target);
			// if the target is not a header, load the page
			loadDocument(target);

			// make sure link doesn't redirect
			return false;
		}
		else
		{
			document.getElementById(target.substring(1)).scrollIntoView();
			return false;
		}
	});

    window.onpopstate = function(event)
    {
		loadDocument(window.location.pathname, false);
    }
}

function initializePage()
{
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
	// remove all event listeners
	$(".toggle__input").off("click tap");
	$(".callout.is-collapsible .callout-title").off("click tap");
	$(".heading-collapse-indicator").off("click tap");
	$(".outline-item-contents > .collapse-icon").off("click tap");
	$(".collapse-all").off("click tap");
	$(".task-list-item-checkbox").off("click tap");
	$(".copy-code-button").off("click tap");
	$(".canvas-node-content-blocker").off("click tap");
	$("center-content").find("*").off("click tap");
}

//#endregion

jQuery(initializePage);