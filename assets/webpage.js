jQuery(function()
{
    // THEME TOGGLE

	// load saved theme state
    if (localStorage.getItem("theme_toggle") != null)
    {
        setThemeToggle(localStorage.getItem("theme_toggle") == "true");
    }

	var lastScheme = "theme-dark";
	// change theme to match current system theme
	if (localStorage.getItem("theme_toggle") == null && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches)
	{
		setThemeToggle(true);
		lastScheme = "theme-light";
	}
	if (localStorage.getItem("theme_toggle") == null && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
	{
		setThemeToggle(true);
		lastScheme = "theme-dark";
	}

	// set initial toggle state based on body theme class
	if ($("body").hasClass("theme-light"))
	{
		setThemeToggle(true);
	}
	else
	{
		setThemeToggle(false);
	}

	function setThemeToggle(state, instant = false)
	{
		$(".toggle__input").each(function()
		{
			$(this).prop("checked", state);
		});

		if(!$(".toggle__input").hasClass("is-checked") && state)
		{
			$(".toggle__input").addClass("is-checked");
		}
		else if ($(".toggle__input").hasClass("is-checked") && !state)
		{
			$(".toggle__input").removeClass("is-checked");
		}

		if(!state)
		{
			if ($("body").hasClass("theme-light"))
			{
				$("body").removeClass("theme-light");
			}

			if (!$("body").hasClass("theme-dark"))
			{
				$("body").addClass("theme-dark");
			}
		}
		else
		{
			if ($("body").hasClass("theme-dark"))
			{
				$("body").removeClass("theme-dark");
			}

			if (!$("body").hasClass("theme-light"))
			{
				$("body").addClass("theme-light");
			}
		}

		localStorage.setItem("theme_toggle", state ? "true" : "false");
	}

    $(".toggle__input").on("click", function()
    {
		setThemeToggle(!(localStorage.getItem("theme_toggle") == "true"));
    });

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => 
	{
		// return if we are printing
		if (window.matchMedia('print').matches)
		{
			printing = true;
			return;
		}

        let newColorScheme = event.matches ? "theme-dark" : "theme-light";

		if (newColorScheme == lastScheme) return;

        if (newColorScheme == "theme-dark")
        {
			setThemeToggle(false);
        }

        if (newColorScheme == "theme-light")
        {
			setThemeToggle(true);
        }

		lastScheme = newColorScheme;
    });

    // MAKE CALLOUTS COLLAPSIBLE
    // if the callout title is clicked, toggle the display of .callout-content
    $(".callout.is-collapsible .callout-title").on("click", function()
    {
        var isCollapsed = $(this).parent().hasClass("is-collapsed");

        if (isCollapsed)
        {
            $(this).parent().toggleClass("is-collapsed");
        }

        $(this).parent().find(".callout-content").slideToggle(duration = 100, complete = function()
        {
            if (!isCollapsed)
            {
                $(this).parent().toggleClass("is-collapsed");
            }
        });
    });

    

    // MAKE HEADERS COLLAPSIBLE
    // if "heading-collapse-indicator" is clicked, toggle the display of every div until the next heading of the same or lower level

    function getHeadingContentsSelector(header)
    {
        let headingLevel = $(header).children().first().prop("tagName").toLowerCase();
        let headingNumber = parseInt(headingLevel.replace("h", ""));

        let endingHeadings = [1, 2, 3, 4, 5, 6].filter(function(item)
        {
            return item <= headingNumber;
        }).map(function(item)
        {
            return `div:has(h${item})`;
        });

        let endingHeadingsSelector = endingHeadings.join(", ");

        return endingHeadingsSelector;
    }

	function setHeaderCollapse(header, collapse)
	{
		let selector = getHeadingContentsSelector($(header));

        if(!collapse)
        {
			if ($(header).hasClass("is-collapsed")) $(header).toggleClass("is-collapsed");

            $(header).nextUntil(selector).show();
			
			// close headers inside of this one that are collapsed
            $(header).nextUntil(selector).each(function()
            {
				if($(this).hasClass("is-collapsed"))
					setHeaderCollapse($(this), true);
            });
			
			//open headers above this one that are collapsed
			lastHeaderSize = $(header).children().first().prop("tagName").toLowerCase().replace("h", "");
			$(header).prevAll().each(function()
			{
				if($(this).hasClass("is-collapsed") && $(this).has("h1, h2, h3, h4, h5, h6"))
				{
					let hSize = $(this).children().first().prop("tagName").toLowerCase().replace("h", "");
					if(hSize < lastHeaderSize)
					{
						setHeaderCollapse($(this), false);
						lastHeaderSize = hSize;
					}
				}
			});
        }
        else
        {
			if (!$(header).hasClass("is-collapsed")) $(header).toggleClass("is-collapsed");
            $(header).nextUntil(selector).hide();
        }
	}

    $(".heading-collapse-indicator").on("click", function()
    {
        var isCollapsed = $(this).parent().parent().hasClass("is-collapsed");
		setHeaderCollapse($(this).parent().parent(), !isCollapsed);
    });

	// open outline header when an internal link that points to that header is clicked
	$(".internal-link").on("click", function()
	{
		let target = $(this).attr("href");

		if (target.startsWith("#"))
		{
			let header = $(document.getElementById(target.substring(1)));

			setHeaderCollapse($(header).parent(), false);
		}
	});

    // MAKE OUTLINE COLLAPSIBLE
    // if "outline-header" is clicked, toggle the display of every div until the next heading of the same or lower level
    
	function setOutlineCollapse(header, collapse)
	{
		if (collapse)
		{
			if (!$(header).hasClass("is-collapsed")) 
				$(header).addClass("is-collapsed");

			$(header).children(".outline-item-children").slideUp(120);
		}
		else
		{
			if ($(header).hasClass("is-collapsed"))
				$(header).removeClass("is-collapsed");
			
			$(header).children(".outline-item-children").slideDown(120);
		}
	}

	function toggleOutlineCollapse(header)
	{
		let isCollapsed = $(header).hasClass("is-collapsed");
		setOutlineCollapse(header, !isCollapsed);
	}

    $(".outline-item-contents > .collapse-icon").on("click", function(e)
    {
        toggleOutlineCollapse($(this).parent().parent());

		// Prevent the collapse button from triggering the parent <a> tag navigation.
		// fix implented by 'zombony' from GitHub
		return false;
    });

	$(".collapse-all").on("click", function()
	{
		let button = $(this);
		$(".outline-container div.outline-item").each(function()
		{
			setOutlineCollapse($(this), !button.hasClass("is-collapsed"));
		});

		button.toggleClass("is-collapsed");

		button.find("iconify-icon").attr("icon", button.hasClass("is-collapsed") ? "ph:arrows-out-line-horizontal-bold" : "ph:arrows-in-line-horizontal-bold");
	});

    // hide the control button if the header has no children
    $(".outline-item-children:not(:has(*))").each(function()
    {
        $(this).parent().find(".collapse-icon").hide();
    });


	// Fix checkboxed toggling .is-checked
	$(".task-list-item-checkbox").on("click", function()
	{
		$(this).parent().toggleClass("is-checked");
		$(this).parent().attr("data-task", $(this).parent().hasClass("is-checked") ? "x" : " ");
	});

	$(`.plugin-tasks-list-item input[type="checkbox"]`).each(function()
	{
		$(this).prop("checked", $(this).parent().hasClass("is-checked"));
	});

	$('.kanban-plugin__item.is-complete').each(function()
	{
		$(this).find('input[type="checkbox"]').prop("checked", true);
	});

	// make code snippet block copy button copy the code to the clipboard
	$(".copy-code-button").on("click", function()
	{
		let code = $(this).parent().find("code").text();
		navigator.clipboard.writeText(code);
		$(this).text("Copied!");
		// set a timeout to change the text back
		setTimeout(function()
		{
			$(".copy-code-button").text("Copy");
		}, 2000);
	});

	let focusedNode = null;

	// make canvas nodes selectable
	$(".canvas-node-content-blocker").on("click", function()
	{
		$(this).parent().parent().toggleClass("is-focused");
		$(this).hide();

		if (focusedNode)
		{
			focusedNode.removeClass("is-focused");
			$(focusedNode).find(".canvas-node-content-blocker").show();
		}

		focusedNode = $(this).parent().parent();
	});

	// make canvas node deselect when clicking outside
	$(document).on("click", function(event)
	{
		if (!$(event.target).closest(".canvas-node").length)
		{
			$(".canvas-node").removeClass("is-focused");
			$(".canvas-node-content-blocker").show();
		}
	});

	// unhide html elements that are hidden by default
	// $("html").css("visibility", "visible");
	// $("html").css("background-color", "var(--background-primary)");
});


// -------------------------- GRAPH VIEW --------------------------

// Wasm glue
var Module=typeof Module!="undefined"?Module:{};var moduleOverrides=Object.assign({},Module);var arguments_=[];var thisProgram="./this.program";var quit_=(status,toThrow)=>{throw toThrow};var ENVIRONMENT_IS_WEB=typeof window=="object";var ENVIRONMENT_IS_WORKER=typeof importScripts=="function";var ENVIRONMENT_IS_NODE=typeof process=="object"&&typeof process.versions=="object"&&typeof process.versions.node=="string";var scriptDirectory="";function locateFile(path){if(Module["locateFile"]){return Module["locateFile"](path,scriptDirectory)}return scriptDirectory+path}var read_,readAsync,readBinary,setWindowTitle;if(ENVIRONMENT_IS_NODE){var fs=require("fs");var nodePath=require("path");if(ENVIRONMENT_IS_WORKER){scriptDirectory=nodePath.dirname(scriptDirectory)+"/"}else{scriptDirectory=__dirname+"/"}read_=(filename,binary)=>{filename=isFileURI(filename)?new URL(filename):nodePath.normalize(filename);return fs.readFileSync(filename,binary?undefined:"utf8")};readBinary=filename=>{var ret=read_(filename,true);if(!ret.buffer){ret=new Uint8Array(ret)}return ret};readAsync=(filename,onload,onerror)=>{filename=isFileURI(filename)?new URL(filename):nodePath.normalize(filename);fs.readFile(filename,function(err,data){if(err)onerror(err);else onload(data.buffer)})};if(!Module["thisProgram"]&&process.argv.length>1){thisProgram=process.argv[1].replace(/\\/g,"/")}arguments_=process.argv.slice(2);if(typeof module!="undefined"){module["exports"]=Module}process.on("uncaughtException",function(ex){if(ex!=="unwind"&&!(ex instanceof ExitStatus)&&!(ex.context instanceof ExitStatus)){throw ex}});var nodeMajor=process.versions.node.split(".")[0];if(nodeMajor<15){process.on("unhandledRejection",function(reason){throw reason})}quit_=(status,toThrow)=>{process.exitCode=status;throw toThrow};Module["inspect"]=function(){return"[Emscripten Module object]"}}else if(ENVIRONMENT_IS_WEB||ENVIRONMENT_IS_WORKER){if(ENVIRONMENT_IS_WORKER){scriptDirectory=self.location.href}else if(typeof document!="undefined"&&document.currentScript){scriptDirectory=document.currentScript.src}if(scriptDirectory.indexOf("blob:")!==0){scriptDirectory=scriptDirectory.substr(0,scriptDirectory.replace(/[?#].*/,"").lastIndexOf("/")+1)}else{scriptDirectory=""}{read_=url=>{var xhr=new XMLHttpRequest;xhr.open("GET",url,false);xhr.send(null);return xhr.responseText};if(ENVIRONMENT_IS_WORKER){readBinary=url=>{var xhr=new XMLHttpRequest;xhr.open("GET",url,false);xhr.responseType="arraybuffer";xhr.send(null);return new Uint8Array(xhr.response)}}readAsync=(url,onload,onerror)=>{var xhr=new XMLHttpRequest;xhr.open("GET",url,true);xhr.responseType="arraybuffer";xhr.onload=()=>{if(xhr.status==200||xhr.status==0&&xhr.response){onload(xhr.response);return}onerror()};xhr.onerror=onerror;xhr.send(null)}}setWindowTitle=title=>document.title=title}else{}var out=Module["print"]||console.log.bind(console);var err=Module["printErr"]||console.warn.bind(console);Object.assign(Module,moduleOverrides);moduleOverrides=null;if(Module["arguments"])arguments_=Module["arguments"];if(Module["thisProgram"])thisProgram=Module["thisProgram"];if(Module["quit"])quit_=Module["quit"];var wasmBinary;if(Module["wasmBinary"])wasmBinary=Module["wasmBinary"];var noExitRuntime=Module["noExitRuntime"]||true;if(typeof WebAssembly!="object"){abort("no native wasm support detected")}var wasmMemory;var ABORT=false;var EXITSTATUS;var HEAP8,HEAPU8,HEAP16,HEAPU16,HEAP32,HEAPU32,HEAPF32,HEAPF64;function updateMemoryViews(){var b=wasmMemory.buffer;Module["HEAP8"]=HEAP8=new Int8Array(b);Module["HEAP16"]=HEAP16=new Int16Array(b);Module["HEAP32"]=HEAP32=new Int32Array(b);Module["HEAPU8"]=HEAPU8=new Uint8Array(b);Module["HEAPU16"]=HEAPU16=new Uint16Array(b);Module["HEAPU32"]=HEAPU32=new Uint32Array(b);Module["HEAPF32"]=HEAPF32=new Float32Array(b);Module["HEAPF64"]=HEAPF64=new Float64Array(b)}var wasmTable;var __ATPRERUN__=[];var __ATINIT__=[];var __ATPOSTRUN__=[];var runtimeInitialized=false;function preRun(){if(Module["preRun"]){if(typeof Module["preRun"]=="function")Module["preRun"]=[Module["preRun"]];while(Module["preRun"].length){addOnPreRun(Module["preRun"].shift())}}callRuntimeCallbacks(__ATPRERUN__)}function initRuntime(){runtimeInitialized=true;callRuntimeCallbacks(__ATINIT__)}function postRun(){if(Module["postRun"]){if(typeof Module["postRun"]=="function")Module["postRun"]=[Module["postRun"]];while(Module["postRun"].length){addOnPostRun(Module["postRun"].shift())}}callRuntimeCallbacks(__ATPOSTRUN__)}function addOnPreRun(cb){__ATPRERUN__.unshift(cb)}function addOnInit(cb){__ATINIT__.unshift(cb)}function addOnPostRun(cb){__ATPOSTRUN__.unshift(cb)}var runDependencies=0;var runDependencyWatcher=null;var dependenciesFulfilled=null;function addRunDependency(id){runDependencies++;if(Module["monitorRunDependencies"]){Module["monitorRunDependencies"](runDependencies)}}function removeRunDependency(id){runDependencies--;if(Module["monitorRunDependencies"]){Module["monitorRunDependencies"](runDependencies)}if(runDependencies==0){if(runDependencyWatcher!==null){clearInterval(runDependencyWatcher);runDependencyWatcher=null}if(dependenciesFulfilled){var callback=dependenciesFulfilled;dependenciesFulfilled=null;callback()}}}function abort(what){if(Module["onAbort"]){Module["onAbort"](what)}what="Aborted("+what+")";err(what);ABORT=true;EXITSTATUS=1;what+=". Build with -sASSERTIONS for more info.";var e=new WebAssembly.RuntimeError(what);throw e}var dataURIPrefix="data:application/octet-stream;base64,";function isDataURI(filename){return filename.startsWith(dataURIPrefix)}function isFileURI(filename){return filename.startsWith("file://")}var wasmBinaryFile;wasmBinaryFile="graph_wasm.wasm";if(!isDataURI(wasmBinaryFile)){wasmBinaryFile=locateFile(wasmBinaryFile)}function getBinary(file){try{if(file==wasmBinaryFile&&wasmBinary){return new Uint8Array(wasmBinary)}if(readBinary){return readBinary(file)}throw"both async and sync fetching of the wasm failed"}catch(err){abort(err)}}function getBinaryPromise(binaryFile){if(!wasmBinary&&(ENVIRONMENT_IS_WEB||ENVIRONMENT_IS_WORKER)){if(typeof fetch=="function"&&!isFileURI(binaryFile)){return fetch(binaryFile,{credentials:"same-origin"}).then(function(response){if(!response["ok"]){throw"failed to load wasm binary file at '"+binaryFile+"'"}return response["arrayBuffer"]()}).catch(function(){return getBinary(binaryFile)})}else{if(readAsync){return new Promise(function(resolve,reject){readAsync(binaryFile,function(response){resolve(new Uint8Array(response))},reject)})}}}return Promise.resolve().then(function(){return getBinary(binaryFile)})}function instantiateArrayBuffer(binaryFile,imports,receiver){return getBinaryPromise(binaryFile).then(function(binary){return WebAssembly.instantiate(binary,imports)}).then(function(instance){return instance}).then(receiver,function(reason){err("failed to asynchronously prepare wasm: "+reason);abort(reason)})}function instantiateAsync(binary,binaryFile,imports,callback){if(!binary&&typeof WebAssembly.instantiateStreaming=="function"&&!isDataURI(binaryFile)&&!isFileURI(binaryFile)&&!ENVIRONMENT_IS_NODE&&typeof fetch=="function"){return fetch(binaryFile,{credentials:"same-origin"}).then(function(response){var result=WebAssembly.instantiateStreaming(response,imports);return result.then(callback,function(reason){err("wasm streaming compile failed: "+reason);err("falling back to ArrayBuffer instantiation");return instantiateArrayBuffer(binaryFile,imports,callback)})})}else{return instantiateArrayBuffer(binaryFile,imports,callback)}}function createWasm(){var info={"a":wasmImports};function receiveInstance(instance,module){var exports=instance.exports;Module["asm"]=exports;wasmMemory=Module["asm"]["f"];updateMemoryViews();wasmTable=Module["asm"]["r"];addOnInit(Module["asm"]["g"]);removeRunDependency("wasm-instantiate");return exports}addRunDependency("wasm-instantiate");function receiveInstantiationResult(result){receiveInstance(result["instance"])}if(Module["instantiateWasm"]){try{return Module["instantiateWasm"](info,receiveInstance)}catch(e){err("Module.instantiateWasm callback failed with error: "+e);return false}}instantiateAsync(wasmBinary,wasmBinaryFile,info,receiveInstantiationResult);return{}}var tempDouble;var tempI64;var ASM_CONSTS={2304:$0=>{console.log(UTF8ToString($0))}};function ExitStatus(status){this.name="ExitStatus";this.message="Program terminated with exit("+status+")";this.status=status}function callRuntimeCallbacks(callbacks){while(callbacks.length>0){callbacks.shift()(Module)}}function getValue(ptr,type="i8"){if(type.endsWith("*"))type="*";switch(type){case"i1":return HEAP8[ptr>>0];case"i8":return HEAP8[ptr>>0];case"i16":return HEAP16[ptr>>1];case"i32":return HEAP32[ptr>>2];case"i64":return HEAP32[ptr>>2];case"float":return HEAPF32[ptr>>2];case"double":return HEAPF64[ptr>>3];case"*":return HEAPU32[ptr>>2];default:abort("invalid type for getValue: "+type)}}function setValue(ptr,value,type="i8"){if(type.endsWith("*"))type="*";switch(type){case"i1":HEAP8[ptr>>0]=value;break;case"i8":HEAP8[ptr>>0]=value;break;case"i16":HEAP16[ptr>>1]=value;break;case"i32":HEAP32[ptr>>2]=value;break;case"i64":tempI64=[value>>>0,(tempDouble=value,+Math.abs(tempDouble)>=1?tempDouble>0?(Math.min(+Math.floor(tempDouble/4294967296),4294967295)|0)>>>0:~~+Math.ceil((tempDouble-+(~~tempDouble>>>0))/4294967296)>>>0:0)],HEAP32[ptr>>2]=tempI64[0],HEAP32[ptr+4>>2]=tempI64[1];break;case"float":HEAPF32[ptr>>2]=value;break;case"double":HEAPF64[ptr>>3]=value;break;case"*":HEAPU32[ptr>>2]=value;break;default:abort("invalid type for setValue: "+type)}}function _abort(){abort("")}var readEmAsmArgsArray=[];function readEmAsmArgs(sigPtr,buf){readEmAsmArgsArray.length=0;var ch;buf>>=2;while(ch=HEAPU8[sigPtr++]){buf+=ch!=105&buf;readEmAsmArgsArray.push(ch==105?HEAP32[buf]:HEAPF64[buf++>>1]);++buf}return readEmAsmArgsArray}function runEmAsmFunction(code,sigPtr,argbuf){var args=readEmAsmArgs(sigPtr,argbuf);return ASM_CONSTS[code].apply(null,args)}function _emscripten_asm_const_int(code,sigPtr,argbuf){return runEmAsmFunction(code,sigPtr,argbuf)}function _emscripten_date_now(){return Date.now()}function _emscripten_memcpy_big(dest,src,num){HEAPU8.copyWithin(dest,src,src+num)}function getHeapMax(){return 2147483648}function emscripten_realloc_buffer(size){var b=wasmMemory.buffer;try{wasmMemory.grow(size-b.byteLength+65535>>>16);updateMemoryViews();return 1}catch(e){}}function _emscripten_resize_heap(requestedSize){var oldSize=HEAPU8.length;requestedSize=requestedSize>>>0;var maxHeapSize=getHeapMax();if(requestedSize>maxHeapSize){return false}let alignUp=(x,multiple)=>x+(multiple-x%multiple)%multiple;for(var cutDown=1;cutDown<=4;cutDown*=2){var overGrownHeapSize=oldSize*(1+.2/cutDown);overGrownHeapSize=Math.min(overGrownHeapSize,requestedSize+100663296);var newSize=Math.min(maxHeapSize,alignUp(Math.max(requestedSize,overGrownHeapSize),65536));var replacement=emscripten_realloc_buffer(newSize);if(replacement){return true}}return false}function getCFunc(ident){var func=Module["_"+ident];return func}function writeArrayToMemory(array,buffer){HEAP8.set(array,buffer)}function lengthBytesUTF8(str){var len=0;for(var i=0;i<str.length;++i){var c=str.charCodeAt(i);if(c<=127){len++}else if(c<=2047){len+=2}else if(c>=55296&&c<=57343){len+=4;++i}else{len+=3}}return len}function stringToUTF8Array(str,heap,outIdx,maxBytesToWrite){if(!(maxBytesToWrite>0))return 0;var startIdx=outIdx;var endIdx=outIdx+maxBytesToWrite-1;for(var i=0;i<str.length;++i){var u=str.charCodeAt(i);if(u>=55296&&u<=57343){var u1=str.charCodeAt(++i);u=65536+((u&1023)<<10)|u1&1023}if(u<=127){if(outIdx>=endIdx)break;heap[outIdx++]=u}else if(u<=2047){if(outIdx+1>=endIdx)break;heap[outIdx++]=192|u>>6;heap[outIdx++]=128|u&63}else if(u<=65535){if(outIdx+2>=endIdx)break;heap[outIdx++]=224|u>>12;heap[outIdx++]=128|u>>6&63;heap[outIdx++]=128|u&63}else{if(outIdx+3>=endIdx)break;heap[outIdx++]=240|u>>18;heap[outIdx++]=128|u>>12&63;heap[outIdx++]=128|u>>6&63;heap[outIdx++]=128|u&63}}heap[outIdx]=0;return outIdx-startIdx}function stringToUTF8(str,outPtr,maxBytesToWrite){return stringToUTF8Array(str,HEAPU8,outPtr,maxBytesToWrite)}function stringToUTF8OnStack(str){var size=lengthBytesUTF8(str)+1;var ret=stackAlloc(size);stringToUTF8(str,ret,size);return ret}var UTF8Decoder=typeof TextDecoder!="undefined"?new TextDecoder("utf8"):undefined;function UTF8ArrayToString(heapOrArray,idx,maxBytesToRead){var endIdx=idx+maxBytesToRead;var endPtr=idx;while(heapOrArray[endPtr]&&!(endPtr>=endIdx))++endPtr;if(endPtr-idx>16&&heapOrArray.buffer&&UTF8Decoder){return UTF8Decoder.decode(heapOrArray.subarray(idx,endPtr))}var str="";while(idx<endPtr){var u0=heapOrArray[idx++];if(!(u0&128)){str+=String.fromCharCode(u0);continue}var u1=heapOrArray[idx++]&63;if((u0&224)==192){str+=String.fromCharCode((u0&31)<<6|u1);continue}var u2=heapOrArray[idx++]&63;if((u0&240)==224){u0=(u0&15)<<12|u1<<6|u2}else{u0=(u0&7)<<18|u1<<12|u2<<6|heapOrArray[idx++]&63}if(u0<65536){str+=String.fromCharCode(u0)}else{var ch=u0-65536;str+=String.fromCharCode(55296|ch>>10,56320|ch&1023)}}return str}function UTF8ToString(ptr,maxBytesToRead){return ptr?UTF8ArrayToString(HEAPU8,ptr,maxBytesToRead):""}function ccall(ident,returnType,argTypes,args,opts){var toC={"string":str=>{var ret=0;if(str!==null&&str!==undefined&&str!==0){ret=stringToUTF8OnStack(str)}return ret},"array":arr=>{var ret=stackAlloc(arr.length);writeArrayToMemory(arr,ret);return ret}};function convertReturnValue(ret){if(returnType==="string"){return UTF8ToString(ret)}if(returnType==="boolean")return Boolean(ret);return ret}var func=getCFunc(ident);var cArgs=[];var stack=0;if(args){for(var i=0;i<args.length;i++){var converter=toC[argTypes[i]];if(converter){if(stack===0)stack=stackSave();cArgs[i]=converter(args[i])}else{cArgs[i]=args[i]}}}var ret=func.apply(null,cArgs);function onDone(ret){if(stack!==0)stackRestore(stack);return convertReturnValue(ret)}ret=onDone(ret);return ret}function cwrap(ident,returnType,argTypes,opts){var numericArgs=!argTypes||argTypes.every(type=>type==="number"||type==="boolean");var numericRet=returnType!=="string";if(numericRet&&numericArgs&&!opts){return getCFunc(ident)}return function(){return ccall(ident,returnType,argTypes,arguments,opts)}}var wasmImports={"b":_abort,"e":_emscripten_asm_const_int,"d":_emscripten_date_now,"c":_emscripten_memcpy_big,"a":_emscripten_resize_heap};var asm=createWasm();var ___wasm_call_ctors=function(){return(___wasm_call_ctors=Module["asm"]["g"]).apply(null,arguments)};var _SetBatchFractionSize=Module["_SetBatchFractionSize"]=function(){return(_SetBatchFractionSize=Module["_SetBatchFractionSize"]=Module["asm"]["h"]).apply(null,arguments)};var _SetAttractionForce=Module["_SetAttractionForce"]=function(){return(_SetAttractionForce=Module["_SetAttractionForce"]=Module["asm"]["i"]).apply(null,arguments)};var _SetLinkLength=Module["_SetLinkLength"]=function(){return(_SetLinkLength=Module["_SetLinkLength"]=Module["asm"]["j"]).apply(null,arguments)};var _SetRepulsionForce=Module["_SetRepulsionForce"]=function(){return(_SetRepulsionForce=Module["_SetRepulsionForce"]=Module["asm"]["k"]).apply(null,arguments)};var _SetCentralForce=Module["_SetCentralForce"]=function(){return(_SetCentralForce=Module["_SetCentralForce"]=Module["asm"]["l"]).apply(null,arguments)};var _SetDt=Module["_SetDt"]=function(){return(_SetDt=Module["_SetDt"]=Module["asm"]["m"]).apply(null,arguments)};var _Init=Module["_Init"]=function(){return(_Init=Module["_Init"]=Module["asm"]["n"]).apply(null,arguments)};var _Update=Module["_Update"]=function(){return(_Update=Module["_Update"]=Module["asm"]["o"]).apply(null,arguments)};var _SetPosition=Module["_SetPosition"]=function(){return(_SetPosition=Module["_SetPosition"]=Module["asm"]["p"]).apply(null,arguments)};var _FreeMemory=Module["_FreeMemory"]=function(){return(_FreeMemory=Module["_FreeMemory"]=Module["asm"]["q"]).apply(null,arguments)};var ___errno_location=function(){return(___errno_location=Module["asm"]["__errno_location"]).apply(null,arguments)};var _malloc=Module["_malloc"]=function(){return(_malloc=Module["_malloc"]=Module["asm"]["s"]).apply(null,arguments)};var _free=Module["_free"]=function(){return(_free=Module["_free"]=Module["asm"]["t"]).apply(null,arguments)};var stackSave=function(){return(stackSave=Module["asm"]["u"]).apply(null,arguments)};var stackRestore=function(){return(stackRestore=Module["asm"]["v"]).apply(null,arguments)};var stackAlloc=function(){return(stackAlloc=Module["asm"]["w"]).apply(null,arguments)};var ___cxa_is_pointer_type=function(){return(___cxa_is_pointer_type=Module["asm"]["__cxa_is_pointer_type"]).apply(null,arguments)};Module["cwrap"]=cwrap;Module["setValue"]=setValue;Module["getValue"]=getValue;var calledRun;dependenciesFulfilled=function runCaller(){if(!calledRun)run();if(!calledRun)dependenciesFulfilled=runCaller};function run(){if(runDependencies>0){return}preRun();if(runDependencies>0){return}function doRun(){if(calledRun)return;calledRun=true;Module["calledRun"]=true;if(ABORT)return;initRuntime();if(Module["onRuntimeInitialized"])Module["onRuntimeInitialized"]();postRun()}if(Module["setStatus"]){Module["setStatus"]("Running...");setTimeout(function(){setTimeout(function(){Module["setStatus"]("")},1);doRun()},1)}else{doRun()}}if(Module["preInit"]){if(typeof Module["preInit"]=="function")Module["preInit"]=[Module["preInit"]];while(Module["preInit"].length>0){Module["preInit"].pop()()}}run();


var started = false;

async function RunGraphView()
{
    if(started) return;

    started = true;
    console.log("Module Ready");

    let batchFraction = 1;
    let minBatchFraction = 0.3;

    let dt = 1;
    let attractionForce = 1;
    let linkLength = 1;
    let repulsionForce = 30 / batchFraction;
    let centralForce = 2;
    let edgePruning = 20;

    let targetFPS = 30;

    class GraphAssembly
    {
        static nodeCount = 0;
        static linkCount = 0;
        static hoveredNode = -1;

        static #positionsPtr = 0;
        static #positionsByteLength = 0;
        static #radiiPtr = 0;
        static #linkSourcesPtr = 0;
        static #linkTargetsPtr = 0;

        static linkSources = new Int32Array(0);
        static linkTargets = new Int32Array(0);
        static radii = new Float32Array(0);
        static maxRadius = 0;
        static averageRadius = 0;
        static minRadius = 0;

        /**  
         * @param {{nodeCount: number, linkCount:number, radii: number[], labels: string[], linkSources: number[], linkTargets: number[], linkCounts: number[]}} nodes
        */
        static init(nodes)
        {
            GraphAssembly.nodeCount = nodes.nodeCount;
            GraphAssembly.linkCount = nodes.linkCount;

            // create arrays for the data
            let positions = new Float32Array(GraphAssembly.nodeCount * 2);
            GraphAssembly.radii = new Float32Array(nodes.radii);
            GraphAssembly.linkSources = new Int32Array(nodes.linkSources);
            GraphAssembly.linkTargets = new Int32Array(nodes.linkTargets);

            // allocate memory on the heap
            GraphAssembly.#positionsPtr = Module._malloc(positions.byteLength);
            GraphAssembly.#positionsByteLength = positions.byteLength;
            GraphAssembly.#radiiPtr = Module._malloc(GraphAssembly.radii.byteLength);
            GraphAssembly.#linkSourcesPtr = Module._malloc(GraphAssembly.linkSources.byteLength);
            GraphAssembly.#linkTargetsPtr = Module._malloc(GraphAssembly.linkTargets.byteLength);

            GraphAssembly.maxRadius = GraphAssembly.radii.reduce((a, b) => Math.max(a, b));
            GraphAssembly.averageRadius = GraphAssembly.radii.reduce((a, b) => a + b) / GraphAssembly.radii.length;
            GraphAssembly.minRadius = GraphAssembly.radii.reduce((a, b) => Math.min(a, b));

            // generate positions on a circle
            let spawnRadius = (GraphAssembly.averageRadius * Math.sqrt(GraphAssembly.nodeCount)) * 2;
            for (let i = 0; i < GraphAssembly.nodeCount; i++) 
            {
                let distance = (1 - GraphAssembly.radii[i] / GraphAssembly.maxRadius) * spawnRadius;
                positions[i * 2] = Math.cos(i/GraphAssembly.nodeCount * 7.41 * 2 * Math.PI) * distance;
                positions[i * 2 + 1] = Math.sin(i/GraphAssembly.nodeCount * 7.41 * 2 * Math.PI) * distance;
            }

            // copy the data to the heap
            Module.HEAP32.set(new Int32Array(positions.buffer), GraphAssembly.#positionsPtr / positions.BYTES_PER_ELEMENT);
            Module.HEAP32.set(new Int32Array(GraphAssembly.radii.buffer), GraphAssembly.#radiiPtr / GraphAssembly.radii.BYTES_PER_ELEMENT);
            Module.HEAP32.set(new Int32Array(GraphAssembly.linkSources.buffer), GraphAssembly.#linkSourcesPtr / GraphAssembly.linkSources.BYTES_PER_ELEMENT);
            Module.HEAP32.set(new Int32Array(GraphAssembly.linkTargets.buffer), GraphAssembly.#linkTargetsPtr / GraphAssembly.linkTargets.BYTES_PER_ELEMENT);

            Module._Init(
                GraphAssembly.#positionsPtr, 
                GraphAssembly.#radiiPtr, 
                GraphAssembly.#linkSourcesPtr, 
                GraphAssembly.#linkTargetsPtr, 
                GraphAssembly.nodeCount, 
                GraphAssembly.linkCount, 
                batchFraction, 
                dt, 
                attractionForce, 
                linkLength, 
                repulsionForce, 
                centralForce
            );
        }

        /**
         * @returns {Float32Array}
         */
        static get positions()
        {
            return Module.HEAP32.buffer.slice(GraphAssembly.#positionsPtr, GraphAssembly.#positionsPtr + GraphAssembly.#positionsByteLength);
        }

        /**
         * @param {{x: number, y: number}} mousePosition
         * @param {number} grabbedNode
         */
        static update(mousePosition, grabbedNode, cameraScale)
        {
            GraphAssembly.hoveredNode = Module._Update(mousePosition.x, mousePosition.y, grabbedNode, cameraScale);
        }

        static free()
        {
            Module._free(GraphAssembly.#positionsPtr);
            Module._free(GraphAssembly.#radiiPtr);
            Module._free(GraphAssembly.#linkSourcesPtr);
            Module._free(GraphAssembly.#linkTargetsPtr);
            Module._FreeMemory();
        }

        /**
         * @param {number} value
         */
        static set batchFraction(value)
        {
            Module._SetBatchFractionSize(value);
        }
        
        /**
         * @param {number} value
         */
        static set attractionForce(value)
        {
            Module._SetAttractionForce(value);
        }

        /**
         * @param {number} value
         */
        static set repulsionForce(value)
        {
            Module._SetRepulsionForce(value);
        }

        /**
         * @param {number} value
         */
        static set centralForce(value)
        {
            Module._SetCentralForce(value);
        }

        /**
         * @param {number} value
         */
        static set linkLength(value)
        {
            Module._SetLinkLength(value);
        }

        /**
         * @param {number} value
         */
        static set dt(value)
        {
            Module._SetDt(value);
        }
    }



    GraphAssembly.init(nodes);



    class GraphRenderWorker
    {
        #cameraOffset
        #cameraScale
        #hoveredNode
        #grabbedNode
        #colors
        #width
        #height


        constructor()
        {
            console.log($("#graph-canvas"));
            this.canvas = $("#graph-canvas")[0];
            console.log(this.canvas);
            this.view = this.canvas.transferControlToOffscreen();

            this.worker = new Worker(new URL("./graph_render_worker.js", import.meta.url));

            
            
            this.#cameraOffset = {x: 0, y: 0};
            this.#cameraScale = 1;
            this.#hoveredNode = -1;
            this.#grabbedNode = -1;
            this.#colors = 
            {
                background: 0x000000,
                link: 0x000000,
                node: 0x000000,
                outline: 0x000000,
                text: 0x000000,
                accent: 0x000000,
            }
            this.#width = 0;
            this.#height = 0;

            this.cameraOffset = {x: this.canvas.width / 2, y: this.canvas.height / 2};
            this.cameraScale = 1;
            this.hoveredNode = -1;
            this.grabbedNode = -1;
            this.resampleColors();

            console.log(this.#colors);

            this.#pixiInit();


            this.width = this.canvas.width;
            this.height = this.canvas.height;

        }

        #pixiInit()
        {
            let { width, height } = this.view;

            this.worker.postMessage(
            {
                type: 'init',
                linkCount: GraphAssembly.linkCount,
                linkSources: GraphAssembly.linkSources,
                linkTargets: GraphAssembly.linkTargets,
                nodeCount: GraphAssembly.nodeCount,
                radii: GraphAssembly.radii,
                labels: nodes.labels,
                linkLength: linkLength,
                edgePruning: edgePruning,
                options: { width: width, height: height, view: this.view },
            }, [this.view]);
        }

        resampleColors()
        {
            function sampleColor(variable) 
            {
                let testEl = document.createElement('div');
                testEl.style.setProperty('display', 'none');
                testEl.style.setProperty('color', 'var(' + variable + ')');
                document.body.appendChild(testEl);

                let col = getComputedStyle(testEl).color;
                let opacity = getComputedStyle(testEl).opacity;

                testEl.remove();

                function toColorObject(str)
                {
                    var match = str.match(/rgb?\((\d+),\s*(\d+),\s*(\d+)\)/);
                    return match ? {
                        red: parseInt(match[1]),
                        green: parseInt(match[2]),
                        blue: parseInt(match[3]),
                        alpha: 1
                    } : null
                }

                var color = toColorObject(col), alpha = parseFloat(opacity);
                return isNaN(alpha) && (alpha = 1),
                color ? {
                    a: alpha * color.alpha,
                    rgb: color.red << 16 | color.green << 8 | color.blue
                } : {
                    a: alpha,
                    rgb: 8947848
                }
            };

            this.colors =
            {
                background: sampleColor('--background-secondary').rgb,
                link: sampleColor('--graph-line').rgb,
                node: sampleColor('--graph-node').rgb,
                outline: sampleColor('--graph-line').rgb,
                text: sampleColor('--graph-text').rgb,
                accent: sampleColor('--interactive-accent').rgb,
            };
        }

        draw(_positions)
        {
            this.worker.postMessage(
            {
                type: 'draw',
                positions: _positions,
            }, [_positions]);
        }
    
        resizeCanvas(width, height)
        {
            this.worker.postMessage(
            {
                type: "resize",
                width: width,
                height: height,
            });

            this.#width = width;
            this.#height = height;
        }

        autoResizeCanvas()
        {
            this.resizeCanvas(this.canvas.offsetWidth, this.canvas.offsetHeight);
        }

        centerCamera()
        {
            this.cameraOffset = { x: this.width / 2, y: this.height / 2 };
        }
    
        #pixiSetInteraction(hoveredNodeIndex, grabbedNodeIndex)
        {   
            let obj = 
            {
                type: "update_interaction",
                hoveredNode: hoveredNodeIndex,
                grabbedNode: grabbedNodeIndex,
            }

            this.worker.postMessage(obj);
        }

        #pixiSetCamera(cameraOffset, cameraScale)
        {
            this.worker.postMessage(
            {
                type: "update_camera",
                cameraOffset: cameraOffset,
                cameraScale: cameraScale,
            });
        }

        #pixiSetColors(colors)
        {
            this.worker.postMessage(
            {
                type: "update_colors",
                colors: colors,
            });

        }

        set cameraOffset(offset)
        {
            this.#cameraOffset = offset;
            this.#pixiSetCamera(offset, this.cameraScale);
        }

        set cameraScale(scale)
        {
            this.#cameraScale = scale;
            this.#pixiSetCamera(this.cameraOffset, scale);
        }

        get cameraOffset()
        {
            return this.#cameraOffset;
        }

        get cameraScale()
        {
            return this.#cameraScale;
        }

        /**
         * @param {number} node
         */
        set hoveredNode(node)
        {
            this.#hoveredNode = node;
            this.#pixiSetInteraction(node, this.#grabbedNode);
        }

        /**
         * @param {number} node
         */
        set grabbedNode(node)
        {
            this.#grabbedNode = node;
            this.#pixiSetInteraction(this.#hoveredNode, node);
        }

        get hoveredNode()
        {
            return this.#hoveredNode;
        }

        get grabbedNode()
        {
            return this.#grabbedNode;
        }

        /**
         * @param {{ background: number; link: number; node: number; outline: number; text: number; accent: number; }} colors
         */
        set colors(colors)
        {
            this.#colors = colors;
            this.#pixiSetColors(colors);
        }

        get colors()
        {
            return this.#colors;
        }

        set width(width)
        {
            this.#width = width;
            this.resizeCanvas(width, this.#height);
        }

        set height(height)
        {
            this.#height = height;
            this.resizeCanvas(this.#width, height);
        }

        get height()
        {
            return this.#height;
        }

        get width()
        {
            return this.#width;
        }

        /**
         * @param {number} x
         * @param {number} y
         * @param {boolean} floor
         * @returns {{x: number; y: number;}}
         */
        toScreenSpace(x, y, floor = true)
        {
            if (floor)
            {
                return {x: Math.floor((x * this.cameraScale) + this.cameraOffset.x), y: Math.floor((y * this.cameraScale) + this.cameraOffset.y)};
            }
            else
            {
                return {x: (x * this.cameraScale) + this.cameraOffset.x, y: (y * this.cameraScale) + this.cameraOffset.y};
            }
        }

        /**
         * @param {{x: number; y: number;}} vector
         * @param {boolean} floor
         * @returns {{x: number; y: number;}}
        */
        vecToScreenSpace(vector, floor = true)
        {
            return this.toScreenSpace(vector.x, vector.y, floor);
        }

        /**
         * @param {number} x
         * @param {number} y
         * @returns {{x: number; y: number;}}
         */
        toWorldspace(x, y)
        {
            return {x: (x - this.cameraOffset.x) / this.cameraScale, y: (y - this.cameraOffset.y) / this.cameraScale};
        }

        /**
         * @param {{x: number; y: number;}} vector
         * @returns {{x: number; y: number;}}
         */
        vecToWorldspace(vector)
        {
            return this.toWorldspace(vector.x, vector.y);
        }

        setCameraCenterWorldspace({x, y})
        {
            this.cameraOffset = {x: (this.width / 2) - (x * this.cameraScale), y: (this.height / 2) - (y * this.cameraScale)};
        }

        getCameraCenterWorldspace()
        {
            return this.toWorldspace(this.width / 2, this.height / 2);
        }
    }

    const renderWorker = new GraphRenderWorker();

    renderWorker.autoResizeCanvas();
    renderWorker.centerCamera();

    const app = new PIXI.Application();

    app.ticker.maxFPS = targetFPS;

    let mousePositionWorld = { x: undefined, y: undefined };
    let mousePositionScreen = { x: undefined, y: undefined };
    let scrollVelocity = 0;
    let mouseDown = false;
    let lastMousePos = { x: 0, y: 0 };
    let averageFPS = targetFPS;

    setTimeout(() => app.ticker.add(() => 
    {
        GraphAssembly.update(mousePositionWorld, renderWorker.grabbedNode, renderWorker.cameraScale);

        if (GraphAssembly.hoveredNode != renderWorker.hoveredNode)
        {
            renderWorker.hoveredNode = GraphAssembly.hoveredNode;
            renderWorker.canvas.style.cursor = GraphAssembly.hoveredNode == -1 ? "default" : "pointer";
        }

        renderWorker.draw(GraphAssembly.positions);

        averageFPS = averageFPS * 0.95 + app.ticker.FPS * 0.05;

        if (averageFPS < targetFPS * 0.9 && batchFraction > minBatchFraction)
        {
            batchFraction = Math.max(batchFraction - 0.5 * 1/targetFPS, minBatchFraction);
            GraphAssembly.batchFraction = batchFraction;
            GraphAssembly.repulsionForce = repulsionForce / batchFraction;
            // GraphAssembly.dt = dt * batchFraction;
            // console.log(batchFraction);
        }

        if (scrollVelocity != 0)
        {
            let cameraCenter = renderWorker.getCameraCenterWorldspace();

            if (Math.abs(scrollVelocity) < 0.001)
            {
                scrollVelocity = 0;
            }

            renderWorker.cameraScale = Math.max(Math.min(renderWorker.cameraScale + scrollVelocity * renderWorker.cameraScale, 10.0), 0.1);

            if(renderWorker.cameraScale != 0.1 && renderWorker.cameraScale != 10 && scrollVelocity > 0)
            {
                // zoom towards cursor position
                let mouseDiff = {x: mousePositionWorld.x - cameraCenter.x, y: mousePositionWorld.y - cameraCenter.y};
                var movePos = {x: cameraCenter.x + mouseDiff.x * scrollVelocity, y: cameraCenter.y + mouseDiff.y * scrollVelocity};
                renderWorker.setCameraCenterWorldspace(movePos);
            }
            else renderWorker.setCameraCenterWorldspace(cameraCenter);

            scrollVelocity *= 0.8;
        }

    }), 1000);

    //#region Event listeners

    window.addEventListener('beforeunload', () => 
    {
        GraphAssembly.free();
    });

    window.addEventListener('resize', () =>
    {
        renderWorker.autoResizeCanvas();
        renderWorker.centerCamera();
    });

    // Get the mouse position relative to the canvas.
    function getMousePos(canvas, event)
    {
        var rect = canvas.getBoundingClientRect();
        var clientX = event.clientX;
        var clientY = event.clientY;

        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }

    function handleMouseMove(event)
    {
        mousePositionScreen = getMousePos(renderWorker.canvas, event);
        mousePositionWorld = renderWorker.vecToWorldspace(mousePositionScreen);

        if (lastMousePos.x == 0 && lastMousePos.y == 0)
        {
            lastMousePos = { x: event.clientX, y: event.clientY };
            return;
        }

        let delta = { x: lastMousePos.x - event.clientX, y: lastMousePos.y - event.clientY };

        if (mouseDown && renderWorker.hoveredNode == -1)
        {
            let camOffset = renderWorker.cameraOffset;
            renderWorker.cameraOffset = { x: camOffset.x - delta.x, y: camOffset.y - delta.y };
        }

        lastMousePos = { x: event.clientX, y: event.clientY };
    }

    $("*").mousemove(function(event)
    {
        if(mouseDown || renderWorker.grabbedNode != -1)
        {
            handleMouseMove(event);
        }
    });

    $("#graph-canvas").mousemove(function(event)
    {
        if(!mouseDown && renderWorker.grabbedNode == -1)
        {
            handleMouseMove(event);
        }
    });

    $("#graph-canvas").mousedown(function(e) 
    {
        e.preventDefault();
        e.stopPropagation();
        
        // only grab with the left mouse button
        if (e.button == 0)
            renderWorker.grabbedNode = renderWorker.hoveredNode;
            
        mouseDown = true;
    });

    $("*").mouseup(function(e)
    {
        e.preventDefault();
        e.stopPropagation();

        renderWorker.grabbedNode = -1;
        mouseDown = false;
    });

    // also mouse up if mouse leaves canvas
    $("#graph-canvas").mouseleave(function(e)
    {
        e.preventDefault();
        e.stopPropagation();

        if (renderWorker.grabbedNode == -1 && !mouseDown)
        {
            mousePositionScreen = { x: undefined, y: undefined };
            mousePositionWorld = { x: undefined, y: undefined };
        }
        
    });


    $("#graph-canvas")[0].addEventListener("wheel", function(e) 
    {
        e.preventDefault();
        e.stopPropagation();

        let delta = e.deltaY;
        if (delta > 0)
        {
            if(scrollVelocity >= -0.04)
            {
                scrollVelocity = -0.04;
            }

            scrollVelocity *= 1.2;
        }
        else
        {
            if(scrollVelocity <= 0.04)
            {
                scrollVelocity = 0.04;
            }

            scrollVelocity *= 1.2;
        }
    });

    $(".toggle__input").change(function(e)
    {
        renderWorker.resampleColors();
    });

    $(".graph-expand.graph-icon").on("click", function(e)
    {
        e.preventDefault();
        e.stopPropagation();

        let container = $(".graph-view-container");

        // scale and fade out animation:
        container.addClass("scale-down");
        container.animate({ opacity: 0 }, 200, "easeInQuad", function()
        {
            container.toggleClass("expanded");

            renderWorker.autoResizeCanvas();
            renderWorker.centerCamera();

            container.removeClass("scale-down");
            container.addClass("scale-up");
            container.animate({ opacity: 1 }, 1000, "easeOutQuad", function()
            {
                container.removeClass("scale-up");
            });
            
        });

    });
}

Module['onRuntimeInitialized'] = RunGraphView;

setTimeout(() => Module['onRuntimeInitialized'](), 100);