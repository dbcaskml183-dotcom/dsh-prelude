// Compatibility exports for existing offline consumers. Product modules import
// the responsible shared/client module directly; shared never imports this facade.
export {CATEGORIES,MAX_DRAFT,DECISIONS} from './shared/method-limits.mjs';
export {plainDraft,excluded,localSuggestions} from './shared/method-policy.mjs';
export {validateModelResult} from './shared/result-validation.mjs';
export {safeSnippet} from './shared/catalog-registry.mjs';
export {safeSourceUrl} from './shared/source-url.mjs';
export {searchCatalog as searchMethods} from './shared/catalog-search.mjs';
export {insertSafely} from './client/insertion.mjs';
