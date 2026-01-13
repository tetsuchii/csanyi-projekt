# Freesound API Setup Guide

## Overview
Your Sound Map app currently runs in **mock mode** with example sounds. To use real sounds from Freesound.org, you need to connect to the actual Freesound API.

## Current Status
- ✅ Sound Library Browser UI is fully implemented
- ✅ Search functionality is working (with mock data)
- ✅ Integration points are ready in both Zone Settings and Global Channels
- ⚠️ Currently using mock data with disabled audio previews
- ❌ Real API connection not yet configured

## Steps to Enable Real Freesound API

### 1. Get Your Freesound API Key

1. Go to [https://freesound.org/apiv2/apply/](https://freesound.org/apiv2/apply/)
2. Create a Freesound account if you don't have one
3. Fill out the API credentials application form:
   - **Application Name**: Sound Map App (or your preferred name)
   - **Description**: Interactive sound mapping application for tablets
   - **URL**: Your app URL (optional)
4. Submit the form and wait for approval (usually instant for basic access)
5. Once approved, you'll receive your **API Key** (also called OAuth token)

### 2. Update the Code

Open `/components/SoundLibraryBrowser.tsx` and modify the `searchSounds` function:

**Current code (lines 135-162):**
```typescript
const searchSounds = async (query: string) => {
  setIsSearching(true);
  
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Filter mock data based on search query
  const filtered = query.trim() === '' 
    ? MOCK_SOUNDS 
    : MOCK_SOUNDS.filter(sound => 
        sound.name.toLowerCase().includes(query.toLowerCase()) ||
        sound.description.toLowerCase().includes(query.toLowerCase())
      );
  
  setResults(filtered);
  setIsSearching(false);
  
  /* 
  // Production API call example:
  // ... commented code ...
  */
};
```

**Replace with:**
```typescript
const searchSounds = async (query: string) => {
  setIsSearching(true);
  
  try {
    // Replace with your actual Freesound API key
    const API_KEY = 'YOUR_FREESOUND_API_KEY_HERE';
    
    // Build search query (default to "ambience" if empty)
    const searchTerm = query.trim() || 'ambience';
    
    const response = await fetch(
      `https://freesound.org/apiv2/search/text/?` +
      `query=${encodeURIComponent(searchTerm)}` +
      `&fields=id,name,username,duration,previews,description,download` +
      `&token=${API_KEY}` +
      `&page_size=20` // Limit results
    );
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Map Freesound API response to our Sound type
    const mappedResults = data.results.map((item: any) => ({
      id: item.id,
      name: item.name,
      username: item.username,
      duration: item.duration,
      // Freesound provides multiple preview formats - use high quality MP3
      previews: item.previews?.['preview-hq-mp3'] || item.previews?.['preview-lq-mp3'] || null,
      description: item.description || 'No description',
      download: item.download // Note: downloading requires OAuth authentication
    }));
    
    setResults(mappedResults);
  } catch (error) {
    console.error('Freesound API error:', error);
    // Fallback to mock data on error
    setResults(MOCK_SOUNDS);
  } finally {
    setIsSearching(false);
  }
};
```

### 3. Update the Type Definition

The Freesound API returns preview URLs as an object with different quality levels. Update the `Sound` type (lines 104-112):

**Current:**
```typescript
type Sound = {
  id: number;
  name: string;
  username: string;
  duration: number;
  previews: string | null;
  description: string;
  download: string;
};
```

**Optional - Keep as is (works with both mock and real API):**
The current type already works because we extract a single preview URL string from the API response.

### 4. Remove or Update the Mock Mode Warning

Once connected to the real API, update the warning banner (lines 239-247):

**Option A - Remove it entirely** (if API is always enabled)

**Option B - Make it conditional:**
```typescript
const API_KEY = 'your-key-here'; // Define at component level
const isUsingRealAPI = API_KEY !== 'YOUR_FREESOUND_API_KEY_HERE';

// Then in the JSX:
{!isUsingRealAPI && (
  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
    {/* ... existing warning ... */}
  </div>
)}
```

### 5. Optional: Add Download Functionality

The current implementation uses preview URLs. If you want users to download the actual full-quality files:

**Note:** Downloading files from Freesound requires OAuth 2.0 authentication, which is more complex than simple API token auth. For most use cases, using the preview URLs (which are high-quality MP3s) is sufficient.

If you need full downloads, you'll need to:
1. Set up OAuth 2.0 flow
2. Store OAuth tokens
3. Make authenticated download requests

## Testing Your Connection

1. Replace `YOUR_FREESOUND_API_KEY_HERE` with your actual API key
2. Open the Sound Library in your app (either in Zone Settings or Global Channels)
3. Try searching for common sounds like "rain", "ocean", "birds"
4. Click the play button to preview sounds (should now work!)
5. Click "Use" to select a sound for your zone or channel

## API Response Structure

Here's what the Freesound API returns:

```json
{
  "count": 12345,
  "next": "https://freesound.org/apiv2/search/text/?...",
  "previous": null,
  "results": [
    {
      "id": 123456,
      "name": "Rain on roof",
      "username": "soundcollector",
      "duration": 45.5,
      "description": "Light rain falling on a tin roof",
      "previews": {
        "preview-hq-mp3": "https://freesound.org/data/previews/123/123456_1234567-hq.mp3",
        "preview-lq-mp3": "https://freesound.org/data/previews/123/123456_1234567-lq.mp3",
        "preview-hq-ogg": "https://freesound.org/data/previews/123/123456_1234567-hq.ogg",
        "preview-lq-ogg": "https://freesound.org/data/previews/123/123456_1234567-lq.ogg"
      },
      "download": "https://freesound.org/apiv2/sounds/123456/download/"
    }
  ]
}
```

## API Rate Limits

Freesound has rate limits:
- **Free tier**: 60 requests per minute
- **OAuth authenticated**: Higher limits

For normal usage in your app, this should be more than sufficient since searches are debounced (300ms delay).

## Troubleshooting

### "403 Forbidden" or "401 Unauthorized"
- Check that your API key is correct
- Ensure you're using the token parameter: `&token={API_KEY}`
- Verify your API application is approved on Freesound

### "No sounds found" for common searches
- The API is working, but the search term might be too specific
- Try broader terms like "nature", "city", "water"

### Previews not playing
- Check browser console for CORS errors
- Freesound preview URLs should work cross-origin
- Make sure `previews` field is included in the API request fields parameter

### Slow searches
- This is normal - the Freesound API can take 1-2 seconds to respond
- The debounce delay (300ms) helps reduce unnecessary requests

## Alternative: Self-Hosted Sound Library

If you want full control without API dependencies, you could:

1. Curate your own sound collection
2. Upload audio files to Supabase Storage
3. Create a database table with sound metadata
4. Query your own database instead of Freesound

This would require:
- Setting up a `sounds` table in Supabase
- Uploading audio files to Supabase Storage
- Modifying `searchSounds()` to query your database
- Building an admin interface to manage sounds

## Next Steps

1. ✅ Get your Freesound API key
2. ✅ Update the `searchSounds` function with your API key
3. ✅ Test searching and previewing sounds
4. ✅ Consider removing the mock mode warning
5. 🎵 Enjoy access to 500,000+ free sounds!

## Resources

- [Freesound API Documentation](https://freesound.org/docs/api/)
- [Freesound API Explorer](https://freesound.org/apiv2/apply/) - Test API calls
- [Freesound Homepage](https://freesound.org/)
- [API Terms of Use](https://freesound.org/help/tos_api/)

---

**Important:** When using sounds from Freesound, make sure to comply with their Creative Commons licenses. Many sounds require attribution. Consider adding attribution information to your app or documentation.
