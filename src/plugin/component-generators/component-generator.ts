

export interface ComponentGenerator
{
	generate(container?: HTMLElement): Promise<HTMLElement>;
}
