import { URL } from 'node:url';
const logicalApi = 'http://127.0.0.1:4000';
export function classifyTarget(target, connect = false) {
  const counts = {
    deniedProxy: 0,
    apiFallthrough: 0,
    proxyProbes: 0,
    directProbes: 0,
  };
  if (connect) {
    counts.deniedProxy = 1;
    if (target === '127.0.0.1:4000') counts.apiFallthrough = 1;
  } else if (/^https?:\/\//.test(target ?? '')) {
    counts.deniedProxy = 1;
    if (target === logicalApi + '/qa-network-probe') counts.proxyProbes = 1;
    else if (URL.canParse(target) && new URL(target).origin === logicalApi)
      counts.apiFallthrough = 1;
  } else {
    counts.apiFallthrough = 1;
    if (target === '/qa-network-probe') counts.directProbes = 1;
  }
  return counts;
}
