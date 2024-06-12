
export class Notice
{
	private static container: HTMLElement;
	public notification: HTMLElement;

	constructor(public message: string, public duration: number = 5000)
	{
		this.show();
	}

	public show()
	{
		if (!Notice.container)
		{
			Notice.container = document.createElement("div");
			Notice.container.classList.add("notice-container");
			Notice.container.style.top = "0";
			Notice.container.style.right = "0";
			document.body.appendChild(Notice.container);
		}

		this.notification = document.createElement("div");
		this.notification.classList.add("notice");
		this.notification.innerHTML = this.message;
		Notice.container.appendChild(this.notification);

		// slide in from left
		this.notification.style.opacity = "0";
		this.notification.style.transform = "translateX(350px)";
		this.notification.style.transition = "all 0.5s";
		setTimeout(() =>
		{
			this.notification.style.opacity = "1";
			this.notification.style.transform = "translateX(0)";
			this.notification.style.height = this.notification.scrollHeight + "px";
		}, 100);

		// slide up
		setTimeout(() =>
		{
			this.dismiss();
		}, this.duration);

		// dismiss on click
		this.notification.addEventListener("click", () =>
		{
			this.dismiss();
		}, { once: true });
	}

	public dismiss()
	{
		if (!this.notification) return;
		this.notification.style.opacity = "0";
		this.notification.style.height = "0";
		this.notification.style.margin = "0";
		this.notification.style.padding = "0";
		setTimeout(() =>
		{
			this.notification.remove();
		}, 500);
	}
}
