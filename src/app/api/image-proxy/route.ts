import { NextResponse } from 'next/server';

export const runtime = 'edge';

function getRefererForUrl(imageUrl: string): string {
  try {
    const url = new URL(imageUrl);
    const hostname = url.hostname;
    if (hostname.includes('douban') || hostname.includes('doubanio')) {
      return 'https://movie.douban.com/';
    }
    return `${url.protocol}//${url.hostname}/`;
  } catch {
    return 'https://movie.douban.com/';
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get('url');
  if (!imageUrl) return NextResponse.json({ error: 'Missing image URL' }, { status: 400 });
  if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
    return NextResponse.json({ error: 'Invalid image URL' }, { status: 400 });
  }
  try {
    const referer = getRefererForUrl(imageUrl);
    const resp = await fetch(imageUrl, {
      headers: {
        Referer: referer,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      },
    });
    if (!resp.ok) {
      if (resp.status === 403 || resp.status === 401) {
        const retry = await fetch(imageUrl, {
          headers: {
            Referer: 'https://www.google.com/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          },
        });
        if (retry.ok) return proxyResponse(retry);
      }
      return NextResponse.json({ error: resp.statusText }, { status: resp.status });
    }
    return proxyResponse(resp);
  } catch {
    return NextResponse.json({ error: 'Error fetching image' }, { status: 500 });
  }
}

async function proxyResponse(resp: Response): Promise<Response> {
  const ct = resp.headers.get('content-type');
  if (!resp.body) return NextResponse.json({ error: 'No body' }, { status: 500 });
  const h = new Headers();
  if (ct) h.set('Content-Type', ct);
  h.set('Access-Control-Allow-Origin', '*');
  h.set('Cache-Control', 'public, max-age=15720000, s-maxage=15720000');
  h.set('CDN-Cache-Control', 'public, s-maxage=15720000');
  h.set('Vercel-CDN-Cache-Control', 'public, s-maxage=15720000');
  return new Response(resp.body, { status: 200, headers: h });
}
