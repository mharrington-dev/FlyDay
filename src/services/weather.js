
export const getWeatherCodeDescription = (code) => {
    const codes = {
        0: 'Clear sky',
        1: 'Mainly clear',
        2: 'Partly cloudy',
        3: 'Overcast',
        45: 'Fog',
        48: 'Depositing rime fog',
        51: 'Light drizzle',
        53: 'Moderate drizzle',
        55: 'Dense drizzle',
        56: 'Light freezing drizzle',
        57: 'Dense freezing drizzle',
        61: 'Slight rain',
        63: 'Moderate rain',
        65: 'Heavy rain',
        66: 'Light freezing rain',
        67: 'Heavy freezing rain',
        71: 'Slight snow',
        73: 'Moderate snow',
        75: 'Heavy snow',
        77: 'Snow grains',
        80: 'Slight rain showers',
        81: 'Moderate rain showers',
        82: 'Violent rain showers',
        85: 'Slight snow showers',
        86: 'Heavy snow showers',
        95: 'Thunderstorm',
        96: 'Thunderstorm with slight hail',
        99: 'Thunderstorm with heavy hail',
    };
    return codes[code] || 'Unknown';
};

export const fetchWeather = async (lat, lon, startDate, endDate) => {
    try {
        const params = new URLSearchParams({
            latitude: lat,
            longitude: lon,
            hourly: 'wind_speed_10m,wind_direction_10m,wind_gusts_10m,weather_code,temperature_2m',
            start_date: startDate, // YYYY-MM-DD
            end_date: endDate,     // YYYY-MM-DD
            wind_speed_unit: 'kn',
            temperature_unit: 'fahrenheit',
            timezone: 'auto'
        });

        const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
        if (!response.ok) throw new Error('Weather data fetch failed');

        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Error fetching weather:", error);
        throw error;
    }
};
