// Scaffold for Amazon PA-API (when credentials unlock)
// Implements signed requests for SearchItems/GetItems and normalization
// Note: Keep usage minimal until approval; respect rate limits and policies.

import crypto from 'crypto'

type PaapiParams = Record<string, string>

function signPaapi(
  params: PaapiParams,
  region: string,
  host: string,
  accessKey: string,
  secretKey: string
) {
  // Placeholder for V4 signing (omitted for brevity). We'll implement when keys are available.
  // Return { url, headers } for fetch.
  return {
    url: `https://${host}/paapi5/searchitems`,
    headers: {} as Record<string, string>,
  }
}

export function buildPaapiRequest(
  keyword: string,
  region = 'us-east-1',
  host = 'webservices.amazon.com'
) {
  const accessKey = process.env.PAAPI_ACCESS_KEY || ''
  const secretKey = process.env.PAAPI_SECRET_KEY || ''
  const partnerTag = process.env.PAAPI_PARTNER_TAG || ''
  if (!accessKey || !secretKey || !partnerTag)
    throw new Error('Missing PA-API credentials')
  const params: PaapiParams = {
    Keywords: keyword,
    PartnerTag: partnerTag,
    PartnerType: 'Associates',
  }
  return signPaapi(params, region, host, accessKey, secretKey)
}
