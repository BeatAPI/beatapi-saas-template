// Next.js Metadata type shim
export type Metadata = Record<string, any>;
export type Viewport = Record<string, any>;
export type GenerateMetadata = (...args: any[]) => Promise<Metadata> | Metadata;
