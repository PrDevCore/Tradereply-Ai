import backgroundSource from '../../extension/src/background.js?raw';
import contentSource from '../../extension/src/content.js?raw';
import contentCssSource from '../../extension/src/content.css?raw';
import manifestSource from '../../extension/src/manifest.json?raw';
import popupHtmlSource from '../../extension/src/popup.html?raw';
import popupJsSource from '../../extension/src/popup.js?raw';
import optionsHtmlSource from '../../extension/src/options.html?raw';
import optionsJsSource from '../../extension/src/options.js?raw';
import readmeSource from '../../extension/src/README.md?raw';

export interface ExtensionFiles {
  'manifest.json': string;
  'background.js': string;
  'content.js': string;
  'content.css': string;
  'popup.html': string;
  'popup.js': string;
  'options.html': string;
  'options.js': string;
  'README.md': string;
}

export const EXTENSION_FILE_NAMES: Array<keyof ExtensionFiles> = [
  'manifest.json', 'background.js', 'content.js', 'content.css',
  'popup.html', 'popup.js', 'options.html', 'options.js', 'README.md',
];

const API_ORIGIN_PLACEHOLDER = '__TRADEREPLY_API_ORIGIN__';

function normaliseApiOrigin(apiBaseUrl: string): string {
  let url: URL;
  try {
    url = new URL(apiBaseUrl.trim());
  } catch {
    throw new Error('API origin must be an absolute URL.');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('API origin must use http or https.');
  }
  if (url.search || url.hash || (url.pathname && url.pathname !== '/')) {
    throw new Error('API origin must not include a path, query string, or fragment.');
  }
  return url.origin;
}

/** Build downloadable files from the real extension source tree. */
export function generateExtensionFiles(apiBaseUrl: string): ExtensionFiles {
  const currentOrigin = normaliseApiOrigin(apiBaseUrl);
  const substitute = (source: string) => source.replaceAll(API_ORIGIN_PLACEHOLDER, currentOrigin);
  const manifest = JSON.parse(substitute(manifestSource));
  manifest.host_permissions = manifest.host_permissions.map((permission: string) =>
    permission === `${API_ORIGIN_PLACEHOLDER}/*` ? `${currentOrigin}/*` : permission,
  );

  return {
    'manifest.json': JSON.stringify(manifest, null, 2),
    'background.js': substitute(backgroundSource),
    'content.js': contentSource,
    'content.css': contentCssSource,
    'popup.html': popupHtmlSource,
    'popup.js': popupJsSource,
    'options.html': substitute(optionsHtmlSource),
    'options.js': optionsJsSource,
    'README.md': readmeSource,
  };
}
