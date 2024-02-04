async function loadIncludes()
{
	if (location.protocol != "file:") 
	{
		// replace include tags with the contents of the file
		let includeTags = document.querySelectorAll("include");
		for (let i = 0; i < includeTags.length; i++)
		{
			let includeTag = includeTags[i];
			let includePath = includeTag.getAttribute("src");

			try
			{
				const request = await fetch(includePath);
				if (!request.ok) 
				{
					console.log("Could not include file: " + includePath);
					includeTag?.remove();
					continue;
				}
				
				let includeText = await request.text();
				let docFrag = document.createRange().createContextualFragment(includeText);
				let includeChildren = Array.from(docFrag.children);
				for (let child of includeChildren)
				{
					child.classList.add("hide");
					child.style.transition = "opacity 0.5s ease-in-out";

					setTimeout(() => 
					{
						child.classList.remove("hide");
					}, 10);
				};

				includeTag.before(docFrag);
				includeTag.remove();

				console.log("Included file: " + includePath);
			}
			catch (e)
			{
				includeTag?.remove();
				console.log("Could not include file: " + includePath, e);
				continue;
			}
		}
	}
	else
	{
		let e = document.querySelectorAll("include");
		if (e.length > 0)
		{
			var error = document.createElement("div");
			error.id = "error";
			error.textContent = "Web server exports must be hosted on an http / web server to be viewed correctly.";
			error.style.position = "fixed";
			error.style.top = "50%";
			error.style.left = "50%";
			error.style.transform = "translate(-50%, -50%)";
			error.style.fontSize = "1.5em";
			error.style.fontWeight = "bold";
			error.style.textAlign = "center";
			document.body.appendChild(error);
			document.querySelector(".document-container")?.classList.remove("hide");
		}
	}
}

document.addEventListener("DOMContentLoaded", () => 
{
	loadIncludes();
});

let isFileProtocol = location.protocol == "file:";

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
