import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

import * as cheerio from 'cheerio';
import axios from 'axios';

export class BazosScraper implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Bazos Scraper',
		name: 'bazosScraper',
		icon: 'file:bazos.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["search"]}}',
		description: 'Scrape listings from Bazos.sk',
		defaults: {
			name: 'Bazos Scraper',
		},
		inputs: ['main'],
		outputs: ['main'],
		properties: [
			{
				displayName: 'Search Term',
				name: 'search',
				type: 'string',
				default: '',
				placeholder: 'e.g., darujem, notebook, auto',
				description: 'Search term to look for in listings',
				required: true,
			},
			{
				displayName: 'Post Code',
				name: 'location',
				type: 'string',
				default: '',
				placeholder: 'e.g., 81101, 04001',
				description: 'Post code to search in (leave empty for all locations)',
			},
			{
				displayName: 'Distance (km)',
				name: 'distance',
				type: 'number',
				default: 25,
				description: 'Search radius in kilometers from the post code',
			},
			{
				displayName: 'Min Price',
				name: 'minPrice',
				type: 'number',
				default: '',
				placeholder: 'e.g., 100',
				description: 'Minimum price filter (leave empty for no minimum)',
			},
			{
				displayName: 'Max Price',
				name: 'maxPrice',
				type: 'number',
				default: '',
				placeholder: 'e.g., 1000',
				description: 'Maximum price filter (leave empty for no maximum)',
			},
			{
				displayName: 'Order',
				name: 'order',
				type: 'options',
				options: [
					{
						name: 'Newest First',
						value: '',
					},
					{
						name: 'Price Low to High',
						value: 1,
					},
					{
						name: 'Price High to Low',
						value: 2,
					},
				],
				default: '',
				description: 'Sort order for results',
			},
			{
				displayName: 'Results Limit',
				name: 'resultsLimit',
				type: 'number',
				default: 100,
				description: 'Maximum number of results to return (max 1000)',
			},
			{
				displayName: 'Published in Last (days)',
				name: 'publishedDays',
				type: 'number',
				default: '',
				placeholder: 'e.g., 7',
				description: 'Only show listings published in the last N days (leave empty for no time filter)',
			},
			{
				displayName: 'Fetch Full Descriptions',
				name: 'withFullDescriptions',
				type: 'boolean',
				default: false,
				description: 'When enabled, fetches full descriptions, names, and phone numbers from detail pages for listings with truncated descriptions',
			},
			{
				displayName: 'Country',
				name: 'country',
				type: 'options',
				options: [
					{
						name: 'Slovakia (bazos.sk)',
						value: 'sk',
					},
					{
						name: 'Czech Republic (bazos.cz)',
						value: 'cz',
					},
				],
				default: 'sk',
				description: 'Select the Bazos domain to scrape',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const search = this.getNodeParameter('search', i) as string;
				const location = this.getNodeParameter('location', i) as string;
				const distance = this.getNodeParameter('distance', i) as number;
				
				// Handle price parameters - convert empty strings to null, but keep 0 as valid value
				const minPriceRaw = this.getNodeParameter('minPrice', i);
				const minPrice = minPriceRaw === '' || minPriceRaw === null || minPriceRaw === undefined ? null : Number(minPriceRaw);
				
				const maxPriceRaw = this.getNodeParameter('maxPrice', i);
				const maxPrice = maxPriceRaw === '' || maxPriceRaw === null || maxPriceRaw === undefined ? null : Number(maxPriceRaw);
				
				const order = this.getNodeParameter('order', i) as number;
				const resultsLimit = this.getNodeParameter('resultsLimit', i) as number;
				
				// Handle publishedDays - convert empty strings to null
				const publishedDaysRaw = this.getNodeParameter('publishedDays', i);
				const publishedDays = publishedDaysRaw === '' || publishedDaysRaw === null || publishedDaysRaw === undefined ? null : Number(publishedDaysRaw);
				
				const withFullDescriptions = this.getNodeParameter('withFullDescriptions', i) as boolean;
				const country = this.getNodeParameter('country', i) as string;

				if (!search) {
					throw new NodeOperationError(this.getNode(), 'Search term is required');
				}

				const { listings, totalResults } = await BazosScraper.scrapeBazos({
					search,
					location,
					distance,
					minPrice,
					maxPrice,
					order,
					resultsLimit,
					publishedDays,
					withFullDescriptions,
					country,
				});

				// Build the search URL for debugging - match Bazos format exactly
				const domain = country === 'cz' ? 'bazos.cz' : 'bazos.sk';
				const submitText = country === 'cz' ? 'Hledat' : 'Hľadať';
				const urlParams = [
					`hledat=${encodeURIComponent(search)}`,
					`rubriky=www`,
					`hlokalita=${location || ''}`,
					`humkreis=${distance}`,
					...(minPrice !== null ? [`cenaod=${minPrice}`] : []),
					...(maxPrice !== null ? [`cenado=${maxPrice}`] : []),
					`Submit=${encodeURIComponent(submitText)}`,
					`order=${order || ''}`,
					`kitx=ano`
				];
				const searchUrl = `https://www.${domain}/search.php?${urlParams.join('&')}`;

				returnData.push({
					json: {
						searchTerm: search,
						location,
						distance,
						minPrice,
						maxPrice,
						order,
						resultsLimit,
						publishedDays,
						withFullDescriptions,
						searchUrl,
						listings,
						totalFound: totalResults,
						totalReturned: listings.length,
					},
					pairedItem: { item: i },
				});
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
				} else {
					throw error;
				}
			}
		}

		return [returnData];
	}

	private static async scrapeBazos(params: {
		search: string;
		location: string;
		distance: number;
		minPrice: number | null;
		maxPrice: number | null;
		order: string | number;
		resultsLimit: number;
		publishedDays: number | null;
		withFullDescriptions: boolean;
		country: string;
	}) {
		const domain = params.country === 'cz' ? 'bazos.cz' : 'bazos.sk';
		const BASE_URL = `https://www.${domain}/search.php`;
		const listings: any[] = [];
		let totalResults = 0;
		let originalTotalResults = 0;

		// Build query parameters - match Bazos format exactly
		const submitText = params.country === 'cz' ? 'Hledat' : 'Hľadať';
		const urlParams = [
			`hledat=${encodeURIComponent(params.search)}`,
			`rubriky=www`,
			`hlokalita=${params.location || ''}`,
			`humkreis=${params.distance}`,
			...(params.minPrice !== null ? [`cenaod=${params.minPrice}`] : []),
			...(params.maxPrice !== null ? [`cenado=${params.maxPrice}`] : []),
			`Submit=${encodeURIComponent(submitText)}`,
			`order=${params.order || ''}`,
			`kitx=ano`
		];
		const url = `${BASE_URL}?${urlParams.join('&')}`;

		try {
			const response = await axios.get(url, {
				headers: {
					'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
				},
			});

			const $ = cheerio.load(response.data);

			// Get total results count from the status bar
			const resultsCountElement = $('div.inzeratynadpis').first();
			if (resultsCountElement.length > 0) {
				const text = resultsCountElement.text().trim();
				// Look for pattern like "Zobrazených 1-20 inzerátov z 8 295"
				const match = text.match(/z\s+([\d\s]+)$/);
				if (match) {
					// Remove spaces and convert to number
					totalResults = parseInt(match[1].replace(/\s/g, ''), 10);
				}
			}
			
			// Store the original total for reporting
			originalTotalResults = totalResults;
			
			// Fallback: if we couldn't parse total results, use a reasonable default for pagination
			if (totalResults === 0) {
				totalResults = Math.max(params.resultsLimit, 100); // Use at least 100 for pagination
			}

			const actualLimit = Math.min(totalResults, params.resultsLimit);
			let offset = 0;

			// Scrape pages until we have enough results
			while (listings.length < actualLimit) {
				const pageUrl = offset === 0 ? url : `${url}&crz=${offset}`;
				
				const pageResponse = await axios.get(pageUrl, {
					headers: {
						'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
					},
				});

				const page$ = cheerio.load(pageResponse.data);
				const listingElements = page$('div.inzeraty.inzeratyflex');

				// If no more listings found, break
				if (listingElements.length === 0) {
					break;
				}

				let pageHasValidResults = false;

				// Process all listings on this page
				for (let i = 0; i < listingElements.length; i++) {
					if (listings.length >= actualLimit) break;

					const element = listingElements.eq(i);
					const listing = await BazosScraper.parseListing(element, params.publishedDays, params.withFullDescriptions, params.country);
					if (listing) {
						listings.push(listing);
						pageHasValidResults = true;
					}
				}

				// If we have time filtering and no valid results on this page, stop pagination
				// This is especially important for newest-first ordering (order === '' or order === 0)
				if (params.publishedDays !== null && params.publishedDays > 0 && !pageHasValidResults && (params.order === '' || params.order === 0)) {
					break;
				}

				// Move to next page (20 items per page)
				offset += 20;
				
				// Safety check to prevent infinite loops
				if (offset > totalResults) {
					break;
				}
				
				// Additional safety check - don't go beyond reasonable limits
				if (offset > 1000) {
					break;
				}
			}
		} catch (error) {
			throw new Error(`Failed to scrape Bazos: ${(error as Error).message}`);
		}

		return { listings, totalResults: originalTotalResults };
	}

	private static async parseListing($element: cheerio.Cheerio<any>, publishedDays: number | null = null, withFullDescriptions: boolean = false, country: string = 'sk'): Promise<any> {
		try {
			// Extract ID from image src
			const imgSrc = $element.find('a img').attr('src') || '';
			let id = 0;
			if (imgSrc && imgSrc !== 'empty') {
				const match = imgSrc.match(/(\d+)\./);
				if (match) {
					id = parseInt(match[1], 10);
				}
			}

			// Extract title
			const title = $element.find('.nadpis').text().trim();

			// Extract link
			let link = $element.find('h2 a').attr('href') || '';
			
			// Ensure link uses correct domain
			if (link && !link.startsWith('http')) {
				const domain = country === 'cz' ? 'bazos.cz' : 'bazos.sk';
				link = `https://www.${domain}${link}`;
			}

			// Extract image link and convert to full-size image
			// The "t" in URLs like /1t/, /2t/, /3t/ indicates image order (1st, 2nd, 3rd image)
			// This is the image that the seller chose to display as the front image
			let imgLink = imgSrc;
			let imageOrder = 1; // Default to first image
			
			if (imgLink && imgLink.includes('t/')) {
				// Extract image order number
				const orderMatch = imgLink.match(/(\d+)t\//);
				if (orderMatch) {
					imageOrder = parseInt(orderMatch[1], 10);
				}
				// Replace any pattern like /1t/, /2t/, /3t/ with /1/, /2/, /3/ etc.
				imgLink = imgLink.replace(/(\d+)t\//, '$1/');
			}
			
			// Ensure image URL uses correct domain
			if (imgLink && !imgLink.startsWith('http')) {
				const domain = country === 'cz' ? 'bazos.cz' : 'bazos.sk';
				imgLink = `https://www.${domain}${imgLink}`;
			}

			// Extract added date and parse it properly
			const addedText = $element.find('span').text();
			
			// Parse and validate the date
			let added = addedText.replace(/[^\d.]/g, '');
			const parsedDate = BazosScraper.parseAndValidateDate(addedText, country);
			if (parsedDate) {
				// Use ISO date format: YYYY-MM-DD
				added = parsedDate.toISOString().split('T')[0];
			}
			
			// Parse the date to check if it's within the time filter
			let isWithinTimeFilter = true;
			if (publishedDays !== null && publishedDays > 0) {
				isWithinTimeFilter = BazosScraper.isWithinTimeFilter(addedText, publishedDays, country);
				if (!isWithinTimeFilter) {
					return null; // Skip this listing if it's too old
				}
			}

			// Extract description
			const description = $element.find('div.popis').text().trim();

			// Initialize additional fields
			let fullDescription = '';
			let name = '';
			let phone = '';

			// If withFullDescriptions is enabled and description ends with "...", fetch detail page
			if (withFullDescriptions && description.endsWith('...')) {
				try {
					// Extract the detail URL from the listing link
					const detailLink = $element.find('a').first().attr('href');
					if (detailLink) {
						const domain = country === 'cz' ? 'bazos.cz' : 'bazos.sk';
						const detailUrl = detailLink.startsWith('http') ? detailLink : `https://www.${domain}${detailLink}`;
						
						// Fetch the detail page
						const detailResponse = await axios.get(detailUrl, {
							headers: {
								'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
							},
						});

						const detail$ = cheerio.load(detailResponse.data);

						// Extract full description from class="popisdetail"
						const fullDescElement = detail$('div.popisdetail');
						if (fullDescElement.length > 0) {
							fullDescription = fullDescElement.text().trim();
						}

						// Extract name from the table structure
						// Look for "Meno:" label and get the adjacent <b> tag content
						const nameRow = detail$('td').filter(function() {
							return detail$(this).text().trim() === 'Meno:';
						}).closest('tr');
						
						if (nameRow.length > 0) {
							const nameElement = nameRow.find('b');
							if (nameElement.length > 0) {
								name = nameElement.text().trim();
							}
						}

						// Extract phone from the table structure
						// Look for "Telefón:" label and get the phone number from the <a> tag
						const phoneRow = detail$('tr#overlaytel');
						if (phoneRow.length > 0) {
							const phoneLink = phoneRow.find('a.teldetail');
							if (phoneLink.length > 0) {
								phone = phoneLink.text().trim();
							}
						}
					}
				} catch (error) {
					// If fetching detail page fails, continue with truncated description
					console.warn('Failed to fetch detail page:', error);
				}
			}

			// Extract price and currency
			const priceElement = $element.find('div.inzeratycena');
			const priceText = priceElement.text().trim();
			
			let price = 0;
			let currency = '';
			
			if (priceText.toLowerCase().includes('zadarmo') || priceText.toLowerCase().includes('zdarma')) {
				// Free item (both Slovak "zadarmo" and Czech "zdarma")
				price = 0;
				currency = '';
			} else {
				// Parse price with Euro sign or other currency
				const priceMatch = priceText.match(/(\d+(?:[\s,]\d+)*)/);
				if (priceMatch) {
					// Remove spaces and commas from price number
					const cleanPrice = priceMatch[1].replace(/[\s,]/g, '');
					price = parseInt(cleanPrice, 10);
				}
				// Extract currency (everything that's not a number, space, or comma)
				currency = priceText.replace(/[\d\s,.-]/g, '').trim();
			}

			// Extract location and post code
			const locationElement = $element.find('div.inzeratylok');
			const locationText = locationElement.text();
			const location = locationText.replace(/[\d.]/g, '').trim();
			const postCodeMatch = locationText.match(/(\d{3}\s\d{2})/);
			const postCode = postCodeMatch ? postCodeMatch[1] : '';

			// Extract views
			const viewsElement = $element.find('div.inzeratyview');
			const viewsText = viewsElement.text();
			const viewsMatch = viewsText.match(/(\d+)/);
			const views = viewsMatch ? parseInt(viewsMatch[1], 10) : 0;

			return {
				id,
				title,
				link,
				imgLink,
				imageOrder,
				added,
				description,
				fullDescription,
				name,
				phone,
				price,
				currency,
				location,
				postCode,
				views,
			};
		} catch (error) {
			console.error('Error parsing listing:', error);
			return null;
		}
	}

	private static parseAndValidateDate(dateText: string, country: string = 'sk'): Date | null {
		try {
			const now = new Date();
			
			// Format: "27.10. 2025" or "27.10.2025" - validate year range
			// Use word boundary to ensure we match exactly 4 digits for year
			const fullDateMatch = dateText.match(/(\d{1,2})\.(\d{1,2})\.\s*(\d{4})\b/);
			if (fullDateMatch) {
				const [, day, month, year] = fullDateMatch;
				const yearNum = parseInt(year);
				const monthNum = parseInt(month);
				const dayNum = parseInt(day);
				
				console.log(`Parsing date: "${dateText}" -> day:${dayNum}, month:${monthNum}, year:${yearNum}`);
				
				// Validate reasonable year range (2000-2030)
				if (yearNum >= 2000 && yearNum <= 2030 && monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
					const tempDate = new Date(yearNum, monthNum - 1, dayNum);
					// Additional validation: check if the date is actually valid
					if (tempDate.getFullYear() === yearNum && tempDate.getMonth() === monthNum - 1 && tempDate.getDate() === dayNum) {
						console.log(`Valid date created: ${tempDate}`);
						return tempDate;
					} else {
						console.log(`Invalid date: ${tempDate} (expected: ${dayNum}/${monthNum}/${yearNum})`);
					}
				} else {
					console.log(`Date out of range: day:${dayNum}, month:${monthNum}, year:${yearNum}`);
				}
			}
			// Format: "dnes" (today) - both SK and CZ
			else if (dateText.includes('dnes')) {
				return new Date(now.getFullYear(), now.getMonth(), now.getDate());
			}
			// Format: "včera" (yesterday) - both SK and CZ
			else if (dateText.includes('včera')) {
				const yesterday = new Date(now);
				yesterday.setDate(yesterday.getDate() - 1);
				return yesterday;
			}
			// Format: "pred X hodinami" (X hours ago) - both SK and CZ
			else if (dateText.includes('pred') && dateText.includes('hodinami')) {
				const hoursMatch = dateText.match(/pred\s+(\d+)\s+hodinami/);
				if (hoursMatch) {
					const hours = parseInt(hoursMatch[1]);
					const hoursAgo = new Date(now);
					hoursAgo.setHours(hoursAgo.getHours() - hours);
					return hoursAgo;
				}
			}
			// Format: "pred X dňami" (X days ago) - Slovak
			else if (dateText.includes('pred') && dateText.includes('dňami')) {
				const daysMatch = dateText.match(/pred\s+(\d+)\s+dňami/);
				if (daysMatch) {
					const days = parseInt(daysMatch[1]);
					const daysAgo = new Date(now);
					daysAgo.setDate(daysAgo.getDate() - days);
					return daysAgo;
				}
			}
			// Format: "před X dny" (X days ago) - Czech
			else if (dateText.includes('před') && dateText.includes('dny')) {
				const daysMatch = dateText.match(/před\s+(\d+)\s+dny/);
				if (daysMatch) {
					const days = parseInt(daysMatch[1]);
					const daysAgo = new Date(now);
					daysAgo.setDate(daysAgo.getDate() - days);
					return daysAgo;
				}
			}
			
			return null;
		} catch (error) {
			console.log(`Error parsing date: "${dateText}"`, error);
			return null;
		}
	}

	private static isWithinTimeFilter(dateText: string, publishedDays: number, country: string = 'sk'): boolean {
		try {
			const now = new Date();
			// Calculate cutoff date: N full days ago
			// If today is 27.10.2025 and publishedDays=1, we want 26.10.2025 and 27.10.2025
			const cutoffDate = new Date(now);
			cutoffDate.setDate(cutoffDate.getDate() - publishedDays);
			cutoffDate.setHours(0, 0, 0, 0); // Start of the cutoff day
			
			
			// Use the same parsing logic
			const listingDate = BazosScraper.parseAndValidateDate(dateText, country);
			
			if (!listingDate) {
				// If we can't parse the date, include it to be safe
				return true;
			}
			
			// Check if listing date is >= cutoff date (inclusive)
			return listingDate >= cutoffDate;
		} catch (error) {
			// If there's any error parsing the date, include it to be safe
			return true;
		}
	}
}
