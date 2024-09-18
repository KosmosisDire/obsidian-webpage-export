var Module = typeof Module != "undefined" ? Module : {};
var ENVIRONMENT_IS_WEB = typeof window == "object";
var ENVIRONMENT_IS_WORKER = typeof importScripts == "function";
var ENVIRONMENT_IS_NODE = typeof process == "object" && typeof process.versions == "object" && typeof process.versions.node == "string";
if (ENVIRONMENT_IS_NODE) {}
var moduleOverrides = Object.assign({}, Module);
var arguments_ = [];
var thisProgram = "./this.program";
var quit_ = (status, toThrow) => {
    throw toThrow
};
var scriptDirectory = "";

function locateFile(path) {
    if (Module["locateFile"]) {
        return Module["locateFile"](path, scriptDirectory)
    }
    return scriptDirectory + path
}
var read_, readAsync, readBinary;
if (ENVIRONMENT_IS_NODE) {
    var fs = require("fs");
    var nodePath = require("path");
    if (ENVIRONMENT_IS_WORKER) {
        scriptDirectory = nodePath.dirname(scriptDirectory) + "/"
    } else {
        scriptDirectory = __dirname + "/"
    }
    read_ = (filename, binary) => {
        filename = isFileURI(filename) ? new URL(filename) : nodePath.normalize(filename);
        return fs.readFileSync(filename, binary ? undefined : "utf8")
    };
    readBinary = filename => {
        var ret = read_(filename, true);
        if (!ret.buffer) {
            ret = new Uint8Array(ret)
        }
        return ret
    };
    readAsync = (filename, onload, onerror, binary = true) => {
        filename = isFileURI(filename) ? new URL(filename) : nodePath.normalize(filename);
        fs.readFile(filename, binary ? undefined : "utf8", (err, data) => {
            if (err) onerror(err);
            else onload(binary ? data.buffer : data)
        })
    };
    if (!Module["thisProgram"] && process.argv.length > 1) {
        thisProgram = process.argv[1].replace(/\\/g, "/")
    }
    arguments_ = process.argv.slice(2);
    if (typeof module != "undefined") {
        module["exports"] = Module
    }
    process.on("uncaughtException", ex => {
        if (ex !== "unwind" && !(ex instanceof ExitStatus) && !(ex.context instanceof ExitStatus)) {
            throw ex
        }
    });
    quit_ = (status, toThrow) => {
        process.exitCode = status;
        throw toThrow
    }
} else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
    if (ENVIRONMENT_IS_WORKER) {
        scriptDirectory = self.location.href
    } else if (typeof document != "undefined" && document.currentScript) {
        scriptDirectory = document.currentScript.src
    }
    if (scriptDirectory.startsWith("blob:")) {
        scriptDirectory = ""
    } else {
        scriptDirectory = scriptDirectory.substr(0, scriptDirectory.replace(/[?#].*/, "").lastIndexOf("/") + 1)
    } {
        read_ = url => {
            var xhr = new XMLHttpRequest;
            xhr.open("GET", url, false);
            xhr.send(null);
            return xhr.responseText
        };
        if (ENVIRONMENT_IS_WORKER) {
            readBinary = url => {
                var xhr = new XMLHttpRequest;
                xhr.open("GET", url, false);
                xhr.responseType = "arraybuffer";
                xhr.send(null);
                return new Uint8Array(xhr.response)
            }
        }
        readAsync = (url, onload, onerror) => {
            var xhr = new XMLHttpRequest;
            xhr.open("GET", url, true);
            xhr.responseType = "arraybuffer";
            xhr.onload = () => {
                if (xhr.status == 200 || xhr.status == 0 && xhr.response) {
                    onload(xhr.response);
                    return
                }
                onerror()
            };
            xhr.onerror = onerror;
            xhr.send(null)
        }
    }
} else {}
var out = Module["print"] || console.log.bind(console);
var err = Module["printErr"] || console.error.bind(console);
Object.assign(Module, moduleOverrides);
moduleOverrides = null;
if (Module["arguments"]) arguments_ = Module["arguments"];
if (Module["thisProgram"]) thisProgram = Module["thisProgram"];
if (Module["quit"]) quit_ = Module["quit"];
var wasmBinary;
if (Module["wasmBinary"]) wasmBinary = Module["wasmBinary"];
var wasmMemory;
var ABORT = false;
var EXITSTATUS;
var HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;

function updateMemoryViews() {
    var b = wasmMemory.buffer;
    Module["HEAP8"] = HEAP8 = new Int8Array(b);
    Module["HEAP16"] = HEAP16 = new Int16Array(b);
    Module["HEAPU8"] = HEAPU8 = new Uint8Array(b);
    Module["HEAPU16"] = HEAPU16 = new Uint16Array(b);
    Module["HEAP32"] = HEAP32 = new Int32Array(b);
    Module["HEAPU32"] = HEAPU32 = new Uint32Array(b);
    Module["HEAPF32"] = HEAPF32 = new Float32Array(b);
    Module["HEAPF64"] = HEAPF64 = new Float64Array(b)
}
var __ATPRERUN__ = [];
var __ATINIT__ = [];
var __ATPOSTRUN__ = [];
var runtimeInitialized = false;

function preRun() {
    if (Module["preRun"]) {
        if (typeof Module["preRun"] == "function") Module["preRun"] = [Module["preRun"]];
        while (Module["preRun"].length) {
            addOnPreRun(Module["preRun"].shift())
        }
    }
    callRuntimeCallbacks(__ATPRERUN__)
}

function initRuntime() {
    runtimeInitialized = true;
    callRuntimeCallbacks(__ATINIT__)
}

function postRun() {
    if (Module["postRun"]) {
        if (typeof Module["postRun"] == "function") Module["postRun"] = [Module["postRun"]];
        while (Module["postRun"].length) {
            addOnPostRun(Module["postRun"].shift())
        }
    }
    callRuntimeCallbacks(__ATPOSTRUN__)
}

function addOnPreRun(cb) {
    __ATPRERUN__.unshift(cb)
}

function addOnInit(cb) {
    __ATINIT__.unshift(cb)
}

function addOnPostRun(cb) {
    __ATPOSTRUN__.unshift(cb)
}
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null;

function addRunDependency(id) {
    runDependencies++;
    Module["monitorRunDependencies"]?.(runDependencies)
}

function removeRunDependency(id) {
    runDependencies--;
    Module["monitorRunDependencies"]?.(runDependencies);
    if (runDependencies == 0) {
        if (runDependencyWatcher !== null) {
            clearInterval(runDependencyWatcher);
            runDependencyWatcher = null
        }
        if (dependenciesFulfilled) {
            var callback = dependenciesFulfilled;
            dependenciesFulfilled = null;
            callback()
        }
    }
}

function abort(what) {
    Module["onAbort"]?.(what);
    what = "Aborted(" + what + ")";
    err(what);
    ABORT = true;
    EXITSTATUS = 1;
    what += ". Build with -sASSERTIONS for more info.";
    var e = new WebAssembly.RuntimeError(what);
    throw e
}
var dataURIPrefix = "data:application/octet-stream;base64,";
var isDataURI = filename => filename.startsWith(dataURIPrefix);
var isFileURI = filename => filename.startsWith("file://");
var wasmBinaryFile;
wasmBinaryFile = "graph-wasm.wasm";
if (!isDataURI(wasmBinaryFile)) {
    wasmBinaryFile = locateFile(wasmBinaryFile)
}

function getBinarySync(file) {
    if (file == wasmBinaryFile && wasmBinary) {
        return new Uint8Array(wasmBinary)
    }
    if (readBinary) {
        return readBinary(file)
    }
    throw "both async and sync fetching of the wasm failed"
}

function getBinaryPromise(binaryFile) 
{
	if (window.location.protocol === 'file:')
	{
		return new Promise((resolve, reject) =>
		{
			let id = btoa(encodeURI(`site-lib/scripts/${binaryFile}`));
			window.addEventListener('DOMContentLoaded', () => 
			{
				const dataEl = document.getElementById(id);
				if (dataEl)
				{
					const data = Uint8Array.from(Array.from(atob(JSON.parse(decodeURI(atob(dataEl.value))).data)).map(s => s.charCodeAt(0)));
					resolve(data);
				}
			});
		});
	}

    if (!wasmBinary && (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER)) {
        if (typeof fetch == "function" && !isFileURI(binaryFile)) {
            return fetch(binaryFile, {
                credentials: "same-origin"
            }).then(response => {
                if (!response["ok"]) {
                    throw `failed to load wasm binary file at '${binaryFile}'`
                }
                return response["arrayBuffer"]()
            }).catch(() => getBinarySync(binaryFile))
        } else if (readAsync) {
            return new Promise((resolve, reject) => {
                readAsync(binaryFile, response => resolve(new Uint8Array(response)), reject)
            })
        }
    }
    return Promise.resolve().then(() => getBinarySync(binaryFile))
}

function instantiateArrayBuffer(binaryFile, imports, receiver) 
{
	return getBinaryPromise(binaryFile).then(binary => 
		{
			console.log("loaded wasm from", binary);
			return WebAssembly.instantiate(binary, imports)
		}).then(receiver, reason => {
		err(`failed to asynchronously prepare wasm: ${reason}`);
		abort(reason)
	})
}

function instantiateAsync(binary, binaryFile, imports, callback) {
    // if (!binary && typeof WebAssembly.instantiateStreaming == "function" && !isDataURI(binaryFile) && !isFileURI(binaryFile) && !ENVIRONMENT_IS_NODE && typeof fetch == "function") {
    //     return fetch(binaryFile, {
    //         credentials: "same-origin"
    //     }).then(response => {
	// 		response.headers.set('Content-Type', 'application/wasm');
    //         var result = WebAssembly.instantiateStreaming(response, imports);
    //         return result.then(callback, function(reason) {
    //             err(`wasm streaming compile failed: ${reason}`);
    //             err("falling back to ArrayBuffer instantiation");
    //             return instantiateArrayBuffer(binaryFile, imports, callback)
    //         })
    //     })
    // }
    return instantiateArrayBuffer(binaryFile, imports, callback)
}

function getWasmImports() {
    return {
        "a": wasmImports
    }
}

function createWasm() {
    var info = getWasmImports();

    function receiveInstance(instance, module) {
        wasmExports = instance.exports;
        wasmMemory = wasmExports["f"];
        updateMemoryViews();
        addOnInit(wasmExports["g"]);
        removeRunDependency("wasm-instantiate");
        return wasmExports
    }
    addRunDependency("wasm-instantiate");

    function receiveInstantiationResult(result) {
        receiveInstance(result["instance"])
    }
    if (Module["instantiateWasm"]) {
        try {
            return Module["instantiateWasm"](info, receiveInstance)
        } catch (e) {
            err(`Module.instantiateWasm callback failed with error: ${e}`);
            return false
        }
    }
    instantiateAsync(wasmBinary, wasmBinaryFile, info, receiveInstantiationResult);
    return {}
}
var ASM_CONSTS = {
    2408: $0 => {
        console.log(UTF8ToString($0))
    }
};

function ExitStatus(status) {
    this.name = "ExitStatus";
    this.message = `Program terminated with exit(${status})`;
    this.status = status
}
var callRuntimeCallbacks = callbacks => {
    while (callbacks.length > 0) {
        callbacks.shift()(Module)
    }
};

function getValue(ptr, type = "i8") {
    if (type.endsWith("*")) type = "*";
    switch (type) {
        case "i1":
            return HEAP8[ptr];
        case "i8":
            return HEAP8[ptr];
        case "i16":
            return HEAP16[ptr >> 1];
        case "i32":
            return HEAP32[ptr >> 2];
        case "i64":
            abort("to do getValue(i64) use WASM_BIGINT");
        case "float":
            return HEAPF32[ptr >> 2];
        case "double":
            return HEAPF64[ptr >> 3];
        case "*":
            return HEAPU32[ptr >> 2];
        default:
            abort(`invalid type for getValue: ${type}`)
    }
}
var noExitRuntime = Module["noExitRuntime"] || true;

function setValue(ptr, value, type = "i8") {
    if (type.endsWith("*")) type = "*";
    switch (type) {
        case "i1":
            HEAP8[ptr] = value;
            break;
        case "i8":
            HEAP8[ptr] = value;
            break;
        case "i16":
            HEAP16[ptr >> 1] = value;
            break;
        case "i32":
            HEAP32[ptr >> 2] = value;
            break;
        case "i64":
            abort("to do setValue(i64) use WASM_BIGINT");
        case "float":
            HEAPF32[ptr >> 2] = value;
            break;
        case "double":
            HEAPF64[ptr >> 3] = value;
            break;
        case "*":
            HEAPU32[ptr >> 2] = value;
            break;
        default:
            abort(`invalid type for setValue: ${type}`)
    }
}
var stackRestore = val => __emscripten_stack_restore(val);
var stackSave = () => _emscripten_stack_get_current();
var __emscripten_memcpy_js = (dest, src, num) => HEAPU8.copyWithin(dest, src, src + num);
var _abort = () => {
    abort("")
};
var readEmAsmArgsArray = [];
var readEmAsmArgs = (sigPtr, buf) => {
    readEmAsmArgsArray.length = 0;
    var ch;
    while (ch = HEAPU8[sigPtr++]) {
        var wide = ch != 105;
        wide &= ch != 112;
        buf += wide && buf % 8 ? 4 : 0;
        readEmAsmArgsArray.push(ch == 112 ? HEAPU32[buf >> 2] : ch == 105 ? HEAP32[buf >> 2] : HEAPF64[buf >> 3]);
        buf += wide ? 8 : 4
    }
    return readEmAsmArgsArray
};
var runEmAsmFunction = (code, sigPtr, argbuf) => {
    var args = readEmAsmArgs(sigPtr, argbuf);
    return ASM_CONSTS[code](...args)
};
var _emscripten_asm_const_int = (code, sigPtr, argbuf) => runEmAsmFunction(code, sigPtr, argbuf);
var _emscripten_date_now = () => Date.now();
var getHeapMax = () => 2147483648;
var growMemory = size => {
    var b = wasmMemory.buffer;
    var pages = (size - b.byteLength + 65535) / 65536;
    try {
        wasmMemory.grow(pages);
        updateMemoryViews();
        return 1
    } catch (e) {}
};
var _emscripten_resize_heap = requestedSize => {
    var oldSize = HEAPU8.length;
    requestedSize >>>= 0;
    var maxHeapSize = getHeapMax();
    if (requestedSize > maxHeapSize) {
        return false
    }
    var alignUp = (x, multiple) => x + (multiple - x % multiple) % multiple;
    for (var cutDown = 1; cutDown <= 4; cutDown *= 2) {
        var overGrownHeapSize = oldSize * (1 + .2 / cutDown);
        overGrownHeapSize = Math.min(overGrownHeapSize, requestedSize + 100663296);
        var newSize = Math.min(maxHeapSize, alignUp(Math.max(requestedSize, overGrownHeapSize), 65536));
        var replacement = growMemory(newSize);
        if (replacement) {
            return true
        }
    }
    return false
};
var getCFunc = ident => {
    var func = Module["_" + ident];
    return func
};
var writeArrayToMemory = (array, buffer) => {
    HEAP8.set(array, buffer)
};
var lengthBytesUTF8 = str => {
    var len = 0;
    for (var i = 0; i < str.length; ++i) {
        var c = str.charCodeAt(i);
        if (c <= 127) {
            len++
        } else if (c <= 2047) {
            len += 2
        } else if (c >= 55296 && c <= 57343) {
            len += 4;
            ++i
        } else {
            len += 3
        }
    }
    return len
};
var stringToUTF8Array = (str, heap, outIdx, maxBytesToWrite) => {
    if (!(maxBytesToWrite > 0)) return 0;
    var startIdx = outIdx;
    var endIdx = outIdx + maxBytesToWrite - 1;
    for (var i = 0; i < str.length; ++i) {
        var u = str.charCodeAt(i);
        if (u >= 55296 && u <= 57343) {
            var u1 = str.charCodeAt(++i);
            u = 65536 + ((u & 1023) << 10) | u1 & 1023
        }
        if (u <= 127) {
            if (outIdx >= endIdx) break;
            heap[outIdx++] = u
        } else if (u <= 2047) {
            if (outIdx + 1 >= endIdx) break;
            heap[outIdx++] = 192 | u >> 6;
            heap[outIdx++] = 128 | u & 63
        } else if (u <= 65535) {
            if (outIdx + 2 >= endIdx) break;
            heap[outIdx++] = 224 | u >> 12;
            heap[outIdx++] = 128 | u >> 6 & 63;
            heap[outIdx++] = 128 | u & 63
        } else {
            if (outIdx + 3 >= endIdx) break;
            heap[outIdx++] = 240 | u >> 18;
            heap[outIdx++] = 128 | u >> 12 & 63;
            heap[outIdx++] = 128 | u >> 6 & 63;
            heap[outIdx++] = 128 | u & 63
        }
    }
    heap[outIdx] = 0;
    return outIdx - startIdx
};
var stringToUTF8 = (str, outPtr, maxBytesToWrite) => stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);
var stackAlloc = sz => __emscripten_stack_alloc(sz);
var stringToUTF8OnStack = str => {
    var size = lengthBytesUTF8(str) + 1;
    var ret = stackAlloc(size);
    stringToUTF8(str, ret, size);
    return ret
};
var UTF8Decoder = typeof TextDecoder != "undefined" ? new TextDecoder("utf8") : undefined;
var UTF8ArrayToString = (heapOrArray, idx, maxBytesToRead) => {
    var endIdx = idx + maxBytesToRead;
    var endPtr = idx;
    while (heapOrArray[endPtr] && !(endPtr >= endIdx)) ++endPtr;
    if (endPtr - idx > 16 && heapOrArray.buffer && UTF8Decoder) {
        return UTF8Decoder.decode(heapOrArray.subarray(idx, endPtr))
    }
    var str = "";
    while (idx < endPtr) {
        var u0 = heapOrArray[idx++];
        if (!(u0 & 128)) {
            str += String.fromCharCode(u0);
            continue
        }
        var u1 = heapOrArray[idx++] & 63;
        if ((u0 & 224) == 192) {
            str += String.fromCharCode((u0 & 31) << 6 | u1);
            continue
        }
        var u2 = heapOrArray[idx++] & 63;
        if ((u0 & 240) == 224) {
            u0 = (u0 & 15) << 12 | u1 << 6 | u2
        } else {
            u0 = (u0 & 7) << 18 | u1 << 12 | u2 << 6 | heapOrArray[idx++] & 63
        }
        if (u0 < 65536) {
            str += String.fromCharCode(u0)
        } else {
            var ch = u0 - 65536;
            str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023)
        }
    }
    return str
};
var UTF8ToString = (ptr, maxBytesToRead) => ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : "";
var ccall = (ident, returnType, argTypes, args, opts) => {
    var toC = {
        "string": str => {
            var ret = 0;
            if (str !== null && str !== undefined && str !== 0) {
                ret = stringToUTF8OnStack(str)
            }
            return ret
        },
        "array": arr => {
            var ret = stackAlloc(arr.length);
            writeArrayToMemory(arr, ret);
            return ret
        }
    };

    function convertReturnValue(ret) {
        if (returnType === "string") {
            return UTF8ToString(ret)
        }
        if (returnType === "boolean") return Boolean(ret);
        return ret
    }
    var func = getCFunc(ident);
    var cArgs = [];
    var stack = 0;
    if (args) {
        for (var i = 0; i < args.length; i++) {
            var converter = toC[argTypes[i]];
            if (converter) {
                if (stack === 0) stack = stackSave();
                cArgs[i] = converter(args[i])
            } else {
                cArgs[i] = args[i]
            }
        }
    }
    var ret = func(...cArgs);

    function onDone(ret) {
        if (stack !== 0) stackRestore(stack);
        return convertReturnValue(ret)
    }
    ret = onDone(ret);
    return ret
};
var cwrap = (ident, returnType, argTypes, opts) => {
    var numericArgs = !argTypes || argTypes.every(type => type === "number" || type === "boolean");
    var numericRet = returnType !== "string";
    if (numericRet && numericArgs && !opts) {
        return getCFunc(ident)
    }
    return (...args) => ccall(ident, returnType, argTypes, args, opts)
};
var wasmImports = {
    c: __emscripten_memcpy_js,
    a: _abort,
    e: _emscripten_asm_const_int,
    d: _emscripten_date_now,
    b: _emscripten_resize_heap
};
var wasmExports = createWasm();
var ___wasm_call_ctors = () => (___wasm_call_ctors = wasmExports["g"])();
var _SetBatchFractionSize = Module["_SetBatchFractionSize"] = a0 => (_SetBatchFractionSize = Module["_SetBatchFractionSize"] = wasmExports["h"])(a0);
var _SetAttractionForce = Module["_SetAttractionForce"] = a0 => (_SetAttractionForce = Module["_SetAttractionForce"] = wasmExports["i"])(a0);
var _SetLinkLength = Module["_SetLinkLength"] = a0 => (_SetLinkLength = Module["_SetLinkLength"] = wasmExports["j"])(a0);
var _SetRepulsionForce = Module["_SetRepulsionForce"] = a0 => (_SetRepulsionForce = Module["_SetRepulsionForce"] = wasmExports["k"])(a0);
var _SetCentralForce = Module["_SetCentralForce"] = a0 => (_SetCentralForce = Module["_SetCentralForce"] = wasmExports["l"])(a0);
var _SetDt = Module["_SetDt"] = a0 => (_SetDt = Module["_SetDt"] = wasmExports["m"])(a0);
var _Init = Module["_Init"] = (a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11) => (_Init = Module["_Init"] = wasmExports["n"])(a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11);
var _Update = Module["_Update"] = (a0, a1, a2, a3) => (_Update = Module["_Update"] = wasmExports["o"])(a0, a1, a2, a3);
var _SetPosition = Module["_SetPosition"] = (a0, a1, a2) => (_SetPosition = Module["_SetPosition"] = wasmExports["p"])(a0, a1, a2);
var _SetSettleness = Module["_SetSettleness"] = a0 => (_SetSettleness = Module["_SetSettleness"] = wasmExports["q"])(a0);
var _FreeMemory = Module["_FreeMemory"] = () => (_FreeMemory = Module["_FreeMemory"] = wasmExports["r"])();
var _malloc = Module["_malloc"] = a0 => (_malloc = Module["_malloc"] = wasmExports["t"])(a0);
var _free = Module["_free"] = a0 => (_free = Module["_free"] = wasmExports["u"])(a0);
var __emscripten_stack_restore = a0 => (__emscripten_stack_restore = wasmExports["v"])(a0);
var __emscripten_stack_alloc = a0 => (__emscripten_stack_alloc = wasmExports["w"])(a0);
var _emscripten_stack_get_current = () => (_emscripten_stack_get_current = wasmExports["x"])();
var ___cxa_increment_exception_refcount = a0 => (___cxa_increment_exception_refcount = wasmExports["__cxa_increment_exception_refcount"])(a0);
var ___cxa_is_pointer_type = a0 => (___cxa_is_pointer_type = wasmExports["__cxa_is_pointer_type"])(a0);
Module["cwrap"] = cwrap;
Module["setValue"] = setValue;
Module["getValue"] = getValue;
var calledRun;
dependenciesFulfilled = function runCaller() {
    // if (!calledRun) run();
    // if (!calledRun) dependenciesFulfilled = runCaller
};

function run() 
{
    if (runDependencies > 0) {
        return
    }
    preRun();
    if (runDependencies > 0) {
        return
    }

    function doRun() {
        if (calledRun) return;
        calledRun = true;
        Module["calledRun"] = true;
        if (ABORT) return;
        initRuntime();
		console.log("wasm loaded");
        if (Module["onRuntimeInitialized"]) Module["onRuntimeInitialized"]();
		console.log("wasm initialized");
        postRun()
    }
    if (Module["setStatus"]) {
        Module["setStatus"]("Running...");
        setTimeout(function() {
            setTimeout(function() {
                Module["setStatus"]("")
            }, 1);
            doRun()
        }, 1)
    } else {
        doRun()
    }
}
if (Module["preInit"]) {
    if (typeof Module["preInit"] == "function") Module["preInit"] = [Module["preInit"]];
    while (Module["preInit"].length > 0) {
        Module["preInit"].pop()()
    }
}
