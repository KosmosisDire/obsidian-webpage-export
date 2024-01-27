function loadIncludes()
{
	if (location.protocol != "file:") 
	{
		// replace include tags with the contents of the file
		let includeTags = document.querySelectorAll("include");
		for (let i = 0; i < includeTags.length; i++)
		{
			let includeTag = includeTags[i];
			let includePath = includeTag.getAttribute("src");
			
			const request = new XMLHttpRequest();
			request.open("GET", includePath, false); // `false` makes the request synchronous
			request.send(null);
			
			if (request.status !== 200) 
			{
				console.log("Could not include file: " + includePath);
				continue;
			}
			
			let includeText = request.responseText;
			includeTag.outerHTML = includeText;
		}
	}
	else
	{
		let e = document.querySelectorAll("include");
		if (e.length > 0)
		{
			var error = document.createElement("div");
			error.textContent = "Web server exports relay on fetch() to load content, which is unsupported by the file:// protocol. Please use a web server to view this vault.";
			error.style.position = "fixed";
			error.style.top = "50%";
			error.style.left = "50%";
			error.style.transform = "translate(-50%, -50%)";
			error.style.fontSize = "1.5em";
			error.style.fontWeight = "bold";
			error.style.textAlign = "center";
			document.body.appendChild(error);
		}
	}

	observer.disconnect();
	if (document.body.querySelector(".sidebar")) uncollapseSidebars();
	else
	{
		observer = new MutationObserver(() => 
		{
			if (document.body.querySelector(".sidebar")) uncollapseSidebars();
		});
		observer.observe(document.body, { childList: true });
	}
}

function uncollapseSidebars()
{
	document.querySelector(".document-container").classList.add("hide");
	return; // disabled for now
	let viewportWidth = window.innerWidth;
	let sidebars = document.querySelectorAll(".sidebar");
	if (viewportWidth > 1600) sidebars.forEach(sidebar => sidebar.classList.remove("is-collapsed"));
	else if (viewportWidth > 900) document.querySelector(".sidebar-left").classList.remove("is-collapsed");
}


function updateTheme()
{
	
	if (localStorage.getItem("theme") == "dark")
	{
		document.body.classList.add("theme-dark");
		document.body.classList.remove("theme-light");
	}
	else
	{
		document.body.classList.add("theme-light");
		document.body.classList.remove("theme-dark");
	}

	observer.disconnect();

	if (document.body.querySelector("include")) loadIncludes();
	else
	{
		observer = new MutationObserver(() => 
		{
			if (document.body.querySelector("include")) loadIncludes();
		});
		observer.observe(document.body, { childList: true });
	}
}

var observer = new MutationObserver(() => 
{
	if (document.body) updateTheme();
});
observer.observe(document.documentElement, { childList: true });

function waitLoadScripts(scriptNames, callback)
{
	let scripts = scriptNames.map(name => document.getElementById(name + "-script"));
	let index = 0;

	function loadNext()
	{
		let script = scripts[index];
		index++;

		if (!script || script.getAttribute('loaded') == "true") // if already loaded 
		{
			if (index < scripts.length)
				loadNext();
		}
		
		if (index < scripts.length) script.addEventListener("load", loadNext);
		else callback();
	}

	loadNext();
}
