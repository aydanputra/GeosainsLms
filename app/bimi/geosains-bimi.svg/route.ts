const BIMI_SVG = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<svg version="1.2" baseProfile="tiny-ps" width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" aria-labelledby="title desc" role="img">
  <title>GeoSains LMS BIMI Logo</title>
  <desc>GeoSains LMS email logo with blue background and white G mark.</desc>
  <rect width="512" height="512" rx="96" ry="96" fill="#1E3A8A"/>
  <rect x="64" y="64" width="384" height="384" rx="88" ry="88" fill="#2563EB"/>
  <circle cx="256" cy="256" r="132" fill="none" stroke="#FFFFFF" stroke-width="36"/>
  <path d="M338 256h-92v56h84c-16 40-52 66-102 66-68 0-122-55-122-122s54-122 122-122c35 0 62 11 85 32l26-28c-31-29-67-44-111-44-88 0-160 72-160 162s72 162 160 162c90 0 150-63 150-154 0-11-1-20-4-30z" fill="#FFFFFF"/>
</svg>
`;

export async function GET() {
  return new Response(BIMI_SVG, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
