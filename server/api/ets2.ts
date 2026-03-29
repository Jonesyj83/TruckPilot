import { defineEventHandler, getHeader } from "h3";

const DEFAULT_TELEMETRY_ENDPOINT =
    "http://127.0.0.1:31377/api/ets2/telemetry";

export default defineEventHandler(async (event) => {
    try {
        const requestedEndpoint = getHeader(
            event,
            "x-telemetry-endpoint",
        )?.trim();
        const telemetryEndpoint =
            requestedEndpoint || DEFAULT_TELEMETRY_ENDPOINT;

        const data = await $fetch(telemetryEndpoint, {
            timeout: 1500,
            retry: 0,
        });
        return {
            connected: true,
            telemetry: data,
            endpoint: telemetryEndpoint,
        };
    } catch (error: any) {
        return {
            connected: false,
            telemetry: null,
            status: "Telemetry server is starting or disconnected...",
        };
    }
});
