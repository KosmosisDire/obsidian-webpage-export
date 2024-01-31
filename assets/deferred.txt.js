async function loadIncludes()
{
	observer.disconnect();

	if (location.protocol != "file:") 
	{
		// replace include tags with the contents of the file
		let includeTags = document.querySelectorAll("include");
		for (let i = 0; i < includeTags.length; i++)
		{
			let includeTag = includeTags[i];
			let includePath = includeTag.getAttribute("src");

			const request = await fetch(includePath);
			if (!request.ok) 
			{
				console.log("Could not include file: " + includePath);
				continue;
			}
			
			let includeText = await request.text();
			includeTag.outerHTML = includeText;
		}
	}
	else
	{
		let e = document.querySelectorAll("include");
		if (e.length > 0)
		{
			var error = document.createElement("div");
			error.textContent = "Web server exports must be hosted on an http / web server to be viewed correctly.";
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

	if (document.body.querySelector(".sidebar-content include")) loadIncludes();
	else
	{
		observer = new MutationObserver(() => 
		{
			if (document.body.querySelector(".sidebar-content include")) loadIncludes();
		});
		observer.observe(document.body, { childList: true });
	}
}

var observer = new MutationObserver(() => 
{
	if (document.body.classList.length != 0) updateTheme();
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
