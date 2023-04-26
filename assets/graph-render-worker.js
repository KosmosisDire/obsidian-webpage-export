// Import Pixi.js library
if( 'function' === typeof importScripts) 
{
    importScripts('https://d157l7jdn8e5sf.cloudfront.net/v7.2.0/webworker.js', './tinycolor.js');

    addEventListener('message', onMessage);

    let app;
    let container;
    let graphics;
    let labelText;

    isDrawing = false;

    let linkCount = 0;
    let linkSources = [];
    let linkTargets = [];
    let nodeCount = 0;
    let radii = [];
    let labels = [];
    let cameraOffset = {x: 0, y: 0};
    let positions = new Float32Array(0);
    let linkLength = 0;
    let edgePruning = 0;
    let colors = 
    {
        background: 0x232323,
        link: 0xAAAAAA,
        node: 0xCCCCCC,
        outline: 0xAAAAAA,
        text: 0xFFFFFF,
        accent: 0x4023AA
    }

    let hoveredNode = -1;
    let lastHoveredNode = -1;
    let grabbedNode = -1;
    let updateAttached = false;
    let attachedToGrabbed = [];

    let cameraScale = 1;
    let cameraScaleRoot = 1;

    function toScreenSpace(x, y, floor = true)
    {
        if (floor)
        {
            return {x: Math.floor((x * cameraScale) + cameraOffset.x), y: Math.floor((y * cameraScale) + cameraOffset.y)};
        }
        else
        {
            return {x: (x * cameraScale) + cameraOffset.x, y: (y * cameraScale) + cameraOffset.y};
        }
    }

    function vecToScreenSpace({x, y}, floor = true)
    {
        return toScreenSpace(x, y, floor);
    }

    function toWorldspace(x, y)
    {
        return {x: (x - cameraOffset.x) / cameraScale, y: (y - cameraOffset.y) / cameraScale};
    }

    function vecToWorldspace({x, y})
    {
        return toWorldspace(x, y);
    }

    function setCameraCenterWorldspace({x, y})
    {
        cameraOffset.x = (canvas.width / 2) - (x * cameraScale);
        cameraOffset.y = (canvas.height / 2) - (y * cameraScale);
    }

    function getCameraCenterWorldspace()
    {
        return toWorldspace(canvas.width / 2, canvas.height / 2);
    }

    function getNodeScreenRadius(radius)
    {
        return radius * cameraScaleRoot;
    }

    function getNodeWorldspaceRadius(radius)
    {
        return radius / cameraScaleRoot;
    }

    function getPosition(index)
    {
        return {x: positions[index * 2], y: positions[index * 2 + 1]};
    }

    function mixColors(hexStart, hexEnd, factor)
    {
        return tinycolor.mix(tinycolor(hexStart.toString(16)), tinycolor(hexEnd.toString(16)), factor).toHexNumber()
    }

    function darkenColor(hexColor, factor)
    {
        return tinycolor(hexColor.toString(16)).darken(factor).toHexNumber();
    }

    function lightenColor(hexColor, factor)
    {
        return tinycolor(hexColor.toString(16)).lighten(factor).toHexNumber();
    }

    function invertColor(hex, bw) 
    {
        hex = hex.toString(16); // force conversion

        if (hex.indexOf('#') === 0) {
            hex = hex.slice(1);
        }
        // convert 3-digit hex to 6-digits.
        if (hex.length === 3) {
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }
        if (hex.length !== 6) {
            throw new Error('Invalid HEX color.');
        }
        var r = parseInt(hex.slice(0, 2), 16),
            g = parseInt(hex.slice(2, 4), 16),
            b = parseInt(hex.slice(4, 6), 16);
        if (bw) {
            // https://stackoverflow.com/a/3943023/112731
            return (r * 0.299 + g * 0.587 + b * 0.114) > 186
                ? '#000000'
                : '#FFFFFF';
        }
        // invert color components
        r = (255 - r).toString(16);
        g = (255 - g).toString(16);
        b = (255 - b).toString(16);
        // pad each with zeros and return
        return "#" + padZero(r) + padZero(g) + padZero(b);
    }

    let hoverFade = 0;
    let hoverFadeSpeed = 0.2;

    function draw()
    {
        graphics.clear();

        let topLines = [];
        if (updateAttached) 
        {
            attachedToGrabbed = [];
            // hoverFade = 0;
        }

        if (hoveredNode != -1 || grabbedNode != -1)
        {
            hoverFade = Math.min(1, hoverFade + hoverFadeSpeed);
        }else
        {
            hoverFade = Math.max(0, hoverFade - hoverFadeSpeed);
        }

        graphics.lineStyle(1, mixColors(colors.link, colors.background, hoverFade * 50), 0.7);

        for (let i = 0; i < linkCount; i++)
        {
            let target = linkTargets[i];
            let source = linkSources[i];

            if (hoveredNode == source || hoveredNode == target || ((lastHoveredNode == source || lastHoveredNode == target) && hoverFade != 0)) 
            {
                if (updateAttached && hoveredNode == source) 
                    attachedToGrabbed.push(target);

                else if (updateAttached && hoveredNode == target) 
                    attachedToGrabbed.push(source);

                topLines.push(i);
            }

            let startWorld = getPosition(source);
            let endWorld = getPosition(target);
            
            let start = vecToScreenSpace(startWorld);
            let end = vecToScreenSpace(endWorld);

            let dist = Math.sqrt(Math.pow(startWorld.x - endWorld.x, 2) + Math.pow(startWorld.y - endWorld.y, 2));

            if (dist < (radii[source] + radii[target]) * edgePruning)
            {
                graphics.moveTo(start.x, start.y);
                graphics.lineTo(end.x, end.y);
            }
        }

        let opacity = 1 - (hoverFade * 0.5);
        graphics.beginFill(mixColors(colors.node, colors.background, hoverFade * 50), opacity);
        graphics.lineStyle(0, 0xffffff);
        for (let i = 0; i < nodeCount; i++)
        {
            if (hoveredNode == i || (lastHoveredNode == i && hoverFade != 0) || (hoveredNode != -1 && attachedToGrabbed.includes(i))) continue;

            let pos = vecToScreenSpace(getPosition(i));

            graphics.drawCircle(pos.x, pos.y, getNodeScreenRadius(radii[i]));
        }

        graphics.endFill();


        opacity = hoverFade * 0.7;
        graphics.lineStyle(1, mixColors(mixColors(colors.link, colors.accent, hoverFade * 100), colors.background, 20), opacity);

        for (let i = 0; i < topLines.length; i++)
        {
            let target = linkTargets[topLines[i]];
            let source = linkSources[topLines[i]];

            // draw lines on top when hovered
            let start = vecToScreenSpace(getPosition(source));
            let end = vecToScreenSpace(getPosition(target));

            
            graphics.moveTo(start.x, start.y);
            graphics.lineTo(end.x, end.y);
        }

        if(hoveredNode != -1 || (lastHoveredNode != -1 && hoverFade != 0))
        {
            graphics.beginFill(mixColors(colors.node, colors.accent, hoverFade * 20), 0.9);
            graphics.lineStyle(0, 0xffffff);
            for (let i = 0; i < attachedToGrabbed.length; i++)
            {
                let point = attachedToGrabbed[i];

                let pos = vecToScreenSpace(getPosition(point));

                graphics.drawCircle(pos.x, pos.y, getNodeScreenRadius(radii[point]));
            }
            graphics.endFill();

            let index = hoveredNode != -1 ? hoveredNode : lastHoveredNode;

            let pos = vecToScreenSpace(getPosition(index));
            graphics.beginFill(mixColors(colors.node, colors.accent, hoverFade * 100), 1);
            graphics.lineStyle(hoverFade, mixColors(invertColor(colors.background, true), colors.accent, 50));
            graphics.drawCircle(pos.x, pos.y, getNodeScreenRadius(radii[index]));
            graphics.endFill();

            labelText.text = labels[index];
            let nodePos = vecToScreenSpace(getPosition(index));
            labelText.x = nodePos.x - labelText.width/2;
            labelText.y = nodePos.y + getNodeScreenRadius(radii[index]) + hoverFade * 5 + 15;
        }

        updateAttached = false;
        
        if (hoveredNode == -1)
        {
            labelText.text = "";
        }
        else
        {

        }
        
    }

    function onMessage(event)
    {
        if(event.data.type == "draw")
        {
            positions = new Float32Array(event.data.positions);
            draw();
        }
        else if(event.data.type == "update_camera")
        {
            cameraOffset = event.data.cameraOffset;
            cameraScale = event.data.cameraScale;
            cameraScaleRoot = Math.sqrt(cameraScale);
        }
        else if(event.data.type == "update_interaction")
        {
            if(hoveredNode != event.data.hoveredNode && event.data.hoveredNode != -1) updateAttached = true;
            if(grabbedNode != event.data.grabbedNode && event.data.hoveredNode != -1) updateAttached = true;
            
            if(event.data.hoveredNode == -1) lastHoveredNode = hoveredNode;
            else lastHoveredNode = -1;
            
            hoveredNode = event.data.hoveredNode;
            grabbedNode = event.data.grabbedNode;
        }
        else if(event.data.type == "resize")
        {
            app.renderer.resize(event.data.width, event.data.height);
        }
        else if(event.data.type == "update_colors")
        {
            colors = event.data.colors;

            if(labelText) 
            {
                labelText.style.fill = invertColor(colors.background, true);
            }
        }
        else if(event.data.type == "init")
        {
            // Extract data from message
            linkCount = event.data.linkCount;
            linkSources = event.data.linkSources;
            linkTargets = event.data.linkTargets;
            nodeCount = event.data.nodeCount;
            radii = event.data.radii;
            labels = event.data.labels;
            linkLength = event.data.linkLength;
            edgePruning = event.data.edgePruning;

            app = new PIXI.Application({... event.data.options, antialias: true, resolution: 2, backgroundAlpha: 0, transparent: true});
            container = new PIXI.Container();
            graphics = new PIXI.Graphics();
            app.stage.addChild(container);
            container.addChild(graphics);

            labelText = new PIXI.Text("", {fontFamily : 'Arial', fontSize: 16, fontWeight: "bold", fill : invertColor(colors.background, true), align : 'center', anchor: 0.5});
            app.stage.addChild(labelText);

        }
        else
        {
            console.log("Unknown message type sent to graph worker: " + event.data.type);
        }
    }
}







