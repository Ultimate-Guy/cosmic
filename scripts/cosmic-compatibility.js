(() => {
'use strict';
if(window.CosmicCompatibility)return;
const policies={default:{basePath:'auto',resize:'contain',focus:'game',serviceWorker:'isolate',fallback:'shell'},'legacy-document-write':{documentWrite:'compat',basePath:'rewrite',resize:'contain',focus:'game',serviceWorker:'isolate',fallback:'direct'},webgl:{resize:'contain',focus:'game',serviceWorker:'isolate',fallback:'shell'},external:{basePath:'preserve',resize:'contain',focus:'game',serviceWorker:'none',fallback:'direct'}};
function resolve(meta={}){const tags=Array.isArray(meta.compatibility_tags)?meta.compatibility_tags:[];if(tags.includes('document-write'))return policies['legacy-document-write'];if(tags.includes('webgl'))return policies.webgl;if(meta.source==='UGS'||meta.external)return policies.external;return policies.default}
window.CosmicCompatibility={version:1,resolve,policies};
})();