// Import comprehensive airport database from JSON
import airportsData from './airports.json';

// Re-export the airports data
export const airports = airportsData;

// Helper function to get a specific airport by code
export const getAirport = (code) => {
    return airports[code.toUpperCase()] || null;
};

