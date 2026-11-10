import { DOCUMENT, Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { AUTHOR, COAUTHOR, OG_IMAGE, PORTFOLIO_URL, REPO_URL, SITE_NAME, SITE_URL } from '../data/site';

export interface PageSeo {
  title: string;
  description: string;
  /** Path with trailing slash, e.g. "/lote/". */
  path: string;
  noindex?: boolean;
  jsonLd?: object[];
}

const abs = (p: string) => (p.startsWith('http') ? p : SITE_URL + p);
const person = { '@type': 'Person', '@id': `${PORTFOLIO_URL}#person`, name: AUTHOR, url: PORTFOLIO_URL };

const website = {
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  url: `${SITE_URL}/`,
  name: SITE_NAME,
  inLanguage: 'pt-BR',
  description: 'Detector de dados pessoais em pedidos de acesso à informação (LAI/LGPD) que roda no navegador. Projeto de portfólio.',
  creator: person,
};

// No offers or ratings: it is a free portfolio demo and nothing about it is reviewed.
const app = {
  '@type': 'WebApplication',
  '@id': `${SITE_URL}/#app`,
  name: SITE_NAME,
  url: `${SITE_URL}/`,
  applicationCategory: 'SecurityApplication',
  operatingSystem: 'Qualquer navegador moderno',
  browserRequirements: 'Requer JavaScript',
  inLanguage: 'pt-BR',
  isAccessibleForFree: true,
  description: 'Encontra CPF, RG, telefone, e-mail, processos e outros dados pessoais em pedidos de acesso à informação, classifica o risco e anonimiza o texto, sem enviar nada para servidor.',
  featureList: ['Análise de texto colado', 'Análise de CSV em lote no navegador', 'Texto e CSV anonimizados', 'Painel de risco por tipo de dado'],
  author: person,
  creator: person,
  contributor: { '@type': 'Person', name: COAUTHOR },
  codeRepository: REPO_URL,
  isPartOf: { '@id': `${SITE_URL}/#website` },
};

@Injectable({ providedIn: 'root' })
export class Seo {
  private doc = inject(DOCUMENT);
  private meta = inject(Meta);
  private title = inject(Title);

  set(p: PageSeo) {
    const url = abs(p.path);
    const image = abs(OG_IMAGE);
    this.title.setTitle(p.title);
    const tags: Record<string, string> = {
      description: p.description,
      robots: p.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large',
      'og:type': 'website',
      'og:site_name': SITE_NAME,
      'og:locale': 'pt_BR',
      'og:title': p.title,
      'og:description': p.description,
      'og:url': url,
      'og:image': image,
      'og:image:width': '1200',
      'og:image:height': '630',
      'og:image:alt': 'SafeDoc-DF: dados pessoais destacados e tarjados em um pedido de acesso à informação',
      'twitter:card': 'summary_large_image',
      'twitter:title': p.title,
      'twitter:description': p.description,
      'twitter:image': image,
    };
    for (const [key, content] of Object.entries(tags)) {
      const attr = key.startsWith('og:') ? 'property' : 'name';
      this.meta.updateTag({ [attr]: key, content }, `${attr}="${key}"`);
    }

    let link = this.doc.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.doc.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.doc.head.appendChild(link);
    }
    link.setAttribute('href', url);

    let ld = this.doc.getElementById('ld-json');
    if (!ld) {
      ld = this.doc.createElement('script');
      ld.id = 'ld-json';
      ld.setAttribute('type', 'application/ld+json');
      this.doc.head.appendChild(ld);
    }
    // Escape "<" so no string in the data can close the script element.
    ld.textContent = JSON.stringify({ '@context': 'https://schema.org', '@graph': [website, app, ...(p.jsonLd ?? [])] }).replace(/</g, '\\u003c');
  }
}
