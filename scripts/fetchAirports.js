import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const fetchCSV = (url) => {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(data));
            res.on('error', reject);
        });
    });
};

const parseCSV = (csv) => {
    const lines = csv.split('\n');
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());

    return lines.slice(1).map(line => {
        // Handle quoted commas
        const row = [];
        let inQuote = false;
        let current = '';

        for (let char of line) {
            if (char === '"') {
                inQuote = !inQuote;
            } else if (char === ',' && !inQuote) {
                row.push(current.replace(/"/g, '').trim());
                current = '';
            } else {
                current += char;
            }
        }
        row.push(current.replace(/"/g, '').trim());

        if (row.length < headers.length) return null;

        return headers.reduce((obj, header, i) => {
            obj[header] = row[i];
            return obj;
        }, {});
    }).filter(x => x);
};

const main = async () => {
    console.log('Fetching airports...');
    const airportsCSV = await fetchCSV('https://davidmegginson.github.io/ourairports-data/airports.csv');

    console.log('Fetching runways...');
    const runwaysCSV = await fetchCSV('https://davidmegginson.github.io/ourairports-data/runways.csv');

    console.log('Parsing data...');
    const allAirports = parseCSV(airportsCSV);
    const allRunways = parseCSV(runwaysCSV);

    console.log('Filtering US airports...');
    const usAirports = allAirports.filter(a =>
        a.iso_country === 'US' &&
        ['small_airport', 'medium_airport', 'large_airport'].includes(a.type)
    );

    console.log(`Found ${usAirports.length} US airports.`);

    const airportMap = {};

    usAirports.forEach(a => {
        // Use IATA if available, otherwise GPS code or local code
        // We prefer the 3-letter code everyone knows.
        // JFK has iata_code 'JFK'.
        const code = a.iata_code || a.local_code || a.ident;
        if (!code) return;

        // Clean up region (e.g. US-IA -> IA)
        const state = a.iso_region ? a.iso_region.replace('US-', '') : '';

        airportMap[a.id] = {
            code: code,
            name: a.name,
            city: a.municipality,
            state: state,
            lat: parseFloat(a.latitude_deg),
            lon: parseFloat(a.longitude_deg),
            runways: []
        };
    });

    console.log('Mapping runways...');
    allRunways.forEach(r => {
        const airport = airportMap[r.airport_ref];
        if (airport) {
            // Parse headings
            const le_heading = parseFloat(r.le_heading_degT);
            const he_heading = parseFloat(r.he_heading_degT);

            if (!isNaN(le_heading)) {
                airport.runways.push({
                    id: r.le_ident,
                    heading: le_heading,
                    length_ft: parseFloat(r.length_ft),
                    surface: r.surface
                });
            }

            if (!isNaN(he_heading)) {
                airport.runways.push({
                    id: r.he_ident,
                    heading: he_heading,
                    length_ft: parseFloat(r.length_ft),
                    surface: r.surface
                });
            }
        }
    });

    // Convert map to final object keyed by Code
    const finalDb = {};
    Object.values(airportMap).forEach(a => {
        if (a.runways.length > 0) {
            finalDb[a.code] = a;
        }
    });

    console.log(`Final database has ${Object.keys(finalDb).length} airports with runways.`);

    const outputPath = path.join(__dirname, '../src/services/airports.json');
    fs.writeFileSync(outputPath, JSON.stringify(finalDb, null, 2));
    console.log(`Written to ${outputPath}`);
};

main().catch(console.error);
