import { Path } from "src/plugin/utils/path";
import { Attachment } from "src/plugin/utils/downloadable";
import { ExportPipelineOptions } from "src/plugin/website/pipeline-options.js";
import { AssetType, InlinePolicy, LoadMethod, Mutability } from "./asset-types.js";
import { TFile } from "obsidian";
import  mime from "mime";
import { IncludeGenerator } from "src/plugin/features/include.js";
import { Settings } from "src/plugin/settings/settings";
import { AssetHandler } from "./asset-handler";
const { minify: runMinify } = require('html-minifier-terser');

export class AssetLoader extends Attachment 
{
    public type: AssetType; // what type of asset is this
    public inlinePolicy: InlinePolicy; // should this asset be inlined into the html file
	public mutability: Mutability; // can this asset change
    public minify: boolean; // should the asset be minified
    public loadMethod: LoadMethod = LoadMethod.Default; // should this asset be loaded asynchronously if possible
	public loadPriority: number = 100; // the priority of this asset when loading 
	public onlineURL: string | undefined = undefined; // the link to the asset online
	public childAssets: AssetLoader[] = []; // assets that depend on this asset

	constructor(filename: string, data: string | Buffer, source: TFile | undefined | null, type: AssetType, inlinePolicy: InlinePolicy, minify: boolean, mutability: Mutability, loadMethod: LoadMethod = LoadMethod.Async, loadPriority: number = 100, cdnPath: string | undefined = undefined, options: ExportPipelineOptions | undefined = undefined)
    {
		if (source && options == undefined) throw new Error("WebAsset options cannot be empty if source is not empty");
		options = Object.assign(Settings.exportOptions, options ?? {});
		const targetPath = AssetLoader.typeToDir(type).joinString(filename).slugify(options.slugifyPaths);
        super(data, targetPath, source, options);

        this.type = type;
        this.inlinePolicy = inlinePolicy;
		this.mutability = mutability;
        this.minify = minify;
        this.loadMethod = loadMethod;
		this.loadPriority = loadPriority;
		this.onlineURL = cdnPath;

		switch(mutability)
		{
			case Mutability.Static:
				AssetHandler.staticAssets.push(this);
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

	private static readonly replacements: {[key: string]: string} = {
		"\\[href": "[data-href",
		"\\.search-input-": "#search-",
		"\\.workspace-leaf-content\\[data-type.+?(markdown|pdf|canvas|kanban|excalidraw).*?\\]": "",
		"\\.nav-files-container": "#file-explorer",
		"\\.workspace-leaf-content": ".leaf-content",
		"\\.leaf>.leaf-content": ".leaf .leaf-content",
		"\\.markdown-reading-view": "#center-content",
		"\\.markdown-preview-sizer|\\.markdown-preview-section": ".markdown-preview-sizer",
		"\\.horizontal-main-container|\\.workspace": "#main-horizontal",
	}

    public async load(): Promise<void>
    {
		if (this.type == AssetType.Style && typeof this.data == "string")
		{
			this.childAssets = [];
			this.data = await AssetHandler.getStyleChildAssets(this, false);
			
			// replacements
			for (const key in AssetLoader.replacements)
			{
				const reg = new RegExp(key, "g");
				this.data = this.data.replace(reg, AssetLoader.replacements[key]);
			}
		}

        if (this.minify)
        {
            await this.minifyAsset();
        }
    }

    override async download(): Promise<void> 
    {
        if (this.isInlineFormat(this.exportOptions)) return;
        await super.download();
    }

    public static typeToDir(type: AssetType): Path
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
		if (this.type == AssetType.HTML || typeof this.data != "string") return;
		const isJS = this.type == AssetType.Script;
		const isCSS = this.type == AssetType.Style;

		let tempContent = this.data;

		try
		{
			// add script or style tags so that minifier can minify it as html
			if (isJS) tempContent = `<script>${tempContent}</script>`;
			if (isCSS) tempContent = `<style>${tempContent}</style>`;
			
			tempContent = await runMinify(tempContent, { minifyCSS: isCSS, minifyJS: isJS, removeComments: true, collapseWhitespace: true});
			
			// remove the <script> or <style> tags
			tempContent = tempContent.replace("<script>", "").replace("</script>", "").replace("<style>", "").replace("</style>", "");
			this.data = tempContent;
		}
		catch (e)
		{
			console.error("Unable to minify " + (isJS ? "JS" : "CSS") + " file.");

			// remove whitespace manually
			this.data = this.data.replace(/[\n\r]+/g, "");
		}
	}

	public getAssetPath(relativeFrom: Path | undefined = undefined): Path
	{
		if (this.isInlineFormat(this.exportOptions)) return new Path("");
		
		if (relativeFrom == undefined) relativeFrom = Path.rootPath;
		const toRoot = Path.getRelativePath(relativeFrom, Path.rootPath);
		const newPath = toRoot.join(this.targetPath);
		newPath.slugify(this.exportOptions.slugifyPaths);
		
		return newPath;
	}

	protected isInlineFormat(options: ExportPipelineOptions): boolean
	{
		const isInlineFormat = this.inlinePolicy == InlinePolicy.Inline || 
							 this.inlinePolicy == InlinePolicy.InlineHead || 
							 ((this.inlinePolicy == InlinePolicy.Auto || this.inlinePolicy == InlinePolicy.AutoHead) && 
							 (
							 (options.inlineCSS! && this.type == AssetType.Style) ||
							 (options.inlineJS! && this.type == AssetType.Script) ||
							 (options.inlineMedia! && this.type == AssetType.Media) ||
							 (options.inlineHTML! && this.type == AssetType.HTML) ||
							 (options.inlineFonts! && this.type == AssetType.Font)
							 ));

        return isInlineFormat;
	}

	protected isRefFormat(options: ExportPipelineOptions): boolean
	{
		const isRefFormat = this.inlinePolicy == InlinePolicy.Download || 
						  this.inlinePolicy == InlinePolicy.DownloadHead ||
						  ((this.inlinePolicy == InlinePolicy.Auto || this.inlinePolicy == InlinePolicy.AutoHead) && 
						  !((options.inlineCSS! && this.type == AssetType.Style) ||
						  	(options.inlineJS! && this.type == AssetType.Script) ||
						  	(options.inlineMedia! && this.type == AssetType.Media) ||
						  	(options.inlineHTML! && this.type == AssetType.HTML) ||
						  	(options.inlineFonts! && this.type == AssetType.Font)
						  ));
		return isRefFormat;
	}

    public getHTML(options: ExportPipelineOptions): string
    {
        if(this.isInlineFormat(options))
        {
            switch(this.type)
            {
                case AssetType.Style:
                    return `<style>${this.data}</style>`;
                case AssetType.Script:
                    return `<script ${this.loadMethod}>${this.data}</script>`;
				case AssetType.Media:
					return `<${this.getHTMLTagName()} src="${this.getContentBase64()}"/>`;
                case AssetType.HTML:
                    return this.data as string;
                case AssetType.Font:
                    return `<style>@font-face{font-family:'${this.basename}';src:url(${this.getContentBase64()}) format('woff2');}</style>`;
                default:
                    return "";
            }
        }
        
        if (this.isRefFormat(options))
        {
            let path = this.getAssetPath(undefined).path;
			if (options.offlineResources === false && this.onlineURL) path = this.onlineURL;

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
					include = `<script ${this.loadMethod} id="${this.basename + "-script"}" src="${path}" onload='this.onload=null;this.setAttribute(\"loaded\", \"true\")'></script>`;
                    return include;
                case AssetType.Media:
					attr = this.loadMethod == LoadMethod.Defer ? "loading='eager'" : "loading='lazy'";
					if (this.loadMethod == LoadMethod.Default) attr = "";
					include = `<${this.getHTMLTagName()} src="${path}" ${attr} />`;
                    return include;
                case AssetType.Font:
					include = `<style>@font-face{font-family:'${this.basename}';src:url('${path}') format('woff2');}</style>`;
                    return include;
				case AssetType.HTML:
					return IncludeGenerator.generate(path, false);
                default:
                    return "";
            }
        }

		console.log("Unable to inline or reference " + this.filename);
        return "";
    }

    public static mimeToExtention(mime: string): string
    {
        const FileMimeType: {[key: string]: string} = {'audio/x-mpeg': 'mpega', 'application/postscript': 'ps', 'audio/x-aiff': 'aiff', 'application/x-aim': 'aim', 'image/x-jg': 'art', 'video/x-ms-asf': 'asx', 'audio/basic': 'ulw', 'video/x-msvideo': 'avi', 'video/x-rad-screenplay': 'avx', 'application/x-bcpio': 'bcpio', 'application/octet-stream': 'exe', 'image/bmp': 'dib', 'text/html': 'html', 'application/x-cdf': 'cdf', 'application/pkix-cert': 'cer', 'application/java': 'class', 'application/x-cpio': 'cpio', 'application/x-csh': 'csh', 'text/css': 'css', 'application/msword': 'doc', 'application/xml-dtd': 'dtd', 'video/x-dv': 'dv', 'application/x-dvi': 'dvi', 'application/vnd.ms-fontobject': 'eot', 'text/x-setext': 'etx', 'image/gif': 'gif', 'application/x-gtar': 'gtar', 'application/x-gzip': 'gz', 'application/x-hdf': 'hdf', 'application/mac-binhex40': 'hqx', 'text/x-component': 'htc', 'image/ief': 'ief', 'text/vnd.sun.j2me.app-descriptor': 'jad', 'application/java-archive': 'jar', 'text/x-java-source': 'java', 'application/x-java-jnlp-file': 'jnlp', 'image/jpeg': 'jpg', 'application/javascript': 'js', 'text/plain': 'txt', 'application/json': 'json', 'audio/midi': 'midi', 'application/x-latex': 'latex', 'audio/x-mpegurl': 'm3u', 'image/x-macpaint': 'pnt', 'text/troff': 'tr', 'application/mathml+xml': 'mathml', 'application/x-mif': 'mif', 'video/quicktime': 'qt', 'video/x-sgi-movie': 'movie', 'audio/mpeg': 'mpa', 'video/mp4': 'mp4', 'video/mpeg': 'mpg', 'video/mpeg2': 'mpv2', 'application/x-wais-source': 'src', 'application/x-netcdf': 'nc', 'application/oda': 'oda', 'application/vnd.oasis.opendocument.database': 'odb', 'application/vnd.oasis.opendocument.chart': 'odc', 'application/vnd.oasis.opendocument.formula': 'odf', 'application/vnd.oasis.opendocument.graphics': 'odg', 'application/vnd.oasis.opendocument.image': 'odi', 'application/vnd.oasis.opendocument.text-master': 'odm', 'application/vnd.oasis.opendocument.presentation': 'odp', 'application/vnd.oasis.opendocument.spreadsheet': 'ods', 'application/vnd.oasis.opendocument.text': 'odt', 'application/vnd.oasis.opendocument.graphics-template': 'otg', 'application/vnd.oasis.opendocument.text-web': 'oth', 'application/vnd.oasis.opendocument.presentation-template': 'otp', 'application/vnd.oasis.opendocument.spreadsheet-template': 'ots', 'application/vnd.oasis.opendocument.text-template': 'ott', 'application/ogg': 'ogx', 'video/ogg': 'ogv', 'audio/ogg': 'spx', 'application/x-font-opentype': 'otf', 'audio/flac': 'flac', 'application/annodex': 'anx', 'audio/annodex': 'axa', 'video/annodex': 'axv', 'application/xspf+xml': 'xspf', 'image/x-portable-bitmap': 'pbm', 'image/pict': 'pict', 'application/pdf': 'pdf', 'image/x-portable-graymap': 'pgm', 'audio/x-scpls': 'pls', 'image/png': 'png', 'image/x-portable-anymap': 'pnm', 'image/x-portable-pixmap': 'ppm', 'application/vnd.ms-powerpoint': 'pps', 'image/vnd.adobe.photoshop': 'psd', 'image/x-quicktime': 'qtif', 'image/x-cmu-raster': 'ras', 'application/rdf+xml': 'rdf', 'image/x-rgb': 'rgb', 'application/vnd.rn-realmedia': 'rm', 'application/rtf': 'rtf', 'text/richtext': 'rtx', 'application/font-sfnt': 'sfnt', 'application/x-sh': 'sh', 'application/x-shar': 'shar', 'application/x-stuffit': 'sit', 'application/x-sv4cpio': 'sv4cpio', 'application/x-sv4crc': 'sv4crc', 'image/svg+xml': 'svg', 'application/x-shockwave-flash': 'swf', 'application/x-tar': 'tar', 'application/x-tcl': 'tcl', 'application/x-tex': 'tex', 'application/x-texinfo': 'texinfo', 'image/tiff': 'tiff', 'text/tab-separated-values': 'tsv', 'application/x-font-ttf': 'ttf', 'application/x-ustar': 'ustar', 'application/voicexml+xml': 'vxml', 'image/x-xbitmap': 'xbm', 'application/xhtml+xml': 'xhtml', 'application/vnd.ms-excel': 'xls', 'application/xml': 'xsl', 'image/x-xpixmap': 'xpm', 'application/xslt+xml': 'xslt', 'application/vnd.mozilla.xul+xml': 'xul', 'image/x-xwindowdump': 'xwd', 'application/vnd.visio': 'vsd', 'audio/x-wav': 'wav', 'image/vnd.wap.wbmp': 'wbmp', 'text/vnd.wap.wml': 'wml', 'application/vnd.wap.wmlc': 'wmlc', 'text/vnd.wap.wmlsc': 'wmls', 'application/vnd.wap.wmlscriptc': 'wmlscriptc', 'video/x-ms-wmv': 'wmv', 'application/font-woff': 'woff', 'application/font-woff2': 'woff2', 'model/vrml': 'wrl', 'application/wspolicy+xml': 'wspolicy', 'application/x-compress': 'z', 'application/zip': 'zip'};
        return FileMimeType[mime] || mime.split("/")[1] || "txt";
    }

	public static extentionToMime(extention: string): string
	{
		if (extention.startsWith(".")) extention = extention.slice(1);
		const FileMimeType: {[key: string]: string} = {'mpega': 'audio/x-mpeg', 'ps': 'application/postscript', 'aiff': 'audio/x-aiff', 'aim': 'application/x-aim', 'art': 'image/x-jg', 'asx': 'video/x-ms-asf', 'ulw': 'audio/basic', 'avi': 'video/x-msvideo', 'avx': 'video/x-rad-screenplay', 'bcpio': 'application/x-bcpio', 'exe': 'application/octet-stream', 'dib': 'image/bmp', 'html': 'text/html', 'cdf': 'application/x-cdf', 'cer': 'application/pkix-cert', 'class': 'application/java', 'cpio': 'application/x-cpio', 'csh': 'application/x-csh', 'css': 'text/css', 'doc': 'application/msword', 'dtd': 'application/xml-dtd', 'dv': 'video/x-dv', 'dvi': 'application/x-dvi', 'eot': 'application/vnd.ms-fontobject', 'etx': 'text/x-setext', 'gif': 'image/gif', 'gtar': 'application/x-gtar', 'gz': 'application/x-gzip', 'hdf': 'application/x-hdf', 'hqx': 'application/mac-binhex40', 'htc': 'text/x-component', 'ief': 'image/ief', 'jad': 'text/vnd.sun.j2me.app-descriptor', 'jar': 'application/java-archive', 'java': 'text/x-java-source', 'jnlp': 'application/x-java-jnlp-file', 'jpg': 'image/jpeg', 'js': 'application/javascript', 'txt': 'text/plain', 'json': 'application/json', 'midi': 'audio/midi', 'latex': 'application/x-latex', 'm3u': 'audio/x-mpegurl', 'pnt': 'image/x-macpaint', 'tr': 'text/troff', 'mathml': 'application/mathml+xml', 'mif': 'application/x-mif', 'qt': 'video/quicktime', 'movie': 'video/x-sgi-movie', 'mpa': 'audio/mpeg', 'mp4': 'video/mp4', 'mpg': 'video/mpeg', 'mpv2': 'video/mpeg2', 'src': 'application/x-wais-source', 'nc': 'application/x-netcdf', 'oda': 'application/oda', 'odb': 'application/vnd.oasis.opendocument.database', 'odc': 'application/vnd.oasis.opendocument.chart', 'odf': 'application/vnd.oasis.opendocument.formula', 'odg': 'application/vnd.oasis.opendocument.graphics', 'odi': 'application/vnd.oasis.opendocument.image', 'odm': 'application/vnd.oasis.opendocument.text-master', 'odp': 'application/vnd.oasis.opendocument.presentation', 'ods': 'application/vnd.oasis.opendocument.spreadsheet', 'odt': 'application/vnd.oasis.opendocument.text', 'otg': 'application/vnd.oasis.opendocument.graphics-template', 'oth': 'application/vnd.oasis.opendocument.text-web', 'otp': 'application/vnd.oasis.opendocument.presentation-template', 'ots': 'application/vnd.oasis.opendocument.spreadsheet-template', 'ott': 'application/vnd.oasis.opendocument.text-template', 'ogx': 'application/ogg', 'ogv': 'video/ogg', 'spx': 'audio/ogg', 'otf': 'application/x-font-opentype', 'flac': 'audio/flac', 'anx': 'application/annodex', 'axa': 'audio/annodex', 'axv': 'video/annodex', 'xspf': 'application/xspf+xml', 'pbm': 'image/x-portable-bitmap', 'pict': 'image/pict', 'pdf': 'application/pdf', 'pgm': 'image/x-portable-graymap', 'pls': 'audio/x-scpls', 'png': 'image/png', 'pnm': 'image/x-portable-anymap', 'ppm': 'image/x-portable-pixmap', 'pps': 'application/vnd.ms-powerpoint', 'psd': 'image/vnd.adobe.photoshop', 'qtif': 'image/x-quicktime', 'ras': 'image/x-cmu-raster', 'rdf': 'application/rdf+xml', 'rgb': 'image/x-rgb', 'rm': 'application/vnd.rn-realmedia', 'rtf': 'application/rtf', 'rtx': 'text/richtext', 'sfnt': 'application/font-sfnt', 'sh': 'application/x-sh', 'shar': 'application/x-shar', 'sit': 'application/x-stuffit', 'sv4cpio': 'application/x-sv4cpio', 'sv4crc': 'application/x-sv4crc', 'svg': 'image/svg+xml', 'swf': 'application/x-shockwave-flash', 'tar': 'application/x-tar', 'tcl': 'application/x-tcl', 'tex': 'application/x-tex', 'texinfo': 'application/x-texinfo', 'tiff': 'image/tiff', 'tsv': 'text/tab-separated-values', 'ttf': 'application/x-font-ttf', 'ustar': 'application/x-ustar', 'vxml': 'application/voicexml+xml', 'xbm': 'image/x-xbitmap', 'xhtml': 'application/xhtml+xml', 'xls': 'application/vnd.ms-excel', 'xsl': 'application/xml', 'xpm': 'image/x-xpixmap', 'xslt': 'application/xslt+xml', 'xul': 'application/vnd.mozilla.xul+xml', 'xwd': 'image/x-xwindowdump', 'vsd': 'application/vnd.visio', 'wav': 'audio/x-wav', 'wbmp': 'image/vnd.wap.wbmp', 'wml': 'text/vnd.wap.wml', 'wmlc': 'application/vnd.wap.wmlc', 'wmls': 'text/vnd.wap.wmlsc', 'wmlscriptc': 'application/vnd.wap.wmlscriptc', 'wmv': 'video/x-ms-wmv', 'woff': 'application/font-woff', 'woff2': 'application/font-woff2', 'wrl': 'model/vrml', 'wspolicy': 'application/wspolicy+xml', 'z': 'application/x-compress', 'zip': 'application/zip'};
		return FileMimeType[extention] || "application/octet-stream";
	}

	public getContentBase64(): string
	{
		const extension = this.extensionName;
		const mimeType = mime.getType(extension) || "text/plain";
		const base64 = this.data.toString("base64");
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
		const extension = this.extensionName;
		const extToTag: {[key: string]: string} = {"png": "img", "jpg": "img", "jpeg": "img", "tiff": "img", "bmp": "img", "avif": "img", "apng": "img", "gif": "img", "svg": "img", "webp": "img", "ico": "img", "mp4": "video", "webm": "video", "ogg": "video", "3gp": "video", "mov": "video", "mpeg": "video", "mp3": "audio", "wav": "audio", "flac": "audio", "aac": "audio", "m4a": "audio", "opus": "audio", "pdf": "embed"};
		return extToTag[extension] || "img";
	}
}
