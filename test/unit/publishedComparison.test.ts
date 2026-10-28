/**
 * The published-comparison backend (docs/standalone.md: published-comparison-opens-itself):
 * imagecompare.json is a listing of relative paths that stands in for a dropped folder. These tests
 * import the REAL standalone/fsBackends.ts; the end-to-end boot (one fetch, landing kept without a
 * manifest, the shared scanner over the listing) is pinned by the webview standalone spec.
 */
import { describe, it, expect } from 'vitest';

interface PublishedFs {
  writable: boolean;
  readDirectory(path: string): Promise<Array<[string, number]>>;
  readFile(path: string): Promise<Uint8Array>;
  writeFile(path: string, content: Uint8Array): Promise<void>;
  delete(path: string): Promise<void>;
}

// Runtime-computed on purpose, as in sweepHostEquivalence.test.ts: standalone/ compiles under
// tsconfig.standalone.json (DOM lib), so a literal specifier would drag it into tsconfig.test.json.
const backendsModule = '../../standalone/fsBackends';
const shimModule = '../../standalone/shims/vscode';
const { createPublishedBackend, parsePublishedManifest } = await import(backendsModule) as {
  parsePublishedManifest(text: string): string[];
  createPublishedBackend(files: readonly string[], fetchFile: (path: string) => Promise<ArrayBuffer>): { fs: PublishedFs; rootPath: string };
};
const { FileType } = await import(shimModule) as { FileType: { File: number; Directory: number } };

describe('parsePublishedManifest', () => {
  it('returns the listed relative paths in manifest order', () => {
    const files = ['gt/scene_01.png', 'pred/scene_01.png', 'gt/scene 02.png'];
    expect(parsePublishedManifest(JSON.stringify({ files }))).toEqual(files);
  });

  it('rejects a manifest with no files', () => {
    expect(() => parsePublishedManifest('{"files": []}')).toThrow(/^imagecompare\.json: must list "files"/);
    expect(() => parsePublishedManifest('{}')).toThrow(/^imagecompare\.json: must list "files"/);
    expect(() => parsePublishedManifest('null')).toThrow(/^imagecompare\.json: must list "files"/);
    expect(() => parsePublishedManifest('{"files": "gt/a.png"}')).toThrow(/^imagecompare\.json: must list "files"/);
  });

  it('rejects paths that leave the page directory', () => {
    for (const bad of ['../gt/a.png', 'gt/../../a.png', './gt/a.png', 'gt/./a.png', '/gt/a.png', 'https://example.com/a.png', 'gt\\a.png', 'gt//a.png', 7]) {
      expect(() => parsePublishedManifest(JSON.stringify({ files: ['gt/ok.png', bad] }))).toThrow(/^imagecompare\.json: not a relative path/);
    }
  });

  it('reports a page that is not JSON as a parse failure, not a comparison', () => {
    expect(() => parsePublishedManifest('<!DOCTYPE html><html></html>')).toThrow(/^imagecompare\.json: not valid JSON$/);
  });
});

describe('createPublishedBackend', () => {
  const files = ['gt/scene_01.png', 'gt/scene_02.png', 'pred/scene_01.png'];

  it('lists the manifest as a folder whose subdirectories are the columns', async () => {
    const root = createPublishedBackend(files, async () => new ArrayBuffer(0));
    expect(root.rootPath).toBe('/comparison');
    expect((await root.fs.readDirectory('/comparison')).sort()).toEqual([
      ['gt', FileType.Directory],
      ['pred', FileType.Directory],
    ]);
    expect((await root.fs.readDirectory('/comparison/gt')).sort()).toEqual([
      ['scene_01.png', FileType.File],
      ['scene_02.png', FileType.File],
    ]);
  });

  it('reads each file through the injected fetch by its manifest-relative path, lazily, not at listing time', async () => {
    const fetched: string[] = [];
    const root = createPublishedBackend(files, async (path) => {
      fetched.push(path);
      return new Uint8Array([path.length]).buffer;
    });
    expect(fetched).toEqual([]);
    expect(Array.from(await root.fs.readFile('/comparison/pred/scene_01.png'))).toEqual(['pred/scene_01.png'.length]);
    expect(fetched).toEqual(['pred/scene_01.png']);
  });

  it('is read-only: nothing a published page lists can be written or deleted', async () => {
    const root = createPublishedBackend(files, async () => new ArrayBuffer(0));
    expect(root.fs.writable).toBe(false);
    await expect(root.fs.writeFile('/comparison/results.txt', new Uint8Array([1]))).rejects.toThrow(/read-only/);
    await expect(root.fs.delete('/comparison/gt/scene_01.png')).rejects.toThrow(/read-only/);
  });
});
