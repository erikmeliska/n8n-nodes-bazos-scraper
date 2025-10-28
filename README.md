# Bazos Scraper n8n Node

This is a custom n8n node that replicates the functionality of the BazosScraper Python script for both Slovak and Czech Bazos marketplaces.

## Features

- **Multi-country support**: Search both Bazos.sk (Slovakia) and Bazos.cz (Czech Republic)
- **Advanced search parameters** with customizable options
- **Location-based filtering** with distance radius
- **Price range filtering** (min/max price)
- **Time-based filtering** (published in last N days)
- **Sorting options** (newest first, price low-to-high, price high-to-low)
- **Results limit** control with pagination support
- **Full description fetching** from detail pages
- **Structured data extraction** including:
  - Listing ID
  - Title
  - Link to full listing
  - Full-size image link with image order
  - Added date (ISO format: YYYY-MM-DD)
  - Description and full description
  - Seller name and phone number
  - Price and currency (handles "Zadarmo"/"Zdarma" for free items)
  - Location and postal code
  - View count
  - Search URL used

## Installation

1. Install the node in your n8n instance:
   ```bash
   npm install n8n-nodes-bazos-scraper
   ```

2. Add to your n8n configuration in `package.json`:
   ```json
   {
     "n8n": {
       "nodes": [
         "n8n-nodes-bazos-scraper"
       ]
     }
   }
   ```

3. Restart n8n

## Usage

1. Add the "Bazos Scraper" node to your workflow
2. Configure the search parameters:
   - **Search Term**: What to search for (required)
   - **Post Code**: Postal code to search in (e.g., 81101, 04001)
   - **Distance**: Search radius in kilometers (default: 25)
   - **Min Price**: Minimum price filter (leave empty for no limit)
   - **Max Price**: Maximum price filter (leave empty for no limit)
   - **Order**: Sort order for results
     - Newest First (default)
     - Price Low to High
     - Price High to Low
   - **Results Limit**: Maximum number of results to return (default: 20)
   - **Published in Last N Days**: Only show listings from last N days (leave empty for no time filter)
   - **Fetch Full Descriptions**: Fetch complete descriptions, names, and phone numbers from detail pages
   - **Country**: Select marketplace
     - Slovakia (bazos.sk) - default
     - Czech Republic (bazos.cz)

## Output Format

The node returns a JSON object with the following structure:

```json
{
  "searchTerm": "your search term",
  "location": "search location",
  "distance": 25,
  "minPrice": 0,
  "maxPrice": 10000,
  "order": "",
  "resultsLimit": 20,
  "publishedDays": null,
  "withFullDescriptions": false,
  "country": "sk",
  "listings": [
    {
      "id": 123456,
      "title": "Listing Title",
      "link": "https://www.bazos.sk/inzerat/123456",
      "imgLink": "https://www.bazos.sk/img/1/456/123456.jpg",
      "imageOrder": 1,
      "added": "2025-10-26",
      "description": "Listing description...",
      "fullDescription": "Complete description from detail page",
      "name": "Seller Name",
      "phone": "+421 123 456 789",
      "price": 500,
      "currency": "€",
      "location": "Bratislava",
      "postCode": "811 01",
      "views": 42
    }
  ],
  "totalFound": 1250,
  "totalReturned": 20,
  "searchUrl": "https://www.bazos.sk/search.php?hledat=your%20search%20term&rubriky=www&hlokalita=81101&humkreis=25&cenaod=0&cenado=10000&Submit=H%C4%BEada%C5%A5&order=&kitx=ano"
}
```

## Technical Details

- Uses **cheerio** for HTML parsing (server-side jQuery)
- Uses **axios** for HTTP requests
- Implements the same scraping logic as the original Python script
- **Multi-domain support**: Automatically handles bazos.sk and bazos.cz differences
- **Smart pagination**: Fetches multiple pages automatically with configurable limits
- **Date parsing**: Handles both Slovak and Czech date formats
- **Price parsing**: Supports both "Zadarmo" (SK) and "Zdarma" (CZ) for free items
- **URL generation**: Matches exact Bazos URL format for both domains
- **Full description fetching**: Optional detail page scraping for complete information
- **ISO date format**: All dates returned in YYYY-MM-DD format
- **Image handling**: Converts thumbnails to full-size images with order tracking
- Includes comprehensive error handling and validation
- Respects rate limiting with proper User-Agent headers

## Country-Specific Features

### Slovakia (bazos.sk)
- Date formats: "dnes", "včera", "pred X hodinami", "pred X dňami", "DD.MM.YYYY"
- Free items: "Zadarmo"
- Submit button: "Hľadať"

### Czech Republic (bazos.cz)
- Date formats: "dnes", "včera", "pred X hodinami", "před X dny", "DD.MM.YYYY"
- Free items: "Zdarma"
- Submit button: "Hledat"

## Error Handling

The node includes comprehensive error handling:
- Validates required parameters
- Handles network errors gracefully
- Continues processing even if individual listings fail to parse
- Returns structured error information when needed
- Validates date formats and handles parsing errors
- Gracefully handles missing or malformed data

## Version History

- **v1.0.25**: Added multi-country support (Slovakia/Czech Republic)
- **v1.0.24**: Changed date format to ISO (YYYY-MM-DD)
- **v1.0.23**: Fixed date validation and parsing
- **v1.0.22**: Enhanced date validation with word boundaries
- **v1.0.20**: Updated order parameter options
- **v1.0.19**: Fixed URL generation to match Bazos format exactly
- **v1.0.18**: Added search URL to results
- **v1.0.17**: Fixed price filtering for free items
- **v1.0.15**: Added parameter descriptions and validation
- **v1.0.13**: Added title extraction and price parsing for "Zadarmo"
- **v1.0.12**: Added title field to results
- **v1.0.10**: Fixed image URL conversion and order tracking
- **v1.0.9**: Added time-based filtering (last N days)
- **v1.0.7**: Fixed total results parsing
- **v1.0.6**: Fixed pagination and total results reporting
- **v1.0.5**: Added fallback logic for pagination
- **v1.0.4**: Fixed total results extraction
- **v1.0.3**: Implemented proper pagination
- **v1.0.2**: Fixed CommonJS module export
- **v1.0.1**: Fixed icon placement
- **v1.0.0**: Initial release

## License

MIT License - same as the original Python script.
