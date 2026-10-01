import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Report } from '../../src/report/types';
import type { Manifest, ShellOptions } from '../../src/shell';
import type { RouteMeta } from '../../src/app/routes';
import { runAddress, type EngineStatus, type GivenRun, type RunRecord } from '../../src/lib/run';

/*
 * Reports the engine wrote, rendered to HTML on request with the same
 * renderer and page shell the build uses for the sample, so an engine
 * report is a document too: it reads without JavaScript, carries its own
 * title and description, and hydrates from the report embedded in it.
 * Pages that depend on the engine are rendered again for this server.
 */

interface ServerBundle {
  render(address: string, given?: { report?: Report; run?: GivenRun }): Promise<string>;
  structuredData(path: string, report?: Report): Record<string, unknown> | undefined;
  reportMeta(report: Report): RouteMeta;
  fillShell(template: string, o: ShellOptions): string;
  renderForEngine(engine: EngineStatus): void;
  ROUTES: RouteMeta[];
}

export class ReportRenderer {
  private constructor(
    private readonly bundle: ServerBundle,
    private readonly template: string,
    private readonly manifest: Manifest,
    private readonly siteUrl?: string,
    private readonly head = '',
  ) {}

  /** `head` is added to every page; `engine` is what this server runs, for the pages that say so. */
  static async load(root: string, siteUrl?: string, head = '', engine?: EngineStatus): Promise<ReportRenderer> {
    const bundle = (await import(pathToFileURL(join(root, 'dist-ssr', 'entry-server.js')).href)) as ServerBundle;
    const template = await readFile(join(root, 'dist-ssr', 'template.html'), 'utf8');
    const manifest = JSON.parse(await readFile(join(root, 'dist', '.vite', 'manifest.json'), 'utf8')) as Manifest;
    if (engine) bundle.renderForEngine(engine);
    return new ReportRenderer(bundle, template, manifest, siteUrl, head);
  }

  async page(report: Report): Promise<string> {
    const path = `/report/${report.id}`;
    const meta = this.bundle.reportMeta(report);
    return this.withHead(
      this.bundle.fillShell(this.template, {
        path,
        html: await this.bundle.render(path, { report }),
        title: meta.title,
        description: meta.description,
        manifest: this.manifest,
        siteUrl: this.siteUrl,
        structuredData: this.bundle.structuredData(path, report),
        embeds: { 'report-data': report },
      }),
    );
  }

  /**
   * The request page following a run, as the run stands (or saying there is no such run), so
   * the slip reads before any script runs and the page follows the run on from there.
   */
  async runPage(id: string, record: RunRecord | null): Promise<string> {
    const path = runAddress(id);
    const meta = this.meta('/initiate');
    // A copy as the run stands now: events that arrive during the render must not reach the page's data
    // without reaching its markup, or the page would hydrate against a different run.
    const run: GivenRun = { id, record: record && structuredClone(record), at: new Date().toISOString() };
    return this.withHead(
      this.bundle.fillShell(this.template, {
        path,
        html: await this.bundle.render(path, { run }),
        title: meta.title,
        description: meta.description,
        manifest: this.manifest,
        siteUrl: this.siteUrl,
        embeds: { 'run-data': run },
        noindex: true,
      }),
    );
  }

  /** One of the site's own pages, rendered as the build renders it but for this server. */
  async route(path: string): Promise<string> {
    const meta = this.meta(path);
    return this.withHead(
      this.bundle.fillShell(this.template, {
        path,
        html: await this.bundle.render(path),
        title: meta.title,
        description: meta.description,
        manifest: this.manifest,
        siteUrl: this.siteUrl,
        structuredData: this.bundle.structuredData(path),
      }),
    );
  }

  private meta(path: string): RouteMeta {
    const meta = this.bundle.ROUTES.find((r) => r.path === path);
    if (!meta) throw new Error(`The site has no page at ${path}`);
    return meta;
  }

  private withHead(page: string) {
    return this.head ? page.replace('</head>', `${this.head}</head>`) : page;
  }
}
