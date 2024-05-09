let theme = localStorage.getItem("theme") || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
if (theme == "dark")
{
	document.body.classList.add("theme-dark");
	document.body.classList.remove("theme-light");
}
else
{
	document.body.classList.add("theme-light");
	document.body.classList.remove("theme-dark");
}

if (window.innerWidth < 480) document.body.classList.add("is-phone");
else if (window.innerWidth < 768) document.body.classList.add("is-tablet");
else if (window.innerWidth < 1024) document.body.classList.add("is-small-screen");
else document.body.classList.add("is-large-screen");
