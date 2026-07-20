// Color an XML line the same way XmlView does: tags emerald, attribute names
// purple, attribute values amber, comments gray. Processing instructions are
// cyan and CDATA is orange. Input is expected to already be raw XML (it is
// escaped here). Returns HTML for dangerouslySetInnerHTML.
export function highlightXmlLine(line: string): string {
  let h = line
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
  h = h.replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="text-gray-600 italic">$1</span>')
  h = h.replace(/(&lt;!\[CDATA\[[\s\S]*?\]\]&gt;)/g, '<span class="text-orange-300">$1</span>')
  h = h.replace(/(&lt;\?[\s\S]*?\?&gt;)/g, '<span class="text-cyan-300">$1</span>')
  h = h.replace(/(&lt;\/?)([\w:-]+)/g, '$1<span class="text-emerald-300">$2</span>')
  h = h.replace(/( [\w:-]+)(=)(&quot;.*?&quot;)/g, '<span class="text-purple-400">$1</span>$2<span class="text-amber-300">$3</span>')
  return h
}
