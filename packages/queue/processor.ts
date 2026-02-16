import type { BirdSummary } from '@workhero/db';
import type { BirdRepository } from '@workhero/repositories';

interface WikipediaResponse {
  query: {
    pages: Array<{
      title: string;
      extract?: string;
      missing?: boolean;
    }>;
  };
}

/**
 * Fetch a bird's intro summary from Wikipedia's MediaWiki API.
 */
export async function processBirdJob(
  birdId: string,
  birdRepo: BirdRepository,
  wikipediaApiUrl: string,
): Promise<BirdSummary> {
  const bird = birdRepo.findById(birdId);
  if (!bird) {
    throw new Error(`Bird not found: ${birdId}`);
  }

  const params = new URLSearchParams({
    action: 'query',
    prop: 'extracts',
    exintro: '1',
    explaintext: '1',
    redirects: '1',
    titles: bird.name,
    format: 'json',
    formatversion: '2',
  });

  const res = await fetch(`${wikipediaApiUrl}?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Wikipedia API error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as WikipediaResponse;
  const page = data.query.pages[0];

  if (!page || page.missing) {
    throw new Error(`Wikipedia page not found for: ${bird.name}`);
  }

  return {
    title: page.title,
    extract: page.extract ?? '',
    fetchedAt: new Date().toISOString(),
  };
}
