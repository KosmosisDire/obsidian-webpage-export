import { Website } from "scripts/objects/website";
import { Asset, AssetType, InlinePolicy, Mutability } from "./asset";
import { Settings } from "scripts/settings/settings";

export class GlobalDataScript extends Asset
{
    public content: string = "";

    constructor()
    {
        super("global-data-script.js", "", AssetType.Script, InlinePolicy.Auto, true, Mutability.Dynamic);
    }
    
    override async load()
    {
        // this.content = "";
        // if (MainSettings.settings.includeGraphView)
        // {
        //     this.content += 
        //     `
        //     let nodes=\n${JSON.stringify(Website.globalGraph)};
        //     let attractionForce = ${MainSettings.settings.graphAttractionForce};
        //     let linkLength = ${MainSettings.settings.graphLinkLength};
        //     let repulsionForce = ${MainSettings.settings.graphRepulsionForce};
        //     let centralForce = ${MainSettings.settings.graphCentralForce};
        //     let edgePruning = ${MainSettings.settings.graphEdgePruning};
        //     `
        // }
        // await super.load();
    }
}
