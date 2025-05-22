// src/app/api/domain-monitor/[...path]/route.ts

import { NextRequest } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
): Promise<Response> {
  const { path } = await params;
  const pathString = path.join('/');
  const url = new URL(request.url);
  const queryString = url.search;
  
  const targetUrl = `${process.env.DOMENE_INTERNAL_API_URL || 'http://localhost:3001'}/api/${pathString}${queryString}`;
  
  try {
    const response = await fetch(targetUrl, {
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    const data = await response.json();
    return Response.json(data, { status: response.status });
  } catch (error) {
    console.error(`Error proxying to domain monitor API (${targetUrl}):`, error);
    return Response.json({ error: 'Failed to reach domain monitor API' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
): Promise<Response> {
  const { path } = await params;
  const pathString = path.join('/');
  const body = await request.json();
  
  const targetUrl = `${process.env.DOMENE_INTERNAL_API_URL || 'http://localhost:3001'}/api/${pathString}`;
  
  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return Response.json(data, { status: response.status });
  } catch (error) {
    console.error(`Error proxying to domain monitor API (${targetUrl}):`, error);
    return Response.json({ error: 'Failed to reach domain monitor API' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
): Promise<Response> {
  const { path } = await params;
  const pathString = path.join('/');
  const body = await request.json();
  
  const targetUrl = `${process.env.DOMENE_INTERNAL_API_URL || 'http://localhost:3001'}/api/${pathString}`;
  
  try {
    const response = await fetch(targetUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return Response.json(data, { status: response.status });
  } catch (error) {
    console.error(`Error proxying to domain monitor API (${targetUrl}):`, error);
    return Response.json({ error: 'Failed to reach domain monitor API' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
): Promise<Response> {
  const { path } = await params;
  const pathString = path.join('/');
  
  const targetUrl = `${process.env.DOMENE_INTERNAL_API_URL || 'http://localhost:3001'}/api/${pathString}`;
  
  try {
    const response = await fetch(targetUrl, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return Response.json(data, { status: response.status });
  } catch (error) {
    console.error(`Error proxying to domain monitor API (${targetUrl}):`, error);
    return Response.json({ error: 'Failed to reach domain monitor API' }, { status: 500 });
  }
}