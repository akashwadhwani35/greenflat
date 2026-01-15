import { Request, Response } from 'express';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

export const geocodeCity = async (req: Request, res: Response) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'query is required' });
    }

    if (!GOOGLE_MAPS_API_KEY) {
      return res.status(500).json({ error: 'Google Maps API key not configured' });
    }

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_MAPS_API_KEY}`
    );

    if (!response.ok) {
      return res.status(500).json({ error: 'Failed to reach Google Geocoding' });
    }

    const data = await response.json() as any;
    const first = data.results?.[0];
    if (!first) {
      return res.status(404).json({ error: 'No results found for that query' });
    }

    const cityComponent = first.address_components?.find((c: any) => c.types?.includes('locality'));
    const city = cityComponent?.long_name || first.formatted_address || query;
    const { lat, lng } = first.geometry?.location || {};

    res.json({
      city,
      lat,
      lng,
      raw: first,
    });
  } catch (error) {
    console.error('Geocode error', error);
    res.status(500).json({ error: 'Failed to geocode location' });
  }
};

