const forbiddenPatterns: Array<[RegExp, string]> = [
  [/<script[^>]+src\s*=/i, "External scripts are not allowed"],
  [/<(?:img|link|iframe|video|audio|source)[^>]+(?:src|href)\s*=\s*["']https?:/i, "External resources are not allowed"],
  [/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(/i, "Network APIs are not allowed"],
  [/\b(?:eval|Function)\s*\(/i, "Dynamic evaluation is not allowed"],
  [/\b(?:localStorage|sessionStorage|indexedDB|document\.cookie)\b/i, "Browser storage is not allowed"],
  [/\b(?:window\.top|window\.parent|parent\.location|top\.location)\b/i, "Parent navigation is not allowed"],
  [/<base\b/i, "Base URL overrides are not allowed"],
];

export function validateWorldHtml(html: string) {
  const errors: string[] = [];
  if (html.length < 800) errors.push("World artifact is too small to be a complete experiment");
  if (html.length > 250_000) errors.push("World artifact exceeds the 250 KB safety limit");
  if (!/<html[\s>]/i.test(html) || !/<\/html>/i.test(html)) errors.push("Artifact must be a complete HTML document");
  if (!/World A/i.test(html) || !/World B/i.test(html)) errors.push("Artifact must include both World A and World B");
  for (const [pattern, message] of forbiddenPatterns) if (pattern.test(html)) errors.push(message);
  return { valid: errors.length === 0, errors };
}

export function withSandboxCsp(html: string) {
  const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; media-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'">`;
  return /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (match) => `${match}${csp}`) : html.replace(/<html[^>]*>/i, (match) => `${match}<head>${csp}</head>`);
}
