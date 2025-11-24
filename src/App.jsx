import { useState, useEffect } from 'react'
import { format, addDays, parseISO, getHours } from 'date-fns'
import { Plane, Wind, AlertTriangle, CheckCircle2, XCircle, Calendar, Clock, MapPin } from 'lucide-react'
import { getAirport, airports } from './services/airports'
import { fetchWeather, getWeatherCodeDescription } from './services/weather'
import { getBestRunway } from './utils/windCalc'

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
  const [airportInfo, setAirportInfo] = useState(getAirport('DVN'))

  // Handle airport change
  const handleAirportChange = (e) => {
    const code = e.target.value.toUpperCase()
    setAirportCode(code)
    const info = getAirport(code)
    if (info) {
      setAirportInfo(info)
      setError(null)
    } else {
      setAirportInfo(null)
      // Don't set error immediately, let them type
    }
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

    const { time, wind_speed_10m, wind_direction_10m, wind_gusts_10m, weather_code } = weatherData.hourly

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

        const windSpeed = wind_speed_10m[index]
        const windDir = wind_direction_10m[index]
        const gust = wind_gusts_10m[index]

        // Calculate crosswind using best runway
        const { runway, crosswind } = getBestRunway(windSpeed, windDir, airportInfo.runways)

        // Check limits
        const isSurfaceOk = windSpeed <= maxSurfaceWind
        const isCrosswindOk = crosswind <= maxCrosswind
        const isGustOk = (gust - windSpeed) <= maxGust // Gust factor usually means (Gust - Sustained) or just Max Gust? 
        // User said "max gust factor (default 8)". Usually "Gust Factor" is the difference between gust and sustained.
        // But sometimes people mean just raw gust speed.
        // "max gust factor" implies the spread. I will assume spread (Gust - Sustained).
        // Wait, standard aviation "Gust Factor" is often (Gust - Sustained).
        // Let's stick to that interpretation.
        const gustFactor = Math.max(0, gust - windSpeed)
        const isGustFactorOk = gustFactor <= maxGust

        const isAllOk = isSurfaceOk && isCrosswindOk && isGustFactorOk

        groupedByDay[dateStr].push({
          time: t,
          hour,
          windSpeed,
          windDir,
          gust,
          gustFactor,
          crosswind,
          bestRunway: runway.id,
          weatherCode: weather_code[index],
          isAllOk,
          checks: { isSurfaceOk, isCrosswindOk, isGustFactorOk }
        })
      }
    })

    return groupedByDay
  }

  const results = processWeatherData()

  return (
    <div className="min-h-screen bg-aviation-dark text-white p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="mb-8 border-b border-gray-700 pb-6">
          <div className="flex items-center gap-3 mb-2">
            <Plane className="text-aviation-accent w-8 h-8" />
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
              FlyDay <span className="text-gray-400 font-light">| Wind Limit Checker</span>
            </h1>
          </div>
          <p className="text-gray-400 ml-11">Plan your flights safely with personal minimums.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Sidebar / Controls */}
          <div className="lg:col-span-4 space-y-6">

            {/* Flight Parameters */}
            <div className="bg-aviation-card p-6 rounded-xl shadow-lg border border-gray-700">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-aviation-accent">
                <MapPin className="w-5 h-5" /> Flight Parameters
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Airport Code</label>
                  <input
                    type="text"
                    value={airportCode}
                    onChange={handleAirportChange}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-aviation-accent focus:border-transparent outline-none uppercase font-mono"
                    placeholder="e.g. DVN"
                  />
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

            {/* Personal Minimums */}
            <div className="bg-aviation-card p-6 rounded-xl shadow-lg border border-gray-700">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-aviation-accent">
                <Wind className="w-5 h-5" /> Personal Minimums (kts)
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
          </div>

          {/* Results Area */}
          <div className="lg:col-span-8">
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
                        <div key={h.time} className="p-4 hover:bg-white/5 transition-colors flex items-center gap-4">
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
                          <div className="flex-grow grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="block text-gray-400 text-xs uppercase tracking-wider">Conditions</span>
                              <span className="font-medium text-white">{getWeatherCodeDescription(h.weatherCode)}</span>
                            </div>

                            <div>
                              <span className="block text-gray-400 text-xs uppercase tracking-wider">Surface Wind</span>
                              <span className={`font-mono ${!h.checks.isSurfaceOk ? 'text-aviation-danger font-bold' : ''}`}>
                                {h.windSpeed.toFixed(1)} kt @ {h.windDir}°
                              </span>
                            </div>

                            <div>
                              <span className="block text-gray-400 text-xs uppercase tracking-wider">Crosswind</span>
                              <span className={`font-mono ${!h.checks.isCrosswindOk ? 'text-aviation-danger font-bold' : ''}`}>
                                {h.crosswind.toFixed(1)} kt (Rwy {h.bestRunway})
                              </span>
                            </div>

                            <div>
                              <span className="block text-gray-400 text-xs uppercase tracking-wider">Gust Factor</span>
                              <span className={`font-mono ${!h.checks.isGustFactorOk ? 'text-aviation-danger font-bold' : ''}`}>
                                {h.gustFactor.toFixed(1)} kt
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                      {hours.length === 0 && (
                        <div className="p-8 text-center text-gray-500">
                          No hours match the selected time range (6AM - 9PM).
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App

