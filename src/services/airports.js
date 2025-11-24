// Basic airport database
// In a real app, this might come from an API or a larger database

export const airports = {
    DVN: {
        code: 'DVN',
        name: 'Davenport Municipal Airport',
        lat: 41.61,
        lon: -90.58,
        runways: [
            { id: '15', heading: 150 },
            { id: '33', heading: 330 },
            { id: '03', heading: 30 },
            { id: '21', heading: 210 }
        ]
    },
    ORD: {
        code: 'ORD',
        name: 'Chicago O\'Hare International Airport',
        lat: 41.98,
        lon: -87.90,
        runways: [
            { id: '10L', heading: 100 },
            { id: '28R', heading: 280 },
            // ... simplified
        ]
    },
    DSM: {
        code: 'DSM',
        name: 'Des Moines International Airport',
        lat: 41.53,
        lon: -93.66,
        runways: [
            { id: '05', heading: 50 },
            { id: '23', heading: 230 },
            { id: '13', heading: 130 },
            { id: '31', heading: 310 }
        ]
    }
};

export const getAirport = (code) => {
    return airports[code.toUpperCase()] || null;
};
