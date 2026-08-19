// GA4 (gtag.js) as native script tags so they are emitted in SSR HTML.
export function GoogleAnalytics({ measurementId }: { measurementId: string }) {
  const normalizedId = measurementId.trim();
  if (!/^(G|AW|DC)-[A-Z0-9-]+$/i.test(normalizedId)) return null;
  const serializedId = JSON.stringify(normalizedId);

  return (
    <>
      <script
        id="ga-loader"
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(normalizedId)}`}
        async
      />
      {/* async={true} flags this to React 19 as a hoistable resource —
          without it, React logs the "Encountered a script tag while
          rendering React component" warning and won't re-execute it on
          client navigations. */}
      <script
        id="ga-init"
        async
        dangerouslySetInnerHTML={{
          __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config',${serializedId});`,
        }}
      />
    </>
  );
}
