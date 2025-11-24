export const calculateComponents = (windSpeed, windDir, runwayHeading) => {
    // Convert degrees to radians
    const windRad = (windDir * Math.PI) / 180;
    const runwayRad = (runwayHeading * Math.PI) / 180;

    // Angle difference
    let angleDiff = windDir - runwayHeading;

    // Normalize to -180 to 180
    while (angleDiff <= -180) angleDiff += 360;
    while (angleDiff > 180) angleDiff -= 360;

    const diffRad = (angleDiff * Math.PI) / 180;

    // Crosswind = Speed * sin(angle)
    const crosswind = Math.abs(windSpeed * Math.sin(diffRad));

    // Headwind = Speed * cos(angle)
    // Positive = Headwind, Negative = Tailwind
    const headwind = windSpeed * Math.cos(diffRad);

    return {
        crosswind: Math.round(crosswind * 10) / 10,
        headwind: Math.round(headwind * 10) / 10
    };
};

export const getBestRunway = (windSpeed, windDir, runways) => {
    let bestRunway = null;
    let minCrosswind = Infinity;
    let maxHeadwind = -Infinity;

    for (const runway of runways) {
        const { crosswind, headwind } = calculateComponents(windSpeed, windDir, runway.heading);

        // We prioritize the runway with the best headwind (or least tailwind)
        // among those with acceptable crosswinds.
        // However, for this specific calculation, we usually just want the one 
        // most aligned with the wind.

        // Simple logic: Minimize angle difference -> Maximize Headwind
        // If headwind is higher, it's generally better.

        if (headwind > maxHeadwind) {
            maxHeadwind = headwind;
            minCrosswind = crosswind;
            bestRunway = runway;
        }
    }

    return {
        runway: bestRunway,
        crosswind: minCrosswind,
        headwind: maxHeadwind
    };
};
