
// generates an element that stores a url to an html file which will be loaded client side
export class IncludeGenerator
{
	public static generate(url: string, isDocument: boolean): string
	{
		return `<link itemprop="include${isDocument ? "-document" : ""}" href="${url}">`;
	}
}
