declare module "*.txt.js" {
    const value: string
    export default value
}

declare module "*.txt.css" {
    const value: string
    export default value
}

declare module "*.txt" {
    const value: string
    export default value
}

// binary
declare module "*.wasm" {
    const value: Uint8Array
    export default value
}

declare module "*.png" {
    const value: Uint8Array
    export default value
}

