// Local literal matching only. Search and presentation do not depend on routing,
// model calls, persistence, or recommendation policy.
export const normalizeSearch = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase('en-US');
export function matchesSearch(text, query = '') {
 const haystack = normalizeSearch(text);
 return normalizeSearch(query).trim().split(/\s+/u).filter(Boolean).every(word => haystack.includes(word));
}
export function cardTitle(method) {
 return method.technical_name?.trim() || method.label || '';
}
export function methodSearchText(method, sources = []) {
 const refs = (method.reference_sources || []).map(id => Array.isArray(sources) ? sources.find(s => s.id === id) : sources?.[id]).filter(Boolean);
 // Include all card content, even collapsed details and the skill fallback text.
 // Do not index internal review notes or hidden examples that the card cannot show.
 return [method.label, method.technical_name, method.domain, method.category,
  method.plain_explanation, method.snippet, method.generic_snippet,
  method.when_to_suggest, method.when_not_to_suggest, method.placement_hint,
  method.related_installed_skill, method.capability_note,...(method.search_terms || []),...(method.variants||[]).flatMap(v=>[v.label,v.snippet]),
  ...refs.flatMap(s => [s.name, s.url || s.repository || s.repo])]
  .filter(x => typeof x === 'string').join('\n');
}
export function searchCatalog(methods, query, category = '全部', favorites = null, sources = [], domain = '全部') {
 const matches = methods.filter(m => (category === '全部' || m.category === category)
  && (domain === '全部' || m.domains?.includes(domain))
  && (!favorites || favorites.includes(m.id)) && matchesSearch(methodSearchText(m, sources), query));
 if(!normalizeSearch(query).trim())return matches;
 const titles=[],others=[];
 for(const method of matches){
  (matchesSearch([method.technical_name,method.label].filter(Boolean).join('\n'),query)?titles:others).push(method);
 }
 return [...titles,...others];
}
