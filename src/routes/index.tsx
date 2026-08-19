import { createFileRoute } from '@tanstack/react-router';
import { BeatApiProductHome } from '@/components/marketing/beatapi-product-home';
import { envConfigs } from '@/config';
import { m } from '@/paraglide/messages.js';
import { getLocale, locales, localizeUrl } from '@/paraglide/runtime.js';

function HomePage() {
  const { locale } = Route.useLoaderData();
  return <BeatApiProductHome locale={locale} />;
}

export const Route = createFileRoute('/')({
  loader: async () => ({ locale: getLocale() }),
  head: ({ loaderData }) => {
    const locale = loaderData?.locale ?? 'en';
    const messageLocale = locale === 'zh' ? 'zh' : 'en';
    const meta = {
      title: m['product.home.metaTitle']({}, { locale: messageLocale }),
      description: m['product.home.metaDescription'](
        {},
        { locale: messageLocale }
      ),
    };
    const urlFor = (loc: string) =>
      localizeUrl(`${envConfigs.app_url}/`, { locale: loc as 'en' | 'zh' }).href;
    return {
      meta: [
        { title: meta.title },
        { name: 'description', content: meta.description },
      ],
      links: [
        { rel: 'canonical', href: urlFor(locale) },
        ...locales.map((loc) => ({
          rel: 'alternate',
          hrefLang: loc,
          href: urlFor(loc),
        })),
        { rel: 'alternate', hrefLang: 'x-default', href: urlFor('en') },
      ],
    };
  },
  component: HomePage,
});
