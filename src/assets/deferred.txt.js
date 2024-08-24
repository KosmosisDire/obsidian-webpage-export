async function loadIncludes()
{
	// if (location.protocol != "file:") 
	// {
	// replace include tags with the contents of the file
	let includeTags = document.querySelectorAll("link[itemprop='include']");
	for (const includeTag of includeTags)
	{
		let includePath = includeTag.getAttribute("href");

		try
		{
			let includeText = "";
			
			if (includePath.startsWith("https:") || includePath.startsWith("http:") || window.location.protocol != "file:")
			{
				const request = await fetch(includePath);
				if (!request.ok) 
				{
					console.log("Could not include file: " + includePath);
					includeTag?.remove();
					continue;
				}
				
				includeText = await request.text();
			}
			else
			{
				const dataEl = document.querySelector(`data[id='${encodeURI(includePath)}']`);
				if (dataEl)
				{
					const data = JSON.parse(decodeURI(dataEl.getAttribute("value") ?? ""));
					includeText = data?.data ?? "";
				}
			}


			let docFrag = document.createRange().createContextualFragment(includeText);
			let includeChildren = Array.from(docFrag.children);
			for (let child of includeChildren)
			{
				child?.classList?.add("hide");
				child.style.transition = "opacity 0.5s ease-in-out";

				setTimeout(() => 
				{
					child?.classList?.remove("hide");
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
	// }
	// else
	// {
	// 	let e = document.querySelectorAll("link[itemprop='include']");
	// 	if (e.length > 0)
	// 	{
	// 		var error = document.createElement("div");
	// 		error.id = "error";
	// 		error.textContent = "Web server exports must be hosted on an http / web server to be viewed correctly.";
	// 		error.style.position = "fixed";
	// 		error.style.top = "50%";
	// 		error.style.left = "50%";
	// 		error.style.transform = "translate(-50%, -50%)";
	// 		error.style.fontSize = "1.5em";
	// 		error.style.fontWeight = "bold";
	// 		error.style.textAlign = "center";
	// 		document.body.appendChild(error);
	// 		document.querySelector("#center-content")?.classList?.remove("hide");
	// 	}
	// }
}

document.addEventListener("DOMContentLoaded", () => 
{
	loadIncludes();
});

let isFileProtocol = location.protocol == "file:";

function waitLoadScripts(scriptNames, callback)
{
	let scripts = scriptNames.map(name => document.getElementById(name + "-script"));

	function loadNext(index)
	{
		let script = scripts[index];
		let nextIndex = index + 1;
		if (!script)
		{
			if (index < scripts.length)
				loadNext(nextIndex);
			else
			{
				callback();
			}
			return;
		}

		if (!script || script.getAttribute('loaded') == "true") // if already loaded 
		{
			if (index < scripts.length)
				loadNext(nextIndex);
		}
		
		if (index < scripts.length) 
		{
			script.addEventListener("load", () => loadNext(nextIndex));
		}
	}

	loadNext(0);
}
