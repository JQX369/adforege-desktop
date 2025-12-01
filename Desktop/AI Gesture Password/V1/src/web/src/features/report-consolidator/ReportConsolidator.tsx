import React, { useState, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  AreaChart, Area, XAxis, YAxis, BarChart, Bar, CartesianGrid
} from 'recharts';
import { Upload, Download, Trash2, Plus, ChevronDown, ChevronRight, ChevronUp, Sparkles, Loader2, ArrowUpDown, Pencil, AlertTriangle } from 'lucide-react';
import { SmartParser } from '../../lib/smart-parser';
import { api } from '@lib/services/api';
import * as pdfjsLib from 'pdfjs-dist';

// Set PDF.js worker - use local copy handled by vite-plugin-static-copy
// In dev mode, Vite serves from node_modules; in prod, from dist/assets
const workerUrl = import.meta.env.DEV
  ? new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href
  : `${import.meta.env.BASE_URL}assets/pdf.worker.min.mjs`;
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

// --- Types ---

interface DeviceSplit {
  mobile: number;
  desktop: number;
  tv: number;
  is_inferred?: boolean;  // True when device split is estimated/default (not from source data)
}

interface TopShow {
  title: string;
  impressions: number;
}

interface BuyingLine {
  buying_type: string;        // e.g., "Boost - ABC1 Adults", "Premium/Luxe Shopper 30'"
  planned_impressions: number;
  delivered_impressions: number;
  delivery_percent: number;
  vtr: number;
  clicks: number;
  ctr: number;
  is_inferred?: boolean;  // True when buying type is inferred (e.g., Sky demographic from shows)
}

interface DailyImpression {
  date: string;           // "2025-05-08" or "08/05/2025"
  impressions: number;
  clicks?: number;
}

interface DaypartSplit {
  morning: number;        // 6am - 12pm (Midday)
  daytime: number;        // 12pm - 5:25pm
  early_peak: number;     // 5:25pm - 8pm
  late_peak: number;      // 8pm - 11pm
  post_peak: number;      // 11pm - 12:30am
  late_night: number;     // 12:30am - 6am
  is_inferred?: boolean;
}

interface PlatformData {
  id: string;
  name: string;
  supplier: 'Sky' | 'Channel 4' | 'ITV' | 'Linear TV' | 'Other';
  planned_impressions: number;
  delivered_impressions: number;
  clicks: number;
  spend: number;
  vtr: number;
  device_split: DeviceSplit;
  top_shows: TopShow[];
  buying_lines: BuyingLine[];  // Detailed buying breakdown
  daily_impressions: DailyImpression[];  // Day-by-day breakdown
  daypart_split?: DaypartSplit;  // Time-of-day breakdown
  frequency?: number;
  demographics?: string;
  source_file?: string;
  is_manual?: boolean;
  upload_date?: string;
}

interface CampaignMeta {
  client: string;
  campaign: string;
  start_date: string;
  end_date: string;
}

// --- Helper Functions ---

const generateId = () => Math.random().toString(36).substr(2, 9);

/**
 * Extract campaign segment name from Sky filename
 * e.g., "1116903_TomFordBoiPacif_Delivery_20250915.CSV" -> "Tom Ford Bois Pacifique"
 */
const extractCampaignFromFilename = (filename: string): string => {
  // Remove extension
  const base = filename.replace(/\.(csv|xlsx?|pdf)$/i, '');
  
  // Try to extract campaign name from common patterns
  // Pattern: ID_CampaignName_Delivery_Date
  const match = base.match(/^\d+_([^_]+)_/);
  if (match) {
    // Convert camelCase/concatenated to spaces
    let name = match[1]
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .trim();
    return name || base;
  }
  
  return base;
};

/**
 * Normalize buying type names from vendor-specific formats to canonical names
 * Maps C4's "DIRECT DEMO ABC1ME..." to "ABC1 Men 30'" etc.
 * Also handles ITV format like "Tom Ford_Bois Pacifique_ITV_Masthead"
 */
const BUYING_TYPE_PATTERNS: [RegExp, string][] = [
  // Channel 4 patterns
  [/DIRECT INTEREST PREMIUM.*LUXURY/i, 'Premium/Luxe Shopper'],
  [/DIRECT DEMO ABC1AD.*BOOST/i, 'Boost - ABC1 Adults'],
  [/DIRECT DEMO ABC1ME/i, 'ABC1 Men'],
  [/DIRECT DEMO ABC1.*ADULTS/i, 'ABC1 Adults'],
  [/Premium.*Luxe.*Shopper/i, 'Premium/Luxe Shopper'],
  [/Boost.*ABC1/i, 'Boost - ABC1 Adults'],
  [/ABC1.*Men/i, 'ABC1 Men'],
  [/ABC1.*Adults/i, 'ABC1 Adults'],
  // ITV patterns - extract core buying type
  [/_ITV_Masthead$/i, 'ITV Masthead'],
  [/_ITVX_Masthead$/i, 'ITVX Masthead'],
  [/_ITV_Standard$/i, 'ITV Standard'],
  [/_ITVX_Standard$/i, 'ITVX Standard'],
  [/ITV.*Masthead/i, 'ITV Masthead'],
  [/ITV.*Standard/i, 'ITV Standard'],
  [/ITVX.*Masthead/i, 'ITVX Masthead'],
  [/ITVX.*Standard/i, 'ITVX Standard'],
];

const normalizeBuyingTypeName = (rawName: string): string => {
  // First check for exact pattern matches
  for (const [pattern, canonical] of BUYING_TYPE_PATTERNS) {
    if (pattern.test(rawName)) {
      // Extract duration if present (e.g., "30'" or "10'" or "08 M")
      const durationMatch = rawName.match(/(\d+)\s*['"M]/i);
      const duration = durationMatch ? ` ${durationMatch[1]}'` : '';
      return canonical + duration;
    }
  }
  
  // For ITV underscore-separated names like "Tom Ford_Bois Pacifique_ITV_Masthead"
  // Extract the last meaningful part
  if (rawName.includes('_')) {
    const parts = rawName.split('_').filter(p => p.trim());
    // Look for ITV/ITVX buying type part
    const lastPart = parts[parts.length - 1];
    const secondLast = parts.length > 1 ? parts[parts.length - 2] : '';
    
    if (/ITV|ITVX/i.test(secondLast)) {
      return `${secondLast} ${lastPart}`.trim();
    }
    // Otherwise use last meaningful part
    if (lastPart && lastPart.length > 2) {
      return lastPart;
    }
  }
  
  // If no pattern matches, clean up the raw name
  // Remove IDs in parentheses, trim, and capitalize properly
  const cleaned = rawName
    .replace(/\s*\(\d+\)\s*/g, ' ')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Truncate and add ellipsis if too long
  if (cleaned.length > 35) {
    return cleaned.substring(0, 32) + '...';
  }
  return cleaned;
};

/**
 * Calculate CTR for a buying line
 */
const calculateCTR = (clicks: number, impressions: number): number => {
  return impressions > 0 ? (clicks / impressions) * 100 : 0;
};

/**
 * Calculate delivery percentage
 */
const calculateDeliveryPercent = (delivered: number, planned: number): number => {
  return planned > 0 ? (delivered / planned) * 100 : 100;
};

/**
 * Infer a vague demographic from show names for Sky campaigns
 * Keep it general - just ABC1 Adults as default since we can't determine exact demo
 */
const inferDemographicFromShows = (shows: TopShow[]): string => {
  if (!shows || shows.length === 0) return 'ABC1 Adults';
  
  const showNames = shows.map(s => s.title.toLowerCase()).join(' ');
  
  // Very basic heuristics - keep it vague as per user request
  if (showNames.includes('sport') || showNames.includes('football') || 
      showNames.includes('rugby') || showNames.includes('cricket') ||
      showNames.includes('f1') || showNames.includes('golf')) {
    return 'ABC1 Men';
  }
  
  // Default to ABC1 Adults for general entertainment
  return 'ABC1 Adults';
};

// --- Parsing Strategies ---

const STRATEGIES = {
  SKY: {
    anchors: ['impressions (incremental)', 'sky media'],
    tableHeaders: {
      date: ['date', 'day'],
      impressions: ['impressions', 'imps', 'impressions (incremental)'],
      clicks: ['clicks']
    },
    showsAnchor: 'top 10 shows',
    devicesAnchor: 'top 10 devices'
  },
  C4: {
    anchors: ['online campaign details', 'channel 4'],
    tableHeaders: {
      platform: ['platform', 'device'],
      impressions: ['views', 'impressions', 'completed views'],
      clicks: ['clicks']
    },
    programmeHeaders: {
      rank: ['rank'],
      title: ['title', 'programme'],
      impressions: ['impressions']
    },
    plannedKeys: ['target imps', 'target impressions', 'planned impressions'],
    deliveredKeys: ['delivered impressions'],
    platformMixAnchor: 'platform mix',
    programmesAnchor: 'top ten programmes'
  },
  ITV: {
    anchors: ['delivered impressions', 'itv'],
    tableHeaders: {
      campaign: ['campaign'],
      impressions: ['delivered impressions', 'impressions'],
      clicks: ['clicks'],
      vtr: ['vtr']
    }
  }
};

/**
 * Parse a Channel 4 Excel file to extract campaign information, platform mix, top programmes, and LINE ITEMS
 */
const parseChannel4Excel = (data: any[][], parser: SmartParser): Partial<PlatformData> => {
  const parsed: Partial<PlatformData> = {
    name: 'Channel 4',
    supplier: 'Channel 4',
    delivered_impressions: 0,
    planned_impressions: 0,
    clicks: 0,
    vtr: 0.98,
    // Default device split - will be updated below if found in Excel (is_inferred will be removed)
    device_split: { mobile: 0, desktop: 0, tv: 1, is_inferred: true },
    top_shows: [],
    buying_lines: [],
    daily_impressions: []
  };

  // Extract LINE ITEMS section for detailed buying breakdown
  const lineItemsAnchor = parser.findAnchor(['line items']);
  if (lineItemsAnchor) {
    // LINE ITEMS table has headers: Name | Impressions | Clicks
    // Data rows follow until empty row or new section
    const buyingLines: BuyingLine[] = [];
    for (let r = lineItemsAnchor.row + 2; r < Math.min(lineItemsAnchor.row + 20, data.length); r++) {
      const row = data[r];
      if (!row || !row[0]) break;
      
      const rawName = String(row[0] ?? '').trim();
      // Skip header rows or section markers
      if (rawName.toLowerCase() === 'name' || rawName.toLowerCase().includes('daily')) break;
      
      const impressions = SmartParser.cleanNumber(row[1]);
      const clicks = SmartParser.cleanNumber(row[2]);
      
      if (impressions > 0) {
        // Normalize the buying type name to canonical format
        const normalizedName = normalizeBuyingTypeName(rawName);
        
        buyingLines.push({
          buying_type: normalizedName,
          planned_impressions: impressions, // Will be overwritten if we find actual planned values
          delivered_impressions: impressions,
          delivery_percent: 100,
          vtr: 0.98, // Default VTR, will be refined if data available
          clicks: clicks,
          ctr: calculateCTR(clicks, impressions)
        });
      }
    }
    parsed.buying_lines = buyingLines;
  }

  // Extract impressions from daily table (for totals)
    const tableRegion = parser.detectTable(STRATEGIES.C4.tableHeaders);
    if (tableRegion) {
      const rows = parser.extractTableData(tableRegion);
      rows.forEach(r => {
        parsed.delivered_impressions! += SmartParser.cleanNumber(r.impressions);
        parsed.clicks! += SmartParser.cleanNumber(r.clicks);
      });
    }

  // Extract Target Imps (Planned) and Delivered Impressions from Campaign Information section
  const targetImps = parser.extractKeyValue(STRATEGIES.C4.plannedKeys);
  if (targetImps) {
    parsed.planned_impressions = SmartParser.cleanNumber(targetImps);
  }

  const deliveredImps = parser.extractKeyValue(STRATEGIES.C4.deliveredKeys);
  if (deliveredImps) {
    // Override with the official delivered impressions from Campaign Information
    parsed.delivered_impressions = SmartParser.cleanNumber(deliveredImps);
  }

  // Calculate delivery percent and planned impressions for buying lines based on total ratios
  if (parsed.planned_impressions && parsed.delivered_impressions && parsed.buying_lines) {
    const deliveryRatio = parsed.delivered_impressions / parsed.planned_impressions;
    parsed.buying_lines = parsed.buying_lines.map(line => {
      // Estimate planned based on ratio (since raw data only has delivered)
      const estimatedPlanned = Math.round(line.delivered_impressions / deliveryRatio);
      return {
        ...line,
        planned_impressions: estimatedPlanned,
        delivery_percent: calculateDeliveryPercent(line.delivered_impressions, estimatedPlanned),
        ctr: calculateCTR(line.clicks, line.delivered_impressions) // Recalculate to ensure accuracy
      };
    });
  }

  // Extract Platform Mix (MOBILE, DESKTOP, BIG SCREEN percentages)
  const platformMixAnchor = parser.findAnchor([STRATEGIES.C4.platformMixAnchor]);
  if (platformMixAnchor) {
    let foundDeviceData = false;
    for (let r = platformMixAnchor.row + 1; r < Math.min(platformMixAnchor.row + 5, data.length); r++) {
      const row = data[r];
      if (!row) continue;
      const label = String(row[0] ?? '').toLowerCase().trim();
      const value = SmartParser.cleanNumber(row[1]);

      if (label.includes('mobile')) {
        parsed.device_split!.mobile = value > 1 ? value / 100 : value;
        foundDeviceData = true;
      } else if (label.includes('desktop')) {
        parsed.device_split!.desktop = value > 1 ? value / 100 : value;
        foundDeviceData = true;
      } else if (label.includes('big screen') || label.includes('tv') || label.includes('ctv')) {
        parsed.device_split!.tv = value > 1 ? value / 100 : value;
        foundDeviceData = true;
      }
    }
    // Mark as not inferred if we found actual device data
    if (foundDeviceData) {
      parsed.device_split!.is_inferred = false;
    }
  }

  // Extract Top Ten Programmes by Impressions
  const programmesAnchor = parser.findAnchor([STRATEGIES.C4.programmesAnchor]);
  if (programmesAnchor) {
    const programmeRegion = parser.detectTable(STRATEGIES.C4.programmeHeaders, programmesAnchor.row);
    if (programmeRegion) {
      const rows = parser.extractTableData(programmeRegion);
      parsed.top_shows = rows.slice(0, 10).map(r => ({
        title: String(r.title ?? '').trim(),
        impressions: SmartParser.cleanNumber(r.impressions)
      })).filter(s => s.title && s.impressions > 0);
    }
  }

  // Extract Average Frequency from Unique Reach
  const reachAnchor = parser.findAnchor(['unique reach']);
  if (reachAnchor) {
    const reachRow = data[reachAnchor.row];
    if (reachRow && reachRow[1]) {
      const reach = SmartParser.cleanNumber(reachRow[1]);
      // Calculate frequency as Delivered Impressions / Unique Reach
      if (reach > 0 && parsed.delivered_impressions) {
        parsed.frequency = parsed.delivered_impressions / reach;
      }
    }
  }
  
  // Extract Daily Impressions from DAILY IMPRESSIONS section
  const dailyAnchor = parser.findAnchor(['daily impressions', 'daily breakdown', 'date breakdown']);
  if (dailyAnchor) {
    const dailyData: DailyImpression[] = [];
    // Look for date-impressions pairs in subsequent rows
    for (let r = dailyAnchor.row + 1; r < Math.min(dailyAnchor.row + 60, data.length); r++) {
      const row = data[r];
      if (!row) continue;
      
      const dateStr = String(row[0] ?? '').trim();
      // Check if it looks like a date (contains / or - and numbers)
      if (!dateStr || (!dateStr.match(/\d+[\/\-]\d+/) && !dateStr.match(/^\d{1,2}\s+\w+/))) {
        // Not a date format, might be end of section
        if (dateStr.toLowerCase().includes('total') || dateStr === '') continue;
        if (dailyData.length > 0) break; // We've collected some data, new section starting
        continue;
      }
      
      const impressions = SmartParser.cleanNumber(row[1]);
      const clicks = SmartParser.cleanNumber(row[2]);
      
      if (impressions > 0) {
        dailyData.push({
          date: dateStr,
          impressions: impressions,
          clicks: clicks || 0
        });
      }
    }
    parsed.daily_impressions = dailyData;
  }
  
  // Extract Daypart Split - first try direct daypart labels, then try hourly data
  // Handle various formats including "Impressions by daypart(Daypart)" headers
  const daypartAnchor = parser.findAnchor(['impressions by daypart', 'daypart', 'time breakdown', 'time split', 'daypart breakdown']);
  if (daypartAnchor) {
    const daypartData: DaypartSplit = {
      morning: 0,
      daytime: 0,
      early_peak: 0,
      late_peak: 0,
      post_peak: 0,
      late_night: 0,
      is_inferred: false
    };

    // Extended search limit to 15 rows to handle blank rows between sections
    let foundDayparts = 0;
    for (let r = daypartAnchor.row + 1; r < Math.min(daypartAnchor.row + 15, data.length); r++) {
      const row = data[r];
      // Skip null/undefined rows or empty rows
      if (!row || row.length === 0) continue;

      const label = String(row[0] ?? '').toLowerCase().trim();

      // Skip empty labels or header-like rows (containing "daypart" or "percentage")
      if (!label || label.includes('daypart') || label.includes('percentage')) continue;

      const value = SmartParser.cleanNumber(row[1]);

      // Skip rows without valid values
      if (value <= 0) continue;

      // Normalize to decimal if percentage
      const normalizedValue = value > 1 ? value / 100 : value;

      // Match daypart labels - use startsWith to avoid overlap issues
      if (label.startsWith('morning') || label.includes('morning (')) {
        daypartData.morning = normalizedValue;
        foundDayparts++;
      } else if (label.startsWith('daytime') || label.includes('daytime (')) {
        daypartData.daytime = normalizedValue;
        foundDayparts++;
      } else if (label.startsWith('early peak') || label.includes('early peak (')) {
        daypartData.early_peak = normalizedValue;
        foundDayparts++;
      } else if (label.startsWith('late peak') || label.includes('late peak (')) {
        daypartData.late_peak = normalizedValue;
        foundDayparts++;
      } else if (label.startsWith('post peak') || label.includes('post peak (')) {
        daypartData.post_peak = normalizedValue;
        foundDayparts++;
      } else if (label.startsWith('late night') || label.includes('late night (') || label.startsWith('overnight')) {
        daypartData.late_night = normalizedValue;
        foundDayparts++;
      }

      // Stop once we've found all 6 dayparts
      if (foundDayparts >= 6) break;
    }

    // Only set if we found some data
    const hasData = Object.values(daypartData).some(v => typeof v === 'number' && v > 0);
    if (hasData) {
      parsed.daypart_split = daypartData;
    }
  }
  
  // If no daypart data found, try extracting from "IMPRESSIONS SPLIT BY HOUR" section
  // Channel 4 reports have hourly data that needs aggregation into dayparts
  if (!parsed.daypart_split) {
    // Only look for the specific "impressions split by hour" anchor - not "clock hour" which is the header
    const hourlyAnchor = parser.findAnchor(['impressions split by hour']);
    if (hourlyAnchor) {
      // Parse hourly percentages and aggregate into dayparts
      // First collect raw values, then normalize based on total
      const rawHourlyValues: number[] = new Array(24).fill(0);
      let foundHours = 0;

      // Start from anchor row + 1, skip "Clock Hour" header row
      for (let r = hourlyAnchor.row + 1; r < Math.min(hourlyAnchor.row + 30, data.length); r++) {
        const row = data[r];
        if (!row || row.length === 0) continue;

        const hourLabel = String(row[0] ?? '').trim().toLowerCase();

        // Skip header row ("Clock Hour") and empty rows
        if (!hourLabel || hourLabel.includes('clock') || hourLabel === 'hour') continue;

        // Get value from column 1 (Impressions column)
        const value = SmartParser.cleanNumber(row[1]);
        if (value <= 0) continue;

        // Parse "12 AM", "1 PM" format
        const ampmMatch = hourLabel.match(/^(\d{1,2})\s*(am|pm)$/i);
        if (ampmMatch) {
          let hour = parseInt(ampmMatch[1]);
          const isPM = ampmMatch[2].toLowerCase() === 'pm';

          // Convert to 24-hour format
          if (hour === 12) {
            hour = isPM ? 12 : 0;  // 12 PM = 12, 12 AM = 0
          } else if (isPM) {
            hour += 12;  // 1 PM = 13, etc.
          }

          if (hour >= 0 && hour < 24) {
            rawHourlyValues[hour] = value;  // Store raw value
            foundHours++;
          }
        }
      }

      // Only aggregate if we found most hours
      if (foundHours >= 12) {
        // Normalize: if total is ~100, values are percentages; if ~1, already decimals
        const rawTotal = rawHourlyValues.reduce((a, b) => a + b, 0);
        const hourlyValues = rawTotal > 50
          ? rawHourlyValues.map(v => v / 100)  // Percentages (sum ~100) → divide by 100
          : rawHourlyValues;  // Already decimals (sum ~1)

        // Aggregate into UK broadcast dayparts
        const daypartData: DaypartSplit = {
          morning: hourlyValues.slice(6, 12).reduce((a, b) => a + b, 0),
          daytime: hourlyValues.slice(12, 17).reduce((a, b) => a + b, 0) + hourlyValues[17] * 0.42,
          early_peak: hourlyValues[17] * 0.58 + hourlyValues.slice(18, 20).reduce((a, b) => a + b, 0),
          late_peak: hourlyValues.slice(20, 23).reduce((a, b) => a + b, 0),
          post_peak: hourlyValues[23] + hourlyValues[0] * 0.5,
          late_night: hourlyValues[0] * 0.5 + hourlyValues.slice(1, 6).reduce((a, b) => a + b, 0),
          is_inferred: true  // Calculated from hourly data
        };

        parsed.daypart_split = daypartData;
      }
    }
  }
  
  return parsed;
};

/**
 * Parse a Sky CSV file to extract impressions and programme data
 */
const parseSkyCSV = (data: any[][], parser: SmartParser, filename: string = ''): Partial<PlatformData> => {
  // Extract campaign name from filename for buying line
  const campaignName = extractCampaignFromFilename(filename);
  
  const parsed: Partial<PlatformData> = {
    name: campaignName || 'Sky VOD',
    supplier: 'Sky',
    delivered_impressions: 0,
    planned_impressions: 0,
    clicks: 0,
    vtr: 1.0,
    // Sky CSV doesn't provide device data - mark as inferred (assumed Big Screen)
    device_split: { mobile: 0, desktop: 0, tv: 1, is_inferred: true },
    top_shows: [],
    buying_lines: [],
    daily_impressions: []
  };

  // Extract impressions from daily table
  const tableRegion = parser.detectTable(STRATEGIES.SKY.tableHeaders);
  if (tableRegion) {
    const rows = parser.extractTableData(tableRegion);
    const dailyData: DailyImpression[] = [];
    
    rows.forEach(row => {
      const impressions = SmartParser.cleanNumber(row.impressions);
      const clicks = SmartParser.cleanNumber(row.clicks);
      const dateStr = String(row.date ?? '').trim();
      
      parsed.delivered_impressions! += impressions;
      parsed.clicks! += clicks;
      
      // Extract daily data if date is present
      if (dateStr && impressions > 0) {
        dailyData.push({
          date: dateStr,
          impressions: impressions,
          clicks: clicks
        });
      }
    });
    
    parsed.daily_impressions = dailyData;
  }

  // Sky CSVs don't have planned impressions - set to delivered
  parsed.planned_impressions = parsed.delivered_impressions;

  // Extract Top 10 Shows (names only, no impressions in Sky reports)
  const showsAnchor = parser.findAnchor([STRATEGIES.SKY.showsAnchor]);
  if (showsAnchor) {
    // Shows are listed in subsequent rows, one per row
    const shows: TopShow[] = [];
    for (let r = showsAnchor.row + 1; r < Math.min(showsAnchor.row + 11, data.length); r++) {
      const row = data[r];
      if (!row) continue;
      const title = String(row[0] ?? '').trim();
      // Skip empty rows or rows that start a new section
      if (!title || title.toLowerCase().includes('top 10 movies') || title.toLowerCase().includes('top 10 devices')) {
        break;
      }
      // Since Sky doesn't provide impressions per show, estimate based on position
      // (Higher ranked shows get proportionally more impressions)
      const estimatedImpressions = Math.round((parsed.delivered_impressions || 0) * (0.15 - (shows.length * 0.01)));
      shows.push({ title, impressions: Math.max(estimatedImpressions, 0) });
    }
    parsed.top_shows = shows;
  }

  // Generate buying line from Sky CSV data
  // Infer demographic from show names instead of using campaign filename
  if (parsed.delivered_impressions && parsed.delivered_impressions > 0) {
    // Infer demographic from top shows - mark as inferred since it's not in source data
    const inferredDemo = inferDemographicFromShows(parsed.top_shows || []);
    
    const buyingLine: BuyingLine = {
      buying_type: inferredDemo,
      planned_impressions: parsed.planned_impressions || parsed.delivered_impressions,
      delivered_impressions: parsed.delivered_impressions,
      delivery_percent: calculateDeliveryPercent(
        parsed.delivered_impressions, 
        parsed.planned_impressions || parsed.delivered_impressions
      ),
      vtr: parsed.vtr || 1.0,
      clicks: parsed.clicks || 0,
      ctr: calculateCTR(parsed.clicks || 0, parsed.delivered_impressions),
      is_inferred: true  // Demographic is inferred from show content, not source data
    };
    parsed.buying_lines = [buyingLine];
  }
  
  // Extract Daypart Split from "Impressions by daypart" section
  // Handle various CSV formats including "Impressions by daypart(Daypart)" headers
  const daypartAnchor = parser.findAnchor(['impressions by daypart']);
  if (daypartAnchor) {
    const daypartData: DaypartSplit = {
      morning: 0,
      daytime: 0,
      early_peak: 0,
      late_peak: 0,
      post_peak: 0,
      late_night: 0,
      is_inferred: false
    };

    // Parse rows after the anchor - Sky/C4 CSVs have labels in col 0 and percentages in col 1
    // Extended search limit to 15 rows to handle blank rows between sections
    let foundDayparts = 0;
    for (let r = daypartAnchor.row + 1; r < Math.min(daypartAnchor.row + 15, data.length); r++) {
      const row = data[r];
      // Skip null/undefined rows or empty rows
      if (!row || row.length === 0) continue;

      const label = String(row[0] ?? '').toLowerCase().trim();

      // Skip empty labels or header-like rows (containing "daypart" or "percentage")
      if (!label || label.includes('daypart') || label.includes('percentage')) continue;

      // Get percentage from column 1 (the "Percentage" column)
      const percentValue = SmartParser.cleanNumber(row[1]);

      // Skip rows without valid percentage values
      if (percentValue <= 0) continue;

      // Normalize percentage to decimal (if 8.1 -> 0.081)
      const normalizedValue = percentValue > 1 ? percentValue / 100 : percentValue;

      // Match daypart labels - check most specific matches first to avoid overlaps
      // e.g. "late night (12.30am to 6am)" should NOT match "morning" via "6am"
      if (label.startsWith('morning') || label.includes('morning (')) {
        daypartData.morning = normalizedValue;
        foundDayparts++;
      } else if (label.startsWith('daytime') || label.includes('daytime (')) {
        daypartData.daytime = normalizedValue;
        foundDayparts++;
      } else if (label.startsWith('early peak') || label.includes('early peak (')) {
        daypartData.early_peak = normalizedValue;
        foundDayparts++;
      } else if (label.startsWith('late peak') || label.includes('late peak (')) {
        daypartData.late_peak = normalizedValue;
        foundDayparts++;
      } else if (label.startsWith('post peak') || label.includes('post peak (')) {
        daypartData.post_peak = normalizedValue;
        foundDayparts++;
      } else if (label.startsWith('late night') || label.includes('late night (') || label.startsWith('overnight')) {
        daypartData.late_night = normalizedValue;
        foundDayparts++;
      }

      // Stop once we've found all 6 dayparts
      if (foundDayparts >= 6) break;
    }

    // Only set if we found some data
    const hasData = daypartData.morning > 0 || daypartData.daytime > 0 ||
                    daypartData.early_peak > 0 || daypartData.late_peak > 0 ||
                    daypartData.post_peak > 0 || daypartData.late_night > 0;
    if (hasData) {
      parsed.daypart_split = daypartData;
    }
  }

  return parsed;
};

const parseFileSmart = (data: any[][], fileName: string): Partial<PlatformData> => {
  const parser = new SmartParser(data);

  // Detect file type and use appropriate parser
  if (parser.findAnchor(STRATEGIES.SKY.anchors)) {
    return parseSkyCSV(data, parser, fileName);
  } else if (parser.findAnchor(STRATEGIES.C4.anchors)) {
    return parseChannel4Excel(data, parser);
  } else if (parser.findAnchor(STRATEGIES.ITV.anchors)) {
    // ITV Excel parsing (less common, PDFs more typical)
    const parsed: Partial<PlatformData> = {
      name: 'ITV',
      supplier: 'ITV',
      delivered_impressions: 0,
      planned_impressions: 0,
      clicks: 0,
      vtr: 0,
      // Default device split - mark as inferred (ITV PDFs have actual data)
      device_split: { mobile: 0.15, desktop: 0.1, tv: 0.75, is_inferred: true },
      top_shows: [],
      buying_lines: [],
      daily_impressions: []
    };

    const tableRegion = parser.detectTable(STRATEGIES.ITV.tableHeaders);
    if (tableRegion) {
      const rows = parser.extractTableData(tableRegion);
      let vtrSum = 0, count = 0;
      rows.forEach(r => {
        parsed.delivered_impressions! += SmartParser.cleanNumber(r.impressions);
        parsed.clicks! += SmartParser.cleanNumber(r.clicks);
        const vtrVal = SmartParser.cleanNumber(r.vtr);
        if (vtrVal > 0) {
          vtrSum += vtrVal > 1 ? vtrVal / 100 : vtrVal;
          count++;
        }
      });
      if (count > 0) parsed.vtr = vtrSum / count;
    }

    // Set planned = delivered for ITV Excel (PDF has this data)
    parsed.planned_impressions = parsed.delivered_impressions;
    
    return parsed;
  } else {
    // Unknown format - extract filename as name
    return {
      name: fileName.split('.')[0],
      supplier: 'Other',
      delivered_impressions: 0,
      planned_impressions: 0,
      clicks: 0,
      vtr: 0,
      // No device data available - mark as inferred
      device_split: { mobile: 0, desktop: 0, tv: 1, is_inferred: true },
      top_shows: [],
      buying_lines: [],
      daily_impressions: []
    };
  }
};

/**
 * Convert K notation (e.g., "42.68K") to actual number
 */
const parseKNotation = (value: string): number => {
  const match = value.match(/([\d.,]+)\s*K?/i);
  if (!match) return 0;
  const num = parseFloat(match[1].replace(/,/g, ''));
  // If original string contains 'K', multiply by 1000
  if (value.toLowerCase().includes('k')) {
    return Math.round(num * 1000);
  }
  return num;
};

// PDF Parsing for ITV
const parsePDFFile = async (file: File): Promise<Partial<PlatformData>> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(' ');
    fullText += pageText + '\n';
  }

  // Extract ITV metrics from PDF text
  const parsed: Partial<PlatformData> = {
    name: 'ITVX',
    supplier: 'ITV',
    delivered_impressions: 0,
    planned_impressions: 0,
    clicks: 0,
    vtr: 0,
    // Default device split - will be updated below if found in PDF (and is_inferred removed)
    device_split: { mobile: 0, desktop: 0, tv: 1, is_inferred: true },
    top_shows: [],
    buying_lines: [],
    daily_impressions: []  // ITV PDFs rarely have daily data in text form
  };

  // Extract Target (planned impressions)
  // ITV PDFs format: "Target" followed by description then number like "655,045"
  const targetMatch = fullText.match(/Target\s*(?:The number of impressions booked)?\s*(\d{1,3}(?:,\d{3})*)/i);
  if (targetMatch) {
    parsed.planned_impressions = parseInt(targetMatch[1].replace(/,/g, ''));
  }

  // Extract Delivered impressions
  // Format: "Delivered" followed by description then number
  const deliveredMatch = fullText.match(/Delivered\s*(?:The total served impressions)?\s*(\d{1,3}(?:,\d{3})*)/i);
  if (deliveredMatch) {
    parsed.delivered_impressions = parseInt(deliveredMatch[1].replace(/,/g, ''));
  }

  // Extract Completion rate (use as VTR)
  const completionMatch = fullText.match(/Completion\s*rate\s*(?:The video completion rate[^0-9]*)?([\d.]+)%/i);
  if (completionMatch) {
    parsed.vtr = parseFloat(completionMatch[1]) / 100;
  }

  // Extract Device Type splits from "Delivery by device type" section
  // Format: "DESKTOP - 46.38K (7.06%)" or "MOBILE - 103.13K (15.69%)" or "TV - 507.66K (77.25%)"
  const desktopMatch = fullText.match(/DESKTOP\s*[-–]\s*[\d.,]+K?\s*\(([\d.]+)%\)/i);
  const mobileMatch = fullText.match(/MOBILE\s*[-–]\s*[\d.,]+K?\s*\(([\d.]+)%\)/i);
  const tvMatch = fullText.match(/TV\s*[-–]\s*[\d.,]+K?\s*\(([\d.]+)%\)/i);

  if (desktopMatch || mobileMatch || tvMatch) {
    // Actual device data found - not inferred
    parsed.device_split = {
      desktop: desktopMatch ? parseFloat(desktopMatch[1]) / 100 : 0,
      mobile: mobileMatch ? parseFloat(mobileMatch[1]) / 100 : 0,
      tv: tvMatch ? parseFloat(tvMatch[1]) / 100 : 0.75,
      is_inferred: false  // Extracted from source
    };
  }

  // Extract Top Programmes from "Delivery by programme" section
  // Format: PROGRAMME.NAME followed by impressions like "42.68K42.68K  42.68K"
  // The duplicates are from the PDF's visual chart rendering - we take the first occurrence
  const programmeSection = fullText.match(/Delivery by programme[^]*?(?=Delivery by|$)/i);
  if (programmeSection) {
    const sectionText = programmeSection[0];
    // Match programme names (ALL.CAPS.WITH.DOTS or STV.SOMETHING) followed by impression values
    const programmeMatches = sectionText.matchAll(/([A-Z][A-Z.'&\s]+?)\s+([\d.,]+K)/gi);
    const programmes: TopShow[] = [];

    for (const match of programmeMatches) {
      const title = match[1].trim().replace(/\./g, ' ').replace(/\s+/g, ' ');
      const impressions = parseKNotation(match[2]);

      // Avoid duplicates (same title already added)
      if (impressions > 0 && !programmes.find(p => p.title === title)) {
        programmes.push({ title, impressions });
      }
    }

    // Sort by impressions descending and take top 10
    parsed.top_shows = programmes
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 10);
  }
  
  // Try to extract hourly data from text for daypart aggregation
  // Note: ITV PDFs typically have charts for hourly data which require AI Vision parsing
  // This regex attempts to find textual hourly data if present
  const hourlyPattern = /(?:hour|(\d{1,2})\s*(?:am|pm))[:\s]*(\d+(?:\.\d+)?)\s*%?/gi;
  const hourlyMatches = [...fullText.matchAll(hourlyPattern)];
  
  if (hourlyMatches.length >= 12) {
    // Found substantial hourly data in text
    const hourlyValues: number[] = new Array(24).fill(0);
    let foundHours = 0;
    
    hourlyMatches.forEach(match => {
      if (match[1]) {
        const hourStr = match[1];
        const valueStr = match[2] || '0';
        const value = parseFloat(valueStr);
        const isPM = match[0].toLowerCase().includes('pm');
        
        let hour = parseInt(hourStr);
        if (hour === 12) {
          hour = isPM ? 12 : 0;
        } else if (isPM) {
          hour += 12;
        }
        
        if (hour >= 0 && hour < 24 && value > 0) {
          hourlyValues[hour] = value > 1 ? value / 100 : value;
          foundHours++;
        }
      }
    });
    
    if (foundHours >= 12) {
      // Aggregate hourly into dayparts
      parsed.daypart_split = {
        morning: hourlyValues.slice(6, 12).reduce((a, b) => a + b, 0),
        daytime: hourlyValues.slice(12, 17).reduce((a, b) => a + b, 0) + hourlyValues[17] * 0.42,
        early_peak: hourlyValues[17] * 0.58 + hourlyValues.slice(18, 20).reduce((a, b) => a + b, 0),
        late_peak: hourlyValues.slice(20, 23).reduce((a, b) => a + b, 0),
        post_peak: hourlyValues[23] + hourlyValues[0] * 0.5,
        late_night: hourlyValues[0] * 0.5 + hourlyValues.slice(1, 6).reduce((a, b) => a + b, 0),
        is_inferred: false
      };
    }
  }
  // If no hourly data found, daypart_split remains undefined (requires AI Vision parsing)

  return parsed;
};

// --- Components ---

const KPICard = ({ label, value, status = 'neutral' }: { label: string, value: string, status?: 'good' | 'bad' | 'warning' | 'neutral' }) => (
  <div className="relative bg-gradient-to-br from-white/[0.08] to-white/[0.02] backdrop-blur-xl p-6 rounded-2xl border border-white/10 overflow-hidden group hover:border-white/20 transition-all duration-300">
    {/* Glow effect */}
    <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${
      status === 'good' ? 'bg-green-500/5' : status === 'bad' ? 'bg-red-500/5' : status === 'warning' ? 'bg-yellow-500/5' : 'bg-blue-500/5'
    }`} />
    <p className="text-xs text-white/50 mb-2 uppercase tracking-wider font-medium">{label}</p>
    <p className={`text-3xl font-bold ${
      status === 'good' ? 'text-green-400' : 
      status === 'bad' ? 'text-red-400' : 
      status === 'warning' ? 'text-yellow-400' : 
      'text-white'
    }`}>
      {value}
    </p>
  </div>
);

// Glass card wrapper component
const GlassPanel = ({ children, className = '' }: { children: React.ReactNode, className?: string }) => (
  <div className={`bg-gradient-to-br from-white/[0.08] to-white/[0.02] backdrop-blur-xl rounded-2xl border border-white/10 ${className}`}>
    {children}
  </div>
);

export const ReportConsolidator: React.FC = () => {
  const [platforms, setPlatforms] = useState<PlatformData[]>([]);
  const [meta, setMeta] = useState<CampaignMeta>({
    client: 'Tom Ford',
    campaign: 'Bois Pacifique',
    start_date: '08/05/2025',
    end_date: '29/05/2025'
  });
  const [isDragging, setIsDragging] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [activeSupplier, setActiveSupplier] = useState<string>('All');
  const [expandedPlatforms, setExpandedPlatforms] = useState<Set<string>>(new Set());

  const [manualEntry, setManualEntry] = useState<Partial<PlatformData> & { customName?: string }>({
    name: '',
    supplier: 'Linear TV',
    planned_impressions: 0,
    delivered_impressions: 0,
    clicks: 0,
    vtr: 0,
    frequency: undefined,
    device_split: { mobile: 0, desktop: 0, tv: 100, is_inferred: false },
    customName: ''
  });
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [useAiParsing, setUseAiParsing] = useState(true);
  
  // Sorting state for Buying Types table
  const [buyingSortKey, setBuyingSortKey] = useState<keyof BuyingLine>('delivered_impressions');
  const [buyingSortDir, setBuyingSortDir] = useState<'asc' | 'desc'>('desc');
  
  // Toggle sort - click same column toggles direction, new column defaults to desc
  const handleBuyingSort = (key: keyof BuyingLine) => {
    if (buyingSortKey === key) {
      setBuyingSortDir(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setBuyingSortKey(key);
      setBuyingSortDir('desc');
    }
  };
  
  // Editing state for buying type names (double-click to edit)
  const [editingBuyingType, setEditingBuyingType] = useState<{
    platformId: string;
    lineIdx: number;
  } | null>(null);
  const [editingName, setEditingName] = useState('');
  
  // Start editing a buying type name
  const startEditingBuyingType = (platformId: string, lineIdx: number, currentName: string) => {
    setEditingBuyingType({ platformId, lineIdx });
    setEditingName(currentName);
  };
  
  // Save the edited buying type name
  const saveEditedBuyingType = () => {
    if (!editingBuyingType || !editingName.trim()) {
      setEditingBuyingType(null);
      return;
    }
    
    setPlatforms(prev => prev.map(p => {
      if (p.id === editingBuyingType.platformId) {
        const newBuyingLines = [...p.buying_lines];
        if (newBuyingLines[editingBuyingType.lineIdx]) {
          newBuyingLines[editingBuyingType.lineIdx] = {
            ...newBuyingLines[editingBuyingType.lineIdx],
            buying_type: editingName.trim()
          };
        }
        return { ...p, buying_lines: newBuyingLines };
      }
      return p;
    }));
    
    setEditingBuyingType(null);
    setEditingName('');
  };
  
  // Device mix editing state (for inline sliders)
  const [editingDeviceMix, setEditingDeviceMix] = useState<string | null>(null); // platformId or 'global'
  const [deviceMixValues, setDeviceMixValues] = useState({ mobile: 0, desktop: 0, tv: 100 });
  
  // Start editing device mix for a specific platform (used for per-platform edit if needed)
  const _startEditingDeviceMix = (platformId: string, currentSplit: DeviceSplit) => {
    setEditingDeviceMix(platformId);
    setDeviceMixValues({
      mobile: Math.round(currentSplit.mobile * 100),
      desktop: Math.round(currentSplit.desktop * 100),
      tv: Math.round(currentSplit.tv * 100)
    });
  };
  // Silence unused warning - may be used for per-platform editing
  void _startEditingDeviceMix;
  
  // Update a device mix value and auto-normalize others
  const updateDeviceMixValue = (key: 'mobile' | 'desktop' | 'tv', value: number) => {
    const clamped = Math.max(0, Math.min(100, value));
    const remaining = 100 - clamped;
    
    // Get the other two keys
    const others = (['mobile', 'desktop', 'tv'] as const).filter(k => k !== key);
    const otherSum = deviceMixValues[others[0]] + deviceMixValues[others[1]];
    
    // Distribute remaining proportionally to other values
    if (otherSum === 0) {
      // If others are both 0, split equally
      setDeviceMixValues({
        ...deviceMixValues,
        [key]: clamped,
        [others[0]]: Math.round(remaining / 2),
        [others[1]]: remaining - Math.round(remaining / 2)
      });
    } else {
      const ratio0 = deviceMixValues[others[0]] / otherSum;
      const newValue0 = Math.round(remaining * ratio0);
      setDeviceMixValues({
        ...deviceMixValues,
        [key]: clamped,
        [others[0]]: newValue0,
        [others[1]]: remaining - newValue0
      });
    }
  };
  
  // Save the edited device mix
  const saveDeviceMix = () => {
    if (!editingDeviceMix) return;
    
    // If editing 'global', update all platforms with inferred device data
    if (editingDeviceMix === 'global') {
      setPlatforms(prev => prev.map(p => {
        if (p.device_split.is_inferred) {
          return {
            ...p,
            device_split: {
              mobile: deviceMixValues.mobile / 100,
              desktop: deviceMixValues.desktop / 100,
              tv: deviceMixValues.tv / 100,
              is_inferred: false // User has now manually set it
            }
          };
        }
        return p;
      }));
    } else {
      // Update specific platform
      setPlatforms(prev => prev.map(p => {
        if (p.id === editingDeviceMix) {
          return {
            ...p,
            device_split: {
              mobile: deviceMixValues.mobile / 100,
              desktop: deviceMixValues.desktop / 100,
              tv: deviceMixValues.tv / 100,
              is_inferred: false
            }
          };
        }
        return p;
      }));
    }
    
    setEditingDeviceMix(null);
  };

  const processFile = async (file: File) => {
    try {
      let parsed: Partial<PlatformData>;

      // Check if PDF
      if (file.name.toLowerCase().endsWith('.pdf')) {
        // Try AI-powered parsing first (if enabled)
        if (useAiParsing) {
          try {
            setIsProcessingAI(true);
            
            // Helper to convert AI result to PlatformData
            const convertAiResult = (aiResult: any): Partial<PlatformData> => ({
              name: aiResult.supplier === 'ITV' ? 'ITVX' : aiResult.supplier,
              supplier: aiResult.supplier as PlatformData['supplier'],
              planned_impressions: aiResult.planned_impressions,
              delivered_impressions: aiResult.delivered_impressions,
              clicks: aiResult.clicks,
              vtr: aiResult.vtr,
              frequency: aiResult.frequency,
              device_split: {
                mobile: aiResult.device_split?.mobile || 0,
                desktop: aiResult.device_split?.desktop || 0,
                tv: aiResult.device_split?.tv || 1,
                is_inferred: false  // Extracted from AI
              },
              top_shows: (aiResult.top_shows || []).map((s: any) => ({
                title: s.title,
                impressions: s.impressions
              })),
              buying_lines: (aiResult.buying_lines || []).map((b: any) => ({
                buying_type: b.buying_type || 'Unknown Segment',
                planned_impressions: b.planned_impressions || 0,
                delivered_impressions: b.delivered_impressions || 0,
                delivery_percent: b.planned_impressions > 0 
                  ? (b.delivered_impressions / b.planned_impressions) * 100 
                  : 100,
                vtr: b.vtr || 0,
                clicks: b.clicks || 0,
                ctr: b.ctr || 0,
                is_inferred: b.is_inferred ?? false
              })),
              daily_impressions: (aiResult.daily_impressions || []).map((d: any) => ({
                date: d.date || '',
                impressions: d.impressions || 0,
                clicks: d.clicks || 0
              })),
              daypart_split: aiResult.daypart_split ? {
                morning: aiResult.daypart_split.morning || 0,
                daytime: aiResult.daypart_split.daytime || 0,
                early_peak: aiResult.daypart_split.early_peak || 0,
                late_peak: aiResult.daypart_split.late_peak || 0,
                post_peak: aiResult.daypart_split.post_peak || 0,
                late_night: aiResult.daypart_split.late_night || 0,
                is_inferred: aiResult.daypart_split.is_inferred ?? false
              } : undefined // No daypart data available
            });
            
            // First try Vision-based parsing (works better for complex PDFs with charts)
            try {
              console.log('[Vision PDF] Attempting vision-based extraction for:', file.name);
              const visionResult = await api.parsePdfWithVision(file);
              
              // Check if we got meaningful data
              if (visionResult.delivered_impressions > 0) {
                parsed = convertAiResult(visionResult);
                console.log('[Vision PDF] Successfully extracted:', visionResult.supplier, visionResult.delivered_impressions.toLocaleString(), 'impressions');
              } else {
                throw new Error('Vision parsing returned empty results');
              }
            } catch (visionError) {
              // Fallback to text-based AI parsing
              console.warn('[Vision PDF] Vision parsing failed, trying text-based AI:', visionError);
              try {
                const aiResult = await api.parsePdfWithAi(file);
                parsed = convertAiResult(aiResult);
                console.log('[AI PDF] Successfully extracted:', aiResult.supplier, aiResult.delivered_impressions.toLocaleString(), 'impressions');
              } catch (textAiError) {
                console.warn('[AI PDF] Text-based AI parsing also failed:', textAiError);
                throw textAiError;
              }
            }
          } catch (aiError) {
            console.warn('[AI PDF] All AI parsing failed, falling back to basic extraction:', aiError);
            // Fallback to basic PDF parsing
        parsed = await parsePDFFile(file);
          } finally {
            setIsProcessingAI(false);
          }
        } else {
          // Use basic PDF parsing
          parsed = await parsePDFFile(file);
        }
      } else {
        // Excel/CSV processing
        const bstr = await file.arrayBuffer();
        const wb = XLSX.read(bstr);
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        parsed = parseFileSmart(data, file.name);
      }

      const newPlatform: PlatformData = {
        id: generateId(),
        name: parsed.name || 'Unknown',
        supplier: parsed.supplier || 'Other',
        planned_impressions: parsed.planned_impressions || parsed.delivered_impressions || 0,
        delivered_impressions: parsed.delivered_impressions || 0,
        clicks: parsed.clicks || 0,
        spend: 0,
        vtr: parsed.vtr || 0,
        device_split: parsed.device_split || { mobile: 0, desktop: 0, tv: 1, is_inferred: true },
        top_shows: parsed.top_shows || [],
        buying_lines: parsed.buying_lines || [],
        daily_impressions: parsed.daily_impressions || [],
        daypart_split: parsed.daypart_split,
        frequency: parsed.frequency,
        demographics: parsed.demographics,
        source_file: file.name,
        upload_date: new Date().toISOString()
      };

      setPlatforms(prev => [...prev, newPlatform]);
    } catch (err) {
      console.error('Error processing file:', err);
      setIsProcessingAI(false);
      alert(`Failed to process ${file.name}: ${err}`);
    }
  };

  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      await processFile(file);
    }
  }, []);

  const handleManualSubmit = () => {
    // Determine supplier and name
    const selectedSupplier = manualEntry.supplier || 'Linear TV';
    const isOther = selectedSupplier === 'Other';
    const platformName = isOther 
      ? (manualEntry.customName || 'Custom Platform')
      : (manualEntry.name || selectedSupplier);
    
    // Normalize device split percentages to decimals (0-1 range)
    const deviceSplit = manualEntry.device_split || { mobile: 0, desktop: 0, tv: 100, is_inferred: false };
    const totalPercent = (deviceSplit.mobile || 0) + (deviceSplit.desktop || 0) + (deviceSplit.tv || 0);
    const normalizedDeviceSplit: DeviceSplit = totalPercent > 0 ? {
      mobile: (deviceSplit.mobile || 0) / totalPercent,
      desktop: (deviceSplit.desktop || 0) / totalPercent,
      tv: (deviceSplit.tv || 0) / totalPercent,
      is_inferred: false
    } : { mobile: 0, desktop: 0, tv: 1, is_inferred: true };
    
    const newPlatform: PlatformData = {
      id: generateId(),
      name: platformName,
      supplier: isOther ? 'Other' : selectedSupplier as PlatformData['supplier'],
      planned_impressions: Number(manualEntry.planned_impressions),
      delivered_impressions: Number(manualEntry.delivered_impressions),
      clicks: Number(manualEntry.clicks),
      spend: 0,
      vtr: Number(manualEntry.vtr),
      device_split: normalizedDeviceSplit,
      top_shows: [],
      buying_lines: [],
      daily_impressions: [],
      frequency: manualEntry.frequency,
      demographics: manualEntry.demographics,
      is_manual: true,
      upload_date: new Date().toISOString()
    };
    setPlatforms(prev => [...prev, newPlatform]);
    setShowManualModal(false);
    
    // Reset form
    setManualEntry({
      name: '',
      supplier: 'Linear TV',
      planned_impressions: 0,
      delivered_impressions: 0,
      clicks: 0,
      vtr: 0,
      frequency: undefined,
      device_split: { mobile: 0, desktop: 0, tv: 100, is_inferred: false },
      customName: ''
    });
  };

  const consolidated = useMemo(() => {
    const filteredPlatforms = activeSupplier === 'All'
      ? platforms
      : platforms.filter(p => p.supplier === activeSupplier);

    const totalDelivered = filteredPlatforms.reduce((sum, p) => sum + p.delivered_impressions, 0);
    const totalPlanned = filteredPlatforms.reduce((sum, p) => sum + p.planned_impressions, 0);
    const totalClicks = filteredPlatforms.reduce((sum, p) => sum + p.clicks, 0);

    let weightedVtrSum = 0;
    filteredPlatforms.forEach(p => {
      weightedVtrSum += p.delivered_impressions * p.vtr;
    });
    const weightedVtr = totalDelivered > 0 ? weightedVtrSum / totalDelivered : 0;

    const ctr = totalDelivered > 0 ? (totalClicks / totalDelivered) * 100 : 0;
    const deliveryPercent = totalPlanned > 0 ? (totalDelivered / totalPlanned) * 100 : 0;

    let rawMobile = 0, rawDesktop = 0, rawTv = 0;
    let hasInferredDeviceData = false;
    filteredPlatforms.forEach(p => {
      rawMobile += p.delivered_impressions * p.device_split.mobile;
      rawDesktop += p.delivered_impressions * p.device_split.desktop;
      rawTv += p.delivered_impressions * p.device_split.tv;
      // Track if any platform has inferred device data
      if (p.device_split.is_inferred) {
        hasInferredDeviceData = true;
      }
    });

    const deviceMix = [
      { name: 'Mobile', value: rawMobile },
      { name: 'Desktop', value: rawDesktop },
      { name: 'Big Screen', value: rawTv }
    ];

    // Aggregate shows by title to deduplicate (same show from multiple sources)
    const showMap = new Map<string, number>();
    filteredPlatforms.forEach(p => {
      p.top_shows.forEach(s => {
        const normalizedTitle = s.title.trim();
        const existing = showMap.get(normalizedTitle) || 0;
        showMap.set(normalizedTitle, existing + s.impressions);
      });
    });
    const top5Shows = Array.from(showMap.entries())
      .map(([title, impressions]) => ({ title, impressions }))
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 5);

    const totalFrequency = filteredPlatforms.reduce((sum, p) => sum + (p.frequency || 0), 0);
    const avgFrequency = filteredPlatforms.length > 0 ? totalFrequency / filteredPlatforms.length : 0;
    
    // Aggregate daily impressions by date
    const dailyMap = new Map<string, { impressions: number; clicks: number }>();
    filteredPlatforms.forEach(p => {
      (p.daily_impressions || []).forEach(d => {
        const existing = dailyMap.get(d.date) || { impressions: 0, clicks: 0 };
        dailyMap.set(d.date, {
          impressions: existing.impressions + d.impressions,
          clicks: existing.clicks + (d.clicks || 0)
        });
      });
    });
    const dailyData = Array.from(dailyMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => {
        // Try to parse and sort by date
        const parseDate = (d: string) => {
          const parts = d.split(/[\/\-]/);
          if (parts.length === 3) {
            // Try DD/MM/YYYY or YYYY-MM-DD
            if (parts[0].length === 4) return new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]));
            return new Date(parseInt(parts[2]), parseInt(parts[1])-1, parseInt(parts[0]));
          }
          return new Date(d);
        };
        return parseDate(a.date).getTime() - parseDate(b.date).getTime();
      });
    
    // Aggregate daypart splits (weighted by delivered impressions)
    let daypartTotals = {
      morning: 0, daytime: 0, early_peak: 0, late_peak: 0, post_peak: 0, late_night: 0
    };
    let daypartWeight = 0;
    let hasDaypartData = false;
    filteredPlatforms.forEach(p => {
      if (p.daypart_split) {
        hasDaypartData = true;
        const weight = p.delivered_impressions;
        daypartTotals.morning += p.daypart_split.morning * weight;
        daypartTotals.daytime += p.daypart_split.daytime * weight;
        daypartTotals.early_peak += p.daypart_split.early_peak * weight;
        daypartTotals.late_peak += p.daypart_split.late_peak * weight;
        daypartTotals.post_peak += p.daypart_split.post_peak * weight;
        daypartTotals.late_night += p.daypart_split.late_night * weight;
        daypartWeight += weight;
      }
    });
    
    const daypartData = hasDaypartData && daypartWeight > 0 ? [
      { name: 'Morning', value: daypartTotals.morning / daypartWeight, label: '6am - 12pm' },
      { name: 'Daytime', value: daypartTotals.daytime / daypartWeight, label: '12pm - 5:25pm' },
      { name: 'Early Peak', value: daypartTotals.early_peak / daypartWeight, label: '5:25pm - 8pm' },
      { name: 'Late Peak', value: daypartTotals.late_peak / daypartWeight, label: '8pm - 11pm' },
      { name: 'Post Peak', value: daypartTotals.post_peak / daypartWeight, label: '11pm - 12:30am' },
      { name: 'Late Night', value: daypartTotals.late_night / daypartWeight, label: '12:30am - 6am' }
    ] : [];

    // === Data Verification Checks ===
    // Daily impressions verification: check if sum matches total delivered (within 5% tolerance)
    const dailyTotal = dailyData.reduce((sum, d) => sum + d.impressions, 0);
    const dailyMatchesTotal = totalDelivered > 0 && Math.abs(dailyTotal - totalDelivered) < (totalDelivered * 0.05);
    const dailyDataComplete = dailyMatchesTotal && dailyData.length > 0;
    
    // Daypart verification: check if daypart values sum to ~1.0 (within 5% tolerance)
    const daypartSum = daypartData.reduce((sum, d) => sum + d.value, 0);
    const daypartComplete = daypartData.length > 0 && daypartSum > 0.95 && daypartSum < 1.05;

    return {
      totalDelivered,
      totalPlanned,
      totalClicks,
      weightedVtr,
      ctr,
      deliveryPercent,
      deviceMix,
      hasInferredDeviceData,
      top5Shows,
      avgFrequency,
      dailyData,
      dailyDataComplete,
      dailyTotal,
      daypartData,
      daypartComplete,
      filteredCount: filteredPlatforms.length
    };
  }, [platforms, activeSupplier]);

  // Generate dynamic tabs based on uploaded platforms (Linear TV always visible)
  const availableTabs = useMemo(() => {
    const suppliers = new Set(platforms.map(p => p.supplier));
    const dynamicSuppliers = ['Sky', 'Channel 4', 'ITV', 'Other']
      .filter(s => suppliers.has(s as any));
    return ['All', ...dynamicSuppliers, 'Linear TV'];
  }, [platforms]);

  const exportPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Helper to add a section header
    const addSectionHeader = (title: string, yPos: number) => {
      doc.setFillColor(30, 30, 40);
      doc.rect(14, yPos - 5, pageWidth - 28, 12, 'F');
      doc.setFontSize(12);
      doc.setTextColor(255, 255, 255);
      doc.text(title, 18, yPos + 3);
    doc.setTextColor(0, 0, 0);
    };

    // ========== PAGE 1: COVER PAGE ==========
    doc.setFillColor(20, 20, 30);
    doc.rect(0, 0, pageWidth, 297, 'F');
    
    // Title
    doc.setFontSize(32);
    doc.setTextColor(255, 255, 255);
    doc.text('Media Campaign Report', pageWidth / 2, 80, { align: 'center' });
    
    // Client & Campaign
    doc.setFontSize(20);
    doc.setTextColor(150, 150, 200);
    doc.text(meta.client, pageWidth / 2, 105, { align: 'center' });
    doc.setFontSize(16);
    doc.text(meta.campaign, pageWidth / 2, 118, { align: 'center' });
    
    // Date Range
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 140);
    doc.text(`${meta.start_date} - ${meta.end_date}`, pageWidth / 2, 140, { align: 'center' });
    
    // Supplier logos/names
    const suppliers = [...new Set(platforms.map(p => p.supplier))];
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 160);
    doc.text('Data Sources:', pageWidth / 2, 180, { align: 'center' });
    doc.text(suppliers.join(' • '), pageWidth / 2, 192, { align: 'center' });
    
    // ========== PAGE 2: EXECUTIVE SUMMARY ==========
    doc.addPage();
    doc.setFillColor(245, 245, 250);
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setFontSize(20);
    doc.setTextColor(20, 20, 40);
    doc.text('Executive Summary', 14, 25);
    
    // Overall KPIs
    addSectionHeader('Key Performance Indicators', 50);
    autoTable(doc, {
      startY: 60,
      head: [['Metric', 'Value']],
      body: [
        ['Total Planned Impressions', consolidated.totalPlanned.toLocaleString()],
        ['Total Delivered Impressions', consolidated.totalDelivered.toLocaleString()],
        ['Delivery %', `${consolidated.deliveryPercent.toFixed(2)}%`],
        ['Total Clicks', consolidated.totalClicks.toLocaleString()],
        ['CTR', `${consolidated.ctr.toFixed(2)}%`],
        ['Weighted VTR', `${(consolidated.weightedVtr * 100).toFixed(2)}%`],
        ['Average Frequency', consolidated.avgFrequency.toFixed(2)]
      ],
      theme: 'grid',
      headStyles: { fillColor: [30, 30, 50] },
      styles: { fontSize: 10 }
    });

    // Device Mix Summary
    let yPos = (doc as any).lastAutoTable.finalY + 15;
    addSectionHeader('Device Mix (Weighted by Impressions)', yPos);
    const deviceTotal = consolidated.deviceMix.reduce((s, d) => s + d.value, 0);
    autoTable(doc, {
      startY: yPos + 10,
      head: [['Device', 'Impressions', 'Share']],
      body: consolidated.deviceMix.map(d => [
        d.name,
        d.value.toLocaleString(),
        deviceTotal > 0 ? `${((d.value / deviceTotal) * 100).toFixed(1)}%` : '0%'
      ]),
      theme: 'grid',
      headStyles: { fillColor: [30, 30, 50] },
      styles: { fontSize: 10 }
    });
    
    // Top 5 Content
    yPos = (doc as any).lastAutoTable.finalY + 15;
    addSectionHeader('Top 5 Content (All Suppliers)', yPos);
    autoTable(doc, {
      startY: yPos + 10,
      head: [['Rank', 'Programme', 'Impressions']],
      body: consolidated.top5Shows.map((s, i) => [
        i + 1,
        s.title,
        s.impressions.toLocaleString()
      ]),
      theme: 'grid',
      headStyles: { fillColor: [30, 30, 50] },
      styles: { fontSize: 10 }
    });
    
    // Platform Overview Table
    yPos = (doc as any).lastAutoTable.finalY + 15;
    addSectionHeader('Platform Overview', yPos);
    autoTable(doc, {
      startY: yPos + 10,
      head: [['Platform', 'Planned', 'Delivered', 'Delivery %', 'Clicks', 'CTR']],
      body: platforms.map(p => [
        p.name,
        p.planned_impressions.toLocaleString(),
        p.delivered_impressions.toLocaleString(),
        p.planned_impressions > 0 ? `${((p.delivered_impressions / p.planned_impressions) * 100).toFixed(1)}%` : '-',
        p.clicks.toLocaleString(),
        p.delivered_impressions > 0 ? `${((p.clicks / p.delivered_impressions) * 100).toFixed(2)}%` : '-'
      ]),
      theme: 'striped',
      headStyles: { fillColor: [30, 30, 50] },
      styles: { fontSize: 9 }
    });
    
    // ========== PER-SUPPLIER PAGES ==========
    suppliers.forEach(supplier => {
      doc.addPage();
      
      // Supplier Header
      doc.setFillColor(30, 30, 50);
      doc.rect(0, 0, pageWidth, 35, 'F');
      doc.setFontSize(18);
      doc.setTextColor(255, 255, 255);
      doc.text(`${supplier} Performance`, 14, 22);
      
      const supplierPlatforms = platforms.filter(p => p.supplier === supplier);
      const supplierTotal = supplierPlatforms.reduce((acc, p) => ({
        planned: acc.planned + p.planned_impressions,
        delivered: acc.delivered + p.delivered_impressions,
        clicks: acc.clicks + p.clicks
      }), { planned: 0, delivered: 0, clicks: 0 });
      
      // Supplier KPIs
      addSectionHeader('Key Metrics', 45);
    autoTable(doc, {
        startY: 55,
        head: [['Metric', 'Value']],
        body: [
          ['Planned Impressions', supplierTotal.planned.toLocaleString()],
          ['Delivered Impressions', supplierTotal.delivered.toLocaleString()],
          ['Delivery %', supplierTotal.planned > 0 ? `${((supplierTotal.delivered / supplierTotal.planned) * 100).toFixed(2)}%` : '-'],
          ['Clicks', supplierTotal.clicks.toLocaleString()],
          ['CTR', supplierTotal.delivered > 0 ? `${((supplierTotal.clicks / supplierTotal.delivered) * 100).toFixed(2)}%` : '-']
        ],
        theme: 'grid',
        headStyles: { fillColor: [50, 50, 80] },
        styles: { fontSize: 10 }
      });
      
      // Device Mix for this supplier
      yPos = (doc as any).lastAutoTable.finalY + 15;
      addSectionHeader('Device Mix', yPos);
      let supMobile = 0, supDesktop = 0, supTV = 0;
      supplierPlatforms.forEach(p => {
        supMobile += p.delivered_impressions * p.device_split.mobile;
        supDesktop += p.delivered_impressions * p.device_split.desktop;
        supTV += p.delivered_impressions * p.device_split.tv;
      });
      const supTotal = supMobile + supDesktop + supTV;
      autoTable(doc, {
        startY: yPos + 10,
        head: [['Device', 'Impressions', 'Share']],
        body: [
          ['Mobile', Math.round(supMobile).toLocaleString(), supTotal > 0 ? `${((supMobile / supTotal) * 100).toFixed(1)}%` : '-'],
          ['Desktop', Math.round(supDesktop).toLocaleString(), supTotal > 0 ? `${((supDesktop / supTotal) * 100).toFixed(1)}%` : '-'],
          ['Big Screen', Math.round(supTV).toLocaleString(), supTotal > 0 ? `${((supTV / supTotal) * 100).toFixed(1)}%` : '-']
        ],
        theme: 'grid',
        headStyles: { fillColor: [50, 50, 80] },
        styles: { fontSize: 10 }
      });
      
      // Buying Lines for this supplier
      const allBuyingLines = supplierPlatforms.flatMap(p => p.buying_lines || []);
      if (allBuyingLines.length > 0) {
        yPos = (doc as any).lastAutoTable.finalY + 15;
        addSectionHeader('Buying Types / Line Items', yPos);
        autoTable(doc, {
          startY: yPos + 10,
          head: [['Buying Type', 'Planned', 'Delivered', 'Del %', 'Clicks', 'CTR']],
          body: allBuyingLines.map(line => [
            line.buying_type.length > 25 ? line.buying_type.substring(0, 22) + '...' : line.buying_type,
            line.planned_impressions.toLocaleString(),
            line.delivered_impressions.toLocaleString(),
            `${line.delivery_percent.toFixed(1)}%`,
            line.clicks.toLocaleString(),
            `${line.ctr.toFixed(2)}%`
          ]),
          theme: 'striped',
          headStyles: { fillColor: [50, 50, 80] },
          styles: { fontSize: 9 }
        });
      }
      
      // Top Shows for this supplier
      const supplierShows = supplierPlatforms.flatMap(p => p.top_shows || [])
        .sort((a, b) => b.impressions - a.impressions)
        .slice(0, 5);
      if (supplierShows.length > 0) {
        yPos = (doc as any).lastAutoTable.finalY + 15;
        addSectionHeader('Top Content', yPos);
        autoTable(doc, {
          startY: yPos + 10,
          head: [['Rank', 'Programme', 'Impressions']],
          body: supplierShows.map((s, i) => [
            i + 1,
            s.title,
            s.impressions.toLocaleString()
          ]),
          theme: 'grid',
          headStyles: { fillColor: [50, 50, 80] },
          styles: { fontSize: 10 }
        });
      }
    });

    doc.save(`${meta.client}_${meta.campaign}_Consolidated_Report.pdf`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#0d1117] to-[#0a0a0f] px-4 py-6 w-full space-y-6 pb-20">
      {/* Header with Title and Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1 tracking-tight">Media Report Consolidator</h1>
          <p className="text-white/40 text-sm">Unified campaign performance dashboard</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowManualModal(true)}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white px-4 py-2.5 rounded-xl border border-white/10 hover:border-white/20 transition-all duration-200 text-sm font-medium"
          >
            <Plus size={18} />
            Add Manual
          </button>
          <button
            onClick={exportPDF}
            disabled={platforms.length === 0}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white px-5 py-2.5 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-sm font-medium shadow-lg shadow-blue-500/20"
          >
            <Download size={18} />
            Export PDF
          </button>
        </div>
      </div>

      {/* Campaign Meta - NOW ABOVE TABS */}
      <GlassPanel className="p-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
            <label className="block text-xs text-white/40 mb-2 uppercase tracking-wider font-medium">Client</label>
          <input
            value={meta.client}
            onChange={e => setMeta({ ...meta, client: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
          />
        </div>
        <div>
            <label className="block text-xs text-white/40 mb-2 uppercase tracking-wider font-medium">Campaign</label>
          <input
            value={meta.campaign}
            onChange={e => setMeta({ ...meta, campaign: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
          />
        </div>
        <div>
            <label className="block text-xs text-white/40 mb-2 uppercase tracking-wider font-medium">Start Date</label>
          <input
            value={meta.start_date}
            onChange={e => setMeta({ ...meta, start_date: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
          />
        </div>
        <div>
            <label className="block text-xs text-white/40 mb-2 uppercase tracking-wider font-medium">End Date</label>
          <input
            value={meta.end_date}
            onChange={e => setMeta({ ...meta, end_date: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
          />
        </div>
        </div>
      </GlassPanel>

      {/* Supplier Tabs - Dynamic based on uploaded data */}
      <div className="flex gap-1 p-1 bg-white/5 rounded-xl border border-white/10 w-fit">
        {availableTabs.map(supplier => {
          const count = supplier === 'All'
            ? platforms.length
            : platforms.filter(p => p.supplier === supplier).length;

          return (
            <button
              key={supplier}
              onClick={() => setActiveSupplier(supplier)}
              className={`px-4 py-2 text-sm font-medium transition-all duration-200 rounded-lg ${
                activeSupplier === supplier
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              {supplier} {count > 0 && <span className="ml-1 text-xs opacity-60">({count})</span>}
            </button>
          );
        })}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Total Impressions" value={consolidated.totalDelivered.toLocaleString()} />
        <KPICard
          label="Delivery %"
          value={`${consolidated.deliveryPercent.toFixed(2)}%`}
          status={consolidated.deliveryPercent > 98 ? 'good' : consolidated.deliveryPercent < 90 ? 'bad' : 'warning'}
        />
        <KPICard label="Total Clicks" value={consolidated.totalClicks.toLocaleString()} />
        <KPICard label="CTR" value={`${consolidated.ctr.toFixed(2)}%`} />
      </div>

      {/* Main Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Platform Table / Buying Types Table (conditional based on tab) */}
          <GlassPanel className="overflow-hidden">
            {activeSupplier === 'All' ? (
              <>
                {/* All Suppliers View - Platform Performance */}
                <div className="p-4 border-b border-white/10 flex justify-between items-center">
              <h3 className="font-semibold text-white">Platform Performance</h3>
                  <span className="text-xs text-white/40 bg-white/5 px-2 py-1 rounded-md">{consolidated.filteredCount} Sources</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                    <thead className="bg-white/5 text-white/40 uppercase text-xs">
                      <tr>
                        <th className="px-4 py-3 font-medium">Platform</th>
                        <th className="px-4 py-3 text-right font-medium">Planned</th>
                        <th className="px-4 py-3 text-right font-medium">Delivered</th>
                        <th className="px-4 py-3 text-right font-medium">Delivery %</th>
                        <th className="px-4 py-3 text-right font-medium">Clicks</th>
                        <th className="px-4 py-3 text-right font-medium">CTR</th>
                        <th className="px-4 py-3 w-12"></th>
                  </tr>
                </thead>
                    <tbody className="divide-y divide-white/5">
                      {platforms.map(p => {
                    const delPct = p.planned_impressions > 0 ? (p.delivered_impressions / p.planned_impressions) * 100 : 0;
                    const ctr = p.delivered_impressions > 0 ? (p.clicks / p.delivered_impressions) * 100 : 0;
                        const isExpanded = expandedPlatforms.has(p.id);
                        const hasBuyingLines = p.buying_lines && p.buying_lines.length > 0;
                        
                        const toggleExpand = () => {
                          setExpandedPlatforms(prev => {
                            const next = new Set(prev);
                            if (next.has(p.id)) {
                              next.delete(p.id);
                            } else {
                              next.add(p.id);
                            }
                            return next;
                          });
                        };
                        
                    return (
                          <React.Fragment key={p.id}>
                            <tr className="hover:bg-white/5 transition-colors group">
                              <td className="px-4 py-3.5 font-medium text-white">
                                <div className="flex items-center gap-2">
                                  {hasBuyingLines && (
                                    <button 
                                      onClick={toggleExpand}
                                      className="text-white/40 hover:text-white transition-colors"
                                    >
                                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                    </button>
                                  )}
                                  <span className={hasBuyingLines ? '' : 'ml-6'}>{p.name}</span>
                                  {hasBuyingLines && (
                                    <span className="text-xs text-white/30 ml-1">({p.buying_lines.length} lines)</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3.5 text-right text-white/60">{p.planned_impressions.toLocaleString()}</td>
                              <td className="px-4 py-3.5 text-right text-white font-medium">{p.delivered_impressions.toLocaleString()}</td>
                              <td className={`px-4 py-3.5 text-right font-semibold ${delPct >= 100 ? 'text-green-400' : delPct >= 95 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {delPct.toFixed(2)}%
                        </td>
                              <td className="px-4 py-3.5 text-right text-white/60">{p.clicks.toLocaleString()}</td>
                              <td className="px-4 py-3.5 text-right text-white">{ctr.toFixed(2)}%</td>
                              <td className="px-4 py-3.5 text-right">
                          <button
                            onClick={() => setPlatforms(platforms.filter(x => x.id !== p.id))}
                                  className="text-white/20 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                            {/* Buying Lines Breakdown */}
                            {isExpanded && hasBuyingLines && (
                              <tr>
                                <td colSpan={7} className="p-0">
                                  <div className="bg-white/[0.02] border-t border-white/5">
                                    <table className="w-full text-sm">
                                      <thead className="bg-white/[0.03] text-white/30 text-xs uppercase">
                                        <tr>
                                          <th className="px-6 py-2 text-left font-medium pl-14">Buying Type</th>
                                          <th className="px-4 py-2 text-right font-medium">Planned</th>
                                          <th className="px-4 py-2 text-right font-medium">Delivered</th>
                                          <th className="px-4 py-2 text-right font-medium">Delivery %</th>
                                          <th className="px-4 py-2 text-right font-medium">VTR</th>
                                          <th className="px-4 py-2 text-right font-medium">Clicks</th>
                                          <th className="px-4 py-2 text-right font-medium">CTR</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-white/[0.03]">
                                        {p.buying_lines.map((line, idx) => (
                                          <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="px-6 py-2.5 text-white/80 pl-14 truncate max-w-[200px]" title={line.buying_type}>
                                              {line.buying_type}
                                            </td>
                                            <td className="px-4 py-2.5 text-right text-white/50">{line.planned_impressions.toLocaleString()}</td>
                                            <td className="px-4 py-2.5 text-right text-white/70">{line.delivered_impressions.toLocaleString()}</td>
                                            <td className={`px-4 py-2.5 text-right font-medium ${
                                              line.delivery_percent >= 100 ? 'text-green-400/80' : 
                                              line.delivery_percent >= 95 ? 'text-yellow-400/80' : 'text-red-400/80'
                                            }`}>
                                              {line.delivery_percent.toFixed(2)}%
                                            </td>
                                            <td className="px-4 py-2.5 text-right text-white/50">{(line.vtr * 100).toFixed(1)}%</td>
                                            <td className="px-4 py-2.5 text-right text-white/50">{line.clicks.toLocaleString()}</td>
                                            <td className="px-4 py-2.5 text-right text-white/70">{line.ctr.toFixed(2)}%</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                    );
                  })}
                  {consolidated.filteredCount === 0 && (
                    <tr>
                          <td colSpan={7} className="px-4 py-12 text-center text-white/40">
                            <Upload className="mx-auto h-8 w-8 mb-2 opacity-50" />
                        No data available. Upload files or add manual entry.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
              </>
            ) : (
              <>
                {/* Individual Supplier View - Buying Types */}
                {(() => {
                  const filteredPlatforms = platforms.filter(p => p.supplier === activeSupplier);
                  // Include platformId and lineIdx with each buying line for editing
                  const allBuyingLines = filteredPlatforms.flatMap(p => 
                    (p.buying_lines || []).map((line, lineIdx) => ({
                      ...line,
                      _platformId: p.id,
                      _lineIdx: lineIdx
                    }))
                  );
                  const sourceFiles = [...new Set(filteredPlatforms.map(p => p.source_file).filter(Boolean))];
                  
                  // Sort buying lines
                  const sortedBuyingLines = [...allBuyingLines].sort((a, b) => {
                    const aVal = a[buyingSortKey] ?? 0;
                    const bVal = b[buyingSortKey] ?? 0;
                    if (typeof aVal === 'string' && typeof bVal === 'string') {
                      return buyingSortDir === 'desc' 
                        ? bVal.localeCompare(aVal) 
                        : aVal.localeCompare(bVal);
                    }
                    return buyingSortDir === 'desc' 
                      ? (bVal as number) - (aVal as number) 
                      : (aVal as number) - (bVal as number);
                  });
                  
                  // Sortable header component
                  const SortHeader = ({ label, sortKey, align = 'right' }: { label: string; sortKey: keyof BuyingLine; align?: 'left' | 'right' }) => (
                    <th 
                      className={`px-4 py-3 font-medium cursor-pointer hover:text-white/60 transition-colors select-none ${align === 'left' ? 'text-left' : 'text-right'}`}
                      onClick={() => handleBuyingSort(sortKey)}
                    >
                      <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
                        {label}
                        {buyingSortKey === sortKey ? (
                          buyingSortDir === 'desc' ? <ChevronDown size={14} /> : <ChevronUp size={14} />
                        ) : (
                          <ArrowUpDown size={12} className="opacity-30" />
                        )}
          </div>
                    </th>
                  );
                  
                  return (
                    <>
                      <div className="p-4 border-b border-white/10 flex justify-between items-center">
                        <h3 className="font-semibold text-white">Buying Types</h3>
                        <span className="text-xs text-white/40 bg-white/5 px-2 py-1 rounded-md">
                          {allBuyingLines.length} Line Items
                        </span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                          <thead className="bg-white/5 text-white/40 uppercase text-xs">
                            <tr>
                              <SortHeader label="Buying Type" sortKey="buying_type" align="left" />
                              <SortHeader label="Planned" sortKey="planned_impressions" />
                              <SortHeader label="Delivered" sortKey="delivered_impressions" />
                              <SortHeader label="Delivery %" sortKey="delivery_percent" />
                              <SortHeader label="VTR" sortKey="vtr" />
                              <SortHeader label="Clicks" sortKey="clicks" />
                              <SortHeader label="CTR" sortKey="ctr" />
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {sortedBuyingLines.length > 0 ? (
                              sortedBuyingLines.map((line, idx) => {
                                const isEditing = editingBuyingType?.platformId === line._platformId && 
                                                  editingBuyingType?.lineIdx === line._lineIdx;
                                
                                return (
                                <tr key={idx} className="hover:bg-white/5 transition-colors">
                                  <td 
                                    className="px-4 py-3.5 text-white font-medium min-w-[200px] max-w-[280px]" 
                                    title={isEditing ? undefined : `${line.buying_type}\n(Double-click to edit)`}
                                    onDoubleClick={() => !isEditing && startEditingBuyingType(line._platformId, line._lineIdx, line.buying_type)}
                                  >
                                    {isEditing ? (
                                      <input
                                        type="text"
                                        value={editingName}
                                        onChange={(e) => setEditingName(e.target.value)}
                                        onBlur={saveEditedBuyingType}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') saveEditedBuyingType();
                                          if (e.key === 'Escape') setEditingBuyingType(null);
                                        }}
                                        autoFocus
                                        className="w-full bg-white/10 border border-blue-500/50 rounded px-2 py-1 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/30"
                                      />
                                    ) : (
                                      <div className="flex items-center gap-2">
                                        <span className="block truncate cursor-pointer hover:text-blue-400 transition-colors">
                                          {line.buying_type}
                                        </span>
                                        {line.is_inferred && (
                                          <div className="flex items-center gap-1 flex-shrink-0">
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                              Inferred
                                            </span>
                                            <Pencil 
                                              size={12} 
                                              className="text-white/40 hover:text-blue-400 cursor-pointer transition-colors"
                                              onClick={() => startEditingBuyingType(line._platformId, line._lineIdx, line.buying_type)}
                                            />
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-4 py-3.5 text-right text-white/60">{line.planned_impressions.toLocaleString()}</td>
                                  <td className="px-4 py-3.5 text-right text-white font-medium">{line.delivered_impressions.toLocaleString()}</td>
                                  <td className={`px-4 py-3.5 text-right font-semibold ${
                                    line.delivery_percent >= 100 ? 'text-green-400' : 
                                    line.delivery_percent >= 95 ? 'text-yellow-400' : 'text-red-400'
                                  }`}>
                                    {line.delivery_percent.toFixed(2)}%
                                  </td>
                                  <td className="px-4 py-3.5 text-right text-white/60">{(line.vtr * 100).toFixed(1)}%</td>
                                  <td className="px-4 py-3.5 text-right text-white/60">{line.clicks.toLocaleString()}</td>
                                  <td className="px-4 py-3.5 text-right text-white">{line.ctr.toFixed(2)}%</td>
                                </tr>
                              );
                              })
                            ) : (
                              <tr>
                                <td colSpan={7} className="px-4 py-12 text-center text-white/40">
                                  <Upload className="mx-auto h-8 w-8 mb-2 opacity-50" />
                                  No buying type data available for {activeSupplier}.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                      {/* Source Files Pills */}
                      {sourceFiles.length > 0 && (
                        <div className="p-4 border-t border-white/10">
                          <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Sources</p>
                          <div className="flex flex-wrap gap-2">
                            {sourceFiles.map((file, idx) => (
                              <span 
                                key={idx}
                                className="inline-flex items-center px-3 py-1.5 rounded-full bg-white/5 text-xs text-white/70 border border-white/10"
                                title={file}
                              >
                                {file && file.length > 30 ? file.substring(0, 27) + '...' : file}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </>
            )}
          </GlassPanel>

          {/* Upload Zone */}
          <div
            className={`relative border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-300 ${
              isDragging 
                ? 'border-blue-500 bg-blue-500/10 scale-[1.01]' 
                : isProcessingAI
                  ? 'border-purple-500/50 bg-purple-500/5'
                  : 'border-white/20 hover:border-white/30 bg-white/[0.02]'
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
          >
            {/* AI Toggle */}
            <div className="absolute top-3 right-3">
              <button
                onClick={() => setUseAiParsing(!useAiParsing)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  useAiParsing 
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' 
                    : 'bg-white/5 text-white/40 border border-white/10'
                }`}
                title={useAiParsing ? 'AI-powered PDF extraction enabled' : 'Basic PDF extraction'}
              >
                <Sparkles size={14} className={useAiParsing ? 'text-purple-400' : ''} />
                AI Extract
              </button>
            </div>
            
            {isProcessingAI ? (
              <div className="py-4">
                <Loader2 className="mx-auto h-12 w-12 mb-4 text-purple-400 animate-spin" />
                <p className="text-white font-medium mb-1">Analyzing with AI...</p>
                <p className="text-sm text-purple-300/60">Extracting data from PDF using Gemini Vision</p>
              </div>
            ) : (
              <>
                <div className={`transition-transform duration-300 ${isDragging ? 'scale-110' : ''}`}>
                  <Upload className={`mx-auto h-12 w-12 mb-4 transition-colors ${isDragging ? 'text-blue-400' : 'text-white/30'}`} />
                </div>
            <p className="text-white font-medium mb-1">Drag & Drop Log Files</p>
                <p className="text-sm text-white/40 mb-5">Supports Sky CSV, Channel 4 Excel, ITV PDF</p>
                <label className="cursor-pointer inline-flex items-center gap-2 bg-white/10 hover:bg-white/15 text-white px-5 py-2.5 rounded-xl border border-white/10 transition-all duration-200 text-sm font-medium">
              Browse Files
              <input type="file" multiple className="hidden" onChange={async (e) => {
                if (e.target.files) {
                  for (const file of Array.from(e.target.files)) {
                    await processFile(file);
                  }
                }
              }} accept=".csv, .xlsx, .xls, .pdf" />
            </label>
              </>
            )}
          </div>
        </div>

        {/* Right Side */}
        <div className="space-y-6">
          {/* Device Mix */}
          <GlassPanel className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider">Device Mix</h3>
              {activeSupplier === 'All' ? (
                /* On All tab: show info text only, no edit capability */
                consolidated.hasInferredDeviceData && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    Contains Inferred Data
                  </span>
                )
              ) : (
                /* On individual supplier tabs: show badge + edit icon */
                <div className="flex items-center gap-1.5">
                  {consolidated.hasInferredDeviceData && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      Inferred
                    </span>
                  )}
                  <span title="Edit device mix">
                    <Pencil 
                      size={12} 
                      className="text-white/40 hover:text-blue-400 cursor-pointer transition-colors"
                      onClick={() => {
                        if (editingDeviceMix) {
                          setEditingDeviceMix(null);
                        } else {
                          // Calculate current mix percentages from consolidated data
                          const total = consolidated.deviceMix.reduce((s, d) => s + d.value, 0);
                          if (total > 0) {
                            setDeviceMixValues({
                              mobile: Math.round((consolidated.deviceMix[0].value / total) * 100),
                              desktop: Math.round((consolidated.deviceMix[1].value / total) * 100),
                              tv: Math.round((consolidated.deviceMix[2].value / total) * 100)
                            });
                          }
                          setEditingDeviceMix('global');
                        }
                      }}
                    />
                  </span>
                </div>
              )}
            </div>
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={consolidated.deviceMix}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                  >
                    {consolidated.deviceMix.map((_, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={index === 0 ? '#3B82F6' : index === 1 ? '#10B981' : '#F59E0B'} 
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ 
                      backgroundColor: '#1a1a2e', 
                      borderColor: 'rgba(255,255,255,0.2)', 
                      borderRadius: '8px',
                      color: '#ffffff',
                      padding: '8px 12px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                    }}
                    itemStyle={{ color: '#ffffff' }}
                    labelStyle={{ color: '#ffffff', fontWeight: 'bold' }}
                    formatter={(value: number, name: string) => {
                      const total = consolidated.deviceMix.reduce((s, d) => s + d.value, 0);
                      const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
                      return [`${pct}%`, name];
                    }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    formatter={(value) => <span className="text-white/70 text-xs">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            {/* Inline Device Mix Sliders - only on individual supplier tabs */}
            {editingDeviceMix && activeSupplier !== 'All' && (
              <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-white/60 w-16">Mobile</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={deviceMixValues.mobile}
                      onChange={(e) => updateDeviceMixValue('mobile', parseInt(e.target.value))}
                      className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-blue-500"
                    />
                    <span className="text-xs text-white w-10 text-right">{deviceMixValues.mobile}%</span>
          </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-white/60 w-16">Desktop</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={deviceMixValues.desktop}
                      onChange={(e) => updateDeviceMixValue('desktop', parseInt(e.target.value))}
                      className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-emerald-500"
                    />
                    <span className="text-xs text-white w-10 text-right">{deviceMixValues.desktop}%</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-white/60 w-16">Big Screen</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={deviceMixValues.tv}
                      onChange={(e) => updateDeviceMixValue('tv', parseInt(e.target.value))}
                      className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-amber-500"
                    />
                    <span className="text-xs text-white w-10 text-right">{deviceMixValues.tv}%</span>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setEditingDeviceMix(null)}
                    className="px-3 py-1.5 text-xs text-white/60 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveDeviceMix}
                    className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}
          </GlassPanel>
          
          {/* Daily Impressions Chart */}
          {consolidated.dailyData.length > 0 && (
            <GlassPanel className="p-6">
              <h3 className="text-xs font-semibold text-white/40 mb-4 uppercase tracking-wider">Daily Impressions</h3>
              <div className="h-[180px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={consolidated.dailyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="impressionGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                      tickLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                      axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                    />
                    <YAxis 
                      tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                      tickLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                      axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                      tickFormatter={(value) => value >= 1000 ? `${(value/1000).toFixed(0)}K` : value}
                    />
                    <Tooltip
                      contentStyle={{ 
                        backgroundColor: '#1a1a2e', 
                        borderColor: 'rgba(255,255,255,0.2)', 
                        borderRadius: '8px',
                        color: '#ffffff'
                      }}
                      formatter={(value: number) => [value.toLocaleString(), 'Impressions']}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="impressions" 
                      stroke="#3B82F6" 
                      fillOpacity={1} 
                      fill="url(#impressionGradient)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              {/* Warning for incomplete daily data */}
              {!consolidated.dailyDataComplete && consolidated.dailyData.length > 0 && (
                <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2 text-amber-400">
                  <AlertTriangle size={14} />
                  <span className="text-xs">
                    Daily totals ({consolidated.dailyTotal.toLocaleString()}) don't match delivered impressions ({consolidated.totalDelivered.toLocaleString()}) — data may be incomplete
                  </span>
                </div>
              )}
            </GlassPanel>
          )}
          
          {/* Daypart Distribution Chart */}
          {consolidated.daypartData.length > 0 && (
            <GlassPanel className="p-6">
              <h3 className="text-xs font-semibold text-white/40 mb-4 uppercase tracking-wider">Daypart Distribution</h3>
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={consolidated.daypartData} 
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis 
                      type="number"
                      tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                      tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
                      domain={[0, 'auto']}
                    />
                    <YAxis 
                      type="category" 
                      dataKey="name"
                      tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 10 }}
                      width={60}
                    />
                    <Tooltip
                      contentStyle={{ 
                        backgroundColor: '#1a1a2e', 
                        borderColor: 'rgba(255,255,255,0.2)', 
                        borderRadius: '8px',
                        color: '#ffffff'
                      }}
                      formatter={(value: number, _name: string, props: any) => [
                        `${(value * 100).toFixed(1)}%`,
                        props.payload.label || 'Share'
                      ]}
                    />
                    <Bar 
                      dataKey="value" 
                      fill="#10B981"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {/* Warning for incomplete daypart data */}
              {!consolidated.daypartComplete && consolidated.daypartData.length > 0 && (
                <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2 text-amber-400">
                  <AlertTriangle size={14} />
                  <span className="text-xs">
                    Daypart data doesn't sum to 100% — data may be incomplete or inferred
                  </span>
                </div>
              )}
            </GlassPanel>
          )}

          {/* Top Content */}
          <GlassPanel className="overflow-hidden">
            <div className="p-4 border-b border-white/10">
              <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider">Top 5 Content</h3>
            </div>
            <div className="divide-y divide-white/5">
              {consolidated.top5Shows.map((show, idx) => (
                <div key={idx} className="p-3.5 flex justify-between items-center hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className={`flex items-center justify-center w-6 h-6 rounded-lg text-xs font-bold ${
                      idx === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                      idx === 1 ? 'bg-gray-400/20 text-gray-300' :
                      idx === 2 ? 'bg-orange-500/20 text-orange-400' :
                      'bg-white/10 text-white/40'
                    }`}>
                      {idx + 1}
                    </span>
                    <span className="text-sm text-white truncate max-w-[140px]">{show.title}</span>
                  </div>
                  <span className="text-xs font-medium text-blue-400">{show.impressions.toLocaleString()}</span>
                </div>
              ))}
              {consolidated.top5Shows.length === 0 && (
                <div className="p-6 text-center text-sm text-white/30">No content data found</div>
              )}
            </div>
          </GlassPanel>
        </div>
      </div>

      {/* Manual Entry Modal */}
      {showManualModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-[#1a1a2e] to-[#0f0f1a] p-6 rounded-2xl border border-white/10 w-full max-w-lg space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Add Manual Platform</h2>
              <button 
                onClick={() => setShowManualModal(false)}
                className="text-white/40 hover:text-white transition-colors"
              >
                <Trash2 size={18} />
              </button>
            </div>
            <div className="space-y-4">
              {/* Supplier Selection */}
              <div className="grid grid-cols-2 gap-4">
              <div>
                  <label className="block text-xs text-white/40 mb-2 uppercase tracking-wider font-medium">Supplier</label>
                  <select
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
                    value={manualEntry.supplier || 'Linear TV'}
                    onChange={e => setManualEntry({ ...manualEntry, supplier: e.target.value as PlatformData['supplier'] })}
                  >
                    <option value="Sky">Sky</option>
                    <option value="Channel 4">Channel 4</option>
                    <option value="ITV">ITV</option>
                    <option value="Linear TV">Linear TV</option>
                    <option value="Other">Other (Custom)</option>
                  </select>
                </div>
                {/* Platform Name - shown for all, but required for "Other" */}
                <div>
                  <label className="block text-xs text-white/40 mb-2 uppercase tracking-wider font-medium">
                    {manualEntry.supplier === 'Other' ? 'Custom Name *' : 'Platform Name'}
                  </label>
                <input
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
                    value={manualEntry.supplier === 'Other' ? manualEntry.customName : manualEntry.name}
                    onChange={e => manualEntry.supplier === 'Other' 
                      ? setManualEntry({ ...manualEntry, customName: e.target.value })
                      : setManualEntry({ ...manualEntry, name: e.target.value })
                    }
                    placeholder={manualEntry.supplier === 'Other' ? 'e.g., Custom Platform' : `e.g., ${manualEntry.supplier || 'Linear TV'} Campaign`}
                />
              </div>
              </div>
              
              {/* Impressions */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-white/40 mb-2 uppercase tracking-wider font-medium">Planned Impressions</label>
                  <input
                    type="number"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
                    value={manualEntry.planned_impressions || ''}
                    onChange={e => setManualEntry({ ...manualEntry, planned_impressions: Number(e.target.value) })}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-2 uppercase tracking-wider font-medium">Delivered Impressions</label>
                  <input
                    type="number"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
                    value={manualEntry.delivered_impressions || ''}
                    onChange={e => setManualEntry({ ...manualEntry, delivered_impressions: Number(e.target.value) })}
                    placeholder="0"
                  />
                </div>
              </div>
              
              {/* Clicks, VTR, Frequency */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-white/40 mb-2 uppercase tracking-wider font-medium">Clicks</label>
                  <input
                    type="number"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
                    value={manualEntry.clicks || ''}
                    onChange={e => setManualEntry({ ...manualEntry, clicks: Number(e.target.value) })}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-2 uppercase tracking-wider font-medium">VTR (0-1)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
                    value={manualEntry.vtr || ''}
                    onChange={e => setManualEntry({ ...manualEntry, vtr: Number(e.target.value) })}
                    placeholder="0.95"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-2 uppercase tracking-wider font-medium">Frequency</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
                    value={manualEntry.frequency || ''}
                    onChange={e => setManualEntry({ ...manualEntry, frequency: Number(e.target.value) || undefined })}
                    placeholder="3.5"
                  />
              </div>
            </div>
              
              {/* Device Split */}
              <div>
                <label className="block text-xs text-white/40 mb-2 uppercase tracking-wider font-medium">
                  Device Split (%)
                  {(() => {
                    const total = (manualEntry.device_split?.mobile || 0) + 
                                  (manualEntry.device_split?.desktop || 0) + 
                                  (manualEntry.device_split?.tv || 0);
                    return total !== 100 && total > 0 ? (
                      <span className="ml-2 text-amber-400">
                        Total: {total}% (will be normalized to 100%)
                      </span>
                    ) : null;
                  })()}
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] text-white/30 mb-1">Mobile</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
                      value={manualEntry.device_split?.mobile || ''}
                      onChange={e => setManualEntry({ 
                        ...manualEntry, 
                        device_split: { 
                          ...manualEntry.device_split!, 
                          mobile: Number(e.target.value) 
                        } 
                      })}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-white/30 mb-1">Desktop</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
                      value={manualEntry.device_split?.desktop || ''}
                      onChange={e => setManualEntry({ 
                        ...manualEntry, 
                        device_split: { 
                          ...manualEntry.device_split!, 
                          desktop: Number(e.target.value) 
                        } 
                      })}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-white/30 mb-1">Big Screen</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
                      value={manualEntry.device_split?.tv || ''}
                      onChange={e => setManualEntry({ 
                        ...manualEntry, 
                        device_split: { 
                          ...manualEntry.device_split!, 
                          tv: Number(e.target.value) 
                        } 
                      })}
                      placeholder="100"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowManualModal(false)}
                className="px-4 py-2.5 rounded-xl text-white/50 hover:text-white hover:bg-white/5 transition-all font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleManualSubmit}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white transition-all font-medium shadow-lg shadow-blue-500/20"
              >
                Add Platform
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
