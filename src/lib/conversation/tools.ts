import { Type, type FunctionDeclaration } from '@google/genai';

/**
 * Tool/function declarations exposed to Gemini, plus a server-side dispatcher.
 * The three tools (weather, time, web_search) are intentionally lightweight and
 * keyless-friendly so the demo works out of the box:
 *   - get_current_time uses Intl + the IANA tz database (no network).
 *   - get_weather uses the free, keyless Open-Meteo API.
 *   - web_search uses Google Programmable Search IF keys are configured,
 *     otherwise it degrades gracefully with an honest "no search configured".
 */

export const functionDeclarations: FunctionDeclaration[] = [
  {
    name: 'get_weather',
    description:
      'Get the current weather for a city or place. Returns temperature and conditions.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        location: {
          type: Type.STRING,
          description: 'City name, optionally with country, e.g. "Paris" or "Tokyo, Japan".',
        },
      },
      required: ['location'],
    },
  },
  {
    name: 'get_current_time',
    description:
      'Get the current local time in a given city, region, or IANA timezone.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        timezone: {
          type: Type.STRING,
          description:
            'An IANA timezone like "Asia/Tokyo" or "America/New_York". If the user gives a city, map it to the closest IANA timezone.',
        },
      },
      required: ['timezone'],
    },
  },
  {
    name: 'web_search',
    description:
      'Search the web for current information when you do not already know the answer.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: 'The search query.',
        },
      },
      required: ['query'],
    },
  },
];

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

export async function dispatchTool(
  name: string,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  try {
    switch (name) {
      case 'get_weather':
        return await getWeather(String(args.location ?? ''));
      case 'get_current_time':
        return getCurrentTime(String(args.timezone ?? ''));
      case 'web_search':
        return await webSearch(String(args.query ?? ''));
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Tool execution failed' };
  }
}

// ---------------------------------------------------------------------------
// get_current_time — zero network, uses the platform tz database
// ---------------------------------------------------------------------------

function getCurrentTime(timezone: string): Record<string, unknown> {
  const tz = timezone.trim() || 'UTC';
  try {
    const now = new Date();
    const formatted = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'long',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(now);
    return { timezone: tz, localTime: formatted };
  } catch {
    return {
      error: `Unknown timezone "${tz}". Provide a valid IANA timezone like "Asia/Tokyo".`,
    };
  }
}

// ---------------------------------------------------------------------------
// get_weather — Open-Meteo geocoding + forecast (free, no key)
// ---------------------------------------------------------------------------

const WEATHER_CODES: Record<number, string> = {
  0: 'clear sky',
  1: 'mainly clear',
  2: 'partly cloudy',
  3: 'overcast',
  45: 'foggy',
  48: 'depositing rime fog',
  51: 'light drizzle',
  53: 'moderate drizzle',
  55: 'dense drizzle',
  61: 'light rain',
  63: 'moderate rain',
  65: 'heavy rain',
  71: 'light snow',
  73: 'moderate snow',
  75: 'heavy snow',
  80: 'rain showers',
  81: 'moderate rain showers',
  82: 'violent rain showers',
  95: 'thunderstorms',
  96: 'thunderstorms with hail',
  99: 'thunderstorms with heavy hail',
};

async function getWeather(location: string): Promise<Record<string, unknown>> {
  if (!location.trim()) return { error: 'No location provided.' };

  const geoRes = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      location
    )}&count=1&language=en&format=json`
  );
  if (!geoRes.ok) return { error: 'Could not look up that location.' };
  const geo = (await geoRes.json()) as {
    results?: Array<{ latitude: number; longitude: number; name: string; country?: string }>;
  };
  const place = geo.results?.[0];
  if (!place) return { error: `Could not find a place called "${location}".` };

  const wxRes = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,weather_code&temperature_unit=fahrenheit`
  );
  if (!wxRes.ok) return { error: 'Could not fetch the weather.' };
  const wx = (await wxRes.json()) as {
    current?: { temperature_2m: number; weather_code: number };
  };
  if (!wx.current) return { error: 'No weather data available.' };

  return {
    location: [place.name, place.country].filter(Boolean).join(', '),
    temperatureF: Math.round(wx.current.temperature_2m),
    conditions: WEATHER_CODES[wx.current.weather_code] ?? 'unknown conditions',
  };
}

// ---------------------------------------------------------------------------
// web_search — Google Programmable Search if configured, else graceful note
// ---------------------------------------------------------------------------

async function webSearch(query: string): Promise<Record<string, unknown>> {
  if (!query.trim()) return { error: 'No search query provided.' };

  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_ENGINE_ID;

  if (!apiKey || !cx) {
    return {
      note: 'Web search is not configured on this demo. Answer from your own knowledge and mention you could not search the live web.',
    };
  }

  const res = await fetch(
    `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(
      query
    )}&num=3`
  );
  if (!res.ok) return { error: 'Web search request failed.' };
  const data = (await res.json()) as {
    items?: Array<{ title: string; snippet: string; link: string }>;
  };
  const results = (data.items ?? []).map((i) => ({
    title: i.title,
    snippet: i.snippet,
    link: i.link,
  }));
  return { query, results };
}
