//#region -----------------   Initializations   ----------------- 

let webpageContainer;
let documentContainer;
let viewContent;

let leftSidebar;
let rightSidebar;
let sidebarCollapseIcons;
let sidebarGutters;
let sidebars;
let sidebarTargetWidth;
let contentTargetWidth;

let themeToggle;

let canvasWrapper;
let canvas;
let canvasNodes;
let canvasBackground;
let canvasBackgroundPattern;
let focusedCanvasNode;

let loadingIcon;
let isOffline = false;

let collapseIconUp = ["m7 15 5 5 5-5", "m7 9 5-5 5 5"]; // path 1, path 2
let collapseIconDown = ["m7 20 5-5 5 5", "m7 4 5 5 5-5"]; // path 1, path 2

let isTouchDevice = isTouchCapable();

let documentType; // "markdown" | "canvas" | "embed" | "custom" | "none"
let embedType; // "img" | "video" | "audio" | "embed" | "none" 
let customType; // "kanban" | "excalidraw" | "none"
let deviceSize; // "large-screen" | "small screen" | "tablet" | "phone"

let fullyInitialized = false;

function initGlobalObjects()
{
	loadingIcon = document.createElement("div");
	loadingIcon.classList.add("loading-icon");
	document.body.appendChild(loadingIcon);
	loadingIcon.innerHTML = `<div></div><div></div><div></div><div></div>`;

	webpageContainer = document.querySelector(".webpage-container");
	documentContainer = document.querySelector(".document-container");
	leftSidebar = document.querySelector(".sidebar-left");
	rightSidebar = document.querySelector(".sidebar-right");

	sidebars = []
	sidebarGutters = []
	sidebarCollapseIcons = []
	if (leftSidebar && rightSidebar)
	{
		sidebarCollapseIcons = Array.from(document.querySelectorAll(".sidebar-collapse-icon"));
		sidebarGutters = [sidebarCollapseIcons[0].parentElement, sidebarCollapseIcons[1].parentElement];
		sidebars = [sidebarGutters[0].parentElement, sidebarGutters[1].parentElement];
	}

	themeToggle = document.querySelector(".theme-toggle-input");
}

async function initializePage()
{
	focusedCanvasNode = null;
	canvasWrapper = document.querySelector(".canvas-wrapper") ?? canvasWrapper;
	canvas = document.querySelector(".canvas") ?? canvas;

	let canvasNodesTemp = document.querySelectorAll(".canvas-node");
	canvasNodes = canvasNodesTemp.length > 0 ? canvasNodesTemp : canvasNodes;

	canvasBackground = document.querySelector(".canvas-background") ?? canvasBackground;
	canvasBackgroundPattern = document.querySelector(".canvas-background pattern") ?? canvasBackgroundPattern;
	viewContent = document.querySelector(".document-container > .view-content") ?? document.querySelector(".document-container > .markdown-preview-view") ?? viewContent;

	if(!fullyInitialized)
	{	
		initGlobalObjects();
		initializeDocumentTypes();
		setupSidebars();
		setupThemeToggle();

		sidebarTargetWidth = await getComputedPixelValue("--sidebar-width");
		contentTargetWidth = await getComputedPixelValue("--line-width") * 0.9;

		window.addEventListener('resize', () => onResize());
		onResize();
		document.body.classList.toggle("post-load", true);
		document.body.classList.toggle("loading", false);
		setTimeout(function() 
		{ 
			document.body.classList.toggle("loaded", true);
			document.body.classList.toggle("post-load", false); 
		}, 2000);

		fullyInitialized = true;
	}

	// hide the right sidebar when viewing specific file types
	if (rightSidebar && (embedType == "video" || embedType == "embed" || customType == "excalidraw" || customType == "kanban" || documentType == "canvas")) 
	{
		if(!rightSidebar.collapsed)
		{
			rightSidebar.temporaryCollapse();
		}
	}
	else
	{
		// if the right sidebar was temporarily collapsed and it is still collapsed, uncollapse it
		if (rightSidebar && rightSidebar.temporarilyCollapsed && rightSidebar.collapsed) 
		{
			rightSidebar.collapse(false);
			rightSidebar.temporarilyCollapsed = false;
		}
	}
}

function initializePageEvents(setupOnNode)
{
    setupHeaders(setupOnNode);
    setupTrees(setupOnNode);
	setupCallouts(setupOnNode);
	setupCheckboxes(setupOnNode);
	setupCanvas(setupOnNode);
	setupCodeblocks(setupOnNode);
	setupLinks(setupOnNode);
	setupScroll(setupOnNode);
}

function initializeDocumentTypes()
{
	if (document.querySelector(".document-container > .markdown-preview-view")) documentType = "markdown";
	else if (document.querySelector(".canvas-wrapper")) documentType = "canvas";
	else 
	{
		documentType = "custom";
		if (document.querySelector(".kanban-plugin")) customType = "kanban";
		else if (document.querySelector(".excalidraw-plugin")) customType = "excalidraw";
	}
}

function initializeForFileProtocol()
{
	let graphEl = document.querySelector(".graph-view-placeholder");
	if(graphEl)
	{
		console.log("Running locally, skipping graph view initialization and hiding graph.");
		graphEl.style.display = "none";
		graphEl.previousElementSibling.style.display = "none"; // hide the graph's header
	}
}

function onOffline(event)
{
	event.preventDefault();
	event.stopPropagation();
	console.log("Offline");
	isOffline = true;
}

window.onload = async function()
{
	if (window.location.protocol == "file:") initializeForFileProtocol();
	await initializePage();
	initializePageEvents(document);
}

window.addEventListener('offline', onOffline);

window.onpopstate = function(event)
{
	event.preventDefault();
	event.stopPropagation();

	if (document.body.classList.contains("floating-sidebars") && (!leftSidebar.collapsed || !rightSidebar.collapsed))
	{
		leftSidebar.collapse(true);
		rightSidebar.collapse(true);
		return;
	}

	loadDocument(getURLPath(), false);
}


//#endregion

//#region -----------------       Resize        -----------------

function onEndResize()
{
	document.body.classList.toggle("resizing", false);
}

function onStartResize()
{
	document.body.classList.toggle("resizing", true);
}

let lastScreenWidth = undefined;
let isResizing = false;
let checkStillResizingTimeout = undefined;
function onResize(isInitial = false)
{
	if (!isResizing)
	{
		onStartResize();
		isResizing = true;
	}

	function widthNowInRange(low, high)
	{
		let w = window.innerWidth;
		return (w > low && w < high && lastScreenWidth == undefined) || ((w > low && w < high) && (lastScreenWidth <= low || lastScreenWidth >= high));
	}

	function widthNowGreaterThan(value)
	{
		let w = window.innerWidth;
		return (w > value && lastScreenWidth == undefined) || (w > value && lastScreenWidth < value);
	}

	function widthNowLessThan(value)
	{
		let w = window.innerWidth;
		return (w < value && lastScreenWidth == undefined) || (w < value && lastScreenWidth > value);
	}

	if (widthNowGreaterThan(contentTargetWidth + sidebarTargetWidth * 2))
	{
		deviceSize = "large-screen";
		document.body.classList.toggle("floating-sidebars", false);
		document.body.classList.toggle("is-large-screen", true);
		document.body.classList.toggle("is-small-screen", false);
		document.body.classList.toggle("is-tablet", false);
		document.body.classList.toggle("is-phone", false);
		sidebars.forEach(function (sidebar) { sidebar.collapse(false) });
		
		if(document.body.classList.contains("sidebars-always-collapsible")) sidebarGutters.forEach(function (gutter) { gutter.collapse(false) });
		else sidebarGutters.forEach(function (gutter) { gutter.collapse(true) });

	}
	else if (widthNowInRange(contentTargetWidth + sidebarTargetWidth, contentTargetWidth + sidebarTargetWidth * 2))
	{
		deviceSize = "small screen";
		document.body.classList.toggle("floating-sidebars", false);
		document.body.classList.toggle("is-large-screen", false);
		document.body.classList.toggle("is-small-screen", true);
		document.body.classList.toggle("is-tablet", false);
		document.body.classList.toggle("is-phone", false);
		sidebarGutters.forEach(function (gutter) { gutter.collapse(false) });

		if (leftSidebar && rightSidebar && !leftSidebar.collapsed) 
		{
			rightSidebar.collapse(true);
		}
	}
	else if (widthNowInRange(sidebarTargetWidth * 1.5, contentTargetWidth + sidebarTargetWidth))
	{
		deviceSize = "tablet";
		document.body.classList.toggle("floating-sidebars", true);
		document.body.classList.toggle("is-large-screen", false);
		document.body.classList.toggle("is-small-screen", false);
		document.body.classList.toggle("is-tablet", true);
		document.body.classList.toggle("is-phone", false);
		sidebarGutters.forEach(function (gutter) { gutter.collapse(false) });
		
		if (leftSidebar && rightSidebar && !leftSidebar.collapsed) 
		{
			rightSidebar.collapse(true);
		}

		if(leftSidebar && !fullyInitialized) leftSidebar.collapse(true);
	}
	else if (widthNowLessThan(sidebarTargetWidth * 1.5))
	{
		deviceSize = "phone";
		document.body.classList.toggle("floating-sidebars", true);
		document.body.classList.toggle("is-large-screen", false);
		document.body.classList.toggle("is-small-screen", false);
		document.body.classList.toggle("is-tablet", false);
		document.body.classList.toggle("is-phone", true);
		sidebars.forEach(function (sidebar) { sidebar.collapse(true) });
		sidebarGutters.forEach(function (gutter) { gutter.collapse(false) });
	}

	lastScreenWidth = window.innerWidth;

	if (checkStillResizingTimeout != undefined) clearTimeout(checkStillResizingTimeout);

	// wait a little bit of time and if the width is still the same then we are done resizing
	let screenWidthSnapshot = window.innerWidth;
	checkStillResizingTimeout = setTimeout(function ()
	{
		if (window.innerWidth == screenWidthSnapshot)
		{
			checkStillResizingTimeout = undefined;
			isResizing = false;
			onEndResize();
		}
	}, 200);

}

// #endregion

//#region -----------------   Helper Functions  ----------------- 

function clamp(value, min, max)
{
	return Math.min(Math.max(value, min), max);
}

/**Gets the bounding rect of a given element*/
function getElBounds(El)
{
	let elRect = El.getBoundingClientRect();

	let x = elRect.x;
	let y = elRect.y;
	let width = elRect.width;
	let height = elRect.height;
	let centerX = elRect.x + elRect.width / 2;
	let centerY = elRect.y + elRect.height / 2;

	return { x: x, y: y, width: width, height: height, minX: x, minY: y, maxX: x + width, maxY: y + height, centerX: centerX, centerY: centerY };
}

async function getComputedPixelValue(variableName)
{
	const tempElement = document.createElement('div');
	document.body.appendChild(tempElement);
	tempElement.style.position = 'absolute';
	tempElement.style.width = `var(${variableName})`;

	await new Promise(resolve => setTimeout(resolve, 10));

	const computedWidth = window.getComputedStyle(tempElement).width;
	tempElement.remove();

	return parseFloat(computedWidth);
}

function getPointerPosition(event)
{
	let touches = event.touches ? Array.from(event.touches) : [];
	let x = touches.length > 0 ? (touches.reduce((acc, cur) => acc + cur.clientX, 0) / event.touches.length) : event.clientX;
	let y = touches.length > 0 ? (touches.reduce((acc, cur) => acc + cur.clientY, 0) / event.touches.length) : event.clientY;
	return {x: x, y: y};
}

function getTouchPosition(touch)
{
	return {x: touch.clientX, y: touch.clientY};
}

function getAllChildrenRecursive(element) 
{
	let children = [];

	for (let i = 0; i < element.children.length; i++) {
		const child = element.children[i];
		children.push(child);
		children = children.concat(getAllChildrenRecursive(child));
	}

	return children;
}

function isMobile() 
{
	let check = false;
	(function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator.userAgent||navigator.vendor||window.opera);
	return check;
}

function isTouchCapable() 
{
	return (('ontouchstart' in window) ||
	(navigator.maxTouchPoints > 0) ||
	(navigator.msMaxTouchPoints > 0));
}

function downloadBlob(blob, name = 'file.txt') {
    if (
      window.navigator && 
      window.navigator.msSaveOrOpenBlob
    ) return window.navigator.msSaveOrOpenBlob(blob);

    // For other browsers:
    // Create a link pointing to the ObjectURL containing the blob.
    const data = window.URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = data;
    link.download = name;

    // this is necessary as link.click() does not work on the latest firefox
    link.dispatchEvent(
      new MouseEvent('click', { 
        bubbles: true, 
        cancelable: true, 
        view: window 
      })
    );

    setTimeout(() => {
      // For Firefox it is necessary to delay revoking the ObjectURL
      window.URL.revokeObjectURL(data);
      link.remove();
    }, 100);
}

function extentionToTag(extention)
{
	if (["png", "jpg", "jpeg", "svg", "gif", "bmp", "ico"].includes(extention)) return "img";
	if (["mp4", "mov", "avi", "webm", "mpeg"].includes(extention)) return "video";
	if (["mp3", "wav", "ogg", "aac"].includes(extention)) return "audio";
	if (["pdf"].includes(extention)) return "embed";
	return;
}


let slideUp = (target, duration=500) => {

	target.style.transitionProperty = 'height, margin, padding';
	target.style.transitionDuration = duration + 'ms';
	target.style.boxSizing = 'border-box';
	target.style.height = target.offsetHeight + 'px';
	target.offsetHeight;
	target.style.overflow = 'hidden';
	target.style.height = 0;
	target.style.paddingTop = 0;
	target.style.paddingBottom = 0;
	target.style.marginTop = 0;
	target.style.marginBottom = 0;
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

let slideUpAll = (targets, duration=500) => {

	targets.forEach(async target => {
		target.style.transitionProperty = 'height, margin, padding';
		target.style.transitionDuration = duration + 'ms';
		target.style.boxSizing = 'border-box';
		target.style.height = target.offsetHeight + 'px';
		target.offsetHeight;
		target.style.overflow = 'hidden';
		target.style.height = 0;
		target.style.paddingTop = 0;
		target.style.paddingBottom = 0;
		target.style.marginTop = 0;
		target.style.marginBottom = 0;
	});

	window.setTimeout(async () => {
		targets.forEach(async target => {
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

let slideDown = (target, duration=500) => {

	target.style.removeProperty('display');
	let display = window.getComputedStyle(target).display;
	if (display === 'none') display = 'block';
	target.style.display = display;
	let height = target.offsetHeight;
	target.style.overflow = 'hidden';
	target.style.height = 0;
	target.style.paddingTop = 0;
	target.style.paddingBottom = 0;
	target.style.marginTop = 0;
	target.style.marginBottom = 0;
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

let slideDownAll = (targets, duration=500) => {

	targets.forEach(async target => {
		target.style.removeProperty('display');
		let display = window.getComputedStyle(target).display;
		if (display === 'none') display = 'block';
		target.style.display = display;
		let height = target.offsetHeight;
		target.style.overflow = 'hidden';
		target.style.height = 0;
		target.style.paddingTop = 0;
		target.style.paddingBottom = 0;
		target.style.marginTop = 0;
		target.style.marginBottom = 0;
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
			target.style.removeProperty('height');
			target.style.removeProperty('overflow');
			target.style.removeProperty('transition-duration');
			target.style.removeProperty('transition-property');
		});
	}, duration);
}

var slideToggle = (target, duration = 500) => {
	if (window.getComputedStyle(target).display === 'none') {
		return slideDown(target, duration);
	} else {
		return slideUp(target, duration);
	}
}

var slideToggleAll = (targets, duration = 500) => {
	if (window.getComputedStyle(targets[0]).display === 'none') {
		return slideDownAll(targets, duration);
	} else {
		return slideUpAll(targets, duration);
	}
}


//#endregion

//#region -----------------   Loading & Paths   ----------------- 

let transferDocument = document.implementation.createHTMLDocument();

async function loadDocument(url, pushHistory = true, scrollTo = true)
{
	let splitURL = url.split("#");
	let pathnameTarget = splitURL[0] ?? url;
	console.log("Loading document: " + pathnameTarget);

	// display loading icon
	loadingIcon.classList.toggle("shown", true);
	let viewBounds = getViewBounds();
	loadingIcon.style.left = (viewBounds.centerX - loadingIcon.offsetWidth / 2) + "px";
	loadingIcon.style.top = (viewBounds.centerY - loadingIcon.offsetHeight / 2) + "px";

	// hide document container
	documentContainer.classList.toggle("hide", true);
	documentContainer.classList.toggle("show", false);

	// hide the left sidebar if on phone
	if (deviceSize == "phone") leftSidebar.collapse(true);

	if(isOffline)
	{
		setTimeout(function()
		{
			// if the page is offline instead add a header saying so
			viewContent.innerHTML = `
<center style='position: relative; transform: translateY(20vh); width: 100%; text-align: center;'>
	<h1>You appear to be offline. Check your internet connection and then try reloading the page.</h1>
</center>`;

			document.querySelector(".outline-tree").innerHTML = "";

			console.log("Page offline: " + getAbsoluteRootPath() + url);
			let newRootPath = getURLRootPath(getAbsoluteRootPath() + url);
			rootPath = newRootPath;
			document.querySelector("base").href = newRootPath;

			document.title = "Page Offline";

			// hide document container
			documentContainer.classList.toggle("hide", false);
			documentContainer.classList.toggle("show", true);
			loadingIcon.classList.toggle("shown", false);
		}, 1000);

		return;
	}

	let response;

	try
	{
		response = await fetch(pathnameTarget);
	}
	catch (error)
	{
		console.log("Cannot use fetch API (likely due to CORS), just loading the page normally.");
		window.location.assign(pathnameTarget);
		return;
	}

	if (response.ok)
	{
		// change the active file
		setActiveDocument(pathnameTarget, scrollTo, pushHistory);

		let extention = url.split(".").pop().split("?")[0].split("#")[0].toLowerCase().trim();

		documentType = "none";
		embedType = "none";
		customType = "none";

		if(extention == "html")
		{
			let html = (await response.text()).replaceAll("<!DOCTYPE html>", "").replaceAll("<html>", "").replaceAll("</html>", "");
			transferDocument.write(html);

			// copy document content and outline tree
			let newDocContainer = document.importNode(transferDocument.querySelector(".document-container"), true);
			documentContainer.remove();
			documentContainer = newDocContainer;

			// insert document as the second item under the webpage container
			webpageContainer.insertBefore(documentContainer, webpageContainer.children[1]);

			document.querySelector(".outline-tree").innerHTML = transferDocument.querySelector(".outline-tree").innerHTML;
		
			// if the url has a heading, scroll to it
			let headingTarget = splitURL.length > 1 ? splitURL[1] : null;
			if (headingTarget) document.getElementById(headingTarget).scrollIntoView();

			// Change the root path to match the match from the new page
			setupRootPath(transferDocument);

			// set document types
			initializeDocumentTypes();

			// initialize events on the new page, but wait for the page to finish loading
			setTimeout(function() 
			{
				initializePageEvents(documentContainer);
				initializePageEvents(document.querySelector(".outline-tree"));
			}, 0);

			document.title = transferDocument.title;
			transferDocument.close();
		}
		else
		{
			documentType = "embed";

			embedType = extentionToTag(extention);

			if(embedType != undefined)
			{
				let media = document.createElement(embedType);
				media.controls = true;
				media.src = url;
				
				media.style.maxWidth = "100%";
				if(embedType == "embed")
				{
					media.style.width = "100%";
					media.style.height = "100%";
				}
				
				media.style.objectFit = "contain";

				viewContent.innerHTML = "";
				viewContent.setAttribute("class", "view-content embed");
				viewContent.appendChild(media);

				document.querySelector(".outline-tree").innerHTML = "";

				document.title = url.split("/").pop();
			}
			else // just download the file
			{
				let blob = await response.blob();
				downloadBlob(blob, url.split("/").pop());
			}
		}

		await initializePage();
	}
	else
	{
		setTimeout(function()
		{
			// if the page is not able to load instead add a header saying the page doesn't exist
			viewContent.innerHTML = 
			`
			<div>
				<center style='position: relative; transform: translateY(20vh); width: 100%; text-align: center;'>
					<h1 style>Page Not Found</h1>
				</center>
			</div>
			`;

			document.querySelector(".outline-tree").innerHTML = "";

			console.log("Page not found: " + getAbsoluteRootPath() + url);
			let newRootPath = getURLRootPath(getAbsoluteRootPath() + url);
			rootPath = newRootPath;
			document.querySelector("base").href = newRootPath;

			document.title = "Page Not Found";
		}, 1000);
	}

	// hide loading icon
	loadingIcon.classList.toggle("shown", false);

	// show document container
	documentContainer.style.transitionDuration = "";
	documentContainer.classList.toggle("hide", false);
	documentContainer.classList.toggle("show", true);

	return transferDocument;
}


function setActiveDocument(url, scrollTo = true, pushHistory = true)
{
	let pathnameTarget = url.split("#")[0] ?? url; // path with no header

	// switch active file in file tree
	document.querySelector(".tree-item.mod-active")?.classList.remove("mod-active");
	let treeItems = Array.from(document.querySelectorAll(".tree-item > .tree-item-contents > .tree-item-link"));
	let treeItem = undefined;
	for (let item of treeItems) 
	{
		if (item.getAttribute("href") == decodeURI(url))
		{
			let parent = item.parentElement.parentElement;

			parent.classList.add("mod-active");
			treeItem = parent;
			
			while (parent.hasAttribute("data-depth"))
			{
				setTreeCollapsed(parent, false, false);
				parent = parent.parentElement.parentElement;
			}

			break;
		}
	}

	if(scrollTo) treeItem?.scrollIntoView({block: "center", inline: "nearest"});

	// set the active file in th graph view
	if(typeof nodes != 'undefined' && window.renderWorker)
	{
		let activeNode = nodes?.paths.findIndex(function(item) { return item.endsWith(pathnameTarget); }) ?? -1;
		
		if(activeNode >= 0) 
		{
			window.renderWorker.activeNode = activeNode;
		}
	}

	if(pushHistory && window.location.protocol != "file:") window.history.pushState({ path: pathnameTarget }, '', pathnameTarget);
}

function setupRootPath(fromDocument)
{
	let basePath = fromDocument.querySelector("#root-path").getAttribute("root-path");
	document.querySelector("base").href = basePath;
	document.querySelector("#root-path").setAttribute("root-path", basePath);
	rootPath = basePath;
}

function getAbsoluteRootPath()
{
	if (typeof rootPath == 'undefined') setupRootPath(document);
	return new URL(window.location.href + "/../" + rootPath).pathname;
}

function getURLPath(url = window.location.pathname)
{
	let absoluteRoot = getAbsoluteRootPath();
	let pathname = url.substring(absoluteRoot.length);
	return pathname;
}

function getURLRootPath(url = window.location.pathname)
{
	let path = getURLPath(url);
	let splitPath = path.split("/");
	let rootPath = "";
	for (let i = 0; i < splitPath.length - 1; i++)
	{
		rootPath += "../";
	}
	return rootPath;
}


//#endregion

//#region -----------------       Headers       ----------------- 

function setupHeaders(setupOnNode)
{
	setupOnNode.querySelectorAll(".heading-collapse-indicator").forEach(function (element) 
	{
		element.addEventListener("click", function () 
		{
			toggleTreeHeaderOpen(element.parentElement.parentElement, true);
		});
	});

	setupOnNode.querySelectorAll(".heading-wrapper").forEach(function (element)
	{
		element.collapsed = false;
		element.childrenContainer = element.querySelector(".heading-children");
		element.parentHeader = element.parentElement.parentElement;
		element.headerElement = element.querySelector(".heading");

		element.markdownPreviewSizer = getHeaderSizerEl(element);
		element.collapse = function (collapse, openParents = true, instant = false) { collapseHeader(element, collapse, openParents, instant) };
		element.toggleCollapse = function (openParents = true) { toggleTreeHeaderOpen(element, openParents) };
		element.hide = function () { hideHeader(element) };
		element.show = function (parents = false, children = false, forceStay = false) { showHeader(element, parents, children, forceStay) };
	});

	setupOnNode.querySelectorAll(".heading").forEach(function (element)
	{
		element.headingWrapper = element.parentElement;
	});
}

function isHeadingWrapper(headingWrapper)
{
	if (!headingWrapper) return false;
	return headingWrapper.classList.contains("heading-wrapper");
}

function getHeaderSizerEl(headingWrapper)
{
	// go up the tree until we find a markdown-preview-sizer
	let parent = headingWrapper;
	while (parent && !parent.classList.contains("markdown-preview-sizer")) parent = parent.parentElement;

	if (parent) return parent;
	else return;
}

async function collapseHeader(headingWrapper, collapse, openParents = true, instant = false)
{
	let collapseContainer = headingWrapper.childrenContainer;

	if (openParents && !collapse)
	{
		let parent = headingWrapper.parentHeader;
		if (isHeadingWrapper(parent)) parent.collapse(false, true, instant);
	}

	let needsChange = headingWrapper.classList.contains("is-collapsed") != collapse;
	if (!needsChange)
	{
		// if opening show the header
		if (!collapse && documentType == "canvas") headingWrapper.show(true);
		return;
	}


	if (headingWrapper.timeout) 
	{
		clearTimeout(headingWrapper.timeout);
		collapseContainer.style.transitionDuration = "";
		collapseContainer.style.height = "";
		headingWrapper.classList.toggle("is-animating", false);
	}


	if (collapse) 
	{
		headingWrapper.collapseHeight = collapseContainer.offsetHeight + parseFloat(collapseContainer.lastChild?.marginBottom || 0);

		// show all sibling headers after this one
		// this is so that when the header slides down you aren't left with a blank space
		let next = headingWrapper.nextElementSibling;
		while (next && documentType == "canvas")
		{
			let localNext = next;

			// force show the sibling header for 500ms while this one is collapsing
			if (isHeadingWrapper(localNext)) localNext.show(false, true, true);
			setTimeout(function()
			{
				localNext.forceShown = false;
			}, 500);

			next = next.nextElementSibling;
		}
	}

	let height = headingWrapper.collapseHeight;
	collapseContainer.style.height = height + "px";

	// if opening show the header
	if (!collapse && documentType == "canvas") headingWrapper.show(true);

	headingWrapper.collapsed = collapse;

	if (instant)
	{
		console.log("instant");
		collapseContainer.style.transitionDuration = "0s";
		headingWrapper.classList.toggle("is-collapsed", collapse);
		collapseContainer.style.height = "";
		collapseContainer.style.transitionDuration = "";

		let newTotalHeight = Array.from(headingWrapper.markdownPreviewSizer.children).reduce((acc, cur) => acc + cur.offsetHeight, 0);
		headingWrapper.markdownPreviewSizer.style.minHeight = newTotalHeight + "px";

		return;
	}

	// get the length of the height transition on heading container and wait for that time before not displaying the contents
	let transitionDuration = getComputedStyle(collapseContainer).transitionDuration;
	if (transitionDuration.endsWith("s")) transitionDuration = parseFloat(transitionDuration);
	else if (transitionDuration.endsWith("ms")) transitionDuration = parseFloat(transitionDuration) / 1000;
	else transitionDuration = 0;
	
	// multiply the duration by the height so that the transition is the same speed regardless of the height of the header
	let transitionDurationMod = Math.min(transitionDuration * Math.sqrt(height) / 16, 0.5); // longest transition is 0.5s
	collapseContainer.style.transitionDuration = `${transitionDurationMod}s`;


	if (collapse) collapseContainer.style.height = "0px";
	else collapseContainer.style.height = height + "px";
	headingWrapper.classList.toggle("is-animating", true);
	headingWrapper.classList.toggle("is-collapsed", collapse);
	

	setTimeout(function()
	{
		collapseContainer.style.transitionDuration = "";
		if(!collapse) collapseContainer.style.height = "";
		headingWrapper.classList.toggle("is-animating", false);

		let newTotalHeight = Array.from(headingWrapper.markdownPreviewSizer.children).reduce((acc, cur) => acc + cur.offsetHeight, 0);
		headingWrapper.markdownPreviewSizer.style.minHeight = newTotalHeight + "px";

	}, transitionDurationMod * 1000);
}

function toggleTreeHeaderOpen(headingWrapper, openParents = true)
{
	headingWrapper.collapse(!headingWrapper.collapsed, openParents);
}

/**Hides everything in a header and then makes the header div take up the same space as the header element */
function hideHeader(headingWrapper)
{
	if(headingWrapper.forceShown) return;
	if(headingWrapper.classList.contains("is-hidden") || headingWrapper.classList.contains("is-collapsed")) return;
	if(getComputedStyle(headingWrapper).display == "none") return;

	let height = headingWrapper.offsetHeight;
	headingWrapper.classList.toggle("is-hidden", true);
	if (height != 0) headingWrapper.style.height = height + "px";
	headingWrapper.style.visibility = "hidden";
}

/**Restores a hidden header back to it's normal function */
function showHeader(headingWrapper, showParents = true, showChildren = false, forceStayShown = false)
{
	if (forceStayShown) headingWrapper.forceShown = true;

	if (showParents)
	{
		let parent = headingWrapper.parentHeader;
		if (isHeadingWrapper(parent)) parent.show(true, false, forceStayShown);
	}

	if (showChildren)
	{
		let children = headingWrapper.querySelectorAll(".heading-wrapper");
		children.forEach(function(child) { child.show(false, true, forceStayShown); });
	}

	if(!headingWrapper.classList.contains("is-hidden") || headingWrapper.classList.contains("is-collapsed")) return;


	headingWrapper.classList.toggle("is-hidden", false);
	headingWrapper.style.height = "";
	headingWrapper.style.visibility = "";
}

//#endregion

//#region -----------------        Trees        ----------------- 

function setupTrees(setupOnNode) 
{
	const fileTreeItems = Array.from(setupOnNode.querySelectorAll(".tree-container.file-tree .tree-item"));
	const outlineTreeItems = Array.from(setupOnNode.querySelectorAll(".tree-container.outline-tree .tree-item"));

	setupOnNode.querySelectorAll(".tree-item-link > .collapse-icon").forEach(function(item)
	{
		item.addEventListener("click", function(event)
		{
			event.preventDefault();
			event.stopPropagation();
			toggleTreeCollapsed(item.parentElement.parentElement.parentElement);
			return false;
		});
	});

	setupOnNode.querySelectorAll(".collapse-tree-button").forEach(function(button)
	{
		button.treeRoot = button.parentElement.parentElement;
		button.icon = button.firstChild;
		button.icon.innerHTML = "<path d></path><path d></path>";

		let treeItems = button.treeRoot.classList.contains("file-tree") ? fileTreeItems : outlineTreeItems;

		button.setIcon = function(collapse)
		{
			button.icon.children[0].setAttribute("d", collapse ? collapseIconUp[0] : collapseIconDown[0]);
			button.icon.children[1].setAttribute("d", collapse ? collapseIconUp[1] : collapseIconDown[1]);
		}
		button.collapse = function(collapse) 
		{ 
			setTreeCollapsedAll(treeItems, collapse);
			button.setIcon(collapse);
			button.collapsed = collapse;
		};
		button.toggleCollapse = function() { button.collapse(!button.collapsed); };

		button.collapsed = button.treeRoot.querySelectorAll(".tree-scroll-area + .tree-item.mod-collapsible.is-collapsed") != 0;
		button.setIcon(button.collapsed);

		button.addEventListener("click", function(event)
		{
			event.preventDefault();
			event.stopPropagation();
			button.toggleCollapse();
			return false;
		});
	});

	fileTreeItems.forEach(function(treeItem)
	{
		let link = treeItem.querySelector(".tree-item-link");
		let icon = treeItem.querySelector(".collapse-icon");

		if(icon)
		{
			link?.addEventListener("click", function(event)
			{
				event.preventDefault();
				event.stopPropagation();
				let parent = this.parentElement?.parentElement;
				if (parent) 
				{
					toggleTreeCollapsed(parent);
				}
			});
		}
		else
		{
			let ext = link.getAttribute("href").split(".").pop();

			if (!ext.includes(" ") && ext != "html")
			{
				let tag = document.createElement("div");
				tag.classList.add("nav-file-tag");
				tag.textContent = ext.toUpperCase();
				treeItem.querySelector(".tree-item-contents").appendChild(tag);
			}
		}
	});
	
}

async function setTreeCollapsed(element, collapsed, animate = true)
{
	if (!element || !element.classList.contains("mod-collapsible")) return;

	let children = element.querySelector(".tree-item-children");

	if (collapsed)
	{
		element.classList.add("is-collapsed");
		if(animate) slideUp(children, 100);
		else children.style.display = "none";
	}
	else
	{
		element.classList.remove("is-collapsed");
		if(animate) slideDown(children, 100);
		else children.style.removeProperty("display");
	}
}

async function setTreeCollapsedAll(elements, collapsed, animate = true)
{
	let childrenList = [];
	elements.forEach(async element => 
	{
		if (!element || !element.classList.contains("mod-collapsible")) return;

		let children = element.querySelector(".tree-item-children");

		if (collapsed)
		{
			element.classList.add("is-collapsed");
		}
		else
		{
			element.classList.remove("is-collapsed");
		}

		childrenList.push(children);
	});

	if (collapsed)
	{
		if(animate) slideUpAll(childrenList, 100);
		else childrenList.forEach(async children => children.style.display = "none");
	}
	else
	{
		if(animate) slideDownAll(childrenList, 100);
		else childrenList.forEach(async children => children.style.removeProperty("display"));
	}
}

function toggleTreeCollapsed(element)
{
	if (!element) return;
	setTreeCollapsed(element, !element.classList.contains("is-collapsed"));
}

function toggleTreeCollapsedAll(elements)
{
	if (!elements) return;
	setTreeCollapsedAll(elements, !elements[0].classList.contains("is-collapsed"));
}

//#endregion

//#region -----------------        Canvas       ----------------- 


function setupCanvas(setupOnNode)
{
	if(documentType != "canvas" || !setupOnNode.querySelector(".canvas-wrapper")) return;

	// initialize canvas tranformations
	setupOnNode.querySelector(".canvas")?.setAttribute("style", "translate: 0px 1px; scale: 1;");

	let nodeBounds = getNodesBounds();
	setViewCenter(nodeBounds.centerX, nodeBounds.centerY);

	// let nodes be focused when hovered over
	setupOnNode.querySelectorAll(".canvas-node-container").forEach(function (element) 
	{
		var parent = element.parentElement;

		function onEnter(event)
		{
			parent.classList.toggle("is-focused");

			if (focusedCanvasNode != null && focusedCanvasNode != parent) 
			{
				focusedCanvasNode.classList.remove("is-focused");
				focusedCanvasNode.querySelector(".canvas-node-container").style.display = "";
			}

			focusedCanvasNode = parent;

			parent.addEventListener("mouseleave", onLeave);
			parent.addEventListener("touchend", onLeave);
		}

		function onLeave(event)
		{
			if (focusedCanvasNode)
			{
				focusedCanvasNode.classList.remove("is-focused");
				focusedCanvasNode = null;
			}

			parent.removeEventListener("mouseleave", onLeave);
			parent.removeEventListener("touchend", onLeave);
		}

		element.addEventListener("mouseenter", onEnter);
		element.addEventListener("touchstart", onEnter);
	});

	// make nodes fit to view when double clicked
	setupOnNode.querySelectorAll(".canvas-node").forEach(function (element)
	{
		element.addEventListener("dblclick", function (event)
		{
			fitViewToNode(element);
		});
	});

	// make whole canvas fit to view when double clicked on background
	setupOnNode.querySelectorAll(".canvas-background").forEach(function (element)
	{
		element.addEventListener("dblclick", function (event)
		{
			fitViewToCanvas();
		});
	});

	// make canvas draggable / panable
	canvasWrapper.addEventListener("mousedown", canvasWrapperMouseDownHandler);
	canvasWrapper.addEventListener("touchstart", canvasWrapperMouseDownHandler);
	function canvasWrapperMouseDownHandler(mouseDownEv)
	{
		let touchesDown = mouseDownEv.touches ?? [];

		// if there is already one tough down we don't want to start another mouse down event
		// extra fingers are already being handled in the move event below
		if (touchesDown.length > 1) return;

		if (mouseDownEv.button == 1 || mouseDownEv.button == 0 || touchesDown.length > 0)
		{
			let lastPointerPos = getPointerPosition(mouseDownEv);
			let startZoom = false;
			let lastDistance = 0;
			let lastTouchCount = touchesDown.length;

			let mouseMoveHandler = function (mouseMoveEv)
			{
				let touchesMove = mouseMoveEv.touches ?? [];

				let pointer = getPointerPosition(mouseMoveEv);

				if (lastTouchCount != touchesMove.length)
				{
					lastPointerPos = pointer;
					lastTouchCount = touchesMove.length;
				}

				let deltaX = pointer.x - lastPointerPos.x;
				let deltaY = pointer.y - lastPointerPos.y;

				let scrollInterferance = false;
				if ((mouseDownEv.button == 1 || touchesMove.length == 1) && focusedCanvasNode)
				{
					let mouseHoriz = Math.abs(deltaX) > Math.abs(deltaY * 1.5);
					let mouseVert = Math.abs(deltaY) > Math.abs(deltaX * 1.5);

					// only skip if the focused node can be scrolled in the direction of mouse movement
					let sizer = focusedCanvasNode.querySelector(".markdown-preview-sizer");
					if(sizer)
					{
						let scrollableVert = sizer.scrollHeight > sizer.parentElement.clientHeight + 1;
						let scrollableHoriz = sizer.scrollWidth > sizer.parentElement.clientWidth + 1;

						if ((mouseHoriz && scrollableHoriz) || (mouseVert && scrollableVert))
						{
							scrollInterferance = true;
						}
					}
				}

				if (!scrollInterferance)
				{
					translateCanvas(deltaX, deltaY);
					lastPointerPos = pointer;
				}

				if (touchesMove.length == 2)
				{
					let touchCenter = getPointerPosition(mouseMoveEv, false);
					let touch1 = getTouchPosition(mouseMoveEv.touches[0]);
					let touch2 = getTouchPosition(mouseMoveEv.touches[1]);
					let distance = Math.sqrt(Math.pow(touch1.x - touch2.x, 2) + Math.pow(touch1.y - touch2.y, 2));

					if (!startZoom)
					{
						startZoom = true;
						lastDistance = distance;
					}

					let distanceDelta = distance - lastDistance;
					let scaleDelta = distanceDelta / lastDistance;

					scaleCanvasAroundPoint(1 + scaleDelta, touchCenter.x, touchCenter.y);

					lastDistance = distance;
				}
			};

			let mouseUpHandler = function (mouseUpEv)
			{
				document.body.removeEventListener("mousemove", mouseMoveHandler);
				document.body.removeEventListener("mouseup", mouseUpHandler);
				document.body.removeEventListener("mouseenter", mouseEnterHandler);
				document.body.removeEventListener("touchmove", mouseMoveHandler);
				document.body.removeEventListener("touchend", mouseUpHandler);
				document.body.removeEventListener("touchcancel", mouseUpHandler);
			};

			let mouseEnterHandler = function (mouseEnterEv)
			{
				if (mouseEnterEv.buttons == 1 || mouseEnterEv.buttons == 4) return;

				mouseUpHandler(mouseEnterEv);
			}

			document.body.addEventListener("mousemove", mouseMoveHandler);
			document.body.addEventListener("mouseup", mouseUpHandler);
			document.body.addEventListener("mouseenter", mouseEnterHandler);
			document.body.addEventListener("touchmove", mouseMoveHandler);
			document.body.addEventListener("touchend", mouseUpHandler);
			document.body.addEventListener("touchcancel", mouseUpHandler);
		}
	}

	// get mouse position on the canvas
	let mouseX = 0;
	let mouseY = 0;
	canvasWrapper.addEventListener("mousemove", function (event)
	{
		let pointer = getPointerPosition(event);
		mouseX = pointer.x;
		mouseY = pointer.y;
	});

	let scale = 1;
	let speed = 0;
	let instant = false;
	// make canvas zoomable
	canvasWrapper.addEventListener("wheel", function (event)
	{
		if (focusedCanvasNode)
		{
			// only skip if the focused node can be scrolled
			let sizer = focusedCanvasNode.querySelector(".markdown-preview-sizer");
			if(sizer && sizer.scrollHeight > sizer.parentElement.clientHeight) return;
		}

		event.preventDefault();
		event.stopPropagation();

		if(instant)
		{
			let scale = 1;
			scale -= event.deltaY / 700 * scale;
			scale = clamp(scale, 0.1, 10);
			let viewBounds = getViewBounds();
			scaleCanvasAroundPoint(scale, viewBounds.centerX, viewBounds.centerY);
		}
		else
		{
			let isFirstFrame = speed == 0;
			speed -= (event.deltaY / 200);
			const maxSpeed = 0.14 * scale;
			speed = clamp(speed, -maxSpeed, maxSpeed);
			if (isFirstFrame) requestAnimationFrame(scrollAnimation);
		}
	});

	let dt = 0;
	let lastTime = 0;
	let averageDt = 0;
	function scrollAnimation(currentTime)
	{
		dt = currentTime - lastTime;
		if (lastTime == 0) dt = 30;
		lastTime = currentTime;

		averageDt = dt * 0.05 + averageDt * 0.95;

		if (averageDt > 50)
		{
			console.log("Scrolling too slow, turning on instant scroll");
			instant = true;
			return;
		}

		let oldScale = scale;
		scale += speed * (dt / 1000) * 30;
		scale = clamp(scale, 0.1, 10);

		let viewBounds = getViewBounds();
		scaleCanvasAroundPoint(scale / oldScale, mouseX, mouseY);

		speed *= 0.4;
		if (Math.abs(speed) < 0.01) 
		{
			speed = 0;
			lastTime = 0;
		}
		else requestAnimationFrame(scrollAnimation);
	}

	// fit all nodes to view on initialization after centering the camera
	fitViewToCanvas();
}

/**Gets the bounding rect of the voew-content or markdown-preview-sizer*/
function getViewBounds()
{
	let viewContentRect = viewContent.getBoundingClientRect();

	let minX = viewContentRect.x;
	let minY = viewContentRect.y;
	let maxX = viewContentRect.x + viewContentRect.width;
	let maxY = viewContentRect.y + viewContentRect.height;
	let centerX = viewContentRect.x + viewContentRect.width / 2;
	let centerY = viewContentRect.y + viewContentRect.height / 2;

	return { x: minX, y: minY, width: maxX - minX, height: maxY - minY, minX: minX, minY: minY, maxX: maxX, maxY: maxY, centerX: centerX, centerY: centerY };
}

/**Gets the bounding rect of all nodes in the canvas*/
function getNodesBounds()
{
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;

	canvasNodes.forEach(function (node)
	{
		let nodeRect = node.getBoundingClientRect();

		if (nodeRect.x < minX) minX = nodeRect.x;
		if (nodeRect.y < minY) minY = nodeRect.y;
		if (nodeRect.x + nodeRect.width > maxX) maxX = nodeRect.x + nodeRect.width;
		if (nodeRect.y + nodeRect.height > maxY) maxY = nodeRect.y + nodeRect.height;

	});

	let x = minX;
	let y = minY;
	let width = maxX - minX;
	let height = maxY - minY;
	let centerX = minX + width / 2;
	let centerY = minY + height / 2;

	return { x: x, y: y, width: width, height: height, minX: minX, minY: minY, maxX: maxX, maxY: maxY, centerX: centerX, centerY: centerY };
}

function getCanvasBounds()
{
	let canvasRect = canvas.getBoundingClientRect();

	let x = canvasRect.x;
	let y = canvasRect.y;
	let width = canvasRect.width;
	let height = canvasRect.height;
	let centerX = canvasRect.x + canvasRect.width / 2;
	let centerY = canvasRect.y + canvasRect.height / 2;

	return { x: x, y: y, width: width, height: height, minX: x, minY: y, maxX: x + width, maxY: y + height, centerX: centerX, centerY: centerY };
}

/**Sets the relative scale of the canvas around a point*/
function scaleCanvasAroundPoint(scaleBy, aroundPointX, aroundPointY)
{
	let canvasBounds = getCanvasBounds();

	let xCenterToTarget = aroundPointX - canvasBounds.x;
	let yCenterToTarget = aroundPointY - canvasBounds.y;

	let xCenterPin = canvasBounds.x + xCenterToTarget * scaleBy;
	let yCenterPin = canvasBounds.y + yCenterToTarget * scaleBy;

	let offsetX = aroundPointX - xCenterPin;
	let offsetY = aroundPointY - yCenterPin;

	scaleCanvas(scaleBy);
	translateCanvas(offsetX, offsetY);
	return { x: offsetX, y: offsetY };
}

/**Sets the relative scale of the canvas*/
function scaleCanvas(scaleBy)
{
	let newScale = Math.max(scaleBy * canvas.style.scale, 0.001);
	canvas.style.scale = newScale;
	canvasWrapper.style.setProperty("--zoom-multiplier", (1/(Math.sqrt(newScale))) );
}

/**Sets the relative translation of the canvas*/
function translateCanvas(x, y)
{
	let translate = canvas.style.translate;
	let split = translate.split(" ");
	let translateX = split.length > 0 ? parseFloat(translate.split(" ")[0].trim()) : 0;
	let translateY = split.length > 1 ? parseFloat(translate.split(" ")[1].trim()) : translateX;

	canvas.style.translate = `${translateX + x}px ${translateY + y}px`;
}

/**Sets the absolute center of the view*/
function setViewCenter(x, y)
{
	let viewContentRect = getViewBounds();
	let deltaX = viewContentRect.centerX - x;
	let deltaY = viewContentRect.centerY - y;

	translateCanvas(deltaX, deltaY);
}

function getCanvasTranslation()
{
	let translate = canvas.style.translate;
	let split = translate.split(" ");
	let translateX = split.length > 0 ? parseFloat(translate.split(" ")[0].trim()) : 0;
	let translateY = split.length > 1 ? parseFloat(translate.split(" ")[1].trim()) : translateX;

	return { x: translateX, y: translateY };
}

/**Sets the absolute scale of the canvas background pattern*/
function scaleCanvasBackground(scaleBy)
{
	let scaleX = scaleBy * canvasBackgroundPattern.getAttribute("width");
	let scaleY = scaleBy * canvasBackgroundPattern.getAttribute("height");

	canvasBackgroundPattern.setAttribute("width", scaleX);
	canvasBackgroundPattern.setAttribute("height", scaleY);
}

/**Sets the absolute translation of the canvas background pattern*/
function translateCanvasBackground(x, y)
{
	canvasBackgroundPattern.setAttribute("x", x + canvasBackgroundPattern.getAttribute("x"));
	canvasBackgroundPattern.setAttribute("y", y + canvasBackgroundPattern.getAttribute("y"));
}

/**Fits the view to contain the given node*/
function fitViewToNode(node)
{
	let nodeRect = getElBounds(node);
	let viewContentRect = getViewBounds();
	let canvasBounds = getCanvasBounds();

	let scale = 0.8 * Math.min(viewContentRect.width/nodeRect.width, viewContentRect.height/nodeRect.height);
	
	let canvasX = canvasBounds.x;
	let canvasY = canvasBounds.y;

	let canvToNodeX = (nodeRect.centerX - canvasX) * scale;
	let canvToNodeY = (nodeRect.centerY - canvasY) * scale;

	let newNodeX = canvasX + canvToNodeX;
	let newNodeY = canvasY + canvToNodeY;
	
	let deltaX = viewContentRect.centerX - newNodeX;
	let deltaY = viewContentRect.centerY - newNodeY;

	nodeRect = getElBounds(node);

	canvas.style.transition = "scale 0.5s cubic-bezier(0.5, -0.1, 0.5, 1.1), translate 0.5s cubic-bezier(0.5, -0.1, 0.5, 1.1)";
	scaleCanvas(scale);
	translateCanvas(deltaX, deltaY);

	setTimeout(function()
	{
		canvas.style.transition = "";
	}, 550);
}

/**Fits the view to contain all nodes in the graph*/
function fitViewToCanvas()
{
	let nodesRect = getNodesBounds();
	let viewContentRect = getViewBounds();
	let canvasBounds = getCanvasBounds();

	let scale = 0.8 * Math.min(viewContentRect.width/nodesRect.width, viewContentRect.height/nodesRect.height);

	let canvasX = canvasBounds.x;
	let canvasY = canvasBounds.y;

	let canvToNodeX = (nodesRect.centerX - canvasX) * scale;
	let canvToNodeY = (nodesRect.centerY - canvasY) * scale;

	let newNodeX = canvasX + canvToNodeX;
	let newNodeY = canvasY + canvToNodeY;
	
	let deltaX = viewContentRect.centerX - newNodeX;
	let deltaY = viewContentRect.centerY - newNodeY;

	canvas.style.transition = "scale 0.5s cubic-bezier(0.5, -0.1, 0.5, 1.1), translate 0.5s cubic-bezier(0.5, -0.1, 0.5, 1.1)";
	scaleCanvas(scale);
	translateCanvas(deltaX, deltaY);

	setTimeout(function()
	{
		canvas.style.transition = "";
	}, 550);
}

//#endregion

//#region -----------------       Callouts      ----------------- 

function setupCallouts(setupOnNode)
{
	// MAKE CALLOUTS COLLAPSIBLE
    // if the callout title is clicked, toggle the display of .callout-content
	setupOnNode.querySelectorAll(".callout.is-collapsible .callout-title").forEach(function (element) 
	{
		element.addEventListener("click", function () 
		{
			var parent = this.parentElement;

			parent.classList.toggle("is-collapsed");
			element.querySelector(".callout-fold").classList.toggle("is-collapsed");

			slideToggle(parent.querySelector(".callout-content"), 100);
		});
	});

}

//#endregion

//#region -----------------      Checkboxes     ----------------- 

function setupCheckboxes(setupOnNode)
{
	// Fix checkboxed toggling .is-checked
	setupOnNode.querySelectorAll(".task-list-item-checkbox").forEach(function (element) 
	{
		element.addEventListener("click", function () 
		{
			var parent = this.parentElement;
			parent.classList.toggle("is-checked");
			parent.setAttribute("data-task", parent.classList.contains("is-checked") ? "x" : " ");
		});
	});

	setupOnNode.querySelectorAll(`.plugin-tasks-list-item input[type="checkbox"]`).forEach(function(checkbox)
	{
		checkbox.checked = checkbox.parentElement.classList.contains("is-checked");
	});

	setupOnNode.querySelectorAll('.kanban-plugin__item.is-complete').forEach(function(checkbox)
	{
		checkbox.querySelector('input[type="checkbox"]').checked = true;
	});
}

//#endregion

//#region -----------------     Code Blocks     ----------------- 

function setupCodeblocks(setupOnNode)
{
	// make code snippet block copy button copy the code to the clipboard
	setupOnNode.querySelectorAll(".copy-code-button").forEach(function (element) 
	{
		element.addEventListener("click", function () 
		{
			var code = this.parentElement.querySelector("code").textContent;
			navigator.clipboard.writeText(code);
			this.textContent = "Copied!";
			// set a timeout to change the text back
			setTimeout(function () 
			{
				setupOnNode.querySelectorAll(".copy-code-button").forEach(function (button) 
				{
					button.textContent = "Copy";
				});
			}, 2000);
		});
	});
}

//#endregion

//#region -----------------        Links        ----------------- 

function setupLinks(setupOnNode)
{
	setupOnNode.querySelectorAll(".internal-link, .footnote-link, .tree-item:not(.mod-tree-folder) > .tree-item-contents > .tree-item-link").forEach(function(link)
	{
		link.addEventListener("click", function(event)
		{
			let target = link.getAttribute("href");
			event.preventDefault();

			if(!target) return;

			// this is linking to a different page
			if (!target.startsWith("#"))
			{
				// load doc, if it is a tree link then don't scroll to the active doc in the file tree
				loadDocument(target, true, !link.classList.contains("tree-item-link"));
				return;
			}
			else
			{
				let targetEl = document.getElementById(target.substring(1));
				
				if (targetEl)
				{
					targetEl.headingWrapper?.collapse(false, true, true);
					setTimeout(function()
					{
						if(targetEl.classList.contains(".heading")) targetEl.headingWrapper?.scrollIntoView({ behavior: "smooth", block: "start"});
						else targetEl.scrollIntoView({ behavior: "smooth", block: "start"});

						if (deviceSize == "phone") rightSidebar.collapse(true);
					}, 0);
				}
				else
				{
					console.log("No element found with id: " + target.substring(1));
				}
			}
		});
	});
}

//#endregion

//#region -----------------      Sidebars       ----------------- 

function setupSidebars()
{
	if (!rightSidebar || !leftSidebar) return;

	//#region sidebar object references
	sidebarCollapseIcons[0].otherIcon = sidebarCollapseIcons[1];
	sidebarCollapseIcons[1].otherIcon = sidebarCollapseIcons[0];
	sidebarCollapseIcons[0].gutter = sidebarGutters[0];
	sidebarCollapseIcons[1].gutter = sidebarGutters[1];
	sidebarCollapseIcons[0].sidebar = sidebars[0];
	sidebarCollapseIcons[1].sidebar = sidebars[1];
	sidebarGutters[0].otherGutter = sidebarGutters[1];
	sidebarGutters[1].otherGutter = sidebarGutters[0];
	sidebarGutters[0].collapseIcon = sidebarCollapseIcons[0];
	sidebarGutters[1].collapseIcon = sidebarCollapseIcons[1];
	sidebars[0].otherSidebar = sidebars[1];
	sidebars[1].otherSidebar = sidebars[0];
	sidebars[0].gutter = sidebarGutters[0];
	sidebars[1].gutter = sidebarGutters[1];
	//#endregion

	sidebars.forEach(function (sidebar)
	{
		sidebar.collapsed = sidebar.classList.contains("is-collapsed");
		sidebar.collapse = function (collapsed = true)
		{
			if (!collapsed && this.temporarilyCollapsed && deviceSize == "large-screen") this.gutter.collapse(true);
					

			if (!collapsed && document.body.classList.contains("floating-sidebars"))
			{
				function clickOutsideCollapse(event)
				{
					sidebar.collapse(true);
					document.body.removeEventListener("click", clickOutsideCollapse);
				}

				document.body.addEventListener("click", clickOutsideCollapse);
			}

			// if there isn't enough space for both sidebars then close the other one
			if (deviceSize == "phone")
			{
				if (!collapsed) sidebar.otherSidebar.fullCollapse(true, true);
				if (collapsed) sidebar.gutter.otherGutter.collapse(false, true);
			}

			if (deviceSize == "tablet")
			{
				if (!collapsed) sidebar.otherSidebar.collapse(true);
			}

			this.classList.toggle("is-collapsed", collapsed);
			this.collapsed = collapsed;
		}
		sidebar.temporaryCollapse = function (collapsed = true)
		{
			this.temporarilyCollapsed = true;
			this.collapse(true);
			this.gutter.collapse(false);
			this.collapsed = collapsed;
		}
		sidebar.fullCollapse = function (collapsed = true, force = false)
		{
			this.collapse(collapsed);
			this.gutter.collapse(true, force);
			this.collapsed = collapsed;
		}
		sidebar.toggleCollapse = function ()
		{
			this.collapse(!this.collapsed);
		}
		sidebar.toggleFullCollapse = function ()
		{
			this.fullCollapse(!this.collapsed);
		}
	});

	sidebarGutters.forEach(function (gutter)
	{
		gutter.collapsed = gutter.classList.contains("is-collapsed");
		gutter.collapse = function (collapsed, force = false)
		{
			if(!force && document.body.classList.contains("sidebars-always-collapsible")) return;

			this.classList.toggle("is-collapsed", collapsed);
			this.collapsed = collapsed;
		}
		gutter.toggleCollapse = function ()
		{
			this.collapse(!this.collapsed);
		}
	});

	sidebarCollapseIcons.forEach(function (icon)
	{
		icon.addEventListener("click", function (event)
		{
			event.stopPropagation();
			icon.sidebar.toggleCollapse();
		});
	});

	document.querySelectorAll(".sidebar-container").forEach(function (sidebarContainer)
	{
		sidebarContainer.addEventListener("click", function (event)
		{
			event.stopPropagation();
		});
	});
}

/**Get the computed target sidebar width in px*/
function getSidebarWidthProp()
{
	return getComputedPixelValue("--sidebar-width");
}

//#endregion

//#region -----------------        Theme        ----------------- 

function setupThemeToggle()
{
	if (!themeToggle) return;

	if (localStorage.getItem("theme_toggle") != null)
    {
        setThemeToggle(localStorage.getItem("theme_toggle") == "true");
    }

	// set initial toggle state based on body theme class
	if (document.body.classList.contains("theme-light"))
	{
		setThemeToggle(true);
	}
	else
	{
		setThemeToggle(false);
	}

	function setThemeToggle(state, instant = false)
	{

		themeToggle.checked = state;

		if (instant) 
		{	
			var oldTransition = document.body.style.transition;
			document.body.style.transition = "none";
		}

		if(!themeToggle.classList.contains("is-checked") && state)
		{
			themeToggle.classList.add("is-checked");
		}
		else if (themeToggle.classList.contains("is-checked") && !state)
		{
			themeToggle.classList.remove("is-checked");
		}

		if(!state)
		{
			if (document.body.classList.contains("theme-light"))
			{
				document.body.classList.remove("theme-light");
			}

			if (!document.body.classList.contains("theme-dark"))
			{
				document.body.classList.add("theme-dark");
			}
		}
		else
		{
			if (document.body.classList.contains("theme-dark"))
			{
				document.body.classList.remove("theme-dark");
			}

			if (!document.body.classList.contains("theme-light"))
			{
				document.body.classList.add("theme-light");
			}
		}

		if (instant)
		{
			setTimeout(function()
			{
				document.body.style.transition = oldTransition;
			}, 100);
		}

		localStorage.setItem("theme_toggle", state ? "true" : "false");
	}

    document.querySelector(".theme-toggle-input")?.addEventListener("change", event =>
	{
		console.log("Theme toggle changed to: " + !(localStorage.getItem("theme_toggle") == "true"));
		setThemeToggle(!(localStorage.getItem("theme_toggle") == "true"));
	});
}

//#endregion

//#region -----------------        Scroll       -----------------

function setupScroll(setupOnNode)
{
	// hide elements clipped by scrollable areas in markdown-preview-view elements
	if(documentType != "canvas") return;

	let markdownViews = Array.from(setupOnNode.querySelectorAll(".markdown-preview-view"));
	let nextMarkdownViewId = 0;

	let marginMultiplier = 0.1;
	let maxMargin = 150;
	let margin = 0;

	markdownViews.forEach(async function (view)
	{
		console.log("Setting up markdown view");
		let headers = Array.from(view.querySelectorAll(".heading-wrapper"));

		view.updateVisibleWindowMarkdown = function updateVisibleWindowMarkdown(allowVirtualization = true, allowDevirtualization = true)
		{
			let scrollBounds = view.getBoundingClientRect();
			margin = Math.min(scrollBounds.height * marginMultiplier, maxMargin);
			let scrollBoundsTop = scrollBounds.top - margin;
			let scrollBoundsBottom = scrollBounds.bottom + margin;

			async function updateHeader(header)
			{
				let bounds = header?.getBoundingClientRect();

				if (!bounds) return;
				
				let isClipped = (bounds.top < scrollBoundsTop && bounds.bottom < scrollBoundsTop) || (bounds.top > scrollBoundsBottom && bounds.bottom > scrollBoundsBottom);

				if (isClipped && allowVirtualization)
				{
					header.hide();
				}
				else if (!isClipped && allowDevirtualization)
				{
					header.show();
				}
			}

			for (let i = 0; i < headers.length; i++)
			{
				let h = headers[i];
				if(h) updateHeader(h);
			}
		}

		let lastScrollTop = 0;
		view.addEventListener("scroll", function()
		{
			if (Math.abs(view.scrollTop - lastScrollTop) > margin / 3)
			{
				view.updateVisibleWindowMarkdown(false, true);
			}

			lastScrollTop = view.scrollTop;
		});
	});

	async function periodicUpdate()
	{
		if(markdownViews.length > 0)
		{
			markdownViews[nextMarkdownViewId].updateVisibleWindowMarkdown();
			nextMarkdownViewId = (nextMarkdownViewId + 1) % markdownViews.length;
		}
	}
	
	setInterval(periodicUpdate, 200);
}

//#endregion

//#region -----------------        Plugins      -----------------

// Excalidraw
function setupExcalidraw(setupOnNode)
{
	setupOnNode.querySelectorAll(".excalidraw-svg svg").forEach(function (svg)
	{
		let isLight = svg.querySelector("rect").getAttribute("fill") > "#7F7F7F";
		svg.classList.add(isLight ? "light" : "dark");
	});
}


//#endregion
