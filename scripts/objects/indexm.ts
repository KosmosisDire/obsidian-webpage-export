import * as fs from "fs";
import * as path from "path";
import * as cheerio from "cheerio";
import Minisearch from 'minisearch';

export class IndexM {
    private static currentId = 1;
    public static async indexHTMLFiles(indexPath: string): Promise<void> {
        const index = new Minisearch({
            fields: ['title', 'content'],
            storeFields: ['title', 'path'],
          });

        // Read all HTML files in the IndexPath and subfolders
        const htmlFiles = this.getHTMLFiles(indexPath);
        
        // Process each HTML file and add to the index
        for (const file of htmlFiles) {
            const content = await this.extractContentFromFile(file);
            if (content) {
                const id = this.currentId.toString();
                this.currentId++;
                const relativePath = path.relative(indexPath, file);
                index.add({
                    id,
                    title: content.title,
                    content: content.content,
                    path: relativePath,
                });
            }
        }

        // Save the index as a JSON file
        const jsonIndex = index.toJSON();
        const jsonIndexPath = path.join(indexPath, 'lib', 'searchIndex.json');
        fs.writeFileSync(jsonIndexPath, JSON.stringify(jsonIndex, null, 2));

        console.log(`Indexing completed. JSON index saved at: ${jsonIndexPath}`);
    }

    private static getHTMLFiles(directory: string): string[] {
        const htmlFiles: string[] = [];
        const files = fs.readdirSync(directory);

        for (const file of files) {
            const filePath = path.join(directory, file);
            const stat = fs.statSync(filePath);

            if (stat.isDirectory()) {
                htmlFiles.push(...this.getHTMLFiles(filePath));
            } else if (file.endsWith(".html")) {
                htmlFiles.push(filePath);
            }
        }

        return htmlFiles;
    }

    private static async extractContentFromFile(filePath: string): Promise<{ title: string; content: string } | null> {
        try {
            if (!fs.existsSync(filePath)) {
                console.error(`File not found: ${filePath}`);
                return null;
            }

            const fileContent = fs.readFileSync(filePath, "utf-8");
            const $ = cheerio.load(fileContent, { xmlMode: true }); // Use xmlMode to handle self-closing tags

            // Remove header and pre
			$("pre").remove();
            $("div.mod-header").remove();

            const title = $("title").text().trim();
            const contentContainer = $(".document-container");

            // Add a space before and after each <li> <ul> tag
            contentContainer.find("li, ul").each((_, element) => {
                $(element).before(' ').after(' ');
            });

            // Extract text content from anchor tags - they will be stored as tag~*tagname*
            contentContainer.find("a").each((_, element) => {
                const anchorText = $(element).text().trim();
                const modifiedAnchorText = anchorText.startsWith('#') ? `tag~${anchorText.substring(1)}` : anchorText;
                const anchorContent = `${modifiedAnchorText} ${anchorText}`;
                contentContainer.append(` ${anchorContent} `);
            });
            

            const content = contentContainer.text().trim().replace(/\s+/g, ' ');

            return { title, content };
        } catch (error) {
            console.error(`Error extracting content from ${filePath}: ${error.message}`);
            return null;
        }
    }
}
