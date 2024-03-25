export enum AssetType
{
    Style = "style", // css
    Script = "script", // js
    Media = "media", // images, videos, audio, etc
    HTML = "html", // reusable html
    Font = "font", // fonts
    Other = "other" // anything else
}

export enum InlinePolicy
{
    AutoHead = "autohead", // Fine for js, css, html, and fonts. Include data itself or reference to downloaded data into head.
    Auto = "auto", // Does not auto insert anywhere, but chooses format on whether assets are being inlined. (will download if not inlined)
	Inline = "inline", // Does not auto insert anywhere, but is always inline format
    Download = "download", // Just download, does not auto insert anywhere
	DownloadHead = "downloadhead", // Download and include ref in head
	InlineHead = "inlinehead", // Inline raw data into head
    None = "none" // Do nothing with this asset
}

export enum Mutability
{
	Static = "static", // this asset never changes
	Dynamic = "dynamic", // this asset can change
	Temporary = "temporary", // this asset is created only for the current export and is deleted afterwards
	Child = "child", // this asset will only change when the parent changes
}

export enum LoadMethod
{
	Default = "",
	Async = "async",
	Defer = "defer"
}
