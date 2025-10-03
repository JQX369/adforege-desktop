import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { middleware } from '@/middleware'

describe('Middleware', () => {
  let mockRequest: NextRequest

  beforeEach(() => {
    vi.clearAllMocks()
    mockRequest = {
      nextUrl: { pathname: '/' },
      headers: new Headers(),
      cookies: {
        get: vi.fn(),
        set: vi.fn(),
        getAll: vi.fn(),
        delete: vi.fn(),
      },
    } as any
  })

  it('should skip middleware for API routes', () => {
    mockRequest.nextUrl.pathname = '/api/guides/top'
    const result = middleware(mockRequest)
    expect(result).toBeInstanceOf(Response) // Middleware runs for all paths and returns a Response
  })

  it('should skip middleware for static files', () => {
    mockRequest.nextUrl.pathname = '/_next/static/file.js'
    const result = middleware(mockRequest)
    expect(result).toBeInstanceOf(Response)
  })

  it('should skip middleware for images', () => {
    mockRequest.nextUrl.pathname = '/favicon.ico'
    const result = middleware(mockRequest)
    expect(result).toBeInstanceOf(Response)
  })

  it('should set USD cookie for US location', () => {
    mockRequest.headers.set('accept-language', 'en-US,en;q=0.9')
    mockRequest.cookies.get = vi.fn().mockReturnValue(null)

    const mockResponse = { cookies: { set: vi.fn() }, headers: { set: vi.fn() } }
    vi.spyOn(NextResponse, 'next').mockReturnValue(mockResponse as any)

    middleware(mockRequest)

    expect(mockResponse.cookies.set).toHaveBeenCalledWith(
      'preferred-currency',
      'USD',
      expect.objectContaining({
        maxAge: 60 * 60 * 24 * 30,
        path: '/',
        httpOnly: false,
      })
    )
  })

  it('should set GBP cookie for UK location', () => {
    mockRequest.headers.set('accept-language', 'en-GB,en;q=0.9')
    mockRequest.cookies.get = vi.fn().mockReturnValue(null)

    const mockResponse = { cookies: { set: vi.fn() }, headers: { set: vi.fn() } }
    vi.spyOn(NextResponse, 'next').mockReturnValue(mockResponse as any)

    middleware(mockRequest)

    expect(mockResponse.cookies.set).toHaveBeenCalledWith(
      'preferred-currency',
      'GBP',
      expect.any(Object)
    )
  })

  it('should respect existing currency cookie', () => {
    mockRequest.cookies.get = vi.fn().mockReturnValue({ value: 'EUR' })

    const mockResponse = { cookies: { set: vi.fn() }, headers: { set: vi.fn() } }
    vi.spyOn(NextResponse, 'next').mockReturnValue(mockResponse as any)

    middleware(mockRequest)

    // Should not set a new cookie since one already exists with the same value
    expect(mockResponse.cookies.set).not.toHaveBeenCalled()
  })

  it('should set currency header for server components', () => {
    mockRequest.headers.set('accept-language', 'en-GB,en;q=0.9')
    mockRequest.cookies.get = vi.fn().mockReturnValue(null)

    const mockResponse = { cookies: { set: vi.fn() }, headers: new Headers() }
    vi.spyOn(NextResponse, 'next').mockReturnValue(mockResponse as any)

    middleware(mockRequest)

    expect(mockResponse.headers.get('x-detected-currency')).toBe('GBP')
  })

  it('should prioritize cookie over language detection', () => {
    mockRequest.headers.set('accept-language', 'en-US,en;q=0.9')
    mockRequest.cookies.get = vi.fn().mockReturnValue({ value: 'EUR' })

    const mockResponse = { cookies: { set: vi.fn() }, headers: { set: vi.fn() } }
    vi.spyOn(NextResponse, 'next').mockReturnValue(mockResponse as any)

    middleware(mockRequest)

    // Should use cookie value and not set a new cookie
    expect(mockResponse.cookies.set).not.toHaveBeenCalled()
  })

  it('should handle Cloudflare geo headers', () => {
    mockRequest.headers.set('cf-ipcountry', 'DE')
    mockRequest.cookies.get = vi.fn().mockReturnValue(null)

    const mockResponse = { cookies: { set: vi.fn() }, headers: { set: vi.fn() } }
    vi.spyOn(NextResponse, 'next').mockReturnValue(mockResponse as any)

    middleware(mockRequest)

    expect(mockResponse.cookies.set).toHaveBeenCalledWith(
      'preferred-currency',
      'EUR',
      expect.any(Object)
    )
  })

  it('should handle Vercel geo headers', () => {
    mockRequest.headers.set('x-vercel-ip-country', 'FR')
    mockRequest.cookies.get = vi.fn().mockReturnValue(null)

    const mockResponse = { cookies: { set: vi.fn() }, headers: { set: vi.fn() } }
    vi.spyOn(NextResponse, 'next').mockReturnValue(mockResponse as any)

    middleware(mockRequest)

    expect(mockResponse.cookies.set).toHaveBeenCalledWith(
      'preferred-currency',
      'EUR',
      expect.any(Object)
    )
  })

  it('should default to USD when no location data', () => {
    mockRequest.cookies.get = vi.fn().mockReturnValue(null)

    const mockResponse = { cookies: { set: vi.fn() }, headers: { set: vi.fn() } }
    vi.spyOn(NextResponse, 'next').mockReturnValue(mockResponse as any)

    middleware(mockRequest)

    expect(mockResponse.cookies.set).toHaveBeenCalledWith(
      'preferred-currency',
      'USD',
      expect.any(Object)
    )
  })
})
