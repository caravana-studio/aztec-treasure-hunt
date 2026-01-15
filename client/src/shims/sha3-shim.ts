import { keccak256, keccak384, keccak512, sha3_256, sha3_384, sha3_512, shake128, shake256 } from 'js-sha3';

export class Keccak {
  private bits: number;
  private hashFn: (data: string | ArrayBuffer | Uint8Array) => string;
  private data: Uint8Array[] = [];

  constructor(bits: number = 256) {
    this.bits = bits;
    switch (bits) {
      case 256:
        this.hashFn = keccak256;
        break;
      case 384:
        this.hashFn = keccak384;
        break;
      case 512:
        this.hashFn = keccak512;
        break;
      default:
        this.hashFn = keccak256;
    }
  }

  update(data: string | Buffer | Uint8Array): this {
    if (typeof data === 'string') {
      this.data.push(new TextEncoder().encode(data));
    } else {
      this.data.push(new Uint8Array(data));
    }
    return this;
  }

  digest(encoding?: string): string | Buffer {
    const combined = new Uint8Array(this.data.reduce((acc, arr) => acc + arr.length, 0));
    let offset = 0;
    for (const arr of this.data) {
      combined.set(arr, offset);
      offset += arr.length;
    }
    const hash = this.hashFn(combined);
    if (encoding === 'hex') {
      return hash;
    }
    // Return as Buffer-like
    const bytes = new Uint8Array(hash.length / 2);
    for (let i = 0; i < hash.length; i += 2) {
      bytes[i / 2] = parseInt(hash.substr(i, 2), 16);
    }
    return bytes as any;
  }
}

export class SHA3 {
  private bits: number;
  private hashFn: (data: string | ArrayBuffer | Uint8Array) => string;
  private data: Uint8Array[] = [];

  constructor(bits: number = 256) {
    this.bits = bits;
    switch (bits) {
      case 256:
        this.hashFn = sha3_256;
        break;
      case 384:
        this.hashFn = sha3_384;
        break;
      case 512:
        this.hashFn = sha3_512;
        break;
      default:
        this.hashFn = sha3_256;
    }
  }

  update(data: string | Buffer | Uint8Array): this {
    if (typeof data === 'string') {
      this.data.push(new TextEncoder().encode(data));
    } else {
      this.data.push(new Uint8Array(data));
    }
    return this;
  }

  digest(encoding?: string): string | Buffer {
    const combined = new Uint8Array(this.data.reduce((acc, arr) => acc + arr.length, 0));
    let offset = 0;
    for (const arr of this.data) {
      combined.set(arr, offset);
      offset += arr.length;
    }
    const hash = this.hashFn(combined);
    if (encoding === 'hex') {
      return hash;
    }
    const bytes = new Uint8Array(hash.length / 2);
    for (let i = 0; i < hash.length; i += 2) {
      bytes[i / 2] = parseInt(hash.substr(i, 2), 16);
    }
    return bytes as any;
  }
}

export class SHAKE {
  private bits: number;
  private hashFn: (data: string | ArrayBuffer | Uint8Array, outputBits: number) => string;
  private data: Uint8Array[] = [];

  constructor(bits: number = 128) {
    this.bits = bits;
    this.hashFn = bits === 256 ? shake256 : shake128;
  }

  update(data: string | Buffer | Uint8Array): this {
    if (typeof data === 'string') {
      this.data.push(new TextEncoder().encode(data));
    } else {
      this.data.push(new Uint8Array(data));
    }
    return this;
  }

  digest(encoding?: string, outputBits?: number): string | Buffer {
    const combined = new Uint8Array(this.data.reduce((acc, arr) => acc + arr.length, 0));
    let offset = 0;
    for (const arr of this.data) {
      combined.set(arr, offset);
      offset += arr.length;
    }
    const hash = this.hashFn(combined, outputBits || this.bits);
    if (encoding === 'hex') {
      return hash;
    }
    const bytes = new Uint8Array(hash.length / 2);
    for (let i = 0; i < hash.length; i += 2) {
      bytes[i / 2] = parseInt(hash.substr(i, 2), 16);
    }
    return bytes as any;
  }
}

export default { Keccak, SHA3, SHAKE };
