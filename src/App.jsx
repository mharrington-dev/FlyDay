import { useState, useEffect } from 'react'
import { format, addDays, parseISO, getHours } from 'date-fns'
import { Plane, Wind, AlertTriangle, CheckCircle2, XCircle, Calendar, Clock, MapPin } from 'lucide-react'
import { getAirport, airports } from './services/airports.js'
import { fetchWeather, getWeatherCodeDescription } from './services/weather'
import { calculateAllRunwayCrosswinds } from './utils/windCalc'

function App() {
  // State for inputs
  const [airportCode, setAirportCode] = useState('DVN')
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(addDays(new Date(), 2), 'yyyy-MM-dd'))
  const [startHour, setStartHour] = useState(6)
  const [endHour, setEndHour] = useState(21) // 9 PM

  // State for limits
  const [maxSurfaceWind, setMaxSurfaceWind] = useState(15)
  const [maxCrosswind, setMaxCrosswind] = useState(7)
  const [maxGust, setMaxGust] = useState(8)

  // State for data
  const [weatherData, setWeatherData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [airportInfo, setAirportInfo] = useState(airports['DVN'])

  // State for type-ahead search
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [filteredAirports, setFilteredAirports] = useState([])

  // Handle airport change with type-ahead
  const handleAirportChange = (e) => {
    const value = e.target.value;
    setAirportCode(value);

    if (!value || value.trim() === '') {
      setShowSuggestions(false);
      setFilteredAirports([]);
      setAirportInfo(null);
      return;
    }

    // Extract code if format is "CODE : City, State"
    const code = value.split(':')[0].trim().toUpperCase();

    // Filter airports for suggestions
    const searchTerm = value.toLowerCase();
    const matches = Object.values(airports)
      .filter(airport => {
        if (!airport || !airport.code) return false;
        return (
          airport.code.toLowerCase().includes(searchTerm) ||
          (airport.city && airport.city.toLowerCase().includes(searchTerm)) ||
          (airport.state && airport.state.toLowerCase().includes(searchTerm)) ||
          (airport.name && airport.name.toLowerCase().includes(searchTerm))
        );
      })
      .slice(0, 10); // Limit to 10 suggestions

    setFilteredAirports(matches);
    setShowSuggestions(matches.length > 0 && value.length > 0);

    // Check for exact match
    const info = airports[code];
    if (info) {
      setAirportInfo(info);
      setError(null);
    } else {
      setAirportInfo(null);
    }
  }

  // Handle selecting an airport from suggestions
  const handleSelectAirport = (airport) => {
    if (!airport || !airport.code) return;
    setAirportCode(airport.code);
    setAirportInfo(airport);
    setShowSuggestions(false);
    setFilteredAirports([]);
    setError(null);
  }

  // Fetch data
  const handleSearch = async () => {
    if (!airportInfo) {
      setError('Invalid airport code. Try DVN, ORD, or DSM.')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const data = await fetchWeather(airportInfo.lat, airportInfo.lon, startDate, endDate)
      setWeatherData(data)
    } catch (err) {
      setError('Failed to fetch weather data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Process data for display
  const processWeatherData = () => {
    if (!weatherData || !weatherData.hourly) return []

    const { time, wind_speed_10m, wind_direction_10m, wind_gusts_10m, weather_code, temperature_2m } = weatherData.hourly

    // Add defensive checks
    if (!time || !wind_speed_10m || !wind_direction_10m || !wind_gusts_10m || !airportInfo || !airportInfo.runways) {
      return []
    }

    const groupedByDay = {}

    time.forEach((t, index) => {
      const dateObj = parseISO(t)
      const hour = getHours(dateObj)
      const dateStr = format(dateObj, 'yyyy-MM-dd')

      // Filter by hour
      if (hour >= startHour && hour <= endHour) {
        if (!groupedByDay[dateStr]) {
          groupedByDay[dateStr] = []
        }

        const windSpeed = wind_speed_10m[index] || 0
        const windDir = wind_direction_10m[index] || 0
        const gust = wind_gusts_10m[index] || 0
        const temp = temperature_2m ? temperature_2m[index] : null

        // Calculate crosswind for ALL runways
        const runwayData = calculateAllRunwayCrosswinds(windSpeed, windDir, airportInfo.runways)

        // Get the best runway (first in sorted array)
        const bestRunway = runwayData.length > 0 ? runwayData[0] : null
        const bestCrosswind = bestRunway ? bestRunway.crosswind : 0

        // Check limits - overall status is ONLY based on surface wind and gust factor
        // Crosswind only affects individual runway display, not overall flyability
        const isSurfaceOk = windSpeed <= maxSurfaceWind
        const gustFactor = Math.max(0, gust - windSpeed)
        const isGustFactorOk = gustFactor <= maxGust

        // Overall status: green check if surface wind AND gust factor are OK
        // Individual runways will be colored based on their crosswind
        const isAllOk = isSurfaceOk && isGustFactorOk

        groupedByDay[dateStr].push({
          time: t,
          hour,
          windSpeed,
          windDir,
          gust,
          gustFactor,
          temperature: temp,
          runwayData, // All runways with their crosswinds
          bestRunway: bestRunway ? bestRunway.runway.id : 'N/A',
          weatherCode: weather_code ? weather_code[index] : 0,
          isAllOk,
          checks: { isSurfaceOk, isGustFactorOk }
        })
      }
    })

    return groupedByDay
  }

  const results = processWeatherData()

  return (
    <div className="min-h-screen bg-aviation-dark text-white font-sans flex flex-col">
      {/* Fixed Header */}
      <header className="bg-aviation-dark border-b border-gray-700 px-4 md:px-8 py-6 flex-shrink-0">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <Plane className="text-aviation-accent w-8 h-8" />
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
              FlyDay <span className="text-gray-400 font-light">| Wind Limit Checker</span>
            </h1>
          </div>
          <p className="text-gray-400 ml-11">Plan your flights safely with personal maximums.</p>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        <div className="max-w-7xl mx-auto w-full flex flex-col lg:flex-row gap-0">

          {/* Fixed Sidebar */}
          <aside className="lg:w-96 flex-shrink-0 bg-aviation-dark p-4 md:p-6 space-y-6 lg:overflow-y-auto lg:max-h-[calc(100vh-140px)]">

            {/* Flight Parameters */}
            <div className="bg-aviation-card p-6 rounded-xl shadow-lg border border-gray-700">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-aviation-accent">
                <MapPin className="w-5 h-5" /> Flight Parameters
              </h2>

              <div className="space-y-4">
                <div className="relative">
                  <label className="block text-sm text-gray-400 mb-1">Airport Code</label>
                  <input
                    type="text"
                    value={airportCode}
                    onChange={handleAirportChange}
                    onFocus={() => {
                      if (airportCode && !airportInfo) {
                        handleAirportChange({ target: { value: airportCode } })
                      }
                    }}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-aviation-accent focus:border-transparent outline-none uppercase font-mono"
                    placeholder="e.g., DVN"
                  />

                  {/* Type-ahead suggestions */}
                  {showSuggestions && filteredAirports.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredAirports.map(airport => (
                        <div
                          key={airport.code}
                          onClick={() => handleSelectAirport(airport)}
                          className="px-3 py-2 hover:bg-aviation-accent hover:text-aviation-dark cursor-pointer transition-colors border-b border-gray-700 last:border-b-0"
                        >
                          <span className="font-mono font-bold">{airport.code}</span>
                          <span className="text-gray-400"> : {airport.city}, {airport.state}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {airportInfo && <p className="text-xs text-gray-500 mt-1 truncate">{airportInfo.name}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-600 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-aviation-accent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">End Date</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-600 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-aviation-accent outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Start Hour</label>
                    <select
                      value={startHour}
                      onChange={(e) => setStartHour(Number(e.target.value))}
                      className="w-full bg-gray-800 border border-gray-600 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-aviation-accent outline-none"
                    >
                      {Array.from({ length: 24 }).map((_, i) => (
                        <option key={i} value={i}>{i}:00</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">End Hour</label>
                    <select
                      value={endHour}
                      onChange={(e) => setEndHour(Number(e.target.value))}
                      className="w-full bg-gray-800 border border-gray-600 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-aviation-accent outline-none"
                    >
                      {Array.from({ length: 24 }).map((_, i) => (
                        <option key={i} value={i}>{i}:00</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Personal Maximums */}
            <div className="bg-aviation-card p-6 rounded-xl shadow-lg border border-gray-700">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-aviation-accent">
                <Wind className="w-5 h-5" /> Personal Maximums (kts)
              </h2>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-sm text-gray-400">Max Surface Wind</label>
                    <span className="text-sm font-mono text-aviation-accent">{maxSurfaceWind} kt</span>
                  </div>
                  <input
                    type="range" min="0" max="40"
                    value={maxSurfaceWind}
                    onChange={(e) => setMaxSurfaceWind(Number(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-aviation-accent"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-sm text-gray-400">Max Crosswind</label>
                    <span className="text-sm font-mono text-aviation-accent">{maxCrosswind} kt</span>
                  </div>
                  <input
                    type="range" min="0" max="25"
                    value={maxCrosswind}
                    onChange={(e) => setMaxCrosswind(Number(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-aviation-accent"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-sm text-gray-400">Max Gust Factor</label>
                    <span className="text-sm font-mono text-aviation-accent">{maxGust} kt</span>
                  </div>
                  <input
                    type="range" min="0" max="20"
                    value={maxGust}
                    onChange={(e) => setMaxGust(Number(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-aviation-accent"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleSearch}
              disabled={loading}
              className="w-full bg-aviation-accent hover:bg-sky-400 text-aviation-dark font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading ? 'Loading...' : 'Check Weather'}
            </button>

            {error && (
              <div className="bg-red-900/50 border border-red-500/50 text-red-200 p-4 rounded-lg flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="text-sm">{error}</p>
              </div>
            )}
          </aside>

          {/* Scrollable Results Area */}
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:max-h-[calc(100vh-140px)]">
            {!weatherData ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-500 bg-aviation-card/30 rounded-xl border border-gray-800 border-dashed min-h-[400px]">
                <Wind className="w-16 h-16 mb-4 opacity-20" />
                <p>Enter parameters and search to see weather data.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(results).map(([date, hours]) => (
                  <div key={date} className="bg-aviation-card rounded-xl shadow-lg border border-gray-700 overflow-hidden">
                    <div className="bg-gray-800/50 p-4 border-b border-gray-700 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-aviation-accent" />
                      <h3 className="font-semibold text-lg">{format(parseISO(date), 'EEEE, MMMM do, yyyy')}</h3>
                    </div>

                    <div className="divide-y divide-gray-700/50">
                      {hours.map((h) => (
                        <div key={h.time} className="p-4 hover:bg-white/5 transition-colors">
                          <div className="flex items-start gap-4">
                            {/* Status Icon */}
                            <div className="shrink-0">
                              {h.isAllOk ? (
                                <CheckCircle2 className="w-8 h-8 text-aviation-success" />
                              ) : (
                                <XCircle className="w-8 h-8 text-aviation-danger" />
                              )}
                            </div>

                            {/* Time */}
                            <div className="w-16 shrink-0 text-center">
                              <span className="text-lg font-bold block">{h.hour}:00</span>
                            </div>

                            {/* Weather Details */}
                            <div className="flex-grow">
                              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 text-sm mb-3">
                                <div>
                                  <span className="block text-gray-400 text-xs uppercase tracking-wider">Conditions</span>
                                  <span className="font-medium text-white">{getWeatherCodeDescription(h.weatherCode)}</span>
                                </div>

                                {h.temperature !== null && (
                                  <div>
                                    <span className="block text-gray-400 text-xs uppercase tracking-wider">Temperature</span>
                                    <span className="font-mono text-white">{h.temperature.toFixed(1)}°F</span>
                                  </div>
                                )}

                                <div>
                                  <span className="block text-gray-400 text-xs uppercase tracking-wider">Surface Wind</span>
                                  <span className={`font-mono ${!h.checks.isSurfaceOk ? 'text-aviation-danger font-bold' : ''}`}>
                                    {h.windSpeed.toFixed(1)} kt @ {h.windDir}°
                                  </span>
                                </div>

                                <div>
                                  <span className="block text-gray-400 text-xs uppercase tracking-wider">Gust Factor</span>
                                  <span className={`font-mono ${!h.checks.isGustFactorOk ? 'text-aviation-danger font-bold' : ''}`}>
                                    {h.gustFactor.toFixed(1)} kt
                                  </span>
                                </div>
                              </div>

                              {/* All Runways Crosswinds */}
                              {h.runwayData && h.runwayData.length > 0 && (
                                <div className="mt-2">
                                  <span className="block text-gray-400 text-xs uppercase tracking-wider mb-1">Runway Crosswinds</span>
                                  <div className="flex flex-wrap gap-2">
                                    {h.runwayData.map((rwy, idx) => {
                                      const isOverLimit = rwy.crosswind > maxCrosswind;
                                      return (
                                        <div
                                          key={rwy.runway.id}
                                          className={`px-2 py-1 rounded text-xs font-mono ${idx === 0 && !isOverLimit
                                              ? 'bg-aviation-accent/20 border border-aviation-accent text-aviation-accent font-bold'
                                              : isOverLimit
                                                ? 'bg-red-900/30 border border-red-500/50 text-red-300'
                                                : 'bg-gray-700/50 border border-gray-600 text-gray-300'
                                            }`}
                                        >
                                          Rwy {rwy.runway.id}: {rwy.crosswind.toFixed(1)} kt
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      {hours.length === 0 && (
                        <div className="p-8 text-center text-gray-500">
                          No hours match the selected time range.
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}

export default App

