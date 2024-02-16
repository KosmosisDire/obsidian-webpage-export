import { Path } from "scripts/utils/path";
import { Downloadable } from "scripts/utils/downloadable";
import { ExportLog } from "../render-log";
import { Settings, SettingsPage } from "scripts/settings/settings";
import { AssetHandler } from "../asset-handler";
const { minify: runMinify } = require('html-minifier-terser');
const mime = require('mime');

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

export class Asset extends Downloadable 
{
    public type: AssetType; // what type of asset is this
    public inlinePolicy: InlinePolicy; // should this asset be inlined into the html file
	public mutability: Mutability; // can this asset change
    public minify: boolean; // should the asset be minified
    public loadMethod: LoadMethod = LoadMethod.Default; // should this asset be loaded asynchronously if possible
	public loadPriority: number = 100; // the priority of this asset when loading 
	public onlineURL: string | undefined = undefined; // the link to the asset online
	public childAssets: Asset[] = []; // assets that depend on this asset

	constructor(filename: string, content: string | Buffer, type: AssetType, inlinePolicy: InlinePolicy, minify: boolean, mutability: Mutability, loadMethod: LoadMethod = LoadMethod.Async, loadPriority: number = 100, cdnPath: string | undefined = undefined)
    {
		if(Settings.makeNamesWebStyle) filename = Path.toWebStyle(filename);
        super(filename, content, Asset.typeToPath(type));
        this.type = type;
        this.inlinePolicy = inlinePolicy;
		this.mutability = mutability;
        this.minify = minify;
        this.loadMethod = loadMethod;
		this.loadPriority = loadPriority;
		this.onlineURL = cdnPath;
		this.modifiedTime = Date.now();

		switch(mutability)
		{
			case Mutability.Static:
				AssetHandler.staticAssets.push(this);
				this.modifiedTime = AssetHandler.mainJsModTime; // by default all static assets have a modified time the same as main.js
				break;
			case Mutability.Dynamic:
				AssetHandler.dynamicAssets.push(this);
				break;
			case Mutability.Temporary:
				AssetHandler.temporaryAssets.push(this);
				break;
		}

        if (mutability != Mutability.Child) AssetHandler.allAssets.push(this);
    }

    public async load(): Promise<void>
    {
        if (this.type == AssetType.Style && typeof this.content == "string")
        {
			this.childAssets = [];
            this.content = await AssetHandler.getStyleChildAssets(this, false);
		}

        if (this.minify)
        {
            this.minifyAsset();
        }
    }

    override async download(downloadDirectory: Path): Promise<void> 
    {
        if (this.isInlineFormat()) return;
        await super.download(downloadDirectory);
    }

    public static typeToPath(type: AssetType): Path
    {
        switch(type)
        {
            case AssetType.Style:
                return AssetHandler.cssPath;
            case AssetType.Script:
                return AssetHandler.jsPath;
            case AssetType.Media:
                return AssetHandler.mediaPath;
            case AssetType.HTML:
                return AssetHandler.htmlPath;
            case AssetType.Font:
                return AssetHandler.fontPath;
            case AssetType.Other:
                return AssetHandler.libraryPath;
        }
    }

    public static extentionToType(extention: string): AssetType
    {
        const mediaTypes = ["png", "jpg", "jpeg", "gif", "svg", "webp", "ico", "mp4", "webm", "ogg", "mp3", "wav", "flac", "aac", "m4a", "opus"];
        const scriptTypes = ["js", "ts"];
        const styleTypes = ["css", "scss", "sass", "less"];
        const htmlTypes = ["html", "htm"];
        const fontTypes = ["ttf", "woff", "woff2", "eot", "otf"];

        extention = extention.toLowerCase().replace(".", "");

        if (mediaTypes.includes(extention)) return AssetType.Media;
        if (scriptTypes.includes(extention)) return AssetType.Script;
        if (styleTypes.includes(extention)) return AssetType.Style;
        if (htmlTypes.includes(extention)) return AssetType.HTML;
        if (fontTypes.includes(extention)) return AssetType.Font;
        return AssetType.Other;
    }

	/**Minify the contents of a JS or CSS string (No HTML)*/
    async minifyAsset()
	{
		if (this.type == AssetType.HTML || typeof this.content != "string") return;
		let isJS = this.type == AssetType.Script;
		let isCSS = this.type == AssetType.Style;

		let tempContent = this.content;

		try
		{
			// add script or style tags so that minifier can minify it as html
			if (isJS) tempContent = `<script>${tempContent}</script>`;
			if (isCSS) tempContent = `<style>${tempContent}</style>`;
			
			tempContent = await runMinify(tempContent, { minifyCSS: isCSS, minifyJS: isJS, removeComments: true, collapseWhitespace: true});

			// remove the <script> or <style> tags
			tempContent = tempContent.replace("<script>", "").replace("</script>", "").replace("<style>", "").replace("</style>", "");
			this.content = tempContent;
		}
		catch (e)
		{
			ExportLog.warning("Unable to minify " + (isJS ? "JS" : "CSS") + " file.");

			// remove whitespace manually
			this.content = this.content.replace(/[\n\r]+/g, "");
		}
	}

	public getAssetPath(relativeFrom: Path | undefined = undefined): Path
	{
		if (this.isInlineFormat()) return new Path("");
		
		if (relativeFrom == undefined) relativeFrom = Path.rootPath;
		let toRoot = Path.getRelativePath(relativeFrom, Path.rootPath);
		let newPath = toRoot.join(this.relativeDownloadPath).makeUnixStyle();
		newPath.makeWebStyle(Settings.makeNamesWebStyle);
		
		return newPath;
	}

	protected isInlineFormat(): boolean
	{
		let isInlineFormat = this.inlinePolicy == InlinePolicy.Inline || 
							 this.inlinePolicy == InlinePolicy.InlineHead || 
							 ((this.inlinePolicy == InlinePolicy.Auto || this.inlinePolicy == InlinePolicy.AutoHead) && Settings.inlineAssets);

        return isInlineFormat;
	}

	protected isRefFormat(): boolean
	{
		let isRefFormat = this.inlinePolicy == InlinePolicy.Download || 
						  this.inlinePolicy == InlinePolicy.DownloadHead ||
						  ((this.inlinePolicy == InlinePolicy.Auto || this.inlinePolicy == InlinePolicy.AutoHead) && !Settings.inlineAssets);

		return isRefFormat;
	}

    public getHTML(allowOnlineURLs: boolean = false): string
    {
        if(this.isInlineFormat())
        {
            switch(this.type)
            {
                case AssetType.Style:
                    return `<style>${this.content}</style>`;
                case AssetType.Script:
                    return `<script ${this.loadMethod}>${this.content}</script>`;
				case AssetType.Media:
					return `<${this.getHTMLTagName()} src="${this.getContentBase64()}"/>`;
                case AssetType.HTML:
                    return this.content as string;
                case AssetType.Font:
                    return `<style>@font-face{font-family:'${this.filename}';src:url(${this.getContentBase64()}) format('woff2');}</style>`;
                default:
                    return "";
            }
        }
        
        if (this.isRefFormat())
        {
            let path = this.getAssetPath().asString;
			if (allowOnlineURLs && this.onlineURL) path = this.onlineURL;

			let include = "";
			let attr = "";
            switch(this.type)
            {
                case AssetType.Style:
					include = `<link rel="stylesheet" href="${path}">`;
					if (this.loadMethod == LoadMethod.Async)
					{
						include = `<link rel="preload" href="${path}" as="style" onload="this.onload=null;this.rel='stylesheet'"><noscript><link rel="stylesheet" href="${path}"></noscript>`
					}
                    return include;
                case AssetType.Script:
					include = `<script ${this.loadMethod} id="${this.relativeDownloadPath.basename + "-script"}" src="${path}" onload='this.onload=null;this.setAttribute(\"loaded\", \"true\")'></script>`;
                    return include;
                case AssetType.Media:
					attr = this.loadMethod == LoadMethod.Defer ? "loading='eager'" : "loading='lazy'";
					if (this.loadMethod == LoadMethod.Default) attr = "";
					include = `<${this.getHTMLTagName()} src="${path}" ${attr} />`;
                    return include;
                case AssetType.Font:
					include = `<style>@font-face{font-family:'${this.filename}';src:url('${path}') format('woff2');}</style>`;
                    return include;
				case AssetType.HTML:
					return `<include src="${path}"></include>`
                default:
                    return "";
            }
        }


        return "";
    }

    public static mimeToExtention(mime: string): string
    {
        const FileMimeType: {[key: string]: string} = {'audio/x-mpeg': 'mpega', 'application/postscript': 'ps', 'audio/x-aiff': 'aiff', 'application/x-aim': 'aim', 'image/x-jg': 'art', 'video/x-ms-asf': 'asx', 'audio/basic': 'ulw', 'video/x-msvideo': 'avi', 'video/x-rad-screenplay': 'avx', 'application/x-bcpio': 'bcpio', 'application/octet-stream': 'exe', 'image/bmp': 'dib', 'text/html': 'html', 'application/x-cdf': 'cdf', 'application/pkix-cert': 'cer', 'application/java': 'class', 'application/x-cpio': 'cpio', 'application/x-csh': 'csh', 'text/css': 'css', 'application/msword': 'doc', 'application/xml-dtd': 'dtd', 'video/x-dv': 'dv', 'application/x-dvi': 'dvi', 'application/vnd.ms-fontobject': 'eot', 'text/x-setext': 'etx', 'image/gif': 'gif', 'application/x-gtar': 'gtar', 'application/x-gzip': 'gz', 'application/x-hdf': 'hdf', 'application/mac-binhex40': 'hqx', 'text/x-component': 'htc', 'image/ief': 'ief', 'text/vnd.sun.j2me.app-descriptor': 'jad', 'application/java-archive': 'jar', 'text/x-java-source': 'java', 'application/x-java-jnlp-file': 'jnlp', 'image/jpeg': 'jpg', 'application/javascript': 'js', 'text/plain': 'txt', 'application/json': 'json', 'audio/midi': 'midi', 'application/x-latex': 'latex', 'audio/x-mpegurl': 'm3u', 'image/x-macpaint': 'pnt', 'text/troff': 'tr', 'application/mathml+xml': 'mathml', 'application/x-mif': 'mif', 'video/quicktime': 'qt', 'video/x-sgi-movie': 'movie', 'audio/mpeg': 'mpa', 'video/mp4': 'mp4', 'video/mpeg': 'mpg', 'video/mpeg2': 'mpv2', 'application/x-wais-source': 'src', 'application/x-netcdf': 'nc', 'application/oda': 'oda', 'application/vnd.oasis.opendocument.database': 'odb', 'application/vnd.oasis.opendocument.chart': 'odc', 'application/vnd.oasis.opendocument.formula': 'odf', 'application/vnd.oasis.opendocument.graphics': 'odg', 'application/vnd.oasis.opendocument.image': 'odi', 'application/vnd.oasis.opendocument.text-master': 'odm', 'application/vnd.oasis.opendocument.presentation': 'odp', 'application/vnd.oasis.opendocument.spreadsheet': 'ods', 'application/vnd.oasis.opendocument.text': 'odt', 'application/vnd.oasis.opendocument.graphics-template': 'otg', 'application/vnd.oasis.opendocument.text-web': 'oth', 'application/vnd.oasis.opendocument.presentation-template': 'otp', 'application/vnd.oasis.opendocument.spreadsheet-template': 'ots', 'application/vnd.oasis.opendocument.text-template': 'ott', 'application/ogg': 'ogx', 'video/ogg': 'ogv', 'audio/ogg': 'spx', 'application/x-font-opentype': 'otf', 'audio/flac': 'flac', 'application/annodex': 'anx', 'audio/annodex': 'axa', 'video/annodex': 'axv', 'application/xspf+xml': 'xspf', 'image/x-portable-bitmap': 'pbm', 'image/pict': 'pict', 'application/pdf': 'pdf', 'image/x-portable-graymap': 'pgm', 'audio/x-scpls': 'pls', 'image/png': 'png', 'image/x-portable-anymap': 'pnm', 'image/x-portable-pixmap': 'ppm', 'application/vnd.ms-powerpoint': 'pps', 'image/vnd.adobe.photoshop': 'psd', 'image/x-quicktime': 'qtif', 'image/x-cmu-raster': 'ras', 'application/rdf+xml': 'rdf', 'image/x-rgb': 'rgb', 'application/vnd.rn-realmedia': 'rm', 'application/rtf': 'rtf', 'text/richtext': 'rtx', 'application/font-sfnt': 'sfnt', 'application/x-sh': 'sh', 'application/x-shar': 'shar', 'application/x-stuffit': 'sit', 'application/x-sv4cpio': 'sv4cpio', 'application/x-sv4crc': 'sv4crc', 'image/svg+xml': 'svg', 'application/x-shockwave-flash': 'swf', 'application/x-tar': 'tar', 'application/x-tcl': 'tcl', 'application/x-tex': 'tex', 'application/x-texinfo': 'texinfo', 'image/tiff': 'tiff', 'text/tab-separated-values': 'tsv', 'application/x-font-ttf': 'ttf', 'application/x-ustar': 'ustar', 'application/voicexml+xml': 'vxml', 'image/x-xbitmap': 'xbm', 'application/xhtml+xml': 'xhtml', 'application/vnd.ms-excel': 'xls', 'application/xml': 'xsl', 'image/x-xpixmap': 'xpm', 'application/xslt+xml': 'xslt', 'application/vnd.mozilla.xul+xml': 'xul', 'image/x-xwindowdump': 'xwd', 'application/vnd.visio': 'vsd', 'audio/x-wav': 'wav', 'image/vnd.wap.wbmp': 'wbmp', 'text/vnd.wap.wml': 'wml', 'application/vnd.wap.wmlc': 'wmlc', 'text/vnd.wap.wmlsc': 'wmls', 'application/vnd.wap.wmlscriptc': 'wmlscriptc', 'video/x-ms-wmv': 'wmv', 'application/font-woff': 'woff', 'application/font-woff2': 'woff2', 'model/vrml': 'wrl', 'application/wspolicy+xml': 'wspolicy', 'application/x-compress': 'z', 'application/zip': 'zip'};

        return FileMimeType[mime] || mime.split("/")[1] || "txt";
    }

	public getContentBase64(): string
	{
		let extension = this.filename.split(".").pop() || "txt";
		let mimeType = mime(extension) || "text/plain";
		let base64 = this.content.toString("base64");
		return `data:${mimeType};base64,${base64}`;
	}

	private getHTMLTagName(): string
	{
		switch(this.type)
		{
			case AssetType.Style:
				return "link";
			case AssetType.Script:
				return "script";
			case AssetType.Font:
				return "style";
			case AssetType.HTML:
				return "include";
		}
		
		// media
		let extension = this.filename.split(".").pop() || "txt";
		const extToTag: {[key: string]: string} = {"png": "img", "jpg": "img", "jpeg": "img", "tiff": "img", "bmp": "img", "avif": "img", "apng": "img", "gif": "img", "svg": "img", "webp": "img", "ico": "img", "mp4": "video", "webm": "video", "ogg": "video", "3gp": "video", "mov": "video", "mpeg": "video", "mp3": "audio", "wav": "audio", "flac": "audio", "aac": "audio", "m4a": "audio", "opus": "audio"};
		return extToTag[extension] || "img";
	}
}
