// Plausible script rendered natively so it is present in the SSR HTML.
export function Plausible({
  domain,
  src = "https://plausible.io/js/script.js",
}: {
  domain: string;
  src?: string;
}) {
  if (!domain) return null;
  let scriptUrl: URL;
  try {
    scriptUrl = new URL(src);
  } catch {
    return null;
  }
  if (scriptUrl.protocol !== 'https:') return null;

  return (
    <>
      {/* async={true} flags this to React 19 as a hoistable resource —
          see google-analytics.tsx for the full rationale. */}
      <script
        id="plausible-init"
        async
        dangerouslySetInnerHTML={{
          __html: `window.plausible=window.plausible||function(){(window.plausible.q=window.plausible.q||[]).push(arguments)};`,
        }}
      />
      <script
        id="plausible-loader"
        data-domain={domain}
        src={scriptUrl.toString()}
        defer
        async
      />
    </>
  );
}
