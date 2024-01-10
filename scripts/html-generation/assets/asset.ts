import { Path } from "scripts/utils/path";
import { Downloadable } from "scripts/utils/downloadable";
import { RenderLog } from "../render-log";
import { MainSettings } from "scripts/settings/main-settings";
import { AssetHandler } from "../asset-handler";
const { minify: runMinify } = require('html-minifier-terser');
const mime = require('mime');

export enum AssetType
{
    Style, // css
    Script, // js
    Media, // images, videos, audio, etc
    HTML, // reusable html
    Font, // fonts
    Other // anything else
}

export enum InlinePolicy
{
    AlwaysInline, // this asset will always be inlined into the html file
    NeverInline, // this asset will never be inlined into the html file, and will always be saved as a separate file 
    Auto, // this asset will be inlined if the user has enabled inline assets, otherwise it will be saved as a separate file
    None // this asset is only used during export and is not saved automatically
}

export enum Mutability
{
	Static, // this asset never changes
	Dynamic, // this asset can change
	Temporary // this asset is created only for the current export and is deleted afterwards
}

export class Asset extends Downloadable 
{
	// this path is used to generate the relative path to the images folder, likewise for the other paths
    private static libraryFolder: Path;
	private static mediaFolder: Path;
	private static jsFolder: Path;
	private static cssFolder: Path;
	private static fontFolder: Path;
	private static htmlFolder: Path;

	public static initialize() 
	{
		this.libraryFolder = new Path("lib").makeUnixStyle();
		this.mediaFolder = this.libraryFolder.joinString("media").makeUnixStyle();
		this.jsFolder = this.libraryFolder.joinString("scripts").makeUnixStyle(); 
		this.cssFolder = this.libraryFolder.joinString("styles").makeUnixStyle();
		this.fontFolder = this.libraryFolder.joinString("fonts").makeUnixStyle();
		this.htmlFolder = this.libraryFolder.joinString("html").makeUnixStyle();
	}

    public static get libraryPath(): Path
    {
		if (!this.libraryFolder) this.initialize();
        if (MainSettings.settings.makeNamesWebStyle) return Asset.libraryFolder.copy.makeWebStyle();
        return Asset.libraryFolder.copy;
    }
    public static get mediaPath(): Path
    {
		if (!this.mediaFolder) this.initialize();
        if (MainSettings.settings.makeNamesWebStyle) return Asset.mediaFolder.copy.makeWebStyle();
        return Asset.mediaFolder.copy;
    }
    public static get jsPath(): Path
    {
		if (!this.jsFolder) this.initialize();
        if (MainSettings.settings.makeNamesWebStyle) return Asset.jsFolder.copy.makeWebStyle();
        return Asset.jsFolder.copy;
    }
    public static get cssPath(): Path
    {
		if (!this.cssFolder) this.initialize();
        if (MainSettings.settings.makeNamesWebStyle) return Asset.cssFolder.copy.makeWebStyle();
        return Asset.cssFolder.copy;
    }
	public static get fontPath(): Path
	{
		if (!this.fontFolder) this.initialize();
		if (MainSettings.settings.makeNamesWebStyle) return Asset.fontFolder.copy.makeWebStyle();
		return Asset.fontFolder.copy;
	}
    public static get htmlPath(): Path
    {
		if (!this.htmlFolder) this.initialize();
        if (MainSettings.settings.makeNamesWebStyle) return Asset.htmlFolder.copy.makeWebStyle();
        return Asset.htmlFolder.copy;
    }

    public type: AssetType; // what type of asset is this
    public inlinePolicy: InlinePolicy; // should this asset be inlined into the html file
	public mutability: Mutability; // can this asset change
    public minify: boolean; // should the asset be minified
    public loadPriority: number = 1; // which order should the assets be loaded in, lower numbers are loaded first

	constructor(filename: string, content: string | Buffer, type: AssetType, inlinePolicy: InlinePolicy, minify: boolean, mutability: Mutability, loadPriority: number = 1)
    {
        super(filename, content, Asset.typeToPath(type));
        this.type = type;
        this.inlinePolicy = inlinePolicy;
		this.mutability = mutability;
        this.minify = minify;
        this.loadPriority = loadPriority;

        if(mutability == Mutability.Static) 
		{
			AssetHandler.staticAssets.push(this);
			this.modifiedTime = AssetHandler.mainJsModTime; // by default all static assets have a modified time the same as main.js
		}
        else if(mutability == Mutability.Dynamic) 
		{
			AssetHandler.dynamicAssets.push(this);
			this.modifiedTime = Date.now();
		}
		else if(mutability == Mutability.Temporary) 
		{
			AssetHandler.temporaryAssets.push(this);
			this.modifiedTime = Date.now();
		}
        AssetHandler.allAssets.push(this);
    }

    public async load(): Promise<void>
    {
        if (this.type == AssetType.Style && typeof this.content == "string")
        {
            this.content = await AssetHandler.createAssetsFromStyles(this, false);
        }

        if (this.minify && this.type != AssetType.HTML && typeof this.content == "string")
        {
            this.content = await Asset.minify(this.content, this.type == AssetType.Script);
        }
    }

    override async download(downloadDirectory: Path): Promise<void> 
    {
        if (this.inlinePolicy == InlinePolicy.AlwaysInline) return;
        await super.download(downloadDirectory);
    }

    public static typeToPath(type: AssetType): Path
    {
        switch(type)
        {
            case AssetType.Style:
                return this.cssPath;
            case AssetType.Script:
                return this.jsPath;
            case AssetType.Media:
                return this.mediaPath;
            case AssetType.HTML:
                return this.htmlPath;
            case AssetType.Font:
                return this.fontPath;
            case AssetType.Other:
                return this.libraryPath;
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

    public static filterBodyClasses(inputCSS: string): string
    {
        // replace all selectors that change based on the body's class to always be applied
        let matchCount = 1;
        while (matchCount != 0)
        {
            let matches = Array.from(inputCSS.matchAll(/body\.(?!theme-dark|theme-light)[\w-]+/g));
            
            matchCount = 0;
            matches.forEach((match) =>
            {
                let selector = match[0];
                let classes = selector.split(".")[1];
                if (selector && classes && document.body.classList.contains(classes))
                {
                    inputCSS = inputCSS.replace(match[0].toString(), "body:is(.theme-dark, .theme-light)");
                    matchCount++;
                }
            });
        }

        return inputCSS;
    }

	/**Minify the contents of a JS or CSS string (No HTML)*/
    static async minify(content: string, asJavascript: boolean) : Promise<string>
	{
		let tempContent = content;

		try
		{
			// add script or style tags so that minifier can minify it as html
			if (asJavascript)
			{
				content = `
				<script>
				${content}
				</script>`;
			}
			else
			{
				content = `
				<style>
				${content}
				</style>`;
			}

			content = await runMinify(content, { collapseBooleanAttributes: true, minifyCSS: true, minifyJS: true, removeComments: true, removeEmptyAttributes: true, removeRedundantAttributes: true, removeScriptTypeAttributes: true, removeStyleLinkTypeAttributes: true, useShortDoctype: true});

			// remove the <script> or <style> tags
			content = content.replace("<script>", "").replace("</script>", "").replace("<style>", "").replace("</style>", "");
		}
		catch (e)
		{
			RenderLog.error(e.stack, "Error while minifying " + (asJavascript ? "JS" : "CSS") + " file.");
			content = tempContent;
		}

		if (content == "") content = " ";

		return content;
	}

	public getAssetPath(relativeFrom: Path | undefined = undefined): Path
	{
		if (this.inlinePolicy == InlinePolicy.AlwaysInline) return new Path("");
		
		if (relativeFrom == undefined) relativeFrom = Path.rootPath;
		let toRoot = Path.getRelativePath(relativeFrom, Path.rootPath);
		let newPath = toRoot.join(this.relativeDownloadPath).makeUnixStyle();
		if (MainSettings.settings.makeNamesWebStyle) newPath.makeWebStyle();
		
		return newPath;
	}

	protected shouldBeInlined(): boolean
	{
        return !(this.inlinePolicy == InlinePolicy.None || (this.type == AssetType.HTML && this.inlinePolicy == InlinePolicy.Auto));
	}

    public getHTMLInclude(checkInlinePolicy: boolean = false): string
    {
		if (checkInlinePolicy && !this.shouldBeInlined()) return "";

        if((MainSettings.settings.inlineAssets && this.inlinePolicy != InlinePolicy.NeverInline) || this.inlinePolicy == InlinePolicy.AlwaysInline)
        {
            switch(this.type)
            {
                case AssetType.Style:
                    return `<style>${this.content}</style>`;
                case AssetType.Script:
                    return `<script>${this.content}</script>`;
				case AssetType.Media:
					return `<${this.getTag()} src="${this.getContentBase64()}">`;
                case AssetType.HTML:
                    return this.content as string;
                case AssetType.Font:
                    return `<style>@font-face{font-family:'${this.filename}';src:url(${this.getContentBase64()}) format('woff2');}</style>`;
                default:
                    return "";
            }
        }
        
        if (!MainSettings.settings.inlineAssets || this.inlinePolicy == InlinePolicy.NeverInline)
        {
            let path = this.getAssetPath().asString;

            switch(this.type)
            {
                case AssetType.Style:
                    return `<link rel="stylesheet" href="${path}">`;
                case AssetType.Script:
                    return `<script src="${path}"></script>`;
                case AssetType.Media:
                    return `<${this.getTag()} src="${path}">`;
                case AssetType.Font:
                    return `<style>@font-face{font-family:'${this.filename}';src:url('${path}') format('woff2');}</style>`;
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
        const FileMimeType: {[key: string]: string} = {
            'audio/x-mpeg': 'mpega',
            'application/postscript': 'ps',
            'audio/x-aiff': 'aiff',
            'application/x-aim': 'aim',
            'image/x-jg': 'art',
            'video/x-ms-asf': 'asx',
            'audio/basic': 'ulw',
            'video/x-msvideo': 'avi',
            'video/x-rad-screenplay': 'avx',
            'application/x-bcpio': 'bcpio',
            'application/octet-stream': 'exe',
            'image/bmp': 'dib',
            'text/html': 'html',
            'application/x-cdf': 'cdf',
            'application/pkix-cert': 'cer',
            'application/java': 'class',
            'application/x-cpio': 'cpio',
            'application/x-csh': 'csh',
            'text/css': 'css',
            'application/msword': 'doc',
            'application/xml-dtd': 'dtd',
            'video/x-dv': 'dv',
            'application/x-dvi': 'dvi',
            'application/vnd.ms-fontobject': 'eot',
            'text/x-setext': 'etx',
            'image/gif': 'gif',
            'application/x-gtar': 'gtar',
            'application/x-gzip': 'gz',
            'application/x-hdf': 'hdf',
            'application/mac-binhex40': 'hqx',
            'text/x-component': 'htc',
            'image/ief': 'ief',
            'text/vnd.sun.j2me.app-descriptor': 'jad',
            'application/java-archive': 'jar',
            'text/x-java-source': 'java',
            'application/x-java-jnlp-file': 'jnlp',
            'image/jpeg': 'jpg',
            'application/javascript': 'js',
            'text/plain': 'txt',
            'application/json': 'json',
            'audio/midi': 'midi',
            'application/x-latex': 'latex',
            'audio/x-mpegurl': 'm3u',
            'image/x-macpaint': 'pnt',
            'text/troff': 'tr',
            'application/mathml+xml': 'mathml',
            'application/x-mif': 'mif',
            'video/quicktime': 'qt',
            'video/x-sgi-movie': 'movie',
            'audio/mpeg': 'mpa',
            'video/mp4': 'mp4',
            'video/mpeg': 'mpg',
            'video/mpeg2': 'mpv2',
            'application/x-wais-source': 'src',
            'application/x-netcdf': 'nc',
            'application/oda': 'oda',
            'application/vnd.oasis.opendocument.database': 'odb',
            'application/vnd.oasis.opendocument.chart': 'odc',
            'application/vnd.oasis.opendocument.formula': 'odf',
            'application/vnd.oasis.opendocument.graphics': 'odg',
            'application/vnd.oasis.opendocument.image': 'odi',
            'application/vnd.oasis.opendocument.text-master': 'odm',
            'application/vnd.oasis.opendocument.presentation': 'odp',
            'application/vnd.oasis.opendocument.spreadsheet': 'ods',
            'application/vnd.oasis.opendocument.text': 'odt',
            'application/vnd.oasis.opendocument.graphics-template': 'otg',
            'application/vnd.oasis.opendocument.text-web': 'oth',
            'application/vnd.oasis.opendocument.presentation-template': 'otp',
            'application/vnd.oasis.opendocument.spreadsheet-template': 'ots',
            'application/vnd.oasis.opendocument.text-template': 'ott',
            'application/ogg': 'ogx',
            'video/ogg': 'ogv',
            'audio/ogg': 'spx',
            'application/x-font-opentype': 'otf',
            'audio/flac': 'flac',
            'application/annodex': 'anx',
            'audio/annodex': 'axa',
            'video/annodex': 'axv',
            'application/xspf+xml': 'xspf',
            'image/x-portable-bitmap': 'pbm',
            'image/pict': 'pict',
            'application/pdf': 'pdf',
            'image/x-portable-graymap': 'pgm',
            'audio/x-scpls': 'pls',
            'image/png': 'png',
            'image/x-portable-anymap': 'pnm',
            'image/x-portable-pixmap': 'ppm',
            'application/vnd.ms-powerpoint': 'pps',
            'image/vnd.adobe.photoshop': 'psd',
            'image/x-quicktime': 'qtif',
            'image/x-cmu-raster': 'ras',
            'application/rdf+xml': 'rdf',
            'image/x-rgb': 'rgb',
            'application/vnd.rn-realmedia': 'rm',
            'application/rtf': 'rtf',
            'text/richtext': 'rtx',
            'application/font-sfnt': 'sfnt',
            'application/x-sh': 'sh',
            'application/x-shar': 'shar',
            'application/x-stuffit': 'sit',
            'application/x-sv4cpio': 'sv4cpio',
            'application/x-sv4crc': 'sv4crc',
            'image/svg+xml': 'svg',
            'application/x-shockwave-flash': 'swf',
            'application/x-tar': 'tar',
            'application/x-tcl': 'tcl',
            'application/x-tex': 'tex',
            'application/x-texinfo': 'texinfo',
            'image/tiff': 'tiff',
            'text/tab-separated-values': 'tsv',
            'application/x-font-ttf': 'ttf',
            'application/x-ustar': 'ustar',
            'application/voicexml+xml': 'vxml',
            'image/x-xbitmap': 'xbm',
            'application/xhtml+xml': 'xhtml',
            'application/vnd.ms-excel': 'xls',
            'application/xml': 'xsl',
            'image/x-xpixmap': 'xpm',
            'application/xslt+xml': 'xslt',
            'application/vnd.mozilla.xul+xml': 'xul',
            'image/x-xwindowdump': 'xwd',
            'application/vnd.visio': 'vsd',
            'audio/x-wav': 'wav',
            'image/vnd.wap.wbmp': 'wbmp',
            'text/vnd.wap.wml': 'wml',
            'application/vnd.wap.wmlc': 'wmlc',
            'text/vnd.wap.wmlsc': 'wmls',
            'application/vnd.wap.wmlscriptc': 'wmlscriptc',
            'video/x-ms-wmv': 'wmv',
            'application/font-woff': 'woff',
            'application/font-woff2': 'woff2',
            'model/vrml': 'wrl',
            'application/wspolicy+xml': 'wspolicy',
            'application/x-compress': 'z',
            'application/zip': 'zip'
          };

        return FileMimeType[mime] || mime.split("/")[1] || "txt";
    }

	public getContentBase64(): string
	{
		let extension = this.filename.split(".").pop() || "txt";
		let mimeType = mime(extension) || "text/plain";
		let base64 = this.content.toString("base64");
		return `data:${mimeType};base64,${base64}`;
	}

	private getTag(): string
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
		const extToTag: {[key: string]: string} = {
			"png": "img",
			"jpg": "img",
			"jpeg": "img",
			"tiff": "img",
			"bmp": "img",
			"avif": "img",
			"apng": "img",
			"gif": "img",
			"svg": "img",
			"webp": "img",
			"ico": "img",
			"mp4": "video",
			"webm": "video",
			"ogg": "video",
			"3gp": "video",
			"mov": "video",
			"mpeg": "video",
			"mp3": "audio",
			"wav": "audio",
			"flac": "audio",
			"aac": "audio",
			"m4a": "audio",
			"opus": "audio"
		};

		return extToTag[extension] || "img";
	}
}
