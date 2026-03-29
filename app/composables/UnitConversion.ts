export const useUnitConversion = () => {
    const { activeSettings } = useSettings();

    const kmToUserUnits = (value: number | null | undefined) => {
        if (value == null) return 0;
        return activeSettings.value.units === "metric"
            ? value
            : Math.round(value * 0.621371);
    };

    const literToUserUnits = (value: number | null | undefined) => {
        if (value == null) return 0;
        return activeSettings.value.units === "metric"
            ? value
            : Math.round(value * 0.264172);
    };

    const formatDistanceValue = (value: number | null | undefined) => {
        if (value == null || !Number.isFinite(value)) return "0.00";

        const converted =
            activeSettings.value.units === "metric"
                ? value
                : value * 0.621371;

        if (converted < 1) return converted.toFixed(2);
        if (converted < 10) return converted.toFixed(2);
        if (converted < 100) return converted.toFixed(1);
        return Math.round(converted).toString();
    };

    const speedUnit = computed(() =>
        activeSettings.value.units === "metric" ? "km/h" : "mph",
    );

    const distanceUnit = computed(() =>
        activeSettings.value.units === "metric" ? "km" : "mi",
    );

    const fuelUnit = computed(() =>
        activeSettings.value.units === "metric" ? "L" : "gal",
    );

    return {
        kmToUserUnits,
        literToUserUnits,
        formatDistanceValue,
        speedUnit,
        distanceUnit,
        fuelUnit,
    };
};
